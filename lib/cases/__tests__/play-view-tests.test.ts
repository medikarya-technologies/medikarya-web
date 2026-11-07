// A test's basis is the writer's note on its values and often names the diagnosis: the play view drops it and keeps
// everything the encounter shows.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { playView } from "../views";

const made = {
    id: "made-up",
    displayTitle: "A made-up patient",
    tests: [
        { id: "cbc", name: "Complete blood count", result: { basis: "Written to fit the diagnosis", summary: "Normal", values: [] } },
        { id: "xray", name: "Chest X-ray", result: { summary: "Clear" } },
    ],
};

describe("play view of a case's tests", () => {
    it("drops the writer's basis and keeps the result", () => {
        const view = playView(made);
        assert.equal(JSON.stringify(view).includes("Written to fit"), false);
        assert.deepEqual(view.tests[0], { id: "cbc", name: "Complete blood count", result: { summary: "Normal", values: [] } });
        assert.deepEqual(view.tests[1], made.tests[1]);
    });

    it("leaves the case it was given untouched", () => {
        playView(made);
        assert.equal(made.tests[0].result.basis, "Written to fit the diagnosis");
    });
});
