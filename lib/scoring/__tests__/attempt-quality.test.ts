import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { scoreForPersistence, xpForScore } from "../score-attempt";

describe("provisional attempts", () => {
    it("do not receive a final database score or XP until re-scored", () => {
        assert.equal(scoreForPersistence(72.4, true), null);
        assert.equal(xpForScore(72.4, 50, true), 0);
    });

    it("preserves ordinary final marks and rewards", () => {
        assert.equal(scoreForPersistence(72.4, false), 72);
        assert.equal(xpForScore(72.4, 50, false), 36);
    });
});
