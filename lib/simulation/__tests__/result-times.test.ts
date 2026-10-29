// Real result times: a case that runs for hours can make tests take their real ward times (a CBC 15 minutes, a blood
// culture a day), so the student acts before the result or skips ahead to it. Every other case keeps quick results.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { MAX_RESULT_WAIT_SECONDS, turnaroundMinutes } from "../case-resolvers";
import { upgradeLegacyCase } from "../legacy-adapter";
import { checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan } from "../live-plan";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

const config = (over: Partial<SimulationCaseConfig>): SimulationCaseConfig =>
    ({
        custom_tests: [
            { id: "cbc", name: "CBC", category: "haematology", kind: "lab", turnaround_minutes: 0.25 },
            { id: "bedside_scan", name: "Bedside scan", category: "imaging", kind: "imaging", turnaround_minutes: 0.4 },
        ],
        investigation_results: { cbc: { turnaround_minutes: 0.1 } },
        ...over,
    }) as unknown as SimulationCaseConfig;

describe("result times", () => {
    it("by default a case's own times stand and a catalog test is scaled down, never past 30 real seconds", () => {
        const c = config({});
        assert.equal(turnaroundMinutes(c, "cbc"), 0.1, "the case's override");
        assert.equal(turnaroundMinutes(c, "bedside_scan"), 0.4, "the case's own test");
        assert.equal(turnaroundMinutes(c, "blood_culture"), MAX_RESULT_WAIT_SECONDS / 60, "a day, capped at 30 seconds");
    });

    it("with real result times every test takes its real catalog time, and the case's playing times are ignored", () => {
        const c = config({ clinical_constraints: { result_times: "real" } });
        assert.equal(turnaroundMinutes(c, "cbc"), 15);
        assert.equal(turnaroundMinutes(c, "blood_culture"), 1440, "a day, uncapped");
        assert.equal(turnaroundMinutes(c, "bedside_scan"), 30, "not in the catalog: the usual time for its kind");
    });

    const base = upgradeLegacyCase(goldenFixtureCase as Record<string, unknown>) as unknown as SimulationCaseConfig;

    it("a live plan carries the setting into the encounter, and leaving it out changes nothing", () => {
        const real = normaliseLivePlan({ ...goldenFixturePlan, result_times: "real" }, "ai");
        assert.equal(real.result_times, "real");
        assert.equal(compileLivePlan(base, real).clinical_constraints?.result_times, "real");
        const quick = normaliseLivePlan(goldenFixturePlan, "ai");
        assert.equal("result_times" in quick, false);
        assert.equal(compileLivePlan(base, quick).clinical_constraints?.result_times, undefined);
        assert.equal("result_times" in normaliseLivePlan({ ...goldenFixturePlan, result_times: "slow" }, "ai"), false, "only \"real\" is read");
    });

    it("the plan check warns when real times are set on a short encounter", () => {
        const { warnings } = checkLivePlan(normaliseLivePlan({ ...goldenFixturePlan, result_times: "real" }, "ai"), measuredOnArrival(base));
        assert.ok(warnings.some((w) => /result_times "real" in a 20-minute encounter/.test(w)));
    });
});
