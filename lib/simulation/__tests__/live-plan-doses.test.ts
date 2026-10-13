// Repeat doses in a live plan (Phase 1): a dose limit, a minimum interval, a dose that is only indicated while the
// patient is still deteriorating, and scoring by valid dose. Played through the real engine and the server's replay.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { blendLiveScore, checkLivePlan, compileLivePlan, doseFlag, measuredOnArrival, normaliseLivePlan, REFUSED, scoreBedside, type LivePlan } from "../live-plan";
import { playthroughs } from "../live-plan-playthrough";
import { goldenFixtureCase } from "./live-plan-golden-fixture";

const MIN = 60;
const base = (c: unknown = goldenFixtureCase) => upgradeLegacyCase(c as Record<string, unknown>) as unknown as SimulationCaseConfig;

/** A fitting child: a benzodiazepine twice, at least 5 minutes apart, then a second-line drug. */
function rawPlan(over: Record<string, unknown> = {}, benzo: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        summary: "Untreated, the seizure goes on, oxygen falls and the child tires towards respiratory failure.",
        critical_window_minutes: 5,
        time_limit_minutes: 25,
        stages: [
            { id: "fitting", name: "Still fitting", at_minutes: 6, vitals: { hr: 170, spo2: 90 }, nurse_says: "Still fitting, doctor. Saturation {spo2}." },
            { id: "tiring", name: "Tiring", at_minutes: 16, vitals: { hr: 180, spo2: 84, rr: 16 }, stability: "critical", nurse_says: "His breathing is getting shallow, {rr} a minute." },
        ],
        treatments: [
            { id: "iv_access", role: "essential", within_minutes: 4, says: "A cannula is in." },
            {
                id: "benzo_iv", label: "IV benzodiazepine", detail: "0.1 mg/kg IV; a second dose after 5 to 10 minutes if still fitting", group: "medications",
                role: "essential", within_minutes: 5, effect: { hr: -4 }, says: "The first dose goes in. The jerking slows, then starts again.",
                max_doses: 2, min_interval_minutes: 5, doses_required: 2, repeat_within_minutes: 10, repeat_only_while: "not_stabilised",
                effect_per_dose: [{ hr: -4 }, { hr: -6 }], says_per_dose: ["The first dose goes in. The jerking slows, then starts again.", "The second dose goes in. The jerks become smaller but do not stop."],
                ...benzo,
            },
            { id: "second_line_iv", label: "Second-line drug", detail: "Levetiracetam 60 mg/kg over 10 min", group: "medications", role: "essential", within_minutes: 20, says: "The second-line drug is running." },
            { id: "continuous_monitoring", role: "supportive", says: "On the monitor." },
            { id: "third_benzo", label: "A third benzodiazepine dose", detail: "Diazepam IV", group: "medications", role: "harmful", effect: { rr: -4, spo2: -4 }, says: "Breathing slows.", why: "A third dose adds breathing depression." },
            { id: "mouth_gag", label: "Mouth gag", detail: "Spoon between the teeth", group: "airway", role: "harmful", effect: { spo2: -3 }, says: "A tooth chips.", why: "Objects in the mouth injure and obstruct." },
        ],
        stabilised_by: ["iv_access", "benzo_iv", "second_line_iv"],
        recovery: { after_minutes: 4, vitals: { hr: 130, sbp: 96, dbp: 60, spo2: 97, rr: 26 }, consciousness: "drowsy", nurse_says: "The jerking has stopped. Pulse {hr}." },
        ...over,
    };
}
const plan = (over: Record<string, unknown> = {}, benzo: Record<string, unknown> = {}): LivePlan => normaliseLivePlan(rawPlan(over, benzo), "ai");
const live = (p: LivePlan = plan()) => compileLivePlan(base(), p);

function run(steps: Array<[string, number]>, p: LivePlan = plan(), until = 24) {
    const c = live(p);
    const engine = new EncounterEngine(c);
    const results = steps.map(([action, m]) => engine.giveIntervention(action, m * MIN));
    engine.advanceTo(until * MIN);
    return { c, engine, results, score: scoreBedside(c, p, engine.events) };
}

