import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Clock, User, Bell } from "lucide-react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ARTICLES as articles } from "@/lib/blog/articles"

const BASE_URL = "https://www.medikarya.in"
const OG_IMAGE = `${BASE_URL}/og-image.png`

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const article = articles[slug]
    if (!article) return { title: "Article Not Found", robots: { index: false, follow: false } }
    return {
        title: article.title,
        description: article.description ?? article.intro,
        keywords: article.keywords,
        alternates: {
            canonical: `${BASE_URL}/blog/${slug}`,
            // The same article as plain Markdown, for tools that read text rather than pages (lib/seo/markdown.ts)
            types: { "text/markdown": `${BASE_URL}/blog/${slug}.md` },
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
            },
        },
        openGraph: {
            title: article.title,
            description: article.description ?? article.intro,
            type: "article",
            publishedTime: article.isoDate,
            ...(article.updatedIsoDate ? { modifiedTime: article.updatedIsoDate } : {}),
            authors: [article.byline?.name ?? article.author],
            url: `${BASE_URL}/blog/${slug}`,
            siteName: "MediKarya",
            locale: "en_IN",
            images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: article.title }],
        },
        twitter: {
            card: "summary_large_image",
            title: article.title,
            description: article.description ?? article.intro,
            images: [OG_IMAGE],
        },
    }
}

export function generateStaticParams() {
    return Object.keys(articles).map((slug) => ({ slug }))
}

