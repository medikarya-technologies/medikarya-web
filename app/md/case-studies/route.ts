import { getCasesOrThrow } from "@/data/cases"
import { CASE_GUIDES } from "@/lib/seo/case-guides"
import { caseLibraryMarkdown, MD_SITE_URL } from "@/lib/seo/markdown"
import { markdownResponse, unavailableResponse } from "@/lib/seo/text-response"

// Served at /case-studies.md (a rewrite in next.config.mjs): the case library as plain Markdown.

// Built per request (the case list itself is cached for a minute) and cached at the edge by markdownResponse's
// header, so a moment when the database is down is never stored as the page.
export const dynamic = "force-dynamic"

export async function GET() {
    const cases = await getCasesOrThrow().catch(() => null)
    if (!cases) return unavailableResponse()
    return markdownResponse(caseLibraryMarkdown(cases, CASE_GUIDES), `${MD_SITE_URL}/case-studies`)
}
