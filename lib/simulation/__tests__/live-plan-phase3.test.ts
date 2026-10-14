// Phase 3 of live plans: timed infusions and clinical end points (more blocks are added below as each part lands).
// Played through the real engine and the server's replay.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { validateSimulationCase } from "../validate-config";
import { checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan, REASSESS_ID, REFUSED, scoreBedside, type LivePlan } from "../live-plan";
import { playthroughs } from "../live-plan-playthrough";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

const MIN = 60;
const base = () => upgradeLegacyCase(goldenFixtureCase as unknown as Record<string, unknown>) as unknown as SimulationCaseConfig;
const errorsOf = (p: LivePlan) => checkLivePlan(p, measuredOnArrival(base())).errors.join(" | ");

// The shocked toddler (arrives HR 148, BP 86/54; stages at 6 and 12 min). The bolus runs over 4 minutes, and he
// counts as stabilised only once systolic is 90 or more.
function infusionRaw(bolus: Record<string, unknown> = {}, over: Record<string, unknown> = {}): Record<string, unknown> {
    const p = JSON.parse(JSON.stringify(goldenFixturePlan));
    p.treatments = p.treatments.map((t: Record<string, unknown>) => (t.id === "fluid_bolus_20ml_kg" ? { ...t, infusion: { over_minutes: 4 }, ...bolus } : t));
    p.end_points = { vital: "sbp", at_least: 90 };
    return { ...p, ...over };
}
const infusion = (bolus: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => normaliseLivePlan(infusionRaw(bolus, over), "ai");

function run(p: LivePlan, steps: Array<[string, number]>, until: number) {
    const c = compileLivePlan(base(), p);
    const engine = new EncounterEngine(c);
    for (const [a, m] of steps) engine.giveIntervention(a, m * MIN);
    engine.advanceTo(until * MIN);
    return { c, engine, score: scoreBedside(c, p, engine.events, until) };
}
const at = (p: LivePlan, steps: Array<[string, number]>, minute: number) => run(p, steps, minute).engine.state;

describe("timed infusions", () => {
    it("passes the check, and the compiled case passes the engine's validator", () => {
        assert.equal(errorsOf(infusion()), "");
        assert.deepEqual(validateSimulationCase(compileLivePlan(base(), infusion())).errors ?? [], []);
    });

    it("spreads the effect minute by minute, and the shares add up exactly", () => {
        // No IV access, so never stabilised: the whole infusion arrives. Effect hr -14, BP +8/+5 over 4 minutes.
        const steps: Array<[string, number]> = [["fluid_bolus_20ml_kg", 1]];
        assert.equal(at(infusion(), steps, 1).systolic, 86, "nothing at the moment it is started");
        assert.deepEqual([2, 3, 4, 5].map((m) => at(infusion(), steps, m).systolic), [88, 90, 92, 94]);
        const done = at(infusion(), steps, 5);
        assert.equal(done.rate, 148 - 14);
        assert.equal(done.diastolic, 54 + 5);
    });

    it("stops acting once the patient is stabilised, and he is stabilised only when the end point is reached", () => {
        const { engine, score } = run(infusion(), [["iv_access", 1], ["fluid_bolus_20ml_kg", 1]], 3);
        assert.equal(engine.state.flagSetAt.live_stabilised, 3 * MIN, "systolic reaches 90 at minute 3");
        assert.equal(run(infusion(), [["iv_access", 1], ["fluid_bolus_20ml_kg", 1]], 5).engine.state.systolic, 90, "no further shares after stabilisation");
        assert.equal(score.outcome.stabilised, true);
    });

    it("acts only while its condition holds", () => {
        const titrated = infusion({ infusion: { over_minutes: 4, while: { vital: "sbp", below: 89 } } });
        assert.equal(at(titrated, [["fluid_bolus_20ml_kg", 1]], 5).systolic, 90, "two shares (to 88, then 90) and then it stops");
    });

    it("an end point that is never reached means never stabilised, however complete the path", () => {
        const high = infusion({}, { end_points: { vital: "sbp", at_least: 120 } });
        const { score } = run(high, [["iv_access", 1], ["fluid_bolus_20ml_kg", 1]], 19);
        assert.equal(score.outcome.stabilised, false);
    });

    it("refuses an infusion that cannot work", () => {
        assert.match(errorsOf(infusion({ infusion: { over_minutes: 0 } })), /over_minutes must be a whole number/);
        assert.match(errorsOf(infusion({ effect: undefined })), /needs an effect/);
        assert.match(errorsOf(infusion({ max_doses: 2 })), /cannot also have repeat doses/);
        assert.match(errorsOf(infusion({}, { end_points: undefined })), /needs end_points/);
    });

    it("the server's replay agrees with the browser", () => {
        for (const steps of [[["iv_access", 1], ["fluid_bolus_20ml_kg", 1]], [["fluid_bolus_20ml_kg", 2], ["furosemide_iv", 3], ["iv_access", 9]]] as Array<Array<[string, number]>>) {
            const p = infusion();
            const { c, engine, score } = run(p, steps, 19);
            const replayed = replayStudentEvents(c, engine.events.filter((e) => e.type === "INTERVENTION_GIVEN"));
            replayed.advanceTo(19 * MIN);
            assert.deepEqual(scoreBedside(c, p, replayed.events, 19), score);
            assert.equal(replayed.state.systolic, engine.state.systolic);
        }
    });
});

// ── Prerequisites (IV access, a required sequence) ───────────────────────────

describe("prerequisites: what has to be true before a treatment can be given", () => {
    const IV = { when: { given: "iv_access" }, says: "there is no IV access yet." };
    const withReqs = (reqs: unknown[]) => normaliseLivePlan({ ...JSON.parse(JSON.stringify(goldenFixturePlan)), treatments: (JSON.parse(JSON.stringify(goldenFixturePlan)).treatments as Array<Record<string, unknown>>).map((t) => (t.id === "fluid_bolus_20ml_kg" ? { ...t, requires: reqs } : t)) }, "ai");

    it("an IV fluid without IV access is refused: no effect, no credit, no stabilisation, and the student is told why", () => {
        const p = withReqs([IV]);
        assert.equal(errorsOf(p), "");
        const c = compileLivePlan(base(), p);
        const engine = new EncounterEngine(c);
        const r = engine.giveIntervention("fluid_bolus_20ml_kg", 2 * MIN);
        assert.equal(r.consequence, "Not given: there is no IV access yet.");
        assert.equal(engine.state.systolic, 86);
        engine.advanceTo(19 * MIN);
        const s = scoreBedside(c, p, engine.events, 19);
        assert.equal(s.outcome.stabilised, false);
        assert.equal(s.items.find((i) => i.id === "fluid_bolus_20ml_kg")!.status, "missed");
        assert.deepEqual(s.refused?.map((x) => [x.id, x.reason]), [["fluid_bolus_20ml_kg", "needs_first"]]);
    });

    it("once access is in, it works, and it is scored from when it was actually given", () => {
        const p = withReqs([IV]);
        const { score, engine } = run(p, [["fluid_bolus_20ml_kg", 2], ["iv_access", 3], ["fluid_bolus_20ml_kg", 4]], 19);
        assert.equal(engine.state.flagSetAt.given_fluid_bolus_20ml_kg, 4 * MIN);
        assert.equal(score.items.find((i) => i.id === "fluid_bolus_20ml_kg")!.at_minutes, 4);
        assert.equal(score.outcome.stabilised, true);
    });

    it("once given, a second click says it is already given, even if a prerequisite no longer holds", () => {
        const p = withReqs([{ when: { vital: "sbp", below: 95 }, says: "a bolus is only for a low blood pressure." }]);
        const c = compileLivePlan(base(), p);
        const e = new EncounterEngine(c);
        e.giveIntervention("fluid_bolus_20ml_kg", 1 * MIN); // 86 -> 94
        e.giveIntervention("furosemide_iv", 2 * MIN); // harmful, but BP: 84
        e.giveIntervention("oxygen_supplemental", 2 * MIN);
        const again = e.giveIntervention("fluid_bolus_20ml_kg", 3 * MIN);
        assert.equal(again.consequence, "Already given. No further change.");
        e.advanceTo(19 * MIN);
        assert.equal(scoreBedside(c, p, e.events, 19).refused, undefined, "a repeat click on something given is not a refused dose");
    });

    it("gives the first unmet requirement's reason, in order", () => {
        const p = withReqs([IV, { when: { stage_reached: "compensated_shock" }, says: "a bolus is not indicated before he is shocked." }]);
        const c = compileLivePlan(base(), p);
        const e = new EncounterEngine(c);
        assert.equal(e.giveIntervention("fluid_bolus_20ml_kg", 1 * MIN).consequence, "Not given: there is no IV access yet.");
        e.giveIntervention("iv_access", 2 * MIN);
        assert.equal(e.giveIntervention("fluid_bolus_20ml_kg", 3 * MIN).consequence, "Not given: a bolus is not indicated before he is shocked.");
    });

    it("refuses a requirement that can never be met or says nothing", () => {
        assert.match(errorsOf(withReqs([{ when: { given: "fluid_bolus_20ml_kg" }, says: "it has to be given first." }])), /depends on the treatment itself/);
        assert.match(errorsOf(withReqs([{ when: { given: "iv_access" }, says: "no." }])), /write a sentence/);
        assert.match(errorsOf(withReqs([{ when: { given: "nothing_here" }, says: "there is nothing here yet." }])), /not one of the treatments/);
    });

    it("the server's replay agrees with the browser, refusals included", () => {
        const p = withReqs([IV]);
        const { c, engine, score } = run(p, [["fluid_bolus_20ml_kg", 2], ["iv_access", 3], ["fluid_bolus_20ml_kg", 4]], 19);
        const replayed = replayStudentEvents(c, engine.events.filter((e) => e.type === "INTERVENTION_GIVEN"));
        replayed.advanceTo(19 * MIN);
        assert.deepEqual(scoreBedside(c, p, replayed.events, 19), score);
    });
});

// ── Explicit reassessment ───────────────────────────────────────────────────

describe("reassessment: explicit findings, and a further dose only after a fresh one", () => {
    // The fitting child from Phase 2's tests, cut down: a benzodiazepine twice, the second only after a reassessment.
    const fitRaw = (benzo: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
        summary: "Untreated, the seizure goes on, oxygen falls and the child tires towards respiratory failure.",
        critical_window_minutes: 5,
        time_limit_minutes: 25,
        findings: [{ id: "fitting", label: "Still fitting", present: true }],
        reassessment: {
            label: "Reassess: seizure, breathing, saturation",
            detail: "Look, listen and check the monitor",
            checks: [
                { when: { finding: "fitting", is: true }, says: "He is still fitting.", otherwise: "The jerking has stopped." },
                { when: { vital: "spo2", below: 92 }, says: "Saturation is low." },
            ],
        },
        stages: [
            { id: "fitting", name: "Still fitting", at_minutes: 6, vitals: { hr: 170, spo2: 90 }, nurse_says: "Still fitting, doctor. Saturation {spo2}." },
            { id: "tiring", name: "Tiring", at_minutes: 16, vitals: { hr: 180, spo2: 84, rr: 16 }, stability: "critical", nurse_says: "His breathing is getting shallow, {rr} a minute." },
        ],
        treatments: [
            { id: "iv_access", role: "essential", within_minutes: 4, says: "A cannula is in." },
            {
                id: "benzo_iv", label: "IV benzodiazepine", detail: "0.1 mg/kg IV", group: "medications", role: "essential", within_minutes: 5, effect: { hr: -4 },
                says: "The dose goes in. The jerking slows, then starts again.", max_doses: 2, min_interval_minutes: 5, doses_required: 2, repeat_within_minutes: 10,
                repeat_only_while: { finding: "fitting", is: true }, reassess_before_repeat: true,
                responses: [{ dose: 2, says: "The second dose goes in and the jerking stops.", findings: { fitting: false } }],
                ...benzo,
            },
            { id: "continuous_monitoring", role: "supportive", says: "On the monitor." },
            { id: "mouth_gag", label: "Mouth gag", detail: "Spoon between the teeth", group: "airway", role: "harmful", effect: { spo2: -3 }, says: "A tooth chips.", why: "Objects in the mouth injure and obstruct." },
        ],
        stabilised_by: ["iv_access", "benzo_iv"],
        recovery: { after_minutes: 4, vitals: { hr: 130, sbp: 96, dbp: 60, spo2: 97, rr: 26 }, consciousness: "drowsy", nurse_says: "The jerking has stopped. Pulse {hr}." },
        ...over,
    });
    const fit = (benzo: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => normaliseLivePlan(fitRaw(benzo, over), "ai");
    const give = (p: LivePlan, steps: Array<[string, number]>) => {
        const c = compileLivePlan(base(), p);
        const e = new EncounterEngine(c);
        const results = steps.map(([a, m]) => e.giveIntervention(a, m * MIN));
        e.advanceTo(24 * MIN);
        return { c, e, results, score: scoreBedside(c, p, e.events, 24) };
    };

    it("passes the check and puts the reassessment on the tray", () => {
        assert.equal(errorsOf(fit()), "");
        const c = compileLivePlan(base(), fit());
        assert.ok(c.custom_interventions?.some((i) => i.id === REASSESS_ID));
        assert.deepEqual(validateSimulationCase(c).errors ?? [], []);
    });

    it("reports what each check finds right now", () => {
        const { results } = give(fit(), [["iv_access", 1], ["benzo_iv", 2], [REASSESS_ID, 7], ["benzo_iv", 7], [REASSESS_ID, 8]]);
        assert.equal(results[2].consequence, "Reassessment: He is still fitting. Saturation is low.");
        assert.equal(results[4].consequence, "Reassessment: The jerking has stopped. Saturation is low.", "saturation recovers only at the recovery, 4 min after stabilising");
    });

    it("refuses a further dose without a reassessment since the last one: no effect, no credit, and the student is told to reassess", () => {
        const { e, results, score } = give(fit(), [["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 7]]);
        assert.equal(results[2].consequence, REFUSED.not_reassessed("Reassess: seizure, breathing, saturation"));
        assert.equal(e.state.flags.given_benzo_iv_dose2, false);
        assert.deepEqual(score.items.find((i) => i.id === "benzo_iv")!.doses?.map((d) => d.status), ["on_time", "missed"]);
        assert.deepEqual(score.refused?.map((r) => r.reason), ["not_reassessed"]);
    });

    it("a reassessment before the previous dose does not count: it has to come after it", () => {
        const { e } = give(fit(), [["iv_access", 1], [REASSESS_ID, 1], ["benzo_iv", 2], ["benzo_iv", 7]]);
        assert.equal(e.state.flags.given_benzo_iv_dose2, false);
    });

    it("too soon is still too soon, whatever the reassessment says", () => {
        const { results } = give(fit(), [["iv_access", 1], ["benzo_iv", 2], [REASSESS_ID, 3], ["benzo_iv", 3]]);
        assert.match(results[3].consequence, /too soon/);
    });

    it("correct care reassesses, then gives the dose, and scores full", () => {
        const { score } = give(fit(), [["iv_access", 1], ["benzo_iv", 2], [REASSESS_ID, 7], ["benzo_iv", 7]]);
        assert.equal(score.score, 100);
        assert.equal(score.outcome.stabilised, true);
        assert.equal(playthroughs(base(), fit()).correct.score, 100, "the playthroughs reassess before each further dose");
    });

    it("refuses reassess_before_repeat without a reassessment, or on a single-dose treatment", () => {
        assert.match(errorsOf(fit({}, { reassessment: undefined })), /needs the plan's reassessment/);
        assert.match(errorsOf(fit({ max_doses: undefined, min_interval_minutes: undefined, doses_required: undefined, repeat_within_minutes: undefined, repeat_only_while: undefined, responses: undefined })), /only makes sense when max_doses is 2 or more/);
    });

    it("the server's replay agrees with the browser", () => {
        const p = fit();
        const { c, e, score } = give(p, [["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 7], [REASSESS_ID, 8], ["benzo_iv", 8]]);
        const replayed = replayStudentEvents(c, e.events.filter((x) => x.type === "INTERVENTION_GIVEN"));
        replayed.advanceTo(24 * MIN);
        assert.deepEqual(scoreBedside(c, p, replayed.events, 24), score);
    });
});

// ── Fast-forward (waiting) ──────────────────────────────────────────────────

describe("fast-forward: waiting moves the clock, stops at a nurse alert, and replays the same on the server", () => {
    const plan = () => goldenFixturePlan as unknown as LivePlan;
    const fresh = () => {
        const c = compileLivePlan(base(), plan());
        return { c, e: new EncounterEngine(c) };
    };

    it("stops early at the first nurse alert, so a wait never sleeps through a deterioration", () => {
        const { e } = fresh();
        const { to } = e.skipTime(1 * MIN, 10 * MIN);
        assert.equal(to, 6 * MIN, "compensated shock is announced at 6 min");
        const last = e.events.at(-1)!;
        assert.deepEqual(last, { type: "TIME_SKIPPED", timestamp: 6 * MIN, from: 1 * MIN, minutes: 10, stopped: "alert" });
        assert.equal(e.state.state, "compensated_shock");
    });

    it("waits the whole time when nothing happens, and never past the time limit", () => {
        const { e } = fresh();
        e.giveIntervention("iv_access", 1 * MIN);
        e.giveIntervention("fluid_bolus_20ml_kg", 2 * MIN);
        // Stabilised at 2, recovery announced at 6 (an alert), then nothing: the next wait runs its full length.
        assert.equal(e.skipTime(2 * MIN, 10 * MIN).to, 6 * MIN);
        assert.equal(e.skipTime(6 * MIN, 5 * MIN).to, 11 * MIN);
        const capped = e.skipTime(11 * MIN, 30 * MIN);
        assert.equal(capped.to, 20 * MIN, "capped at the 20-minute limit");
        assert.equal(capped.stopped, "limit", "ended by the time limit, not by a nurse alert");
    });

    it("a wait that starts after an alert was due fires it first and never ends before it began", () => {
        // The UI's tick has not yet fired the 6-minute alert when the student clicks wait at 6:00.1.
        const { e } = fresh();
        const start = 6 * MIN + 0.1;
        const { to, stopped } = e.skipTime(start, 5 * MIN);
        assert.ok(to >= start, `the wait ended at ${to}, after it began`);
        assert.equal(stopped, null, "the 6-minute alert happened before the wait, so the wait ran its full length");
        const last = e.events.at(-1) as { from: number; timestamp: number };
        assert.ok(last.from <= last.timestamp);
    });

    it("the server's replay of a log with waits reaches the same patient and the same score", () => {
        const { c, e } = fresh();
        e.skipTime(0, 3 * MIN);
        e.giveIntervention("iv_access", 3 * MIN);
        e.skipTime(3 * MIN, 5 * MIN);
        e.giveIntervention("fluid_bolus_20ml_kg", e.lastTimestamp);
        e.skipTime(e.lastTimestamp, 5 * MIN);
        const studentOnly = e.events.filter((x) => x.type === "INTERVENTION_GIVEN" || x.type === "TIME_SKIPPED");
        const replayed = replayStudentEvents(c, studentOnly);
        assert.deepEqual(replayed.state.snapshot(), e.state.snapshot());
        assert.deepEqual(scoreBedside(c, plan(), replayed.events), scoreBedside(c, plan(), e.events));
        assert.equal(scoreBedside(c, plan(), e.events).items.find((i) => i.id === "fluid_bolus_20ml_kg")!.at_minutes, 6, "the bolus went in when the wait ended, at 6 min");
    });

    it("a malformed wait from the browser is dropped, not trusted", () => {
        const { c } = fresh();
        const bad = [{ type: "TIME_SKIPPED", timestamp: 60, from: 120, minutes: 5 }, { type: "TIME_SKIPPED", timestamp: 60, from: 0, minutes: -1 }];
        assert.equal(replayStudentEvents(c, bad).events.length, 0);
    });
});
