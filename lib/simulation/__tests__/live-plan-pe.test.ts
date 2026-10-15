// High-risk pulmonary embolism on the real plan (data/cases, not in git): IV-access prerequisites, thrombolysis and
// heparin as the stabilising treatments, the harmful actions, the reassessment, and browser/server parity. Runs where
// the case is present.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { checkLivePlan, compileLivePlan, measuredOnArrival, REASSESS_ID, scoreBedside, type LivePlan } from "../live-plan";

const ID = "48-year-old-man-who-suddenly-could-not-breathe-and-fainted";
const FILE = path.join(process.cwd(), "data", "cases", `${ID}.json`);
const MIN = 60;

describe("pulmonary embolism: prerequisites, thrombolysis, harm and reassessment", { skip: !fs.existsSync(FILE) && "the case is not on this machine (data/cases is not in git)" }, () => {
    const c = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const plan = c.live_plan as LivePlan;
    const base = upgradeLegacyCase(c) as unknown as SimulationCaseConfig;
    const end = plan.time_limit_minutes - 1;

    function run(steps: Array<[string, number]>, to = end) {
        const cfg = compileLivePlan(base, plan);
        const e = new EncounterEngine(cfg);
        const results = steps.map(([a, m]) => String(e.giveIntervention(a, m * MIN).consequence));
        e.advanceTo(to * MIN);
        const score = scoreBedside(cfg, plan, e.events, to);
        // The server's replay must give the same score and the same patient.
        const r = replayStudentEvents(cfg, e.events.filter((x) => x.type === "INTERVENTION_GIVEN"));
        r.advanceTo(to * MIN);
        assert.deepEqual(scoreBedside(cfg, plan, r.events, to), score, "browser and server must agree");
        assert.deepEqual(r.state.snapshot(), e.state.snapshot(), "browser and server must leave the same patient");
        return { e, results, score };
    }
    const stable = (e: EncounterEngine) => e.state.flags.live_stabilised === true || e.state.flagSetAt.live_stabilised !== undefined;
    const CORRECT: Array<[string, number]> = [["high_flow_oxygen", 1], ["iv_access", 2], ["heparin_ufh_bolus", 3], ["systemic_thrombolysis_pe", 4]];

    it("is still proposed, passes the check, and keeps its clinical-review blocker open", () => {
        assert.equal(plan.status, "proposed");
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base)), { errors: [], warnings: [] });
        assert.ok((plan.release_blockers ?? []).some((b) => b.id === "clinical_review" && !b.cleared_at));
    });

    it("refuses heparin, thrombolysis and noradrenaline without IV access, and nothing is counted", () => {
        const { results, score } = run([["heparin_ufh_bolus", 1], ["systemic_thrombolysis_pe", 2], ["noradrenaline_infusion", 3]]);
        for (const r of results) assert.match(r, /^Not given: there is no IV access yet\./);
        assert.ok(score.items.filter((i) => ["heparin_ufh_bolus", "systemic_thrombolysis_pe"].includes(i.id)).every((i) => i.status === "missed"));
    });

    it("correct care stabilises him and scores full marks", () => {
        const { e, score, results } = run(CORRECT);
        assert.match(results[3], /full dose runs over 2 hours/);
        assert.ok(stable(e), "stabilised");
        assert.equal(score.score, 100);
        assert.ok(e.state.systolic > 90);
    });

    it("thrombolysis is still a stabilising treatment on its own timeline: it has to come with IV access and heparin", () => {
        const noHeparin = run([["high_flow_oxygen", 1], ["iv_access", 2], ["systemic_thrombolysis_pe", 3]]);
        assert.ok(!stable(noHeparin.e), "heparin is part of the stabilising set");
        const noLysis = run([["high_flow_oxygen", 1], ["iv_access", 2], ["heparin_ufh_bolus", 3]]);
        assert.ok(!stable(noLysis.e), "heparin alone does not reverse the shock");
    });

    it("untreated he is peri-arrest and never stabilised", () => {
        const { e, score } = run([]);
        assert.ok(!stable(e));
        assert.equal(score.score, 0);
    });

    it("thrombolysis at the end of its 15-minute window is still on time, and later it is late", () => {
        const base2: Array<[string, number]> = [["high_flow_oxygen", 1], ["iv_access", 2], ["heparin_ufh_bolus", 3]];
        const onTime = run([...base2, ["systemic_thrombolysis_pe", 15]]);
        const lateRun = run([...base2, ["systemic_thrombolysis_pe", 17]]);
        assert.equal(onTime.score.items.find((i) => i.id === "systemic_thrombolysis_pe")!.status, "on_time");
        assert.equal(lateRun.score.items.find((i) => i.id === "systemic_thrombolysis_pe")!.status, "late");
        assert.ok(lateRun.score.score < onTime.score.score);
    });

    it("the three harmful actions are flagged and cost marks", () => {
        const { score } = run([...CORRECT, ["fluid_two_litres", 5], ["furosemide_iv", 6], ["ctpa_before_treatment", 7]]);
        assert.deepEqual(score.harmful.map((h) => h.id).sort(), ["ctpa_before_treatment", "fluid_two_litres", "furosemide_iv"]);
        assert.equal(score.score, 55);
    });

    it("the reassessment reports the systolic BP", () => {
        const first = run([[REASSESS_ID, 1]]).results[0];
        assert.match(first, /below 90 mmHg/);
        const after = run([...CORRECT, [REASSESS_ID, 20]]).results.at(-1)!;
        assert.match(after, /above 90 mmHg/);
    });
});
