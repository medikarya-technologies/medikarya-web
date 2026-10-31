import { getCasesOrThrow } from "@/data/cases"
import { ARTICLES } from "@/lib/blog/articles"
import { CASE_GUIDES } from "@/lib/seo/case-guides"
import { llmsTxt } from "@/lib/seo/markdown"
import { markdownResponse, unavailableResponse } from "@/lib/seo/text-response"

// A short guide to the site for AI assistants that look for one (llmstxt.org). Built from the published case list
// and the blog, so its counts and links follow the site. Built per request (the case list itself is cached for a minute) and cached at the edge by markdownResponse's
// header, so a moment when the database is down is never stored as the page.
export const dynamic = "force-dynamic"

export async function GET() {
    const cases = await getCasesOrThrow().catch(() => null)
    if (!cases) return unavailableResponse()
    return markdownResponse(llmsTxt({ cases, guides: CASE_GUIDES, articles: ARTICLES }), undefined, "text/plain; charset=utf-8")
}
