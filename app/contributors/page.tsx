import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/flowai/footer"
import { supabaseServer } from "@/lib/supabase/server"
import { listAdvisors } from "@/lib/advisors/invites"
import { contributorPictures } from "@/lib/studio/source"
import { studioLinks } from "@/lib/site-links"
import { ContributorTabs, type EarlyContributor } from "@/components/contributors/contributor-tabs"

// The people behind MediKarya's cases, in one place: the Clinical Advisory Board, the doctors who review cases, the
// students who write them, and the two people who helped before there was a platform. Nobody is named here who is
// not already named in public with their agreement: writers and reviewers come from the credit printed on each live
// case (a reviewer only if they chose to be named), and advisors from the board an admin keeps (Admin → Advisors).

export const revalidate = 300

export const metadata: Metadata = {
    title: "Contributors",
    description: "The clinicians and medical students behind MediKarya's cases: our Clinical Advisory Board, the doctors who review every case, and the students who write them.",
    alternates: { canonical: "https://www.medikarya.in/contributors" },
    robots: { index: true, follow: true },
    openGraph: {
        title: "The People Behind MediKarya's Cases",
        description: "Every MediKarya case is written by a medical student from a patient they saw, and checked by a doctor. These are the people who do that work.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "MediKarya Platform Preview" }],
    },
}

interface Person {
    name: string
    line: string
    cases: number
    /** Their sign-in account's picture, from the Case Studio (contributorPictures). */
    image?: string
}

/** The two people who helped before any of this existed (moved here from the old /early-contributors page, which now redirects). */
const EARLY: EarlyContributor[] = [
    {
        name: "Dr. Apoorva Nagar",
        role: "Clinical Advisor & Case Validator",
        institution: "Santosh University",
        kind: "reviewer",
        contribution:
            "Reviewed and validated MediKarya's initial four clinical cases, ensuring they were medically accurate, educationally sound, and grounded in real-world Indian clinical practice. Her guidance gave the platform its clinical credibility from day one.",
    },
    {
        name: "Shani Dangwal",
        role: "Case Contributor",
        institution: "Doon University",
        kind: "writer",
        contribution:
            "Provided the initial four to five medical case scenarios that became the foundation of MediKarya's case library. The library has grown since, but it would not exist in its current form without this early contribution.",
    },
]

const key = (name: string) => name.toLowerCase().replace(/^(dr|prof)\.?\s+/i, "").replace(/[^a-z]/g, "")

async function load() {
    const [advisors, { data: cases, error }] = await Promise.all([
        listAdvisors(true).catch(() => []),
        supabaseServer
            .from("cases")
            .select("id, credit:case_json->credit, review:case_json->review, studio:case_json->source->>studio_case_id")
            .eq("status", "published"),
    ])
    if (error) console.error("Contributors page: could not read cases:", error.message)

    const rows = (cases ?? []) as Array<{ credit: any; review: any; studio: string | null }>
    // their own photos, for cases that came through the Case Studio (private-link reviewers have no account, so none)
    const pictures = await contributorPictures(rows.map((c) => c.studio).filter((s): s is string => !!s)).catch(() => new Map())

    const writers = new Map<string, Person>()
    const reviewers = new Map<string, Person>()
    for (const c of rows) {
        const pic = c.studio ? pictures.get(c.studio) : undefined
        const author = typeof c.credit?.author === "string" ? c.credit.author.trim() : ""
        if (author) {
            const k = key(author)
            const cur = writers.get(k)
            writers.set(k, { name: cur?.name ?? author, line: cur?.line || (c.credit.institution ?? ""), cases: (cur?.cases ?? 0) + 1, image: cur?.image ?? pic?.writer })
        }
        const r = c.review
        if (r?.decision === "approved" && r.show_name && typeof r.reviewer_name === "string" && r.reviewer_name.trim()) {
            const k = key(r.reviewer_name)
            const cur = reviewers.get(k)
            const line = [r.reviewer_designation, r.reviewer_department, r.reviewer_institution].filter(Boolean).join(", ")
            // a picture only when this approval came from the studio queue (a private link has no account behind it)
            const image = r.via === "studio" ? pic?.reviewer : undefined
            reviewers.set(k, { name: cur?.name ?? r.reviewer_name.trim(), line: cur?.line || line, cases: (cur?.cases ?? 0) + 1, image: cur?.image ?? image })
        }
    }
    const byCases = (a: Person, b: Person) => b.cases - a.cases || a.name.localeCompare(b.name)
    return { advisors, writers: [...writers.values()].sort(byCases), reviewers: [...reviewers.values()].sort(byCases) }
}

const casesNote = (n: number, verb: string) => `${n} case${n === 1 ? "" : "s"} ${verb}`

export default async function ContributorsPage() {
    const { advisors, writers, reviewers } = await load()

    return (
        <main className="flex min-h-screen flex-col bg-white">
            <div className="relative flex-1">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-sky-50" />

                <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
                    <div className="container mx-auto flex h-16 items-center justify-between px-4">
                        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            <div className="flex h-8 w-8 items-center justify-center">
                                <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
                            </div>
                            MediKarya
                        </Link>
                        <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600">
                            <Link href="/" className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" /> Back to Home
                            </Link>
                        </Button>
                    </div>
                </header>

                <div className="mx-auto max-w-5xl px-4">
                    {/* Hero */}
                    <div className="mx-auto max-w-3xl space-y-5 py-16 text-center md:py-20">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600">
                            <Heart className="h-3.5 w-3.5 text-rose-400" />
                            <span>Contributors</span>
                        </div>
                        <h1 className="text-4xl leading-tight font-bold tracking-tight text-slate-900 sm:text-5xl">
                            Every case here was written and checked by <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">real people.</span>
                        </h1>
                        <p className="text-lg leading-relaxed text-slate-600">
                            A medical student writes up a patient they saw. A doctor checks the medicine. Senior clinicians tell us where we are wrong. These
                            are the people who do that work.
                        </p>
                    </div>

                    <div className="space-y-16 pb-24">
                        <ContributorTabs
                            advisors={advisors.map((a) => ({ name: a.name, line: [a.designation, a.department, a.institution].filter(Boolean).join(", ") }))}
                            reviewers={reviewers.map((r) => ({ name: r.name, line: r.line, note: casesNote(r.cases, "reviewed"), image: r.image }))}
                            writers={writers.map((w) => ({ name: w.name, line: w.line, note: casesNote(w.cases, "published"), image: w.image }))}
                            early={EARLY}
                            writeHref={studioLinks.writeACase}
                            reviewHref={studioLinks.becomeAReviewer}
                        />

                        <p className="text-center text-[14px] text-slate-500">
                            Certificates issued by MediKarya carry a QR code and can be checked at{" "}
                            <span className="font-mono text-slate-700">medikarya.in/verify</span>.{" "}
                            <Link href="/contribute" className="font-semibold text-sky-700 hover:underline">
                                How contributing works
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    )
}
