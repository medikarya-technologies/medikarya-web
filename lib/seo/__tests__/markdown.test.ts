import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { ARTICLES } from "../../blog/articles"
import { CASE_GUIDES } from "../case-guides"
import {
    articleMarkdown,
    caseGuideMarkdown,
    caseLibraryMarkdown,
    libraryStats,
    llmsTxt,
    sitemapMarkdown,
    type PublicCase,
} from "../markdown"

// A published list shaped like getCases(): every guided case, plus one without a guide and one live emergency.
const guidedIds = Object.keys(CASE_GUIDES)
const cases: PublicCase[] = [
    ...guidedIds.map((id, i) => ({
        id,
        displayTitle: `Patient ${i}`,
        displayDescription: `Came in with ${CASE_GUIDES[id].complaint}.`,
        category: i % 2 ? "Pediatrics" : "Cardiology",
        difficulty: "Intermediate",
        estimatedTime: 20,
        live: i === 0,
    })),
    { id: "no-guide-case", displayTitle: "A patient with no guide", displayDescription: "Two sentences.", category: "Neurology" },
]
const site = { cases, guides: CASE_GUIDES, articles: ARTICLES }

const outputs = () => [
    llmsTxt(site),
    sitemapMarkdown(site),
    caseLibraryMarkdown(cases, CASE_GUIDES),
    ...Object.entries(ARTICLES).map(([slug, a]) => articleMarkdown(slug, a)),
    ...cases.filter((c) => CASE_GUIDES[c.id]).map((c) => caseGuideMarkdown(c, CASE_GUIDES[c.id], { free: false })),
]

describe("libraryStats", () => {
    it("counts patients, specialties and live emergencies", () => {
        assert.deepEqual(libraryStats(cases), { patients: guidedIds.length + 1, specialties: 3, live: 1 })
        assert.deepEqual(libraryStats([]), { patients: 0, specialties: 0, live: 0 })
    })
})

describe("llms.txt", () => {
    const txt = llmsTxt(site)
    it("follows the llmstxt.org shape: a title, then a summary in a blockquote", () => {
        const lines = txt.split("\n")
        assert.equal(lines[0], "# MediKarya")
        assert.ok(lines[2].startsWith("> "))
    })
    it("links every case guide and every article to its Markdown copy", () => {
        for (const id of guidedIds) assert.ok(txt.includes(`https://www.medikarya.in/case-studies/${id}.md`), id)
        for (const slug of Object.keys(ARTICLES)) assert.ok(txt.includes(`https://www.medikarya.in/blog/${slug}.md`), slug)
        assert.ok(!txt.includes("no-guide-case"))
    })
    it("states the library's real counts", () => {
        assert.ok(txt.includes(`${guidedIds.length + 1} published patients across 3 specialties; 1 are live emergencies`))
    })
})

describe("sitemap.md", () => {
    it("lists every guided case and article, with both the page and its Markdown copy", () => {
        const md = sitemapMarkdown(site)
        for (const id of guidedIds) {
            assert.ok(md.includes(`(https://www.medikarya.in/case-studies/${id})`), id)
            assert.ok(md.includes(`(https://www.medikarya.in/case-studies/${id}.md)`), id)
        }
        for (const slug of Object.keys(ARTICLES)) assert.ok(md.includes(`(https://www.medikarya.in/blog/${slug}.md)`), slug)
    })
})

describe("article Markdown", () => {
    it("keeps the article's headings and paragraphs, and makes its links absolute", () => {
        for (const [slug, a] of Object.entries(ARTICLES)) {
            const md = articleMarkdown(slug, a)
            assert.ok(md.startsWith(`# ${a.title}\n`))
            for (const b of a.body) {
                if (b.type === "heading") assert.ok(md.includes(`\n## ${b.text}\n`), b.text)
                if (b.type === "callout") assert.ok(md.includes(`](https://www.medikarya.in${b.href})`), b.href)
            }
            assert.ok(!md.includes("](/"), `${slug} has a relative link`)
        }
    })
})

describe("case guide Markdown", () => {
    it("has every section of the HTML page, and points a free case at /try", () => {
        const c = cases[0]
        const guide = CASE_GUIDES[c.id]
        const md = caseGuideMarkdown(c, guide, { free: true })
        for (const heading of ["How the patient presents", "What to ask in the history", "Red flags", "What to examine", "First investigations", "Common mistakes"]) {
            assert.ok(md.includes(`\n## ${heading}\n`), heading)
        }
        for (const g of guide.differential) assert.ok(md.includes(`\n### ${g.group}\n`), g.group)
        assert.ok(md.includes("https://www.medikarya.in/try (free, no account)"))
        assert.ok(md.includes("live emergency"))
    })
})

describe("every plain-text copy", () => {
    // Our own wording only: case descriptions come from the database and are shown as written.
    it("follows the public copy rules: no em dashes, no rupee amounts", () => {
        for (const out of outputs()) {
            assert.ok(!out.includes("—"), out.slice(0, 80))
            assert.ok(!/₹|\bRs\.?\s?\d|\bINR\b/.test(out), out.slice(0, 80))
        }
    })
    it("never puts a raw line break inside a list item", () => {
        for (const out of outputs()) {
            for (const line of out.split("\n")) if (line.startsWith("- ")) assert.ok(line.trim().length > 2)
        }
    })
})
