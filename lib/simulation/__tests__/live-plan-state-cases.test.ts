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
    engine.advanceTo((plan.time_limit_minutes - 1) * MIN);
    const score = scoreBedside(c, plan, engine.events);
    // The server's replay must score exactly the same.
    const replayed = replayStudentEvents(c, engine.events.filter((e) => e.type === "INTERVENTION_GIVEN"));
    replayed.advanceTo((plan.time_limit_minutes - 1) * MIN);
    assert.deepEqual(scoreBedside(c, plan, replayed.events), score, "browser and server must agree");
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

    it("correct care: still fitting at 5 minutes, so the second dose is required and given; the seizure stops when both doses and the second-line drug are in", () => {
        const { engine, score } = run(SE, [["high_flow_oxygen", 1], ["iv_access", 2], ["capillary_glucose_check", 2], ["lorazepam_iv", 3], ["lorazepam_iv", 8], ["second_line_antiseizure_iv", 10]]);
        assert.equal(engine.state.flags.finding_seizing, false);
        assert.equal(score.score, 100);
        assert.equal(score.outcome.recovered, true);
    });

    it("the old loophole stays closed: a second dose a minute after the first is refused and does not count", () => {
        const { engine, score } = run(SE, [["iv_access", 1], ["lorazepam_iv", 2], ["lorazepam_iv", 3], ["second_line_antiseizure_iv", 4]]);
        assert.equal(engine.state.flags[doseFlag("lorazepam_iv", 2)], false);
        assert.equal(engine.state.flags.finding_seizing, true, "the second-line drug alone does not stop this seizure");
        assert.equal(score.outcome.stabilised, false);
        assert.deepEqual(score.refused?.map((r) => r.reason), ["too_soon"]);
    });

    it("either order stops it: second-line first, then the second lorazepam dose", () => {
        const { results, engine } = run(SE, [["iv_access", 1], ["lorazepam_iv", 2], ["second_line_antiseizure_iv", 4], ["lorazepam_iv", 7]]);
        assert.match(results[3].consequence, /the jerking stops/);
        assert.equal(engine.state.flags.finding_seizing, false);
        assert.equal(engine.state.flags.live_stabilised, true);
    });

    it("after both doses, a third attempt is refused at the limit (in this case only the later of dose 2 and the second-line drug stops the seizure)", () => {
        const { score } = run(SE, [["iv_access", 1], ["lorazepam_iv", 2], ["lorazepam_iv", 7], ["second_line_antiseizure_iv", 9], ["lorazepam_iv", 14]]);
        assert.deepEqual(score.refused?.map((r) => r.reason), ["limit"]);
    });
});

const OP = "24-year-old-man-brought-in-vomiting-and-drowsy";
describe("organophosphate: atropine doubled until the end points are met", { skip: OP && SKIP(OP) }, () => {
    const correct: Array<[string, number]> = [["iv_access", 1], ["high_flow_oxygen", 2], ["atropine_iv_titrated", 3], ["atropine_iv_titrated", 8], ["atropine_iv_titrated", 13], ["atropine_infusion", 14]];

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

    it("a further bolus once atropinised is refused as not indicated", () => {
        const { score } = run(OP, [...correct, ["atropine_iv_titrated", 19]]);
        assert.deepEqual(score.refused?.map((r) => r.reason), ["not_indicated"]);
        assert.equal(score.score, 100);
    });

    it("the dose count is not enough: with the pulse held down, three doses do not stabilise him and a fourth is needed", () => {
        const steps: Array<[string, number]> = [["iv_access", 1], ["high_flow_oxygen", 2], ["atropine_iv_titrated", 3], ["furosemide_iv", 4], ["gastric_lavage_unprotected", 5], ["atropine_iv_titrated", 8], ["atropine_iv_titrated", 13]];
        const three = run(OP, steps);
        assert.equal(three.score.outcome.stabilised, false);
        assert.ok(three.engine.state.rate <= 80, "HR is still at or below 80");
        const four = run(OP, [...steps, ["atropine_iv_titrated", 18]]);
        assert.equal(four.score.outcome.stabilised, true);
    });

    it("in respiratory failure, atropine alone no longer stabilises him; with intubation it does", () => {
        const late: Array<[string, number]> = [["iv_access", 8], ["high_flow_oxygen", 8], ["atropine_iv_titrated", 9], ["atropine_iv_titrated", 14], ["atropine_iv_titrated", 19], ["atropine_iv_titrated", 24]];
        const noTube = run(OP, late);
        assert.equal(noTube.score.outcome.stabilised, false);
        assert.equal(item(noTube.score, "intubation_rsi").status, "missed");
        // Steps go in time order: the engine never goes back in time.
        const tube = run(OP, [...late.slice(0, 5), ["intubation_rsi", 19], late[5]]);
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

    it("refractory, then rescued: escalation, infusion and fluids stabilise him through the refractory pathway, and IM doses stop", () => {
        const { score } = run(ANA, [...usual, ["im_adrenaline_0_5mg", 6], ["escalate_critical_care", 12], ["adrenaline_infusion_low_dose", 12], ["crystalloid_bolus_500_1000ml", 12], ["im_adrenaline_0_5mg", 13]]);
        assert.equal(score.outcome.stabilised, true);
        assert.equal(score.outcome.path, "Refractory pathway: adrenaline infusion, with fluids and lying flat");
        assert.equal(item(score, "adrenaline_infusion_low_dose").status, "on_time");
        assert.deepEqual(score.refused?.map((r) => r.reason), ["not_indicated"], "no IM dose once the infusion is running");
    });
});
