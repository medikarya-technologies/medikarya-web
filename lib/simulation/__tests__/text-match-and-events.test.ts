import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { textMatchesAll, textMatchesAny } from "../text-match";
import { formatClock, isClinicalEvent, sanitizeEvents, orderKey } from "../encounter-events";

describe("negation-aware text matching", () => {
    const stemi = ["stemi", "st elevation", "st segment elevation"];

    it("matches plain mentions, case- and hyphen-insensitively", () => {
        assert.equal(textMatchesAny("Anterior STEMI", stemi), true);
        assert.equal(textMatchesAny("ST-elevation in V1-V4", stemi), true);
        assert.equal(textMatchesAny("ST-Segment Elevation", stemi), true);
    });

    it("does not match negated mentions", () => {
        assert.equal(textMatchesAny("There is no ST elevation", stemi), false);
        assert.equal(textMatchesAny("Not a STEMI", stemi), false);
        assert.equal(textMatchesAny("without ST elevation", stemi), false);
        assert.equal(textMatchesAny("absence of ST elevation", stemi), false);
    });

    it("a negation stops at the end of its clause", () => {
        assert.equal(textMatchesAny("No ST depression, ST elevation in V1-V4", stemi), true);
        assert.equal(textMatchesAny("No reciprocal changes and ST elevation in V2", stemi), true);
        assert.equal(textMatchesAny("Sinus tachycardia but ST elevation V1-V4", stemi), true);
    });

    it("each clause is judged on its own", () => {
        assert.equal(textMatchesAny("No chest pain and no ST elevation", stemi), false);
        assert.equal(textMatchesAny("No chest pain. ST elevation V2-V3.", stemi), true);
    });

    it("does not mistake NSTEMI for STEMI, or a longer word for a phrase inside it", () => {
        assert.equal(textMatchesAny("NSTEMI", stemi), false);
        assert.equal(textMatchesAny("Probably an NSTEMI", stemi), false);
        assert.equal(textMatchesAny("STEMI, not NSTEMI", stemi), true, "the real STEMI mention still counts");
        assert.equal(textMatchesAny("hyperacute T waves", ["acute"]), false);
        assert.equal(textMatchesAny("acute anterior STEMI", ["acute"]), true);
    });

    it("allows stems: a phrase may be the start of a longer word", () => {
        assert.equal(textMatchesAny("Does the pain radiate to your arm?", ["radiat"]), true);
        assert.equal(textMatchesAny("pain radiating to the jaw", ["radiat"]), true);
    });

    it("very short phrases must match whole words", () => {
        assert.equal(textMatchesAny("mild anxiety", ["mi"]), false);
        assert.equal(textMatchesAny("acute MI", ["mi"]), true);
        assert.equal(textMatchesAny("MI with shock", ["mi"]), true);
    });

    it("can be told to ignore negation", () => {
        assert.equal(textMatchesAny("no ST elevation", stemi, { negationAware: false }), true);
    });

    it("requires all phrases for textMatchesAll", () => {
        assert.equal(textMatchesAll("anterior wall, ST elevation V1-V4", ["anterior", "st elevation"]), true);
        assert.equal(textMatchesAll("anterior wall only", ["anterior", "st elevation"]), false);
        assert.equal(textMatchesAll("anything", []), true);
    });

    it("handles empty input", () => {
        assert.equal(textMatchesAny("", stemi), false);
        assert.equal(textMatchesAny("STEMI", []), false);
    });
});

describe("event helpers", () => {
    it("formats the clock", () => {
        assert.equal(formatClock(0), "00:00");
        assert.equal(formatClock(512), "08:32");
        assert.equal(formatClock(3725), "1:02:05");
        assert.equal(formatClock(-4), "00:00");
        assert.equal(formatClock(NaN), "00:00");
    });

    it("identifies an order by test and time", () => {
        assert.equal(orderKey("ecg_12_lead", 60), "ecg_12_lead@60");
    });

    it("validates each event shape", () => {
        assert.equal(isClinicalEvent({ type: "HISTORY_TAKEN", timestamp: 5, question: "q", response: "r" }), true);
        assert.equal(isClinicalEvent({ type: "HISTORY_TAKEN", timestamp: 5, question: "q" }), false);
        assert.equal(isClinicalEvent({ type: "ASSIST_USED", timestamp: 1, assistType: "socratic_hint", cost: 3 }), true);
        assert.equal(isClinicalEvent({ type: "ASSIST_USED", timestamp: 1, assistType: "made_up", cost: 3 }), false);
        assert.equal(isClinicalEvent({ type: "ASSIST_USED", timestamp: 1, assistType: "socratic_hint", cost: -1 }), false);
        assert.equal(isClinicalEvent({ type: "RESULT_REVEALED", timestamp: 1, testId: "x", revealType: "nope" }), false);
        assert.equal(isClinicalEvent({ type: "NOPE", timestamp: 1 }), false);
        assert.equal(isClinicalEvent({ type: "HISTORY_TAKEN", timestamp: -1, question: "q", response: "r" }), false);
        assert.equal(isClinicalEvent({ type: "HISTORY_TAKEN", timestamp: NaN, question: "q", response: "r" }), false);
        assert.equal(isClinicalEvent(null), false);
        assert.equal(isClinicalEvent("HISTORY_TAKEN"), false);
    });

    it("sanitises untrusted input: drops junk and orders by time, keeping ties stable", () => {
        const cleaned = sanitizeEvents([
            { type: "TEST_ORDERED", timestamp: 30, testId: "b", testName: "B" },
            { junk: true },
            { type: "TEST_ORDERED", timestamp: 10, testId: "a", testName: "A" },
            { type: "TEST_ORDERED", timestamp: 30, testId: "c", testName: "C" },
            null,
        ]);
        assert.deepEqual(
            cleaned.map((e) => (e.type === "TEST_ORDERED" ? e.testId : "?")),
            ["a", "b", "c"]
        );
        assert.deepEqual(sanitizeEvents("not an array"), []);
    });
});
