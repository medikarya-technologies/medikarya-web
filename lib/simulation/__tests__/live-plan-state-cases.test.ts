// Phase 2 on the real plans (data/cases, not in git): the status epilepticus seizure finding, organophosphate atropine
// titrated to end points, and the refractory anaphylaxis pathway. Each block runs wherever its case is present.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { PatientState } from "../patient-state";
import { availableFlag, checkLivePlan, compileLivePlan, doseFlag, measuredOnArrival, scoreBedside, type LivePlan } from "../live-plan";

const MIN = 60;
const DIR = path.join(process.cwd(), "data", "cases");
const SKIP = (id: string) => !fs.existsSync(path.join(DIR, `${id}.json`)) && "the case is not on this machine (data/cases is not in git)";

function load(id: string) {
    const c = JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), "utf8"));
    const base = upgradeLegacyCase(c) as unknown as SimulationCaseConfig;
    return { base, plan: c.live_plan as LivePlan };
}

function run(id: string, steps: Array<[string, number]>) {
    const { base, plan } = load(id);
    const c = compileLivePlan(base, plan);
    const engine = new EncounterEngine(c);
    const results = steps.map(([a, m]) => engine.giveIntervention(a, m * MIN));
    const end = plan.time_limit_minutes - 1;
    engine.advanceTo(end * MIN);
    const score = scoreBedside(c, plan, engine.events, end);
    // The server's replay must score exactly the same.
    const replayed = replayStudentEvents(c, engine.events.filter((e) => e.type === "INTERVENTION_GIVEN"));
    replayed.advanceTo((plan.time_limit_minutes - 1) * MIN);
    assert.deepEqual(scoreBedside(c, plan, replayed.events, end), score, "browser and server must agree");
    return { engine, results, score, plan };
}
const item = (s: ReturnType<typeof scoreBedside>, id: string) => s.items.find((i) => i.id === id)!;

const SE = "32-year-old-man-brought-in-fitting";
describe("status epilepticus: the second lorazepam dose depends on an explicit seizure finding", { skip: SE && SKIP(SE) }, () => {
    it("is still proposed, and passes the check", () => {
        const { base, plan } = load(SE);
        assert.equal(plan.status, "proposed");
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base)), { errors: [], warnings: [] });
        assert.deepEqual(plan.treatments.find((t) => t.id === "lorazepam_iv")!.repeat_only_while, { finding: "seizing", is: true });
    });

    it("correct care: still fitting at 5 minutes, so after a reassessment the second dose is required and given; the second-line drug then stops the seizure", () => {
        const { engine, score } = run(SE, [["high_flow_oxygen", 1], ["iv_access", 2], ["capillary_glucose_check", 2], ["lorazepam_iv", 3], ["reassess_patient", 7], ["lorazepam_iv", 8], ["second_line_antiseizure_iv", 10]]);
        assert.equal(engine.state.flags.finding_seizing, false);
        assert.equal(score.score, 100);
        assert.equal(score.outcome.recovered, true);
    });

    it("the old loophole stays closed: a second dose a minute after the first is refused and does not count", () => {
        const { engine, score } = run(SE, [["iv_access", 1], ["lorazepam_iv", 2], ["lorazepam_iv", 3], ["second_line_antiseizure_iv", 4]]);
        assert.equal(engine.state.flags[doseFlag("lorazepam_iv", 2)], false);
        assert.equal(engine.state.flags.finding_seizing, true, "the second-line drug alone does not stop this seizure");
        assert.equal(score.outcome.stabilised, false);
        assert.deepEqual(score.refused?.map((r) => r.reason), ["too_soon", "needs_first"]);
    });

    // Release blocker se_treatment_sequence: the order is not interchangeable.
    it("sequence: the second-line drug before two benzodiazepine doses is refused and does nothing; after them, it stops the seizure", () => {
        const { results, engine, score } = run(SE, [["iv_access", 1], ["lorazepam_iv", 2], ["second_line_antiseizure_iv", 4], ["reassess_patient", 6], ["lorazepam_iv", 7], ["second_line_antiseizure_iv", 8]]);
        assert.match(results[2].consequence, /^Not given: the second-line drug follows two doses of benzodiazepine/);
        assert.match(results[4].consequence, /do not stop/, "the second lorazepam dose alone does not stop it");
        assert.match(results[5].consequence, /the jerking stops/);
        assert.equal(engine.state.flagSetAt.finding_seizing, undefined, "no longer fitting");
        assert.equal(engine.state.flagSetAt.given_second_line_antiseizure_iv, 8 * MIN, "scored from the valid dose, not the refused one");
        assert.equal(item(score, "second_line_antiseizure_iv").at_minutes, 8);
        assert.deepEqual(score.refused?.map((r) => [r.id, r.reason]), [["second_line_antiseizure_iv", "needs_first"]]);
    });

    it("sequence: second-line first and no second lorazepam dose means the seizure never stops", () => {
        const { engine, score } = run(SE, [["iv_access", 1], ["lorazepam_iv", 2], ["second_line_antiseizure_iv", 4]]);
        assert.equal(engine.state.flags.finding_seizing, true);
        assert.equal(score.outcome.stabilised, false);
    });

    it("the second lorazepam dose needs a reassessment since the first, and IV lorazepam needs IV access", () => {
        const noReassess = run(SE, [["iv_access", 1], ["lorazepam_iv", 2], ["lorazepam_iv", 7]]);
        assert.deepEqual(noReassess.score.refused?.map((r) => r.reason), ["not_reassessed"]);
        const noAccess = run(SE, [["lorazepam_iv", 1]]);
        assert.match(noAccess.results[0].consequence, /^Not given: there is no IV access yet/);
    });

    it("after both doses, a third attempt is refused at the limit", () => {
        const { score } = run(SE, [["iv_access", 1], ["lorazepam_iv", 2], ["reassess_patient", 6], ["lorazepam_iv", 7], ["second_line_antiseizure_iv", 9], ["lorazepam_iv", 14]]);
        assert.deepEqual(score.refused?.map((r) => r.reason), ["limit"]);
    });
});

