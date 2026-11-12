import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { countFunnel, parseTryStep, stepForEvent } from "../try-funnel";

const guestId = "7c93ca7d-1111-4222-8333-944445555666";

describe("try funnel: what the browser may record", () => {
    it("takes a play step with its play id, and a page view without one", () => {
        assert.deepEqual(parseTryStep({ guestId, step: "started", playId: "abc-123", adSource: "meta", internal: false }), {
            guest_id: guestId, play_id: "abc-123", step: "started", ad_source: "meta", internal: false,
        });
        assert.deepEqual(parseTryStep({ guestId, step: "viewed", playId: "ignored" }), {
            guest_id: guestId, play_id: "", step: "viewed", ad_source: null, internal: false,
        });
    });

    it("refuses unknown steps, bad ids, a play step without a play, and anything else", () => {
        assert.equal(parseTryStep({ guestId, step: "paid", playId: "a" }), null);
        assert.equal(parseTryStep({ guestId: "not-a-uuid", step: "viewed" }), null);
        assert.equal(parseTryStep({ guestId, step: "asked" }), null);
        assert.equal(parseTryStep({ guestId, step: "asked", playId: "has spaces" }), null);
        assert.equal(parseTryStep(null), null);
        assert.equal(parseTryStep("viewed"), null);
    });

    it("only says ad_source meta or nothing, and internal only when exactly true", () => {
        const row = parseTryStep({ guestId, step: "viewed", adSource: "<script>", internal: "yes" });
        assert.equal(row?.ad_source, null);
        assert.equal(row?.internal, false);
    });
});

describe("try funnel: encounter events and counting", () => {
    it("maps a question, an exam and a test order, nothing else", () => {
        assert.equal(stepForEvent("HISTORY_TAKEN"), "asked");
        assert.equal(stepForEvent("EXAM_PERFORMED"), "examined");
        assert.equal(stepForEvent("TEST_ORDERED"), "ordered");
        assert.equal(stepForEvent("TIME_SKIPPED"), null);
    });

    it("counts each guest once per step, across plays", () => {
        const counts = countFunnel([
            { guest_id: "a", step: "viewed" },
            { guest_id: "b", step: "viewed" },
            { guest_id: "a", step: "started" },
            { guest_id: "a", step: "started" },
            { guest_id: "a", step: "finished" },
        ]);
        assert.deepEqual(counts.slice(0, 2), [{ step: "viewed", guests: 2 }, { step: "started", guests: 1 }]);
        assert.equal(counts.find((c) => c.step === "finished")?.guests, 1);
        assert.equal(counts.find((c) => c.step === "asked")?.guests, 0);
    });
});
