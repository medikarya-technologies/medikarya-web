import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BadgeCheck, GraduationCap, Heart, PenTool, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/flowai/footer"
import { supabaseServer } from "@/lib/supabase/server"
import { listAdvisors } from "@/lib/advisors/invites"
import { studioLinks } from "@/lib/site-links"

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
}

/** The two people who helped before any of this existed (moved here from the old /early-contributors page, which now redirects). */
const EARLY = [
    {
        name: "Dr. Apoorva Nagar",
        role: "Clinical Advisor & Case Validator",
        institution: "Santosh University",
        Icon: Stethoscope,
        contribution:
            "Reviewed and validated MediKarya's initial four clinical cases, ensuring they were medically accurate, educationally sound, and grounded in real-world Indian clinical practice. Her guidance gave the platform its clinical credibility from day one.",
    },
    {
        name: "Shani Dangwal",
        role: "Case Contributor",
        institution: "Doon University",
        Icon: GraduationCap,
        contribution:
            "Provided the initial four to five medical case scenarios that became the foundation of MediKarya's case library. The library has grown since, but it would not exist in its current form without this early contribution.",
    },
]

const key = (name: string) => name.toLowerCase().replace(/^(dr|prof)\.?\s+/i, "").replace(/[^a-z]/g, "")

async function load() {
    const [advisors, { data: cases, error }] = await Promise.all([
        listAdvisors(true).catch(() => []),
        supabaseServer.from("cases").select("id, credit:case_json->credit, review:case_json->review").eq("status", "published"),
    ])
    if (error) console.error("Contributors page: could not read cases:", error.message)

    const writers = new Map<string, Person>()
    const reviewers = new Map<string, Person>()
    for (const c of (cases ?? []) as Array<{ credit: any; review: any }>) {
        const author = typeof c.credit?.author === "string" ? c.credit.author.trim() : ""
        if (author) {
            const k = key(author)
            const cur = writers.get(k)
            writers.set(k, { name: cur?.name ?? author, line: cur?.line || (c.credit.institution ?? ""), cases: (cur?.cases ?? 0) + 1 })
        }
        const r = c.review
        if (r?.decision === "approved" && r.show_name && typeof r.reviewer_name === "string" && r.reviewer_name.trim()) {
            const k = key(r.reviewer_name)
            const cur = reviewers.get(k)
            const line = [r.reviewer_designation, r.reviewer_department, r.reviewer_institution].filter(Boolean).join(", ")
            reviewers.set(k, { name: cur?.name ?? r.reviewer_name.trim(), line: cur?.line || line, cases: (cur?.cases ?? 0) + 1 })
        }
    }
    const byCases = (a: Person, b: Person) => b.cases - a.cases || a.name.localeCompare(b.name)
    return { advisors, writers: [...writers.values()].sort(byCases), reviewers: [...reviewers.values()].sort(byCases) }
}

const initials = (name: string) =>
    name
        .replace(/^(dr|prof)\.?\s+/i, "")
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

function SectionHeading({ id, icon: Icon, eyebrow, title, text, tone }: { id: string; icon: LucideIcon; eyebrow: string; title: string; text: string; tone: string }) {
    return (
        <div id={id} className="scroll-mt-24">
            <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-5 w-5" />
                </span>
                <div>
                    <p className="text-[11px] font-bold tracking-[0.14em] text-slate-500 uppercase">{eyebrow}</p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
                </div>
            </div>
            <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-slate-600">{text}</p>
        </div>
    )
}

