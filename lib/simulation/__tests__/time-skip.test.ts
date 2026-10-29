// Waiting at the bedside: the choices offered, the summary after a wait, and that a wait still stops at a nurse alert.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { sanitizeEvents } from "../encounter-events";
import { upgradeLegacyCase } from "../legacy-adapter";
import { compileLivePlan, normaliseLivePlan } from "../live-plan";
import type { PatientSnapshot } from "../patient-state";
import { describeSkip, formatSpan, waitSteps } from "../time-skip";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

const snap = (over: Partial<PatientSnapshot>): PatientSnapshot =>
    ({ rate: 122, systolic: 100, diastolic: 86, spo2: 96, rr: 24, consciousness: "alert", ...over }) as PatientSnapshot;

describe("time skip: which waits are offered", () => {
    it("a short case offers 1 and 5 minutes; one that runs for hours offers hours too", () => {
        assert.deepEqual(waitSteps(25 * 60, 0), [1, 5]);
        assert.deepEqual(waitSteps(48 * 3600, 0), [1, 5, 15, 30, 60, 120, 240]);
    });

    it("only waits that fit in what is left of the encounter", () => {
        assert.deepEqual(waitSteps(25 * 60, 22 * 60), [1]);
        assert.deepEqual(waitSteps(25 * 60, 24.5 * 60), []);
        assert.deepEqual(waitSteps(48 * 3600, 48 * 3600 - 45 * 60), [1, 5, 15, 30]);
    });

    it("spans read as a person would say them", () => {
        assert.deepEqual([12, 60, 285, 299, 300, 3600, 5400, 7200].map(formatSpan), ["12 s", "1 min", "4 min 45 s", "5 min", "5 min", "1 h", "1 h 30 min", "2 h"]);
    });
});

describe("time skip: the summary after a wait", () => {
    it("says how long passed, what changed on the monitor and which results came back", () => {
        const s = describeSkip({
            from: 600,
            to: 600 + 7200,
            stopped: null,
            before: snap({}),
            after: snap({ rate: 104, systolic: 112, diastolic: 80 }),
            resultsBack: ["Complete blood count (CBC)"],
        });
        assert.equal(s.title, "2 h passed");
        assert.deepEqual(s.lines, ["Pulse 122 → 104, BP 100/86 → 112/80.", "Result back: Complete blood count (CBC)."]);
    });

    it("an early stop says why, and how long really passed", () => {
        const s = describeSkip({ from: 0, to: 240, stopped: "alert", before: snap({}), after: snap({ systolic: 96, consciousness: "drowsy" }), resultsBack: [] });
        assert.equal(s.title, "Stopped after 4 min: the nurse is calling");
        assert.deepEqual(s.lines, ["BP 100/86 → 96/86.", "Consciousness: alert → drowsy."]);
    });

    it("nothing changed: it says so, and never shows a vital the case does not measure", () => {
        const s = describeSkip({ from: 0, to: 300, stopped: null, before: snap({}), after: snap({}), resultsBack: [], unmeasured: ["bp"] });
        assert.deepEqual(s.lines, ["No change: pulse 122, SpO2 96%, RR 24."]);
        const hidden = describeSkip({ from: 0, to: 300, stopped: null, before: snap({}), after: snap({ systolic: 80 }), resultsBack: [], unmeasured: ["bp"] });
        assert.ok(!hidden.lines.join(" ").includes("BP"), "a change in an unmeasured vital is not revealed");
    });
});

describe("time skip: the engine's wait", () => {
    const config = compileLivePlan(upgradeLegacyCase(goldenFixtureCase as Record<string, unknown>) as unknown as SimulationCaseConfig, normaliseLivePlan(goldenFixturePlan, "ai"));

    it("a long wait in an untreated patient stops at the first nurse alert", () => {
        const e = new EncounterEngine(config);
        const before = e.state.snapshot();
        const w = e.skipTime(0, 60 * 60);
        assert.equal(w.stopped, "alert");
        assert.equal(w.to, 6 * 60, "the fixture's first deterioration is at 6 minutes");
        const s = describeSkip({ from: 0, to: w.to, stopped: w.stopped, before, after: e.state.snapshot(), resultsBack: [] });
        assert.equal(s.title, "Stopped after 6 min: the nurse is calling");
    });

    it("a wait of a few seconds (skipping to a result) is logged as a valid wait, so it survives a resume", () => {
        const e = new EncounterEngine(config);
        e.skipTime(0, 4);
        const logged = e.events.at(-1);
        assert.equal(logged?.type, "TIME_SKIPPED");
        assert.equal(logged?.type === "TIME_SKIPPED" && logged.minutes, 0.1);
        assert.equal(sanitizeEvents(JSON.parse(JSON.stringify(e.events))).length, e.events.length);
    });
});
