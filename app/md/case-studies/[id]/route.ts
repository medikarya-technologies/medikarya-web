import { getCasesOrThrow } from "@/data/cases"
import { GUEST_CASE_IDS } from "@/lib/plans/limits"
import { CASE_GUIDES } from "@/lib/seo/case-guides"
import { caseGuideMarkdown, MD_SITE_URL } from "@/lib/seo/markdown"
import { markdownResponse, unavailableResponse } from "@/lib/seo/text-response"

// Served at /case-studies/<id>.md (a rewrite in next.config.mjs): a case's study guide as plain Markdown. Only cases
// with a guide have one, the same ones whose HTML page is indexed; it reads the published list, so never a draft.

const notFound = () => new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })

// Built per request (the case list itself is cached for a minute) and cached at the edge by markdownResponse's
// header, so a moment when the database is down is never stored as the page.
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const guide = CASE_GUIDES[id]
    if (!guide) return notFound()
    const cases = await getCasesOrThrow().catch(() => null)
    if (!cases) return unavailableResponse()
    const c = cases.find((x) => x.id === id)
    if (!c) return notFound()
    return markdownResponse(caseGuideMarkdown(c, guide, { free: GUEST_CASE_IDS.includes(id) }), `${MD_SITE_URL}/case-studies/${id}`)
}
