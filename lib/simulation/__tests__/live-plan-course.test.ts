// The course after treatment, and what a live encounter may claim about it: a patient left dying cannot score well,
// a patient is never called recovered at readings nobody would call settled, a late patient can settle somewhere
// worse than a timely one (recovery.after_stage), and harm can outlast the recovery (lasting). The last two are plan
// fields: a plan without them compiles exactly as before (the golden tests hold every real plan to that).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import type { SimulationCaseConfig } from "../case-schema";
import type { ClinicalEvent } from "../encounter-events";
import { checkLivePlan, compileLivePlan, LEFT_DYING_CAP, measuredOnArrival, normaliseLivePlan, scoreBedside, unmodelledCourse, unsafeReadings, type LivePlan } from "../live-plan";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

// The fixture's plan on an adult, so the adult floors apply.
const adultCase = { ...goldenFixtureCase, patient: { ...goldenFixtureCase.patient, age: 40 } };
const base = () => upgradeLegacyCase(adultCase as Record<string, unknown>) as unknown as SimulationCaseConfig;
const plan = (over: Record<string, unknown> = {}): LivePlan => normaliseLivePlan({ ...goldenFixturePlan, ...over }, "ai");
const recovery = goldenFixturePlan.recovery;

function run(p: LivePlan, given: Array<[string, number]>, endMinutes = p.time_limit_minutes) {
    const config = compileLivePlan(base(), p);
    const events: ClinicalEvent[] = given.map(([action, m]) => ({ type: "INTERVENTION_GIVEN", timestamp: m * 60, action, consequence: "x" }));
    const engine = replayStudentEvents(config, events);
    for (let m = 1; m <= endMinutes; m++) engine.advanceTo(m * 60);
    return { score: scoreBedside(config, p, engine.events, endMinutes), state: engine.state, fired: engine.state.firedRules };
}

describe("course: a patient left dying", () => {
    it("holds the bedside score at the cap, and says what it would have been", () => {
        // access on time, the bolus never: never stabilised, and the decompensated step reached
        const { score } = run(plan(), [["iv_access", 2]]);
        assert.equal(score.outcome.stabilised, false);
        assert.deepEqual(score.capped, { at: LEFT_DYING_CAP, from: 50 });
        assert.equal(score.score, LEFT_DYING_CAP);
    });

    it("does not cap a score already under it, a stabilised patient, or an encounter ended inside the window", () => {
        assert.equal(run(plan(), []).score.capped, undefined, "nothing given scores 0, under the cap");
        const late = run(plan(), [["iv_access", 9], ["fluid_bolus_20ml_kg", 10]]).score;
        assert.equal(late.outcome.stabilised, true);
        assert.equal(late.capped, undefined);
        assert.equal(late.score, 50);
        const early = run(plan(), [["iv_access", 2]], 6).score;
        assert.equal(early.capped, undefined, "the window (8 min) is still open at 6");
    });
});

