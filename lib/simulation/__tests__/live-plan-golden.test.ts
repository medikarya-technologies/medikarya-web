// Backward compatibility of the live-plan compiler (scripts/record-live-plan-golden.ts). A plan that does not use a new
// field must compile to exactly the same engine rules and play exactly the same: untreated, correct, with harmful
// treatments, and late. Re-recorded on purpose on 2026-10-31, when every plan gained the course after treatment
// (a late recovery and lasting harm, lateRecoveries and lastingEffect in live-plan.ts).
// Re-recorded again the same day when every case gained history.reference_questions: the compiled rules carry a copy
// of the case's history section, so 14 compiled hashes moved; every plan and every playthrough stayed identical.
// And once more when nine cases' required history questions were reworded (two of them live): same reason, same result.
//
// The synthetic fixture is committed in full and runs everywhere. The real plans (data/cases, not in git) are checked
// wherever they are present, and only while the plan itself is unchanged: an edited plan is re-recorded on purpose.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { upgradeLegacyCase } from "../legacy-adapter";
import { compileLivePlan, isLivePlan, type LivePlan } from "../live-plan";
import { canonicalJson, compiledSha, planSha, playthroughs } from "../live-plan-playthrough";
import type { SimulationCaseConfig } from "../case-schema";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

// Paths from the repo root: the test runner compiles tests into node_modules/.cache first, so __dirname moves.
const GOLDEN = path.join(process.cwd(), "lib", "simulation", "__tests__", "golden");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(GOLDEN, f), "utf8"));
const base = (c: unknown) => upgradeLegacyCase(c as Record<string, unknown>) as unknown as SimulationCaseConfig;

describe("live plan golden: the synthetic fixture (committed in full)", () => {
    const plan = goldenFixturePlan as unknown as LivePlan;

    it("is a plan the site recognises", () => assert.equal(isLivePlan(plan), true));

    it("compiles to exactly the recorded engine rules", () => {
        const compiled = canonicalJson(compileLivePlan(base(goldenFixtureCase), plan));
        assert.equal(compiled, fs.readFileSync(path.join(GOLDEN, "fixture-compiled.json"), "utf8").trim());
    });

    it("plays exactly as recorded: untreated, correct, harmful and late", () => {
        assert.deepEqual(JSON.parse(JSON.stringify(playthroughs(base(goldenFixtureCase), plan))), read("fixture-playthroughs.json").playthroughs);
    });
});

describe("live plan golden: every real plan present on this machine", () => {
    const golden = read("live-plans.json") as Record<string, { plan_sha: string; compiled_sha: string; playthroughs: unknown }>;
    const dir = path.join(process.cwd(), "data", "cases");
    const present = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

    for (const f of present) {
        const c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        if (!c.live_plan) continue;
        const g = golden[c.id];

        it(`${c.id}: the site recognises its plan`, () => assert.equal(isLivePlan(c.live_plan), true, "isLivePlan must accept every stored plan"));

        if (!g || g.plan_sha !== planSha(c.live_plan)) continue; // a new or edited plan: nothing to compare

        it(`${c.id}: compiles and plays exactly as recorded`, () => {
            assert.equal(compiledSha(compileLivePlan(base(c), c.live_plan)), g.compiled_sha, "compiled engine rules changed");
            assert.deepEqual(JSON.parse(JSON.stringify(playthroughs(base(c), c.live_plan))), g.playthroughs);
        });
    }
});
