// Release blockers on a live plan: while one is open the plan cannot reach students, even if it is marked approved,
// and a changed plan keeps them.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { upgradeLegacyCase } from "../legacy-adapter";
import fs from "fs";
import path from "path";
import { carryReleaseBlockers, isLivePlanCase, liveForStudents, livePlanApplies, openReleaseBlockers, withLivePlan, type LivePlan } from "../live-plan";
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

describe("release blockers: the library's list uses the same rule as the case", () => {
    it("a switched-on plan with an open blocker is not listed as live; cleared or none, it is", () => {
        assert.equal(liveForStudents("approved", [open]), false);
        assert.equal(liveForStudents("approved", [cleared]), true);
        assert.equal(liveForStudents("approved", null), true);
        assert.equal(liveForStudents("proposed", null), false);
        assert.equal(liveForStudents("approved", [{ id: "x" }]), false, "a blocker that cannot be read counts as open");
    });

    it("every real plan on this machine: none reaches students while a blocker is open", () => {
        const dir = path.join(process.cwd(), "data", "cases");
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
        for (const f of files) {
            const c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
            if (!c.live_plan) continue;
            if (openReleaseBlockers(c.live_plan).length === 0) continue;
            for (const status of ["proposed", "approved"] as const) {
                const asStored = { ...c.live_plan, status };
                assert.equal(livePlanApplies(asStored, false), false, `${c.id} (${status}) must not reach students`);
                assert.equal(liveForStudents(asStored.status, asStored.release_blockers), false);
            }
        }
    });
});
