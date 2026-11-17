import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { opensFreshRoom, startedBeforeRoom } from "../room-clock";

describe("Medventure room clock", () => {
    it("starts fresh the first time and on a new India day (after the preflight)", () => {
        assert.equal(opensFreshRoom(null, new Date("2026-11-18T04:00:00Z")), true);
        assert.equal(opensFreshRoom("2026-11-17T15:00:00Z", new Date("2026-11-18T04:00:00Z")), true);
        assert.equal(opensFreshRoom("not a date", new Date("2026-11-18T04:00:00Z")), true);
    });

    it("keeps the clock when the room is closed and reopened the same day", () => {
        assert.equal(opensFreshRoom("2026-11-18T04:00:00Z", new Date("2026-11-18T07:30:00Z")), false);
        // 23:50 and 00:10 UTC on the 17th/18th are both the 18th in India
        assert.equal(opensFreshRoom("2026-11-17T23:50:00Z", new Date("2026-11-18T00:10:00Z")), false);
    });

    it("treats rows from before the room opened as an earlier room's", () => {
        assert.equal(startedBeforeRoom("2026-11-17T15:00:00Z", "2026-11-18T04:00:00Z"), true);
        assert.equal(startedBeforeRoom("2026-11-18T04:05:00Z", "2026-11-18T04:00:00Z"), false);
        assert.equal(startedBeforeRoom("2026-11-18T04:00:00Z", "2026-11-18T04:00:00Z"), false);
        assert.equal(startedBeforeRoom("2026-11-17T15:00:00Z", null), false);
        assert.equal(startedBeforeRoom(null, "2026-11-18T04:00:00Z"), false);
    });
});
