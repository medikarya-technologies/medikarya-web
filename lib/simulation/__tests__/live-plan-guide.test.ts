// The AI drafter's guide to a live plan's optional fields must match the engine: every field it names is one the
// plan reads, and its worked example passes the site's own check and compiles.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { upgradeLegacyCase } from "../legacy-adapter";
import { validateSimulationCase } from "../validate-config";
import { checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan } from "../live-plan";
import { ADVANCED_EXAMPLE, ADVANCED_FIELDS, ADVANCED_FIELDS_GUIDE } from "../live-plan-guide";
import { playthroughs } from "../live-plan-playthrough";
import { goldenFixtureCase } from "./live-plan-golden-fixture";

const base = () => upgradeLegacyCase(goldenFixtureCase as unknown as Record<string, unknown>) as unknown as SimulationCaseConfig;

describe("the drafter's guide to optional fields", () => {
    it("describes every optional field", () => {
        for (const f of ADVANCED_FIELDS) assert.match(ADVANCED_FIELDS_GUIDE, new RegExp(`\\b${f}\\b`), f);
    });

    it("its example uses every optional field, and the normaliser keeps them all", () => {
        const plan = normaliseLivePlan(ADVANCED_EXAMPLE, "ai") as unknown as Record<string, unknown>;
        const treatments = plan.treatments as Array<Record<string, unknown>>;
        for (const f of ADVANCED_FIELDS) {
            const used = f in plan || treatments.some((t) => f in t);
            assert.ok(used, `${f} is in the example and survives normalising`);
        }
    });

    it("its example passes the check, compiles, validates and plays", () => {
        const plan = normaliseLivePlan(ADVANCED_EXAMPLE, "ai");
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base())).errors, []);
        const compiled = compileLivePlan(base(), plan);
        assert.deepEqual(validateSimulationCase(compiled).errors ?? [], []);
        const p = playthroughs(base(), plan);
        assert.equal(p.correct.outcome.stabilised, true);
        assert.ok(p.rescue, "a plan with a conditional rescue gets a rescue playthrough");
    });

    it("tells the model never to invent a threshold, dose or interval", () => {
        assert.match(ADVANCED_FIELDS_GUIDE, /Never invent a threshold, a dose or an interval/);
    });
});