describe("course: safe to call recovered", () => {
    it("names the readings nobody would call settled, on the falling side only", () => {
        assert.deepEqual(unsafeReadings({ hr: 112, sbp: 118, dbp: 74, spo2: 94, rr: 24, consciousness: "alert" }), []);
        assert.deepEqual(unsafeReadings({ hr: 128, sbp: 98, dbp: 62, spo2: 84, rr: 24 }), ["SpO₂ 84%"]);
        assert.deepEqual(unsafeReadings({ spo2: 91 }), ["SpO₂ 91%"], "NEWS2 scale 1 scores 3 at 91% and below");
        assert.deepEqual(unsafeReadings({ sbp: 90, dbp: 50 }), ["BP 90/50"]);
        assert.deepEqual(unsafeReadings({ sbp: 96, dbp: 48 }), ["BP 96/48 (mean under 65)"]);
        assert.deepEqual(unsafeReadings({ hr: 40, rr: 8, consciousness: "unresponsive" }), ["pulse 40", "breathing 8 a minute", "unresponsive"]);
        assert.deepEqual(unsafeReadings({ hr: 150, rr: 30, consciousness: "drowsy" }), [], "fast is not on its own unsafe here (Kussmaul breathing in DKA)");
        // a two-year-old: the systolic floor for the age, and no adult pulse or breathing floors
        assert.deepEqual(unsafeReadings({ sbp: 76, dbp: 40, hr: 38, rr: 8 }, 2), []);
        assert.deepEqual(unsafeReadings({ sbp: 72, dbp: 40 }, 2), ["BP 72/40"]);
    });

    it("does not call a patient recovered who was made unsafe after the recovery", () => {
        // a harm given after he settled: its fall stays on the monitor, and he is no longer safe
        const harmful = plan({ treatments: goldenFixturePlan.treatments.map((t) => (t.id === "furosemide_iv" ? { ...t, effect: { sbp: -10, dbp: -6, hr: 8, spo2: -10 } } : t)) });
        const { score, fired } = run(harmful, [["iv_access", 1], ["fluid_bolus_20ml_kg", 2], ["furosemide_iv", 10]]);
        assert.equal(fired.has("live_recovery"), true);
        assert.equal(score.outcome.recovered, false);
        assert.deepEqual(score.outcome.unsafe_at_end, ["SpO₂ 89%", "BP 84/52"]);
        const fine = run(harmful, [["iv_access", 1], ["fluid_bolus_20ml_kg", 2]]).score;
        assert.equal(fine.outcome.recovered, true);
        assert.equal(fine.outcome.unsafe_at_end, undefined);
    });

    it("refuses a plan whose own recovery is unsafe", () => {
        const bad = plan({ recovery: { ...recovery, vitals: { ...recovery.vitals, spo2: 88 } } });
        assert.match(checkLivePlan(bad, measuredOnArrival(base())).errors.join(" | "), /recovery\.vitals: a patient at SpO₂ 88% has not recovered/);
    });
});

describe("course: a late patient settles somewhere worse (recovery.after_stage)", () => {
    const late = () =>
        plan({
            recovery: {
                ...recovery,
                after_stage: [
                    { stage: "compensated_shock", vitals: { hr: 132, sbp: 92, dbp: 56 } },
                    { stage: "decompensated", vitals: { hr: 140, sbp: 92, dbp: 54, rr: 34 }, after_minutes: 6, consciousness: "drowsy", nurse_says: "He is pinker but still drowsy. Pulse {hr}." },
                ],
            },
        });

    it("passes the check, and a plan without it is listed as not saying", () => {
        assert.deepEqual(checkLivePlan(late(), measuredOnArrival(base())).errors, []);
        assert.match(unmodelledCourse(plan()).join(" | "), /recovery\.after_stage/);
        assert.doesNotMatch(unmodelledCourse(late()).join(" | "), /recovery\.after_stage/);
    });

    it("in time: the usual recovery", () => {
        const { state, fired } = run(late(), [["iv_access", 1], ["fluid_bolus_20ml_kg", 2]]);
        assert.equal(fired.has("live_recovery"), true);
        assert.deepEqual([state.rate, state.systolic, state.diastolic, state.rr], [126, 94, 58, 30]);
    });

    it("after the first step: that step's recovery, at the usual time", () => {
        const { state, fired, score } = run(late(), [["iv_access", 7], ["fluid_bolus_20ml_kg", 8]]);
        assert.equal(fired.has("live_recovery"), false);
        assert.equal(fired.has("live_recovery_after_compensated_shock"), true);
        assert.deepEqual([state.rate, state.systolic, state.diastolic, state.rr], [132, 92, 56, 30]);
        assert.equal(score.outcome.recovered, true);
    });

    it("after the worst step: the furthest step reached decides, with its own minutes and words", () => {
        const r = run(late(), [["iv_access", 13], ["fluid_bolus_20ml_kg", 13]]);
        assert.deepEqual([...r.fired].filter((id) => id.startsWith("live_recovery")), ["live_recovery_after_decompensated"]);
        assert.deepEqual([r.state.rate, r.state.systolic, r.state.diastolic, r.state.rr, r.state.consciousness], [140, 92, 54, 34, "drowsy"]);
        assert.equal(r.score.outcome.recovered, true);
        // not yet settled 5 minutes after stabilisation (its own 6), settled at 6
        assert.equal(run(late(), [["iv_access", 13], ["fluid_bolus_20ml_kg", 13]], 18).fired.has("live_recovery_after_decompensated"), false);
        assert.equal(run(late(), [["iv_access", 13], ["fluid_bolus_20ml_kg", 13]], 19).fired.has("live_recovery_after_decompensated"), true);
    });

    it("refuses an unknown step, the wrong order, and a late recovery that is not safe", () => {
        const errors = (after_stage: unknown) => checkLivePlan(plan({ recovery: { ...recovery, after_stage } }), measuredOnArrival(base())).errors.join(" | ");
        assert.match(errors([{ stage: "arrest", vitals: { hr: 140 } }]), /"arrest" is not one of the stages/);
        assert.match(errors([{ stage: "decompensated", vitals: { hr: 140 } }, { stage: "compensated_shock", vitals: { hr: 132 } }]), /in the order of the untreated course/);
        assert.match(errors([{ stage: "decompensated", vitals: { spo2: 86 } }]), /SpO₂ 86% has not recovered/);
        assert.match(errors([{ stage: "decompensated", vitals: {} }]), /say how this patient settles differently/);
    });
});