const OP = "24-year-old-man-brought-in-vomiting-and-drowsy";
describe("organophosphate: atropine doubled until the end points are met", { skip: OP && SKIP(OP) }, () => {
    const correct: Array<[string, number]> = [["iv_access", 1], ["high_flow_oxygen", 2], ["atropine_iv_titrated", 3], ["reassess_patient", 7], ["atropine_iv_titrated", 8], ["reassess_patient", 12], ["atropine_iv_titrated", 13], ["atropine_infusion", 14]];

    it("is still proposed, and passes the check", () => {
        const { base, plan } = load(OP);
        assert.equal(plan.status, "proposed");
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base)), { errors: [], warnings: [] });
    });

    it("correct care: atropinised after the third dose (chest clear, HR and SBP above 80); the infusion becomes required then", () => {
        const { engine, score } = run(OP, correct);
        assert.equal(engine.state.flags.finding_chest_wet, false);
        assert.equal(item(score, "atropine_infusion").required_at_minutes, 13);
        assert.equal(item(score, "intubation_rsi").status, "not_needed");
        assert.equal(score.score, 100);
    });

    it("the reassessment reports the end points explicitly, and a further dose without one is refused", () => {
        const { results } = run(OP, [["iv_access", 1], ["atropine_iv_titrated", 3], ["reassess_patient", 8], ["atropine_iv_titrated", 9]]);
        assert.equal(results[2].consequence, "Reassessment: Chest: still wet, with crackles. Pulse: 80 or below. Systolic: above 80.");
        const skipped = run(OP, [["iv_access", 1], ["atropine_iv_titrated", 3], ["atropine_iv_titrated", 8]]);
        assert.deepEqual(skipped.score.refused?.map((r) => r.reason), ["not_reassessed"]);
    });

    it("a further bolus once atropinised is refused as not indicated", () => {
        const { score } = run(OP, [...correct, ["reassess_patient", 18], ["atropine_iv_titrated", 19]]);
        assert.deepEqual(score.refused?.map((r) => r.reason), ["not_indicated"]);
        assert.equal(score.score, 100);
    });

    it("the dose count is not enough: with the pulse held down, three doses do not stabilise him and a fourth is needed", () => {
        const steps: Array<[string, number]> = [["iv_access", 1], ["high_flow_oxygen", 2], ["atropine_iv_titrated", 3], ["furosemide_iv", 4], ["gastric_lavage_unprotected", 5], ["reassess_patient", 7], ["atropine_iv_titrated", 8], ["reassess_patient", 12], ["atropine_iv_titrated", 13]];
        const three = run(OP, steps);
        assert.equal(three.score.outcome.stabilised, false);
        assert.ok(three.engine.state.rate <= 80, "HR is still at or below 80");
        const four = run(OP, [...steps, ["reassess_patient", 17], ["atropine_iv_titrated", 18]]);
        assert.equal(four.score.outcome.stabilised, true);
    });

    it("in respiratory failure, atropine alone no longer stabilises him; with intubation it does", () => {
        const late: Array<[string, number]> = [["iv_access", 8], ["high_flow_oxygen", 8], ["atropine_iv_titrated", 9], ["reassess_patient", 13], ["atropine_iv_titrated", 14], ["reassess_patient", 18], ["atropine_iv_titrated", 19], ["reassess_patient", 23], ["atropine_iv_titrated", 24]];
        const noTube = run(OP, late);
        assert.equal(noTube.score.outcome.stabilised, false);
        assert.equal(item(noTube.score, "intubation_rsi").status, "missed");
        // Steps go in time order: the engine never goes back in time.
        const tube = run(OP, [...late.slice(0, 7), ["intubation_rsi", 19], ...late.slice(7)]);
        assert.equal(tube.score.outcome.stabilised, true);
        assert.equal(tube.score.outcome.path, "Atropine to end points, with intubation and ventilation");
        assert.equal(item(tube.score, "intubation_rsi").status, "on_time");
        assert.equal(item(tube.score, "atropine_infusion").status, "not_due", "atropinised at 24 with the encounter ending at 25");
    });

    it("intubation and the suxamethonium trap are not on the tray before the fatigue stage", () => {
        const { engine, results } = run(OP, [["intubation_rsi", 2]]);
        assert.match(results[0].consequence, /^Not given:/);
        assert.equal(engine.state.flagSetAt[availableFlag("suxamethonium_intubation")], 13 * MIN);
    });
});

