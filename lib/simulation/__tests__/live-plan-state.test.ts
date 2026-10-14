// State in a live plan (Phase 2): conditions on the patient, effects that depend on them, further doses gated by an
// explicit finding, treatments that appear on the tray only when needed, treatments required only in some states,
// and other paths to stabilisation. Played through the real engine and the server's replay.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { evaluateCondition, type ConditionContext } from "../conditions";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { validateSimulationCase } from "../validate-config";
import {
    availableFlag,
    checkLivePlan,
    compileCondition,
    compileLivePlan,
    doseFlag,
    measuredOnArrival,
    normaliseLivePlan,
    REFUSED,
    scoreBedside,
    type LiveCondition,
    type LivePlan,
} from "../live-plan";
import { playthroughs } from "../live-plan-playthrough";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

const MIN = 60;
const base = () => upgradeLegacyCase(goldenFixtureCase as unknown as Record<string, unknown>) as unknown as SimulationCaseConfig;
const errorsOf = (p: LivePlan) => checkLivePlan(p, measuredOnArrival(base())).errors.join(" | ");

// ── Fixture 1: a shocked toddler (arrives HR 148, BP 86/54) with a rescue path ──────────────────────────────────
// Untreated: compensated at 6 min (BP 80/50), decompensated at 12 (BP 62/38). The usual path (access + bolus) works
// only until decompensation; after that a rescue bolus, required only once systolic falls below 70, is also needed.

const RESCUE_WHEN = { vital: "sbp", below: 70 };

function shockRaw(over: Record<string, unknown> = {}): Record<string, unknown> {
    const p = JSON.parse(JSON.stringify(goldenFixturePlan));
    p.findings = [{ id: "cold_peripheries", label: "Cold hands and feet", present: true }];
    p.recovery.findings = { cold_peripheries: false };
    p.treatments = p.treatments.map((t: Record<string, unknown>) =>
        t.id === "fluid_bolus_20ml_kg"
            ? { ...t, responses: [{ when: { stage_reached: "decompensated" }, effect: { hr: -6, sbp: 4, dbp: 2 }, says: "The bolus is running, but his pressure barely moves." }] }
            : t
    );
    p.treatments.push({
        id: "rescue_bolus",
        label: "Second fluid bolus",
        detail: "A further 20 mL/kg Ringer's lactate, for hypotension after the first",
        group: "circulation",
        role: "essential",
        within_minutes: 3,
        available_when: RESCUE_WHEN,
        required_when: RESCUE_WHEN,
        effect: { hr: -10, sbp: 12, dbp: 8 },
        says: "The second bolus is running and his pressure lifts.",
    });
    p.stabilised_by_while = { not: { stage_reached: "decompensated" } };
    p.or_stabilised_by = [{ name: "Rescue: a second bolus", treatments: ["iv_access", "fluid_bolus_20ml_kg", "rescue_bolus"] }];
    return { ...p, ...over };
}
const shock = (over: Record<string, unknown> = {}) => normaliseLivePlan(shockRaw(over), "ai");

// ── Fixture 2: a fitting child, the second benzodiazepine dose gated on an explicit "still fitting" finding ────────
// The second-line drug stops the seizure; so does the second benzodiazepine dose once the second-line is in.

