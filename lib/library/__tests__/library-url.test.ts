import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { NO_FILTERS } from "../case-library";
import { DEFAULT_VIEW, libraryHref, mergeQuery, queryFromView, specialtyHref, viewFromParams, type LibraryView } from "../library-url";
import { MAX_SAVED, parseSaved, readSaved, savedKeyFor, serialiseSaved, toggleSaved, writeSaved } from "../saved";

/** A minimal stand-in for URLSearchParams, built from a query string. */
function params(query: string) {
    const map = new Map<string, string>();
    for (const pair of query.replace(/^\?/, "").split("&")) {
        if (!pair) continue;
        const [k, v = ""] = pair.split("=");
        map.set(decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, " ")));
    }
    return { get: (name: string) => map.get(name) ?? null };
}

const SPECIALTIES = ["Cardiology", "Nephrology", "Internal Medicine", "Obstetrics & Gynecology"];

describe("library address: writing", () => {
    it("is empty when everything is at its default", () => {
        assert.equal(queryFromView(DEFAULT_VIEW), "");
    });

    it("carries only what differs, in a fixed order", () => {
        const view: LibraryView = { filters: { query: "chest pain", specialty: "Cardiology", difficulty: 2, status: "new", saved: true }, sort: "shortest" };
        assert.equal(queryFromView(view), "q=chest%20pain&specialty=Cardiology&level=2&status=new&saved=1&sort=shortest");
        assert.equal(queryFromView({ filters: { ...NO_FILTERS, difficulty: 3 }, sort: "recommended" }), "level=3");
    });

    it("encodes what would break an address, and ignores a query that is only spaces", () => {
        assert.equal(queryFromView({ filters: { ...NO_FILTERS, specialty: "Obstetrics & Gynecology" }, sort: "recommended" }), "specialty=Obstetrics%20%26%20Gynecology");
        assert.equal(queryFromView({ filters: { ...NO_FILTERS, query: "   " }, sort: "recommended" }), "");
    });
});

describe("library address: reading", () => {
    it("reads back what was written, for every combination of the filters", () => {
        for (const specialty of ["all", ...SPECIALTIES]) {
            for (const difficulty of [0, 1, 2, 3] as const) {
                for (const status of ["all", "new", "attempted"] as const) {
                    for (const saved of [false, true]) {
                        for (const sort of ["recommended", "newest", "hardest"] as const) {
                            const filters = { query: "flank & pain", specialty, difficulty, status, ...(saved ? { saved } : {}) };
                            const view: LibraryView = { filters, sort };
                            assert.deepEqual(viewFromParams(params(queryFromView(view)), SPECIALTIES), view);
                        }
                    }
                }
            }
        }
    });

    it("gives the default view for an empty address", () => {
        assert.deepEqual(viewFromParams(params("")), DEFAULT_VIEW);
    });

    it("ignores values that are not one of the choices, so an old or edited link never breaks the page", () => {
        const view = viewFromParams(params("level=9&status=done&sort=random&saved=yes&specialty=Nope"), SPECIALTIES);
        assert.deepEqual(view, DEFAULT_VIEW);
        assert.equal(viewFromParams(params("level=abc")).filters.difficulty, 0);
    });

    it("drops a specialty the library does not have, but trusts it while the list is not known yet", () => {
        assert.equal(viewFromParams(params("specialty=Oncology"), SPECIALTIES).filters.specialty, "all");
        assert.equal(viewFromParams(params("specialty=Oncology"), []).filters.specialty, "Oncology");
    });

    it("keeps a search to a sane length", () => {
        const long = "x".repeat(500);
        assert.equal(viewFromParams(params(`q=${long}`)).filters.query.length, 200);
    });
});

describe("saved cases", () => {
    it("adds a case at the front and removes it the second time, without touching the list it was given", () => {
        const before = ["a", "b"];
        const added = toggleSaved(before, "c");
        assert.deepEqual(added, ["c", "a", "b"]);
        assert.deepEqual(before, ["a", "b"]);
        assert.deepEqual(toggleSaved(added, "a"), ["c", "b"]);
    });

    it("never keeps more than it should", () => {
        const many = Array.from({ length: MAX_SAVED }, (_, i) => `id${i}`);
        assert.equal(toggleSaved(many, "one-more").length, MAX_SAVED);
        assert.equal(toggleSaved(many, "one-more")[0], "one-more");
    });

    it("reads stored text forgivingly: only a list of non-empty strings counts, once each", () => {
        assert.deepEqual(parseSaved(serialiseSaved(["a", "b"])), ["a", "b"]);
        assert.deepEqual(parseSaved('["a","a","","b",3,null]'), ["a", "b"]);
        for (const junk of [null, undefined, "", "{", "null", '{"a":1}', '"a"', "42"]) assert.deepEqual(parseSaved(junk), [], String(junk));
    });

    it("keeps a list for each person", () => {
        const data: Record<string, string> = {};
        const store = { getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => void (data[k] = v) };
        assert.equal(writeSaved(["a"], "user_1", store), true);
        assert.equal(writeSaved(["b"], "user_2", store), true);
        assert.deepEqual(readSaved("user_1", store), ["a"]);
        assert.deepEqual(readSaved("user_2", store), ["b"]);
        assert.deepEqual(readSaved(undefined, store), []);
        assert.notEqual(savedKeyFor("user_1"), savedKeyFor("user_2"));
    });

    it("says so when the browser will not keep it, and never throws", () => {
        const angry = {
            getItem() {
                throw new Error("blocked");
            },
            setItem() {
                throw new Error("blocked");
            },
        };
        assert.equal(writeSaved(["a"], "u", angry), false);
        assert.equal(writeSaved(["a"], "u", undefined), false);
        assert.deepEqual(readSaved("u", angry), []);
    });
});

describe("library address: the rest of the address", () => {
    it("replaces its own parts and leaves the others alone", () => {
        assert.equal(mergeQuery("?empty=1&specialty=Cardiology&name=Priya", "level=2"), "empty=1&name=Priya&level=2");
        assert.equal(mergeQuery("?q=old&sort=newest", "specialty=Nephrology"), "specialty=Nephrology");
    });

    it("gives an empty query when there is nothing left", () => {
        assert.equal(mergeQuery("?q=old", ""), "");
        assert.equal(mergeQuery("", ""), "");
    });

    it("copes with a part it cannot decode", () => {
        assert.equal(mergeQuery("?%E0%A4%A=1&level=3", "sort=newest"), "%E0%A4%A=1&sort=newest");
    });
});

describe("library address: links to a view", () => {
    it("is the bare library for the default view", () => {
        assert.equal(libraryHref(), "/dashboard/cases");
        assert.equal(libraryHref(DEFAULT_VIEW), "/dashboard/cases");
    });

    it("filters to a specialty, with the name escaped", () => {
        assert.equal(specialtyHref("Cardiology"), "/dashboard/cases?specialty=Cardiology");
        assert.equal(specialtyHref("Obstetrics & Gynecology"), "/dashboard/cases?specialty=Obstetrics%20%26%20Gynecology");
    });

    it("is read back as the same specialty by the library", () => {
        for (const name of SPECIALTIES) {
            const view = viewFromParams(params(specialtyHref(name).split("?")[1]), SPECIALTIES);
            assert.equal(view.filters.specialty, name);
            assert.equal(view.sort, "recommended");
        }
    });
});