export default async function BlogArticlePage({ params }: Props) {
    const { slug } = await params
    const article = articles[slug]
    if (!article) notFound()

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": article.title,
        "description": article.description ?? article.intro,
        "keywords": article.keywords.join(", "),
        "articleSection": article.category,
        "inLanguage": "en-IN",
        "genre": "Medical Education",
        // A named writer when the article has one (lib/blog/articles.ts, byline); otherwise the team, as an organisation.
        "author": article.byline
            ? { "@type": "Person", "name": article.byline.name, "jobTitle": article.byline.role, ...(article.byline.url ? { "url": article.byline.url, "sameAs": [article.byline.url] } : {}) }
            : { "@type": "Organization", "name": article.author, "url": `${BASE_URL}/about` },
        "publisher": {
            "@type": "Organization",
            "name": "MediKarya",
            "url": BASE_URL,
            "logo": {
                "@type": "ImageObject",
                "url": `${BASE_URL}/icon-512.png`,
                "width": 512,
                "height": 512
            }
        },
        "image": {
            "@type": "ImageObject",
            "url": OG_IMAGE,
            "width": 1200,
            "height": 630
        },
        "url": `${BASE_URL}/blog/${slug}`,
        "datePublished": article.isoDate,
        "dateModified": article.updatedIsoDate ?? article.isoDate,
        "wordCount": article.wordCount ?? 800,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `${BASE_URL}/blog/${slug}`,
            ...(article.reviewedBy
                ? { "reviewedBy": { "@type": "Person", "name": article.reviewedBy.name, "jobTitle": article.reviewedBy.role, ...(article.reviewedBy.url ? { "url": article.reviewedBy.url } : {}) } }
                : {}),
        },
        "isPartOf": {
            "@type": "Blog",
            "@id": `${BASE_URL}/blog`,
            "name": "MediKarya Insights",
            "publisher": {
                "@type": "Organization",
                "name": "MediKarya"
            }
        },
        "about": article.keywords.slice(0, 3).map((k: string) => ({
            "@type": "Thing",
            "name": k
        })),
        "audience": {
            "@type": "Audience",
            "audienceType": "Medical students, MBBS students, clinical educators, healthcare professionals"
        },
        "educationalLevel": "Undergraduate",
    }

    const breadcrumbLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL },
            { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${BASE_URL}/blog` },
            { "@type": "ListItem", "position": 3, "name": article.title, "item": `${BASE_URL}/blog/${slug}` }
        ]
    }

    return (
        <main className="min-h-screen flex flex-col bg-white">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
            <div className="flex-1 relative">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50/60 via-white to-white" />

                {/* Simple header */}
                <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
                    <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                            <div className="flex h-8 w-8 items-center justify-center">
                                <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
                            </div>
                            MediKarya
                        </Link>
                        <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600">
                            <Link href="/blog" className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" /> Back to Blog
                            </Link>
                        </Button>
                    </div>
                </header>

                <div className="mx-auto max-w-3xl px-4 pt-10 pb-24">

                    {/* Header */}
                    <header className="space-y-4 mb-10">
                        <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${article.categoryColor}`}>
                            {article.category}
                        </span>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                            {article.title}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{article.byline ? `${article.byline.name}, ${article.byline.role}` : article.author}</span>
                            <span>{article.date}</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{article.readTime}</span>
                        </div>
                        {article.reviewedBy && (
                            <p className="text-sm text-slate-500">
                                Clinically reviewed by{" "}
                                {article.reviewedBy.url ? (
                                    <a href={article.reviewedBy.url} className="underline underline-offset-2" rel="noopener" target="_blank">{article.reviewedBy.name}</a>
                                ) : (
                                    article.reviewedBy.name
                                )}
                                , {article.reviewedBy.role}
                            </p>
                        )}
                    </header>

                    {/* Article body */}
                    <article className="prose prose-slate prose-lg max-w-none">
                        <p className="lead font-medium text-slate-700">{article.intro}</p>
                        {article.body.map((block, i) => {
                            if (block.type === "heading")
                                return <h2 key={i} className="text-xl font-bold text-slate-900 mt-8 mb-2">{block.text}</h2>
                            if (block.type === "callout")
                                return (
                                    <div key={i} className="not-prose my-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-slate-700 leading-relaxed">
                                        {block.text}{" "}
                                        <Link href={block.href} className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
                                            {block.linkLabel} →
                                        </Link>
                                    </div>
                                )
                            return <p key={i}>{block.text}</p>
                        })}
                        {/* Universal CTA — appears on every full article */}
                        {article.fullArticle && (
                            <p className="mt-8 text-slate-600 border-t border-slate-100 pt-6">
                                Clinical reasoning improves through repeated exposure to real patient scenarios.{" "}
                                <Link href="/case-studies" className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
                                    Explore interactive patient cases on MediKarya
                                </Link>{" "}to practise this process directly.
                            </p>
                        )}
                    </article>

                    {/* Coming soon notice — only for stub articles */}
                    {!article.fullArticle && (
                        <div className="mt-12 rounded-2xl bg-blue-50 border border-blue-100 p-6 flex gap-4 items-start">
                            <Bell className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-blue-900 mb-1">Full article coming soon</h3>
                                <p className="text-sm text-blue-700">
                                    We're working on the complete version of this article. Check back soon, or follow us on social media for updates.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Related Articles */}
                    {article.fullArticle && (
                        <div className="mt-12 pt-8 border-t border-slate-100">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Related Articles</h3>
                            <ul className="space-y-2">
                                {Object.entries(articles)
                                    .filter(([s]) => s !== slug)
                                    .slice(0, 3)
                                    .map(([s, a]) => (
                                        <li key={s}>
                                            <Link
                                                href={`/blog/${s}`}
                                                className="text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 text-sm font-medium"
                                            >
                                                {a.title}
                                            </Link>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="mt-10 border-t border-slate-100" />

                    {/* Bottom CTA buttons */}
                    <div className="mt-8 flex gap-4 flex-wrap">
                        <Button asChild variant="outline" className="rounded-full">
                            <Link href="/blog"><ArrowLeft className="mr-2 h-4 w-4" /> All Articles</Link>
                        </Button>
                        <Button asChild className="rounded-full bg-slate-900 text-white hover:bg-slate-800">
                            <Link href="/try">Try a Patient Case →</Link>
                        </Button>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    )
}