function fitRaw(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        summary: "Untreated, the seizure goes on, oxygen falls and the child tires towards respiratory failure.",
        critical_window_minutes: 5,
        time_limit_minutes: 25,
        findings: [{ id: "fitting", label: "Still fitting", present: true }],
        stages: [
            { id: "fitting", name: "Still fitting", at_minutes: 6, vitals: { hr: 170, spo2: 90 }, nurse_says: "Still fitting, doctor. Saturation {spo2}." },
            { id: "tiring", name: "Tiring", at_minutes: 16, vitals: { hr: 180, spo2: 84, rr: 16 }, stability: "critical", nurse_says: "His breathing is getting shallow, {rr} a minute." },
        ],
        treatments: [
            { id: "iv_access", role: "essential", within_minutes: 4, says: "A cannula is in." },
            {
                id: "benzo_iv", label: "IV benzodiazepine", detail: "0.1 mg/kg IV; a second dose after 5 to 10 minutes if still fitting", group: "medications",
                role: "essential", within_minutes: 5, effect: { hr: -4 }, says: "The dose goes in. The jerking slows, then starts again.",
                max_doses: 2, min_interval_minutes: 5, doses_required: 2, repeat_within_minutes: 10,
                repeat_only_while: { finding: "fitting", is: true },
                not_indicated_says: "He has stopped fitting, so another dose is not indicated.",
                responses: [{ dose: 2, when: { given: "second_line_iv" }, effect: { hr: -10 }, says: "The second dose goes in and the jerking stops.", findings: { fitting: false } }],
            },
            {
                id: "second_line_iv", label: "Second-line drug", detail: "Levetiracetam 60 mg/kg over 10 min", group: "medications", role: "essential", within_minutes: 20,
                says: "The second-line drug is running.",
                responses: [{ says: "The second-line drug is running, and a few minutes in the jerking stops.", findings: { fitting: false } }],
            },
            { id: "continuous_monitoring", role: "supportive", says: "On the monitor." },
            { id: "third_benzo", label: "A third benzodiazepine dose", detail: "Diazepam IV", group: "medications", role: "harmful", effect: { rr: -4, spo2: -4 }, says: "Breathing slows.", why: "A third dose adds breathing depression." },
        ],
        stabilised_by: ["iv_access", "benzo_iv", "second_line_iv"],
        recovery: { after_minutes: 4, vitals: { hr: 130, sbp: 96, dbp: 60, spo2: 97, rr: 26 }, consciousness: "drowsy", nurse_says: "The jerking has stopped. Pulse {hr}." },
        ...over,
    };
}
const fit = (over: Record<string, unknown> = {}) => normaliseLivePlan(fitRaw(over), "ai");

function run(p: LivePlan, steps: Array<[string, number]>, until = p.time_limit_minutes - 1) {
    const c = compileLivePlan(base(), p);
    const engine = new EncounterEngine(c);
    const results = steps.map(([action, m]) => engine.giveIntervention(action, m * MIN));
    engine.advanceTo(until * MIN);
    return { c, engine, results, score: scoreBedside(c, p, engine.events) };
}
const item = (s: ReturnType<typeof scoreBedside>, id: string) => s.items.find((i) => i.id === id)!;

// ── Reading and checking ────────────────────────────────────────────────────

