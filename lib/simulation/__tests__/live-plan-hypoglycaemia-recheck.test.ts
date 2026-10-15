// The finger-prick recheck on the hypoglycaemia plan (data/cases, not in git): JBDS says recheck 10 minutes after
// treatment. It is a second, optional reading: refused if too soon, state-dependent, and never scored or harmful.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { checkLivePlan, compileLivePlan, measuredOnArrival, scoreBedside, type LivePlan } from "../live-plan";

const ID = "58-year-old-man-who-is-sweaty-and-hard-to-wake";
const FILE = path.join(process.cwd(), "data", "cases", `${ID}.json`);
const MIN = 60;

describe("hypoglycaemia: the 10-minute glucose recheck", { skip: !fs.existsSync(FILE) && "the case is not on this machine (data/cases is not in git)" }, () => {
    const c = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const plan = c.live_plan as LivePlan;
    const base = upgradeLegacyCase(c) as unknown as SimulationCaseConfig;
    const play = (steps: Array<[string, number]>) => {
        const cfg = compileLivePlan(base, plan);
        const e = new EncounterEngine(cfg);
        const out = steps.map(([a, m]) => String(e.giveIntervention(a, m * MIN).consequence));
        return { cfg, e, out };
    };

    it("passes the check, is still proposed, and keeps its blockers", () => {
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base)), { errors: [], warnings: [] });
        assert.equal(plan.status, "proposed");
        assert.ok((plan.release_blockers ?? []).some((b) => b.id === "clinical_review" && !b.cleared_at));
    });

    it("refuses a recheck before 10 minutes, and does not count it", () => {
        const { out } = play([["capillary_glucose_check", 1], ["capillary_glucose_check", 5]]);
        assert.match(out[0], /34 mg\/dL/);
        assert.match(out[1], /^Not given/);
    });

    it("after IV glucose the recheck reads 128 mg/dL", () => {
        const { out } = play([["capillary_glucose_check", 1], ["iv_access", 2], ["iv_glucose_10_percent", 3], ["capillary_glucose_check", 13]]);
        assert.match(out[3], /128 mg\/dL/);
    });

    it("after glucagon alone the recheck says the glucose is still below target and gives no invented number", () => {
        const { out } = play([["capillary_glucose_check", 1], ["glucagon_im", 2], ["capillary_glucose_check", 12]]);
        assert.match(out[2], /still below the 72 mg\/dL/);
        assert.doesNotMatch(out[2], /\b\d{2,3} mg\/dL\./);
    });

    it("scoring is unchanged by the recheck", () => {
        const a = play([["capillary_glucose_check", 1], ["iv_access", 2], ["iv_glucose_10_percent", 3]]);
        const b = play([["capillary_glucose_check", 1], ["iv_access", 2], ["iv_glucose_10_percent", 3], ["capillary_glucose_check", 13]]);
        const end = plan.time_limit_minutes - 1;
        a.e.advanceTo(end * MIN); b.e.advanceTo(end * MIN);
        assert.deepEqual(scoreBedside(a.cfg, plan, a.e.events, end).items, scoreBedside(b.cfg, plan, b.e.events, end).items);
    });
});
