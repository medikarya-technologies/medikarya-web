import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { adSourceFromSearch, internalFlagFromSearch, rememberId } from "../traffic";

describe("traffic: visitors from Meta ads", () => {
    it("counts an ad click (fbclid) or a Meta utm_source", () => {
        assert.equal(adSourceFromSearch("?fbclid=IwAR123"), "meta");
        assert.equal(adSourceFromSearch("?utm_source=facebook&utm_medium=paid"), "meta");
        assert.equal(adSourceFromSearch("?utm_source=Instagram"), "meta");
        assert.equal(adSourceFromSearch("utm_source=ig"), "meta");
    });

    it("does not count other sources or an empty fbclid", () => {
        for (const search of ["", "?utm_source=google", "?fbclid=", "?ref=facebook", "?utm_source=whatsapp"]) assert.equal(adSourceFromSearch(search), null, search);
    });
});

describe("traffic: the founder's internal switch", () => {
    it("reads mk_internal=1 and mk_internal=0, nothing else", () => {
        assert.equal(internalFlagFromSearch("?mk_internal=1"), true);
        assert.equal(internalFlagFromSearch("?x=2&mk_internal=0"), false);
        assert.equal(internalFlagFromSearch("?mk_internal=yes"), null);
        assert.equal(internalFlagFromSearch(""), null);
    });
});

describe("traffic: ids of events already sent", () => {
    it("moves a repeat to the end and keeps only the newest", () => {
        assert.deepEqual(rememberId(["a", "b"], "a"), ["b", "a"]);
        assert.deepEqual(rememberId(["a", "b", "c"], "d", 3), ["b", "c", "d"]);
    });
});
