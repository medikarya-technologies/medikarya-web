import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"
import type { Metadata } from "next"
import { getCases } from "@/data/cases"
import { GUEST_CASE_IDS } from "@/lib/plans/limits"
import { CASE_GUIDES } from "@/lib/seo/case-guides"

// One public page per case: the patient as a student first meets them, and a study guide for the presenting
// complaint (lib/seo/case-guides.ts). It reads the same published list as /case-studies, so it never shows a draft
// and never anything that gives the diagnosis away. A case without a guide still gets a page but asks not to be
// indexed, since on its own it is only a title and two sentences.

export const revalidate = 300

const BASE_URL = "https://www.medikarya.in"

type Props = { params: Promise<{ id: string }> }

async function findCase(id: string) {
    return (await getCases()).find((c) => c.id === id) ?? null
}

export function generateStaticParams() {
    return Object.keys(CASE_GUIDES).map((id) => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params
    const c = await findCase(id)
    if (!c) return { title: "Case Not Found", robots: { index: false, follow: false } }
    const guide = CASE_GUIDES[id]
    const title = guide?.seoTitle ?? c.displayTitle
    const description = guide?.metaDescription ?? c.displayDescription
    const url = `${BASE_URL}/case-studies/${id}`
    return {
        title,
        description,
        keywords: guide?.keywords,
        alternates: { canonical: url },
        robots: guide ? { index: true, follow: true } : { index: false, follow: true },
        openGraph: {
            title,
            description,
            type: "article",
            url,
            images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: c.displayTitle }],
        },
        twitter: { card: "summary_large_image", title, description, images: [`${BASE_URL}/og-image.png`] },
    }
}

function List({ items }: { items: string[] }) {
    return (
        <ul className="mt-3 space-y-2">
            {items.map((item) => (
                <li key={item} className="flex gap-3 text-slate-700 leading-relaxed">
                    <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mt-10">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {children}
        </section>
    )
}

export default async function CaseStudyPage({ params }: Props) {
    const { id } = await params
    const all = await getCases()
    const c = all.find((x) => x.id === id)
    if (!c) notFound()
    const guide = CASE_GUIDES[id]
    const free = GUEST_CASE_IDS.includes(c.id)
    const playHref = free ? "/try" : `/dashboard/cases/${c.id}`
    const others = all.filter((x) => x.id !== id && CASE_GUIDES[x.id])
    const url = `${BASE_URL}/case-studies/${id}`

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: guide?.h1 ?? c.displayTitle,
        description: guide?.metaDescription ?? c.displayDescription,
        url,
        inLanguage: "en-IN",
        learningResourceType: "Clinical case simulation",
        educationalLevel: "Undergraduate medical (MBBS)",
        about: c.category,
        timeRequired: `PT${c.estimatedTime}M`,
        isAccessibleForFree: free,
        audience: { "@type": "EducationalAudience", educationalRole: "student", audienceType: "Medical students" },
        provider: { "@type": "Organization", name: "MediKarya", url: BASE_URL },
        ...(guide ? { keywords: guide.keywords.join(", ") } : {}),
    }
    const breadcrumbLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
            { "@type": "ListItem", position: 2, name: "Case library", item: `${BASE_URL}/case-studies` },
            { "@type": "ListItem", position: 3, name: c.displayTitle, item: url },
        ],
    }

    const playButton = (
        <Button asChild size="lg" className="group rounded-full bg-slate-900 text-white hover:bg-slate-800">
            <Link href={playHref}>
                {free ? "Try this case free, no account" : "Work up this patient"}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
        </Button>
    )

    return (
        <main className="flex min-h-screen flex-col bg-white">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
            <div className="relative flex-1">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50/60 via-white to-white" />

                <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
                    <div className="container mx-auto flex h-16 items-center justify-between px-4">
                        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            <div className="flex h-8 w-8 items-center justify-center">
                                <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
                            </div>
                            MediKarya
                        </Link>
                        <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600">
                            <Link href="/case-studies" className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" /> All cases
                            </Link>
                        </Button>
                    </div>
                </header>

                <div className="mx-auto max-w-3xl px-4 pb-24 pt-10">
                    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
                        <Link href="/case-studies" className="hover:text-indigo-700 hover:underline">Case library</Link>
                        <span className="mx-2">/</span>
                        <span>{c.category}</span>
                    </nav>

                    <header className="mt-4 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{c.category}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">{c.difficulty}</span>
                            {c.live && <span className="rounded-full border border-slate-900 bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">Live simulation</span>}
                            {free && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Free, no account</span>}
                        </div>
                        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{guide?.h1 ?? c.displayTitle}</h1>
                        <p className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Clock className="h-4 w-4" /> About {c.estimatedTime} minutes
                            {c.live ? " · the patient changes with what you do, and with what you leave undone" : ""}
                        </p>
                    </header>

                    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">How the patient presents</p>
                        <p className="mt-3 text-lg leading-relaxed text-slate-800">{c.displayDescription}</p>
                        <div className="mt-6">{playButton}</div>
                    </section>

                    {guide && (
                        <article>
                            <Section title={`Why ${guide.complaint} matters`}>
                                <p className="mt-3 leading-relaxed text-slate-700">{guide.why}</p>
                            </Section>
                            <Section title="What to ask in the history">
                                <List items={guide.history} />
                            </Section>
                            <Section title="Red flags">
                                <List items={guide.redFlags} />
                            </Section>
                            <Section title="What to examine">
                                <List items={guide.examination} />
                            </Section>
                            <Section title="First investigations">
                                <List items={guide.investigations} />
                            </Section>
                            <Section title={`Differential diagnosis of ${guide.complaint}`}>
                                <p className="mt-3 text-sm text-slate-500">Grouped, not ranked. Which one fits this patient is for you to work out in the case.</p>
                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                    {guide.differential.map((g) => (
                                        <div key={g.group} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                            <h3 className="font-semibold text-slate-900">{g.group}</h3>
                                            <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                                {g.items.map((item) => <li key={item}>{item}</li>)}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                            <Section title="Common mistakes">
                                <List items={guide.pitfalls} />
                            </Section>
                        </article>
                    )}

                    <section className="mt-12 rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
                        <h2 className="text-xl font-bold">Now try it on the patient</h2>
                        <p className="mt-2 leading-relaxed text-slate-300">
                            Take the history in your own words, examine, order tests that come back after a realistic wait, and commit to a ranked
                            differential. Then see where your reasoning held and where it broke.
                        </p>
                        <Button asChild size="lg" className="group mt-5 rounded-full bg-white text-slate-900 hover:bg-slate-100">
                            <Link href={playHref}>
                                {free ? "Try this case free" : "Work up this patient"}
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </Button>
                    </section>

                    <p className="mt-6 text-xs leading-relaxed text-slate-400">
                        A study guide for medical students, not medical advice. Follow your institution&apos;s protocols in practice.
                    </p>

                    {others.length > 0 && (
                        <section className="mt-12 border-t border-slate-100 pt-8">
                            <h2 className="text-lg font-semibold text-slate-900">More cases to work up</h2>
                            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                                {others.map((o) => (
                                    <li key={o.id}>
                                        <Link href={`/case-studies/${o.id}`} className="text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline underline-offset-2">
                                            {o.displayTitle}
                                        </Link>
                                        <span className="ml-2 text-xs text-slate-400">{o.category}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    )
}