const ANA = "36-year-old-man-with-sudden-breathlessness";
describe("anaphylaxis: IM adrenaline while ABC problems persist, and the refractory pathway", { skip: ANA && SKIP(ANA) }, () => {
    const usual: Array<[string, number]> = [["im_adrenaline_0_5mg", 1], ["lie_flat_legs_raised", 2], ["high_flow_oxygen", 3], ["call_for_help_airway", 4], ["iv_access", 5]];

    it("is still proposed, and passes the check", () => {
        const { base, plan } = load(ANA);
        assert.equal(plan.status, "proposed");
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base)), { errors: [], warnings: [] });
    });

    it("correct care: the second IM dose is needed (airway still swollen at 5 minutes) and settles him; the refractory items are never needed", () => {
        const { score } = run(ANA, [...usual, ["crystalloid_bolus_500_1000ml", 6], ["im_adrenaline_0_5mg", 6]]);
        assert.equal(score.score, 100);
        assert.equal(score.outcome.path, "usual");
        assert.equal(item(score, "escalate_critical_care").status, "not_needed");
        assert.equal(item(score, "adrenaline_infusion_low_dose").status, "not_needed");
    });

    it("an infusion tried before he is refractory is refused and earns nothing", () => {
        const { engine, results } = run(ANA, [["iv_access", 1], ["adrenaline_infusion_low_dose", 2]]);
        assert.match(results[1].consequence, /^Not given:/);
        assert.equal(engine.state.flags[doseFlag("adrenaline_infusion_low_dose", 1)], false);
    });

    it("still shocked 5 minutes after two IM doses (no fluids): refractory, so critical care and the infusion become required", () => {
        const { score } = run(ANA, [...usual, ["im_adrenaline_0_5mg", 6]]);
        assert.equal(item(score, "adrenaline_infusion_low_dose").required_at_minutes, 11);
        assert.equal(item(score, "adrenaline_infusion_low_dose").status, "missed");
        assert.equal(item(score, "escalate_critical_care").status, "missed");
        assert.equal(score.outcome.stabilised, false);
    });

    // Release blocker anaphylaxis_recovery_endpoints.
    it("the refractory rescue never declares him stabilised or recovered while an end point is unmet: late rescue from peri-arrest stays unstabilised", () => {
        const late: Array<[string, number]> = [["im_adrenaline_0_5mg", 7], ["lie_flat_legs_raised", 7], ["high_flow_oxygen", 7], ["call_for_help_airway", 7], ["iv_access", 10], ["im_adrenaline_0_5mg", 12], ["crystalloid_bolus_500_1000ml", 12], ["escalate_critical_care", 18], ["adrenaline_infusion_low_dose", 18]];
        const { engine, score } = run(ANA, late);
        assert.ok(engine.state.spo2 < 92, `SpO2 ${engine.state.spo2} is still below 92`);
        assert.equal(score.outcome.stabilised, false);
        assert.equal(score.outcome.recovered, false);
    });

    it("whenever he is stabilised, on any path, the end points held at that moment (SBP 90 or more, SpO2 92 or more, airway settled)", () => {
        const scenarios: Array<Array<[string, number]>> = [
            [...usual, ["crystalloid_bolus_500_1000ml", 6], ["im_adrenaline_0_5mg", 6]],
            [...usual, ["im_adrenaline_0_5mg", 6], ["escalate_critical_care", 12], ["adrenaline_infusion_low_dose", 12], ["crystalloid_bolus_500_1000ml", 12]],
            [...usual, ["im_adrenaline_0_5mg", 6], ["crystalloid_bolus_500_1000ml", 9]],
            [["im_adrenaline_0_5mg", 4], ["lie_flat_legs_raised", 4], ["high_flow_oxygen", 5], ["iv_access", 5], ["crystalloid_bolus_500_1000ml", 6], ["im_adrenaline_0_5mg", 9], ["escalate_critical_care", 15], ["adrenaline_infusion_low_dose", 15]],
        ];
        let stabilisedCount = 0;
        const { base, plan } = load(ANA);
        const c = compileLivePlan(base, plan);
        for (const steps of scenarios) {
            const { engine } = run(ANA, steps);
            const i = engine.events.findIndex((e) => e.type === "STATE_TRANSITION" && e.trigger === "live_stabilised");
            if (i < 0) continue;
            stabilisedCount++;
            // The patient exactly as the engine judged him, just before it declared him stabilised.
            const before = PatientState.fromEvents(c, engine.events.slice(0, i));
            assert.ok(
                before.systolic >= 90 && before.spo2 >= 92 && before.flags.finding_airway_swelling === false,
                `stabilised at ${engine.events[i].timestamp / 60} min with BP ${before.systolic}, SpO2 ${before.spo2}`
            );
        }
        assert.ok(stabilisedCount >= 2, "at least the usual and the refractory path were exercised");
    });

    it("refractory, then rescued: escalation, infusion and fluids stabilise him through the refractory pathway, and IM doses stop", () => {
        const { score } = run(ANA, [...usual, ["im_adrenaline_0_5mg", 6], ["escalate_critical_care", 12], ["adrenaline_infusion_low_dose", 12], ["crystalloid_bolus_500_1000ml", 12], ["im_adrenaline_0_5mg", 13]]);
        assert.equal(score.outcome.stabilised, true);
        assert.equal(score.outcome.path, "Refractory pathway: adrenaline infusion, with fluids and lying flat");
        assert.equal(item(score, "adrenaline_infusion_low_dose").status, "on_time");
        assert.deepEqual(score.refused?.map((r) => r.reason), ["not_indicated"], "no IM dose once the infusion is running");
    });
});