describe("state: reading and checking the plan", () => {
    it("passes both sound plans, and their compiled cases pass the engine's own validator", () => {
        for (const p of [shock(), fit()]) {
            assert.equal(errorsOf(p), "");
            const v = validateSimulationCase(compileLivePlan(base(), p));
            assert.deepEqual(v.errors ?? [], []);
        }
    });

    it("reads a condition it cannot understand as invalid, and the check refuses the plan, so a gate is never silently dropped", () => {
        const p = fit({}).treatments.find((t) => t.id === "benzo_iv")!;
        assert.deepEqual(p.repeat_only_while, { finding: "fitting", is: true });
        const bad = normaliseLivePlan({ ...fitRaw(), treatments: (fitRaw().treatments as Array<Record<string, unknown>>).map((t) => (t.id === "benzo_iv" ? { ...t, repeat_only_while: { seizure: "yes" } } : t)) }, "ai");
        assert.ok("invalid" in (bad.treatments.find((t) => t.id === "benzo_iv")!.repeat_only_while as object));
        assert.match(errorsOf(bad), /could not read this condition/);
    });

    it("refuses conditions that refer to things the plan does not have, or numbers a monitor cannot show", () => {
        const withGate = (gate: unknown) => fit({ treatments: (fitRaw().treatments as Array<Record<string, unknown>>).map((t) => (t.id === "benzo_iv" ? { ...t, repeat_only_while: gate } : t)) });
        assert.match(errorsOf(withGate({ finding: "apnoea", is: true })), /"apnoea" is not one of the plan's findings/);
        assert.match(errorsOf(withGate({ stage_reached: "arrest" })), /"arrest" is not one of the stages/);
        assert.match(errorsOf(withGate({ given: "phenobarbital" })), /"phenobarbital" is not one of the treatments/);
        assert.match(errorsOf(withGate({ given: "second_line_iv", doses: 2 })), /dose 2 cannot happen/);
        assert.match(errorsOf(withGate({ vital: "spo2", below: 120 })), /outside what a monitor can show/);
    });

    it("refuses a conditionally required treatment that could be given before it is needed, or that sits on the usual path", () => {
        const noGate = shock({ treatments: (shockRaw().treatments as Array<Record<string, unknown>>).map((t) => (t.id === "rescue_bolus" ? { ...t, available_when: undefined } : t)) });
        assert.match(errorsOf(noGate), /needs available_when too/);
        assert.match(errorsOf(shock({ stabilised_by: ["iv_access", "fluid_bolus_20ml_kg", "rescue_bolus"] })), /cannot be in stabilised_by/);
    });

    it("refuses a usual path that can stop working with no other path", () => {
        assert.match(errorsOf(shock({ or_stabilised_by: [] })), /give another path/);
    });

    it("adds no state flags or rules to a plan that does not use the state fields", () => {
        const c = compileLivePlan(base(), goldenFixturePlan as unknown as LivePlan);
        assert.equal(Object.keys(c.initial_state.flags ?? {}).some((f) => /^(available|required|reached|finding|indicated|notneeded)_/.test(f)), false);
        assert.equal(c.event_rules.some((r) => r.keeps_state), false);
    });
});

// ── Conditions and thresholds ───────────────────────────────────────────────

describe("state: conditions and their thresholds", () => {
    const ctx = (sbp: number): ConditionContext => ({
        time: 0, flags: {}, flagSetAt: {}, state: "x", alarms: [],
        physiology: { hr: 100, sbp, dbp: 50, map: 70, spo2: 95, rr: 20, temperature: 37, rhythm: "sinus_normal", consciousness: "alert" },
    });
    const holds = (c: LiveCondition, sbp: number) => evaluateCondition(compileCondition(c), ctx(sbp));

    it("below and above are strict; at_most and at_least include the threshold", () => {
        assert.equal(holds({ vital: "sbp", below: 90 }, 89), true);
        assert.equal(holds({ vital: "sbp", below: 90 }, 90), false);
        assert.equal(holds({ vital: "sbp", above: 80 }, 80), false);
        assert.equal(holds({ vital: "sbp", above: 80 }, 81), true);
        assert.equal(holds({ vital: "sbp", at_most: 80 }, 80), true);
        assert.equal(holds({ vital: "sbp", at_least: 90 }, 90), true);
        assert.equal(holds({ vital: "sbp", at_least: 90 }, 89), false);
    });

    it("a rescue for 'systolic below 70' is not needed at exactly 70, and is at 62", () => {
        // A bolus at 3 min without access: not stabilised, so the stages go on, and at 12 min systolic is 86+8-6-18 = 70.
        const atSeventy = run(shock(), [["fluid_bolus_20ml_kg", 3]]);
        assert.equal(atSeventy.engine.state.systolic, 70);
        assert.equal(atSeventy.engine.state.flags[availableFlag("rescue_bolus")], false);
        assert.equal(item(atSeventy.score, "rescue_bolus").status, "not_needed");
        const untreated = run(shock(), []);
        assert.equal(untreated.engine.state.systolic, 62);
        assert.equal(item(untreated.score, "rescue_bolus").status, "missed");
        assert.equal(item(untreated.score, "rescue_bolus").required_at_minutes, 12);
    });
});

// ── State-dependent effects ─────────────────────────────────────────────────

describe("state: effects that depend on the patient's state", () => {
    it("gives the usual effect before decompensation, and the state's own effect after it", () => {
        const early = run(shock(), [["fluid_bolus_20ml_kg", 3]], 3);
        assert.equal(early.results[0].consequence, "The bolus is running. His pulse is coming down.");
        assert.equal(early.engine.state.systolic, 86 + 8);
        const late = run(shock(), [["fluid_bolus_20ml_kg", 13]], 13);
        assert.equal(late.results[0].consequence, "The bolus is running, but his pressure barely moves.");
        assert.equal(late.engine.state.systolic, 62 + 4);
    });

    it("sets findings from a response, a stage or the recovery", () => {
        const { engine } = run(shock(), [["iv_access", 1], ["fluid_bolus_20ml_kg", 2]], 19);
        assert.equal(engine.state.flags.finding_cold_peripheries, false, "the recovery clears the finding");
        assert.equal(run(shock(), [], 19).engine.state.flags.finding_cold_peripheries, true);
    });
});

// ── Tray availability ───────────────────────────────────────────────────────

describe("state: a treatment that is on the tray only when needed", () => {
    it("is hidden at the start and refused if tried: no effect, no credit, and the debrief lists it", () => {
        const { engine, results, score } = run(shock(), [["rescue_bolus", 2]], 2);
        assert.equal(results[0].consequence, REFUSED.unavailable());
        assert.equal(engine.state.flags[availableFlag("rescue_bolus")], false);
        assert.equal(engine.state.flags[doseFlag("rescue_bolus", 1)], false);
        assert.equal(engine.state.systolic, 86, "the refused bolus did nothing");
        assert.deepEqual(score.refused?.map((r) => [r.id, r.reason]), [["rescue_bolus", "unavailable"]]);
    });

    it("appears the moment its condition holds, and stays", () => {
        const { engine } = run(shock(), [], 12);
        assert.equal(engine.state.flags[availableFlag("rescue_bolus")], true);
        assert.equal(engine.state.flagSetAt[availableFlag("rescue_bolus")], 12 * MIN);
    });
});

// ── Conditionally required treatments, and other paths ──────────────────────

describe("state: a rescue required only once the patient needs it, and the path it opens", () => {
    it("correct care never needs the rescue: it is left out, and the score is full", () => {
        const { score } = run(shock(), [["iv_access", 1], ["fluid_bolus_20ml_kg", 2]]);
        assert.equal(item(score, "rescue_bolus").status, "not_needed");
        assert.equal(score.score, 100);
        assert.equal(score.outcome.stabilised, true);
        assert.equal(score.outcome.path, "usual");
    });

    it("after decompensation the usual path no longer stabilises; the rescue path does, and its window counts from the moment it was needed", () => {
        const usualOnly = run(shock(), [["iv_access", 13], ["fluid_bolus_20ml_kg", 13]]);
        assert.equal(usualOnly.score.outcome.stabilised, false);
        const rescued = run(shock(), [["iv_access", 13], ["fluid_bolus_20ml_kg", 13], ["rescue_bolus", 14]]);
        assert.equal(rescued.score.outcome.stabilised, true);
        assert.equal(rescued.score.outcome.path, "Rescue: a second bolus");
        assert.equal(item(rescued.score, "rescue_bolus").status, "on_time", "given 2 min after it was needed, within 3");
        assert.equal(item(rescued.score, "fluid_bolus_20ml_kg").status, "late");
        // access late (0.5) + bolus late (0.5) + rescue on time (1), out of 3
        assert.equal(rescued.score.score, Math.round((100 * 2) / 3));
    });

    it("a rescue needed but given after its window is late; never given is missed", () => {
        assert.equal(item(run(shock(), [["iv_access", 13], ["fluid_bolus_20ml_kg", 13], ["rescue_bolus", 16]]).score, "rescue_bolus").status, "late");
        assert.equal(item(run(shock(), [["iv_access", 13], ["fluid_bolus_20ml_kg", 13]]).score, "rescue_bolus").status, "missed");
    });

    it("an attempt before it was available cannot stabilise the patient or earn credit", () => {
        const { score } = run(shock(), [["rescue_bolus", 2], ["iv_access", 13], ["fluid_bolus_20ml_kg", 13]]);
        assert.equal(score.outcome.stabilised, false);
        assert.equal(item(score, "rescue_bolus").status, "missed");
        assert.equal(item(score, "rescue_bolus").at_minutes, null);
    });

    it("harm still costs on the rescue path", () => {
        const { score } = run(shock(), [["iv_access", 13], ["fluid_bolus_20ml_kg", 13], ["rescue_bolus", 14], ["furosemide_iv", 15]]);
        assert.deepEqual(score.harmful.map((h) => h.id), ["furosemide_iv"]);
        assert.equal(score.score, Math.round((100 * 2) / 3) - 15);
    });

    it("the playthroughs include a rescue: late care, then the rescue a minute after it is needed", () => {
        const p = playthroughs(base(), shock());
        assert.equal(p.correct.score, 100);
        assert.ok(p.rescue, "a plan with a conditional rescue gets a rescue playthrough");
        // Late here is a bolus at 10 min, before decompensation at 12: late, but the rescue is never needed.
        assert.deepEqual(p.rescue!.items.find(([id]) => id === "rescue_bolus"), ["rescue_bolus", "not_needed"]);
        // With the bolus window at 11, late is 13 min: after decompensation, so the rescue is needed at 12 and given at 13.
        const later = playthroughs(base(), shock({ treatments: (shockRaw().treatments as Array<Record<string, unknown>>).map((t) => (t.id === "fluid_bolus_20ml_kg" ? { ...t, within_minutes: 11 } : t)) }));
        assert.equal(later.late.outcome.stabilised, false, "without the rescue, late care no longer stabilises");
        assert.equal(later.rescue!.outcome.stabilised, true);
        assert.deepEqual(later.rescue!.items.find(([id]) => id === "rescue_bolus"), ["rescue_bolus", "on_time"]);
        assert.equal(playthroughs(base(), goldenFixturePlan as unknown as LivePlan).rescue, undefined);
    });
});

// ── Further doses gated by an explicit finding ──────────────────────────────

describe("state: a further dose required only while the patient is still fitting", () => {
    it("gives the second dose when he is still fitting 5 minutes after the first, and scores it", () => {
        const { results, score } = run(fit(), [["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 7], ["second_line_iv", 9]]);
        assert.equal(results[2].consequence, "The dose goes in. The jerking slows, then starts again.");
        assert.deepEqual(item(score, "benzo_iv").doses?.map((d) => d.status), ["on_time", "on_time"]);
        assert.equal(score.outcome.stabilised, true);
        assert.equal(score.score, 100);
    });

    it("refuses the second dose once the seizure has stopped, even though the patient is not yet stabilised, and does not require it", () => {
        // No IV access, so not stabilised; but the second-line drug has stopped the seizure.
        const { engine, results, score } = run(fit(), [["benzo_iv", 2], ["second_line_iv", 4], ["benzo_iv", 8]]);
        assert.equal(engine.state.flags.finding_fitting, false);
        assert.equal(engine.state.flags.live_stabilised, false, "not stabilised: the plan's usual path needs IV access");
        assert.equal(results[2].consequence, "Not given: He has stopped fitting, so another dose is not indicated.");
        assert.equal(engine.state.flags[doseFlag("benzo_iv", 2)], false);
        assert.deepEqual(item(score, "benzo_iv").doses?.map((d) => d.status), ["on_time", "not_needed"]);
        assert.equal(item(score, "benzo_iv").status, "on_time");
        assert.deepEqual(score.refused?.map((r) => r.reason), ["not_indicated"]);
    });

    it("a dose given once the interval has passed but the state no longer calls for it earns nothing (the timer alone is not enough)", () => {
        const stopped = run(fit(), [["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 7]]);
        assert.equal(stopped.engine.state.flags[doseFlag("benzo_iv", 2)], false);
        assert.equal(stopped.score.outcome.stabilised, true, "stabilised as soon as the seizure stopped, without waiting for dose 2 to fall due");
        assert.equal(stopped.engine.state.flagSetAt.live_stabilised, 3 * MIN);
        assert.equal(stopped.score.score, 100, "nothing lost for a dose that was never needed, nothing gained for the refused one");
    });

    it("still fitting when the second dose falls due, and it is never given: missed", () => {
        const { score } = run(fit(), [["iv_access", 1], ["benzo_iv", 2]]);
        assert.deepEqual(item(score, "benzo_iv").doses?.map((d) => d.status), ["on_time", "missed"]);
        assert.equal(score.outcome.stabilised, false);
    });

    it("the second dose given after the second-line drug stops the seizure through its own response", () => {
        const { engine, results } = run(fit(), [["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 7], ["second_line_iv", 9]], 9);
        assert.equal(results[3].consequence, "The second-line drug is running, and a few minutes in the jerking stops.");
        assert.equal(engine.state.flags.finding_fitting, false);
        const swapped = run(fit(), [["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3]], 3);
        assert.equal(swapped.engine.state.flags.finding_fitting, false);
    });
});

// ── The server's replay ─────────────────────────────────────────────────────

describe("state: the server's replay scores exactly what the browser saw", () => {
    const cases: Array<[string, () => LivePlan, Array<[string, number]>]> = [
        ["shock, correct", shock, [["iv_access", 1], ["fluid_bolus_20ml_kg", 2]]],
        ["shock, refused early rescue then rescue path", shock, [["rescue_bolus", 2], ["iv_access", 13], ["fluid_bolus_20ml_kg", 13], ["rescue_bolus", 14], ["furosemide_iv", 15]]],
        ["shock, boundary at 70", shock, [["fluid_bolus_20ml_kg", 3]]],
        ["fitting, dose refused as not indicated", fit, [["benzo_iv", 2], ["second_line_iv", 4], ["benzo_iv", 8]]],
        ["fitting, both doses", fit, [["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 4], ["benzo_iv", 7], ["second_line_iv", 9], ["third_benzo", 10]]],
    ];
    for (const [name, make, steps] of cases) {
        it(name, () => {
            const p = make();
            const { c, engine, score } = run(p, steps);
            const replayed = replayStudentEvents(c, engine.events.filter((e) => e.type === "INTERVENTION_GIVEN"));
            replayed.advanceTo((p.time_limit_minutes - 1) * MIN);
            assert.deepEqual(scoreBedside(c, p, replayed.events), score);
        });
    }
});