function PersonCard({ name, line, note, tone }: { name: string; line: string; note?: string; tone: string }) {
    return (
        <li className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${tone}`}>{initials(name)}</span>
            <div className="min-w-0">
                <p className="font-semibold leading-snug text-slate-900">{name}</p>
                {line && <p className="text-[13.5px] leading-snug text-slate-600">{line}</p>}
                {note && <p className="mt-1 text-[12.5px] font-medium text-slate-500">{note}</p>}
            </div>
        </li>
    )
}

function Invitation({ text, cta, href }: { text: string; cta: string; href: string }) {
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-slate-700">{text}</p>
            <Button asChild className="shrink-0 bg-slate-900 hover:bg-slate-800">
                <a href={href} target="_blank" rel="noreferrer">
                    {cta} <ArrowRight className="ml-2 h-4 w-4" />
                </a>
            </Button>
        </div>
    )
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
                        <nav className="flex flex-wrap items-center justify-center gap-2 pt-1 text-sm font-medium" aria-label="On this page">
                            {[
                                ["#advisors", "Advisory board"],
                                ["#reviewers", "Reviewers"],
                                ["#writers", "Case writers"],
                                ["#early", "Early contributors"],
                            ].map(([href, label]) => (
                                <a key={href} href={href} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-slate-700 hover:border-slate-400">
                                    {label}
                                </a>
                            ))}
                        </nav>
                    </div>

                    <div className="space-y-16 pb-24">
                        {/* Advisory board */}
                        <section className="space-y-5">
                            <SectionHeading
                                id="advisors"
                                icon={ShieldCheck}
                                eyebrow="Senior clinicians"
                                title="Clinical Advisory Board"
                                text="Professors and senior doctors who have worked through our cases as a student would, and told us what to change. Membership is honorary."
                                tone="bg-rose-50 text-rose-600"
                            />
                            {advisors.length > 0 ? (
                                <ul className="grid gap-3 sm:grid-cols-2">
                                    {advisors.map((a) => (
                                        <PersonCard key={a.id} name={a.name} line={[a.designation, a.department, a.institution].filter(Boolean).join(", ")} tone="bg-rose-50 text-rose-700" />
                                    ))}
                                </ul>
                            ) : (
                                <p className="rounded-2xl border border-slate-200 bg-white p-5 text-[15px] text-slate-600">
                                    We are forming the board now. If you teach clinical medicine and would look at a case for us,{" "}
                                    <Link href="/contact" className="font-semibold text-sky-700 hover:underline">
                                        write to us
                                    </Link>
                                    .
                                </p>
                            )}
                        </section>

                        {/* Reviewers */}
                        <section className="space-y-5">
                            <SectionHeading
                                id="reviewers"
                                icon={BadgeCheck}
                                eyebrow="Doctors"
                                title="Our case reviewers"
                                text="Every case is checked by a doctor before a student sees it. Reviewers are named only if they choose to be, so this list is shorter than the work behind it."
                                tone="bg-sky-50 text-sky-600"
                            />
                            {reviewers.length > 0 && (
                                <ul className="grid gap-3 sm:grid-cols-2">
                                    {reviewers.map((r) => (
                                        <PersonCard key={r.name} name={r.name} line={r.line} note={casesNote(r.cases, "reviewed")} tone="bg-sky-50 text-sky-700" />
                                    ))}
                                </ul>
                            )}
                            <Invitation
                                text="PG resident, practising doctor or faculty? Review cases in your specialty: about ten minutes each, paid, with a title and a certificate."
                                cta="Become a reviewer"
                                href={studioLinks.becomeAReviewer}
                            />
                        </section>

                        {/* Writers */}
                        <section className="space-y-5">
                            <SectionHeading
                                id="writers"
                                icon={PenTool}
                                eyebrow="Medical students and doctors"
                                title="Our case writers"
                                text="The patients in our library come from people who saw them. A writer is credited by name on every case of theirs that goes live."
                                tone="bg-emerald-50 text-emerald-600"
                            />
                            {writers.length > 0 && (
                                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {writers.map((w) => (
                                        <PersonCard key={w.name} name={w.name} line={w.line} note={casesNote(w.cases, "published")} tone="bg-emerald-50 text-emerald-700" />
                                    ))}
                                </ul>
                            )}
                            <Invitation
                                text="Seen a patient worth teaching from? Write it up on a structured case sheet. Published cases earn a payout, a title and a certificate."
                                cta="Write a case"
                                href={studioLinks.writeACase}
                            />
                        </section>

                        {/* Early contributors */}
                        <section className="space-y-5">
                            <SectionHeading
                                id="early"
                                icon={Heart}
                                eyebrow="Before there was a platform"
                                title="Early contributors"
                                text="MediKarya started as a pilot on four clinical cases. These are the people who made those four possible."
                                tone="bg-amber-50 text-amber-600"
                            />
                            <div className="space-y-4">
                                {EARLY.map(({ name, role, institution, Icon, contribution }) => (
                                    <div key={name} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                                            <Icon className="h-6 w-6 text-amber-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-bold text-slate-900">{name}</h3>
                                            <p className="text-sm font-medium text-slate-600">
                                                {role} · {institution}
                                            </p>
                                            <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">{contribution}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

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
