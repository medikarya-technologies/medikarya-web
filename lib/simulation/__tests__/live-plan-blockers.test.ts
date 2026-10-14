// Release blockers on a live plan: while one is open the plan cannot reach students, even if it is marked approved,
// and a changed plan keeps them.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { upgradeLegacyCase } from "../legacy-adapter";
import { carryReleaseBlockers, isLivePlanCase, livePlanApplies, openReleaseBlockers, withLivePlan, type LivePlan } from "../live-plan";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

const plan = (over: Partial<LivePlan> = {}): LivePlan => ({ ...(JSON.parse(JSON.stringify(goldenFixturePlan)) as LivePlan), ...over });
const open = { id: "sequence", text: "A clinician has to confirm the treatment sequence.", raised_at: "2026-10-14T00:00:00Z" };
const cleared = { ...open, id: "old", cleared_at: "2026-10-14T01:00:00Z", cleared_by: "Dr X", resolution: "Confirmed." };

describe("release blockers", () => {
    it("an approved plan with an open blocker does not reach students; admins still play-test it", () => {
        const p = plan({ status: "approved", release_blockers: [open] });
        assert.equal(livePlanApplies(p, false), false);
        assert.equal(livePlanApplies(p, true), true);
        const base = { ...(upgradeLegacyCase(goldenFixtureCase as unknown as Record<string, unknown>) as unknown as SimulationCaseConfig), live_plan: p };
        assert.equal(isLivePlanCase(withLivePlan(base, false)), false, "students get the ordinary case");
        assert.equal(isLivePlanCase(withLivePlan(base, true)), true);
    });

    it("a cleared blocker no longer blocks, and is kept as a record", () => {
        const p = plan({ status: "approved", release_blockers: [cleared] });
        assert.deepEqual(openReleaseBlockers(p), []);
        assert.equal(livePlanApplies(p, false), true);
    });

    it("a plan without blockers behaves exactly as before", () => {
        assert.equal(livePlanApplies(plan({ status: "approved" }), false), true);
        assert.equal(livePlanApplies(plan({ status: "proposed" }), false), false);
    });

    it("a new or changed plan keeps the case's blockers, open and cleared", () => {
        const next = carryReleaseBlockers(plan(), plan({ release_blockers: [open, cleared] }));
        assert.deepEqual(next.release_blockers, [open, cleared]);
        assert.equal("release_blockers" in carryReleaseBlockers(plan(), plan()), false);
    });
});
