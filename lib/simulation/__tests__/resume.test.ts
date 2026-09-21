import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { clearInProgress, describeInProgress, mostRecent, readAllInProgress, readInProgress, simStorageKey, uiStorageKey, type InProgress } from "../resume";

const asked = (timestamp: number) => ({ type: "HISTORY_TAKEN", timestamp, question: "What brought you in?", response: "Chest pain." });
const ordered = (timestamp: number) => ({ type: "TEST_ORDERED", timestamp, testId: "ecg", testName: "12-lead ECG" });
const transition = (timestamp: number) => ({ type: "STATE_TRANSITION", timestamp, from: "stable", to: "unstable", trigger: "time" });
const deteriorated = (timestamp: number) => ({ type: "PATIENT_DETERIORATED", timestamp, narrative: "The patient looks worse.", ruleId: "r1" });

const save = (events: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ v: 1, events, elapsedSeconds: 0, ...extra });

describe("resume: is a case in progress", () => {
    it("is not, when nothing has been saved", () => {
        assert.equal(describeInProgress("c", null, null), null);
        assert.equal(describeInProgress("c", "", undefined), null);
    });

    it("is not, when the student has not done anything yet", () => {
        assert.equal(describeInProgress("c", save([]), null), null);
        // the patient changing on their own is not the student doing something
        assert.equal(describeInProgress("c", save([transition(30), deteriorated(31)]), null), null);
    });

    it("is, once the student has asked, examined, ordered or treated, and says how much", () => {
        const one = describeInProgress("c", save([asked(20), transition(40), ordered(75)], { elapsedSeconds: 300 }), null);
        assert.deepEqual(one, { caseId: "c", elapsedSeconds: 300, actions: 2, savedAt: undefined });
    });

    it("takes the later of the saved clock and the last event, so it never reads earlier than what happened", () => {
        assert.equal(describeInProgress("c", save([asked(20), ordered(500)], { elapsedSeconds: 100 }), null)?.elapsedSeconds, 500);
        assert.equal(describeInProgress("c", save([asked(20)], { elapsedSeconds: -5 }), null)?.elapsedSeconds, 20);
    });

    it("is not, once the case has been scored (the result is shown instead)", () => {
        const scored = JSON.stringify({ chat: [], feedback: { score: 80 }, showQuiz: false });
        assert.equal(describeInProgress("c", save([asked(20)]), scored), null);
        // a chat with no result yet is still in progress
        assert.notEqual(describeInProgress("c", save([asked(20)]), JSON.stringify({ chat: [], feedback: null })), null);
    });

    it("passes on when it was last saved, when the save says", () => {
        assert.equal(describeInProgress("c", save([asked(20)], { savedAt: 1_700_000_000_000 }), null)?.savedAt, 1_700_000_000_000);
        assert.equal(describeInProgress("c", save([asked(20)], { savedAt: "yesterday" }), null)?.savedAt, undefined);
    });

    it("never throws on what a browser might hold", () => {
        for (const junk of ["{", "null", "42", '"text"', "[]", JSON.stringify({ v: 2, events: [asked(1)] }), JSON.stringify({ v: 1, events: "no" }), JSON.stringify({ v: 1, events: [{ type: "NOPE", timestamp: 1 }] })]) {
            assert.equal(describeInProgress("c", junk, junk), null, junk);
        }
    });
});

describe("resume: reading the browser's copy", () => {
    const store = (entries: Record<string, string>) => ({
        data: { ...entries },
        getItem(key: string) {
            return key in this.data ? this.data[key] : null;
        },
        removeItem(key: string) {
            delete this.data[key];
        },
    });

    it("finds the cases in progress among those asked about", () => {
        const s = store({ [simStorageKey("a")]: save([asked(10)]), [simStorageKey("b")]: save([]), [simStorageKey("c")]: save([ordered(50)]), [uiStorageKey("c")]: JSON.stringify({ chat: [], feedback: { score: 90 } }) });
        const found = readAllInProgress(["a", "b", "c", "d"], s);
        assert.deepEqual([...found.keys()], ["a"]);
    });

    it("says nothing is in progress when storage is missing or throws", () => {
        assert.equal(readInProgress("a", undefined), null);
        const angry = {
            getItem() {
                throw new Error("blocked");
            },
        };
        assert.equal(readInProgress("a", angry), null);
    });

    it("picks the case worked on most recently", () => {
        const map = new Map<string, InProgress>([
            ["a", { caseId: "a", elapsedSeconds: 10, actions: 1, savedAt: 100 }],
            ["b", { caseId: "b", elapsedSeconds: 10, actions: 1, savedAt: 300 }],
            ["c", { caseId: "c", elapsedSeconds: 10, actions: 1 }],
        ]);
        assert.equal(mostRecent(map)?.caseId, "b");
        assert.equal(mostRecent(new Map()), undefined);
    });

    it("clears both keys, and only that case's", () => {
        const s = store({ [simStorageKey("a")]: "x", [uiStorageKey("a")]: "y", [simStorageKey("b")]: "z" });
        clearInProgress("a", s);
        assert.deepEqual(Object.keys(s.data), [simStorageKey("b")]);
    });
});
