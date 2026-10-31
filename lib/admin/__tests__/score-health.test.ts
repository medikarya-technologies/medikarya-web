import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { scoreHealth } from "../score-health";

const attempt = (over: Record<string, unknown> = {}) => ({
    feedback_json: { historyScore: 12.5, testingScore: 10, reasoningScore: 15, diagnosisScore: 15, managementScore: 5, ...over },
});

describe("score health", () => {
    it("averages each part as a share of its maximum", () => {
        const h = scoreHealth([attempt(), attempt({ historyScore: 25 })]);
        assert.equal(h.attempts, 2);
        assert.deepEqual(Object.fromEntries(h.parts.map((p) => [p.id, p.average])), { history: 75, tests: 50, reasoning: 50, diagnosis: 100, management: 50 });
    });

    it("flags a part stuck near zero or near full marks", () => {
        // what history looked like before version 2: a few marks out of 25 for everyone
        const h = scoreHealth(Array.from({ length: 10 }, () => attempt({ historyScore: 1.8 })));
        assert.equal(h.parts.find((p) => p.id === "history")!.flag, "low");
        assert.equal(h.parts.find((p) => p.id === "diagnosis")!.flag, "high");
        assert.equal(h.parts.find((p) => p.id === "tests")!.flag, null);
    });

    it("counts only classic-scored attempts, newest first up to the limit", () => {
        const rows = [
            { feedback_json: { historyScore: 0, simulation: { domains: { clinical_reasoning: 80 } } } },
            attempt({ scoringVersion: { history: 2 } }),
            attempt(),
            attempt(),
        ];
        const h = scoreHealth(rows, 2);
        assert.equal(h.attempts, 2);
        assert.equal(h.historyV2, 1);
    });

    it("has nothing to flag with no attempts", () => {
        const h = scoreHealth([]);
        assert.equal(h.attempts, 0);
        assert.ok(h.parts.every((p) => p.flag === null));
    });
});