describe("course: harm that outlasts the recovery (lasting)", () => {
    const lasting = (l: unknown) => plan({ treatments: goldenFixturePlan.treatments.map((t) => (t.id === "furosemide_iv" ? { ...t, lasting: l } : t)) });

    it("given before the recovery: it is still there after it, once", () => {
        const { state, fired } = run(lasting({ sbp: -6, dbp: -4 }), [["iv_access", 1], ["furosemide_iv", 2], ["fluid_bolus_20ml_kg", 3]]);
        assert.equal(fired.has("live_lasting_furosemide_iv"), true);
        assert.deepEqual([state.rate, state.systolic, state.diastolic], [126, 88, 54]);
    });

    it("given after the recovery: its own effect stays, and the lasting part is not added again", () => {
        const { state, fired } = run(lasting({ sbp: -6, dbp: -4 }), [["iv_access", 1], ["fluid_bolus_20ml_kg", 2], ["furosemide_iv", 10]]);
        assert.equal(fired.has("live_lasting_furosemide_iv"), false);
        assert.deepEqual([state.rate, state.systolic, state.diastolic], [134, 84, 52]);
    });

    it("never given: the usual recovery; {} says on purpose that it wears off", () => {
        assert.deepEqual(run(lasting({ sbp: -6, dbp: -4 }), [["iv_access", 1], ["fluid_bolus_20ml_kg", 2]]).state.systolic, 94);
        const worn = run(lasting({}), [["iv_access", 1], ["furosemide_iv", 2], ["fluid_bolus_20ml_kg", 3]]);
        assert.equal(worn.state.systolic, 94);
        assert.doesNotMatch(unmodelledCourse(lasting({})).join(" | "), /lasting/);
        assert.match(unmodelledCourse(plan()).join(" | "), /lasting: .*furosemide_iv/);
    });

    it("is refused on a treatment that is not harmful, and kept by the reader", () => {
        const p = plan({ treatments: goldenFixturePlan.treatments.map((t) => (t.id === "ondansetron_4mg" ? { ...t, lasting: { hr: 4 } } : t)) });
        assert.deepEqual(p.treatments.find((t) => t.id === "ondansetron_4mg")?.lasting, { hr: 4 });
        assert.match(checkLivePlan(p, measuredOnArrival(base())).errors.join(" | "), /only a harmful treatment leaves something behind/);
    });

    it("a plan without either field compiles exactly as before: no recovery flags, no new rules", () => {
        const rules = compileLivePlan(base(), plan()).event_rules.map((r) => r.id);
        assert.equal(rules.some((id) => id.startsWith("live_lasting_") || id.startsWith("live_settled_") || id.startsWith("live_recovery_after_")), false);
        assert.equal("live_recovered" in compileLivePlan(base(), plan()).initial_state.flags, false);
    });
});