// ── Reading and checking ────────────────────────────────────────────────────

describe("repeat doses: reading and checking the plan", () => {
    it("keeps the repeat-dose fields, and adds none to a treatment that does not use them", () => {
        const p = plan();
        const benzo = p.treatments.find((t) => t.id === "benzo_iv")!;
        assert.equal(benzo.max_doses, 2);
        assert.equal(benzo.min_interval_minutes, 5);
        assert.equal(benzo.doses_required, 2);
        assert.equal(benzo.repeat_within_minutes, 10);
        assert.equal(benzo.repeat_only_while, "not_stabilised");
        assert.equal(benzo.effect_per_dose?.length, 2);
        const second = p.treatments.find((t) => t.id === "second_line_iv")!;
        for (const k of ["max_doses", "min_interval_minutes", "effect_per_dose", "says_per_dose", "doses_required", "repeat_within_minutes", "repeat_only_while"]) {
            assert.equal(k in second, false, `${k} must not appear on a single-dose treatment`);
        }
    });

    it("passes a sound plan", () => {
        assert.deepEqual(checkLivePlan(plan(), measuredOnArrival(base())).errors, []);
    });

    it("refuses repeat-dose fields that cannot work", () => {
        const errors = (benzo: Record<string, unknown>) => checkLivePlan(plan({}, benzo), measuredOnArrival(base())).errors.join(" | ");
        assert.match(errors({ max_doses: 1 }), /min_interval_minutes only makes sense/);
        assert.match(errors({ max_doses: 11 }), /max_doses must be a whole number from 1 to 10/);
        assert.match(errors({ doses_required: 3 }), /doses_required must be a whole number from 1 to max_doses/);
        assert.match(errors({ repeat_within_minutes: 3 }), /shorter than min_interval_minutes/);
        assert.match(errors({ min_interval_minutes: 22 }), /cannot all be given before the encounter ends/);
        assert.match(errors({ effect_per_dose: [{ hr: -4 }, { hr: -4 }, { hr: -4 }] }), /effect_per_dose lists 3 doses/);
    });

    it("keeps doses_required off a treatment that is not essential", () => {
        const p = plan({ treatments: [...(rawPlan().treatments as object[]), { id: "extra", label: "Extra", detail: "x", role: "supportive", says: "Given, nothing changes.", max_doses: 2, doses_required: 2 }] });
        assert.equal("doses_required" in p.treatments.find((t) => t.id === "extra")!, false);
    });

    it("refuses monitoring as what stops the deterioration: it watches, it does not treat", () => {
        const p = plan({ treatments: [...(rawPlan().treatments as Array<Record<string, unknown>>).map((t) => (t.id === "continuous_monitoring" ? { ...t, role: "essential", within_minutes: 5 } : t))], stabilised_by: ["iv_access", "benzo_iv", "second_line_iv", "continuous_monitoring"] });
        assert.match(checkLivePlan(p, measuredOnArrival(base())).errors.join(" | "), /watches the patient but does not treat/);
    });
});

// ── The interval and the limit ──────────────────────────────────────────────

