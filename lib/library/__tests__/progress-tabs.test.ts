import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PROGRESS_TAB, PROGRESS_TABS, PROGRESS_TAB_LABEL, parseProgressTab, queryWithTab } from "../progress-tabs";

describe("progress tabs: reading the address", () => {
    it("has three tabs, the first being the default, each with a label", () => {
        assert.deepEqual([...PROGRESS_TABS], ["overview", "skills", "activity"]);
        assert.equal(DEFAULT_PROGRESS_TAB, "overview");
        for (const tab of PROGRESS_TABS) assert.ok(PROGRESS_TAB_LABEL[tab].length > 0);
    });

    it("reads a tab by name", () => {
        for (const tab of PROGRESS_TABS) assert.equal(parseProgressTab(tab), tab);
    });

    it("falls back to the first tab for anything else, and never throws", () => {
        for (const value of [undefined, null, "", "SKILLS", "skills ", "milestones", "__proto__", "constructor"]) assert.equal(parseProgressTab(value), "overview");
    });

    it("takes the first of a repeated parameter", () => {
        assert.equal(parseProgressTab(["activity", "skills"]), "activity");
        assert.equal(parseProgressTab(["nope", "skills"]), "overview");
        assert.equal(parseProgressTab([]), "overview");
    });
});

describe("progress tabs: writing the address", () => {
    it("has no tab part for the first tab", () => {
        assert.equal(queryWithTab("", "overview"), "");
        assert.equal(queryWithTab("?tab=skills", "overview"), "");
    });

    it("sets or replaces the tab and keeps every other part", () => {
        assert.equal(queryWithTab("", "skills"), "tab=skills");
        assert.equal(queryWithTab("?tab=activity", "skills"), "tab=skills");
        assert.equal(queryWithTab("?empty=1&tab=activity&name=Asha", "skills"), "empty=1&name=Asha&tab=skills");
        assert.equal(queryWithTab("empty=1", "overview"), "empty=1");
    });

    it("survives a malformed escape elsewhere in the address", () => {
        assert.equal(queryWithTab("?x=%E0%A4%A&tab=skills", "activity"), "x=%E0%A4%A&tab=activity");
    });

    it("is read back as the tab that was written", () => {
        for (const tab of PROGRESS_TABS) {
            const query = queryWithTab("?empty=1", tab);
            const value = new URLSearchParams(query).get("tab");
            assert.equal(parseProgressTab(value), tab);
        }
    });
});
