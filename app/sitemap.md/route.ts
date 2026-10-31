import { getCasesOrThrow } from "@/data/cases"
import { ARTICLES } from "@/lib/blog/articles"
import { CASE_GUIDES } from "@/lib/seo/case-guides"
import { sitemapMarkdown } from "@/lib/seo/markdown"
import { markdownResponse, unavailableResponse } from "@/lib/seo/text-response"

// Every public page with its Markdown copy, for readers that are not browsers. Search engines use /sitemap.xml.

// Built per request (the case list itself is cached for a minute) and cached at the edge by markdownResponse's
// header, so a moment when the database is down is never stored as the page.
export const dynamic = "force-dynamic"

export async function GET() {
    const cases = await getCasesOrThrow().catch(() => null)
    if (!cases) return unavailableResponse()
    return markdownResponse(sitemapMarkdown({ cases, guides: CASE_GUIDES, articles: ARTICLES }))
}