describe("repeat doses: the minimum interval and the dose limit", () => {
    it("refuses a dose given too soon: no effect, no dose, and it says why", () => {
        const { engine, results } = run([["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 4]], plan(), 4);
        assert.equal(results[2].consequence, REFUSED.too_soon(plan().treatments.find((t) => t.id === "benzo_iv")!));
        assert.equal(engine.state.flags[doseFlag("benzo_iv", 2)], false);
        assert.equal(engine.state.rate, 148 - 4, "only the first dose moved the heart rate");
    });

    it("gives the next dose once the interval has passed, with that dose's own effect and words", () => {
        const { engine, results } = run([["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 7]], plan(), 7);
        assert.equal(results[2].consequence, "The second dose goes in. The jerks become smaller but do not stop.");
        assert.equal(engine.state.flags[doseFlag("benzo_iv", 2)], true);
        assert.equal(engine.state.rate, 170 - 4 - 6, "the stage at 6 min set 170 from arrival; both doses moved it");
    });

    it("refuses a dose beyond the limit", () => {
        const p = plan({}, { repeat_only_while: undefined });
        const { results, engine } = run([["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 7], ["benzo_iv", 13]], p, 13);
        assert.equal(results[3].consequence, REFUSED.limit(p.treatments.find((t) => t.id === "benzo_iv")!));
        assert.equal(engine.state.flags[doseFlag("benzo_iv", 3)], undefined);
    });

    it("refuses a further dose once the patient has stopped deteriorating, when it is only indicated until then", () => {
        // Stabilisation needs only the first dose here, so a second dose after it is no longer indicated.
        const p = plan({}, { doses_required: 1, repeat_within_minutes: undefined });
        const { results } = run([["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 9]], p, 9);
        assert.equal(results[3].consequence, REFUSED.not_indicated());
    });

    it("stabilises only on the last required dose", () => {
        const one = run([["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3]], plan(), 12);
        assert.equal(one.score.outcome.stabilised, false, "one of two required doses is not enough");
        const two = run([["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 7]], plan(), 16);
        assert.equal(two.score.outcome.stabilised, true);
        assert.equal(two.score.outcome.recovered, true);
    });
});

// ── Scoring ─────────────────────────────────────────────────────────────────

describe("repeat doses: scoring by valid dose and its timing", () => {
    const benzoItem = (s: ReturnType<typeof run>["score"]) => s.items.find((i) => i.id === "benzo_iv")!;

    it("is full when every required dose is on time", () => {
        const { score } = run([["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 7]]);
        assert.equal(score.score, 100);
        assert.deepEqual(benzoItem(score).doses, [{ dose: 1, at_minutes: 2, status: "on_time" }, { dose: 2, at_minutes: 7, status: "on_time" }]);
        assert.equal("refused" in score, false, "no refused list when nothing was refused");
    });

    it("never counts a refused dose: a too-early second dose leaves dose 2 missed", () => {
        const { score } = run([["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 4]]);
        assert.deepEqual(benzoItem(score).doses, [{ dose: 1, at_minutes: 2, status: "on_time" }, { dose: 2, at_minutes: null, status: "missed" }]);
        assert.equal(benzoItem(score).status, "late");
        assert.equal(score.score, Math.round((100 * (1 + 0.5 + 1)) / 3));
        assert.deepEqual(score.refused?.map((r) => [r.id, r.at_minutes, r.reason]), [["benzo_iv", 4, "too_soon"]]);
    });

    it("gives half for a required dose that came later than repeat_within_minutes after the one before", () => {
        const { score } = run([["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 15]]);
        assert.deepEqual(benzoItem(score).doses?.map((d) => d.status), ["on_time", "late"]);
        assert.equal(score.score, Math.round((100 * (1 + 0.75 + 1)) / 3));
    });

    it("gives half for a late first dose, and nothing for doses never given", () => {
        const late = run([["iv_access", 1], ["benzo_iv", 8], ["second_line_iv", 9], ["benzo_iv", 13]]).score;
        assert.deepEqual(benzoItem(late).doses?.map((d) => d.status), ["late", "on_time"]);
        const none = run([["iv_access", 1], ["second_line_iv", 3]]).score;
        assert.equal(benzoItem(none).status, "missed");
        assert.deepEqual(benzoItem(none).doses?.map((d) => d.at_minutes), [null, null]);
    });

    it("lists a dose refused at the limit", () => {
        const p = plan({}, { repeat_only_while: undefined });
        const { score } = run([["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 7], ["benzo_iv", 13]], p);
        assert.deepEqual(score.refused?.map((r) => r.reason), ["limit"]);
    });
});

describe("live score: the cap on harmful penalties", () => {
    it("never takes the bedside below 0, so harm can cost at most the bedside's 40% of the final score", () => {
        const { score } = run([["third_benzo", 1], ["mouth_gag", 2]], plan(), 24);
        assert.equal(score.score, 0);
        assert.equal(score.harmful.length, 2);
        assert.equal(blendLiveScore(100, score.score), 60);
    });

    it("takes points off once per harmful treatment, however many times it is clicked", () => {
        const twice = run([["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 7], ["mouth_gag", 8], ["mouth_gag", 9]]).score;
        assert.equal(twice.score, 85);
    });
});

// ── Browser and server agree ────────────────────────────────────────────────

describe("repeat doses: the server's replay scores exactly what the browser saw", () => {
    const paths: Array<[string, Array<[string, number]>]> = [
        ["on time", [["iv_access", 1], ["benzo_iv", 2], ["second_line_iv", 3], ["benzo_iv", 7]]],
        ["too soon, then right", [["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 3], ["second_line_iv", 4], ["benzo_iv", 8]]],
        ["late and harmful", [["benzo_iv", 9], ["mouth_gag", 10], ["benzo_iv", 11], ["benzo_iv", 21], ["iv_access", 22]]],
        ["over the limit", [["iv_access", 1], ["benzo_iv", 2], ["benzo_iv", 7], ["second_line_iv", 8], ["benzo_iv", 14]]],
    ];
    for (const [name, steps] of paths) {
        it(name, () => {
            const p = plan();
            const { c, engine, score } = run(steps, p);
            const server = replayStudentEvents(c, engine.events);
            server.advanceTo(24 * MIN);
            assert.deepEqual(scoreBedside(c, p, server.events), score);
        });
    }
});

describe("repeat doses: the standard playthroughs", () => {
    it("correct care gives every required dose at its interval and scores full", () => {
        const r = playthroughs(base(), plan());
        assert.equal(r.correct.score, 100);
        // The second dose cannot come before minute 7, so even perfect care sees the 6-minute step: he is still fitting.
        assert.deepEqual(r.correct.outcome, { stabilised: true, recovered: true, worst_stage: "Still fitting" });
        assert.equal(r.untreated.outcome.worst_stage, "Tiring");
        assert.ok(r.late.score < 100);
    });
});

// ── Hyperkalaemia: a monitor does not treat ─────────────────────────────────

describe("hyperkalaemia regression: monitoring alone cannot stabilise the patient", () => {
    const file = path.join(process.cwd(), "data", "cases", "46-year-old-man-whose-legs-are-too-weak-to-stand.json");

    it("in a plan where monitoring is essential but not stabilising", () => {
        const p = plan({
            treatments: (rawPlan().treatments as Array<Record<string, unknown>>).map((t) => (t.id === "continuous_monitoring" ? { ...t, role: "essential", within_minutes: 5 } : t)),
        });
        const watched = run([["continuous_monitoring", 1]], p, 24).score;
        assert.equal(watched.outcome.stabilised, false);
        assert.equal(watched.items.find((i) => i.id === "continuous_monitoring")?.status, "on_time", "still scored as an essential step");
    });

    it("in the real hyperkalaemia plan, wherever the case is present", { skip: !fs.existsSync(file) && "the case is not on this machine (data/cases is not in git)" }, () => {
        const c = JSON.parse(fs.readFileSync(file, "utf8"));
        const p = c.live_plan as LivePlan;
        assert.equal(p.stabilised_by.includes("continuous_monitoring"), false);
        assert.equal(p.treatments.find((t) => t.id === "continuous_monitoring")?.role, "essential");
        const compiled = compileLivePlan(base(c), p);
        const watched = new EncounterEngine(compiled);
        watched.giveIntervention("continuous_monitoring", 1 * MIN);
        watched.advanceTo(24 * MIN);
        assert.equal(scoreBedside(compiled, p, watched.events).outcome.stabilised, false, "monitoring alone must not stabilise");
        const treated = new EncounterEngine(compiled);
        for (const [a, m] of [["iv_access", 1], ["calcium_gluconate_iv", 2], ["insulin_glucose_iv", 3]] as const) treated.giveIntervention(a, m * MIN);
        treated.advanceTo(24 * MIN);
        assert.equal(scoreBedside(compiled, p, treated.events).outcome.stabilised, true, "access, calcium and insulin-glucose do");
    });
});
