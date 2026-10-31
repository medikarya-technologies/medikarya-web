import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { CASE_GUIDES, GUIDES_AWAITING_CHECK } from "../case-guides"

const all = { ...CASE_GUIDES, ...GUIDES_AWAITING_CHECK }

describe("case guides", () => {
    it("keeps a guide awaiting a doctor's check off every public list", () => {
        for (const id of Object.keys(GUIDES_AWAITING_CHECK)) assert.equal(CASE_GUIDES[id], undefined, id)
        for (const guide of Object.values(CASE_GUIDES)) assert.notEqual(guide.pendingCheck, true)
        assert.equal(Object.keys(all).length, Object.keys(CASE_GUIDES).length + Object.keys(GUIDES_AWAITING_CHECK).length)
    })
    it("gives every guide a short title and every section of the page", () => {
        for (const [id, g] of Object.entries(all)) {
            assert.ok(g.seoTitle.length <= 55, `${id}: title ${g.seoTitle.length} characters`)
            for (const list of [g.history, g.redFlags, g.examination, g.investigations, g.pitfalls]) assert.ok(list.length > 0, id)
            // A differential with one group would rank by default; grouped means at least two
            assert.ok(g.differential.length >= 2, id)
            for (const group of g.differential) assert.ok(group.items.length > 0, `${id}: ${group.group}`)
        }
    })
    it("follows the public copy rules: no em or en dashes", () => {
        for (const [id, g] of Object.entries(all)) assert.ok(!/[–—]/.test(JSON.stringify(g)), id)
    })
    it("keys every guide by a patient-describing id, never a diagnosis-like slug", () => {
        for (const id of Object.keys(all)) assert.match(id, /^\d+-(year|week|month)-old-/, id)
    })
})
