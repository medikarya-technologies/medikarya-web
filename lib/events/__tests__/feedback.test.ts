import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cleanFeedback, summariseFeedback, TEXT_LIMIT, type Feedback } from "../feedback";

describe("Medventure feedback form", () => {
    it("needs only the overall rating", () => {
        assert.deepEqual(cleanFeedback({}), { ok: false, error: "Choose a rating for the challenge overall." });
        assert.equal(cleanFeedback({ overall: 0 }).ok, false);
        assert.equal(cleanFeedback({ overall: 6 }).ok, false);
        assert.equal(cleanFeedback({ overall: 4.5 }).ok, false);
        const r = cleanFeedback({ overall: 4 });
        assert.ok(r.ok);
        if (r.ok) assert.deepEqual(r.feedback, { overall: 4, roundOne: null, roundTwo: null, realism: null, recommend: null, studyYear: null, liked: "", improve: "", contactOk: false });
    });

    it("drops anything out of range instead of storing it", () => {
        const r = cleanFeedback({ overall: 5, roundOne: 9, roundTwo: "5", realism: 3, recommend: 11, studyYear: "PhD", contactOk: "yes" });
        assert.ok(r.ok);
        if (r.ok) {
            assert.equal(r.feedback.roundOne, null);
            assert.equal(r.feedback.roundTwo, null);
            assert.equal(r.feedback.realism, 3);
            assert.equal(r.feedback.recommend, null);
            assert.equal(r.feedback.studyYear, null);
            assert.equal(r.feedback.contactOk, false);
        }
        const zero = cleanFeedback({ overall: 2, recommend: 0, studyYear: "Final year", contactOk: true });
        assert.ok(zero.ok && zero.feedback.recommend === 0 && zero.feedback.studyYear === "Final year" && zero.feedback.contactOk);
    });

    it("tidies and caps the written answers", () => {
        const r = cleanFeedback({ overall: 3, liked: "  the   patient\n\nfelt real  ", improve: "x".repeat(TEXT_LIMIT + 50) });
        assert.ok(r.ok);
        if (r.ok) {
            assert.equal(r.feedback.liked, "the patient felt real");
            assert.equal(r.feedback.improve.length, TEXT_LIMIT);
        }
    });

    it("summarises averages and the recommend score", () => {
        const row = (overall: number, recommend: number | null, roundTwo: number | null = null): Feedback => ({ overall, roundOne: null, roundTwo, realism: null, recommend, studyYear: null, liked: "", improve: "", contactOk: false });
        const s = summariseFeedback([row(5, 10, 4), row(4, 9), row(3, 6, 5), row(4, null)]);
        assert.equal(s.count, 4);
        assert.equal(s.averages.overall, 4);
        assert.equal(s.averages.roundTwo, 4.5);
        assert.equal(s.averages.roundOne, null);
        // 2 of 3 answers are 9-10, 1 is 0-6: (2 - 1) / 3 = 33
        assert.equal(s.recommendScore, 33);
        assert.equal(s.recommendCount, 3);
        assert.deepEqual(summariseFeedback([]).recommendScore, null);
    });
});
