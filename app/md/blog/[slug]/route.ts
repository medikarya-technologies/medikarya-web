import { ARTICLES } from "@/lib/blog/articles"
import { articleMarkdown, MD_SITE_URL } from "@/lib/seo/markdown"
import { markdownResponse } from "@/lib/seo/text-response"

// Served at /blog/<slug>.md (a rewrite in next.config.mjs): the article as plain Markdown.
export function generateStaticParams() {
    return Object.keys(ARTICLES).map((slug) => ({ slug }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const article = ARTICLES[slug]
    if (!article) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    return markdownResponse(articleMarkdown(slug, article), `${MD_SITE_URL}/blog/${slug}`)
}
