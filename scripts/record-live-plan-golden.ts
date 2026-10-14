// Records what today's compiler and engine do with every live plan, so a later engine change can prove that plans
// which do not use its new fields behave exactly as before (lib/simulation/__tests__/live-plan-golden.test.ts).
// Real cases (data/cases, not in git) are recorded as hashes and scores only; the synthetic fixture in full.
// Run only when the change in behaviour is intended:
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/record-live-plan-golden.ts
import fs from "fs";
import path from "path";
const R = "../lib/simulation/";
const { upgradeLegacyCase } = require(R + "legacy-adapter");
const { compileLivePlan } = require(R + "live-plan");
const { playthroughs, canonicalJson, sha256, planSha, compiledSha } = require(R + "live-plan-playthrough");
const { goldenFixtureCase, goldenFixturePlan } = require(R + "__tests__/live-plan-golden-fixture");

const OUT = path.resolve(__dirname, "../lib/simulation/__tests__/golden");
const record = (caseJson: any, plan: any) => {
    const base = upgradeLegacyCase(caseJson);
    const compiled = compileLivePlan(base, plan);
    return { plan_sha: planSha(plan), compiled_sha: compiledSha(compiled), playthroughs: playthroughs(base, plan), compiled };
};

const cases: Record<string, unknown> = {};
const dir = path.resolve(__dirname, "../data/cases");
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (!c.live_plan) continue;
    const { compiled, ...rest } = record(c, c.live_plan);
    cases[c.id] = rest;
}
fs.writeFileSync(path.join(OUT, "live-plans.json"), JSON.stringify(cases, null, 2) + "\n");

const fx = record(goldenFixtureCase, goldenFixturePlan);
fs.writeFileSync(path.join(OUT, "fixture-compiled.json"), canonicalJson(fx.compiled) + "\n");
fs.writeFileSync(path.join(OUT, "fixture-playthroughs.json"), JSON.stringify({ plan_sha: fx.plan_sha, compiled_sha: fx.compiled_sha, playthroughs: fx.playthroughs }, null, 2) + "\n");
console.log(`recorded ${Object.keys(cases).length} real plans and the fixture`);
