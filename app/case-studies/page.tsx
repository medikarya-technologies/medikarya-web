// The public case library (/case-studies): every patient as a student first meets them, for visitors and search
// engines, each linking to its own page and into the case. Drawn in the app's own language (the home page's navbar,
// brand blue, the library's monitor strip on a live case) so it reads as the same product: the live emergencies first,
// then every other case under its specialty, with links at the top to jump to one. Every case is in the page's HTML,
// with its title, its presentation and its link.

import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"
import type { Metadata } from "next"
import { Navbar } from "@/components/flowai/navbar"
import { Footer } from "@/components/flowai/footer"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { MonitorStrip } from "@/components/dashboard/case-row"
import { specialtyIcon } from "@/components/dashboard/specialty-icon"
import { specialtyTone } from "@/components/dashboard/specialty-tone"
import { getCases, type CaseMetadata } from "@/data/cases"
import { GUEST_CASE_IDS } from "@/lib/plans/limits"
import { CASE_GUIDES } from "@/lib/seo/case-guides"
import { liveClockLabel } from "@/lib/library/case-library"
import { cn } from "@/lib/utils"

export const revalidate = 300

export const metadata: Metadata = {
    alternates: { canonical: "https://www.medikarya.in/case-studies" },
    title: "Clinical Cases for Medical Students: Case Library",
    description: "Every patient in the MediKarya library, as you first meet them: who they are and what they came in with. Work each one up yourself, then see where your reasoning held and where it broke.",
    openGraph: {
        title: "MediKarya Case Library: Patients to Work Up Yourself",
        description: "Real presentations across paediatrics, obstetrics, medicine, surgery and more. Take the history, order the tests, commit to a diagnosis, then get a debrief and questions on what you missed.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "MediKarya Clinical Cases" }],
    },
    twitter: {
        card: "summary_large_image",
        images: ["https://www.medikarya.in/og-image.png"],
    },
}

/** What happens in every case, in order. Each line is something the platform does today (see /how-it-works). */
const LOOP = [
    { title: "Work the patient up", text: "History in your own words, a live bedside monitor, and investigations that come back after a realistic wait." },
    { title: "Commit to an answer", text: "A ranked differential, the findings that support it, and what you would do next. No multiple choice." },
    { title: "See where your reasoning broke", text: "Two scores, the consequences of what you missed, the full record and an expert walkthrough." },
    { title: "Close the gaps", text: "Five questions drawn from what this attempt showed you missed." },
]

const DIFFICULTY_ORDER = ["Beginner", "Intermediate", "Advanced"]
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function CaseCard({ c }: { c: CaseMetadata }) {
    const Icon = specialtyIcon(c.category)
    const tone = specialtyTone(c.category)
    const free = GUEST_CASE_IDS.includes(c.id)
    const clock = c.live ? liveClockLabel(c) : null
    return (
        <article className={cn("relative flex flex-col overflow-hidden rounded-xl border border-enc-line bg-enc-sheet p-4 shadow-enc-sheet sm:p-5", c.live && "pt-16 sm:pt-16")}>
            {c.live ? <MonitorStrip compact /> : <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", tone.band)} />}
            {c.live && (
                <span className="absolute top-3 left-4 inline-flex items-center gap-1.5 rounded-md bg-enc-scope-raised px-1.5 py-0.5 text-[11px] leading-4 font-bold tracking-[0.12em] text-enc-scope-crit">
                    <span className="h-1.5 w-1.5 rounded-full bg-enc-scope-crit" />
                    LIVE
                </span>
            )}
            <div className="flex items-start gap-3.5">
                <PatientAvatar age={c.patient?.age} gender={c.patient?.gender} seed={c.id} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                    <h3 className="text-[15.5px] leading-snug font-semibold text-enc-ink">
                        <Link href={`/case-studies/${c.id}`} className="hover:text-brand-700 hover:underline underline-offset-2">
                            {c.displayTitle}
                        </Link>
                    </h3>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-enc-ink-3">
                        <span className="inline-flex items-center gap-1.5 font-medium text-enc-ink-2">
                            <Icon className={cn("h-3.5 w-3.5", tone.text)} strokeWidth={2} />
                            {c.category}
                        </span>
                        <span>{c.difficulty}</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
                            {clock ?? `${c.estimatedTime} min`}
                        </span>
                        {free && <span className="rounded-md bg-enc-ok-soft px-1.5 py-0.5 text-[11px] font-semibold text-enc-ok">Free, no account</span>}
                    </p>
                </div>
            </div>

            <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-enc-ink-2 sm:line-clamp-3">{c.displayDescription}</p>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3 sm:pt-4">
                {CASE_GUIDES[c.id] ? (
                    <Link href={`/case-studies/${c.id}`} className="text-[13px] font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2">
                        How to approach it
                    </Link>
                ) : (
                    <span />
                )}
                <Link
                    href={free ? "/try" : `/dashboard/cases/${c.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
                >
                    {free ? "Try it now" : "Work up this patient"}
                    <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        </article>
    )
}

function Group({ id, title, note, cases }: { id: string; title: string; note?: string; cases: CaseMetadata[] }) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
            <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-enc-line pb-2">
                <h2 id={`${id}-title`} className="text-[18px] font-semibold text-enc-ink">
                    {title} <span className="font-mono text-[13px] font-normal text-enc-ink-3 tabular-nums">{cases.length}</span>
                </h2>
                {note && <p className="hidden text-[13px] text-enc-ink-2 sm:block">{note}</p>}
            </div>
            {note && <p className="-mt-2 mb-4 text-[13px] text-enc-ink-2 sm:hidden">{note}</p>}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cases.map((c) => (
                    <CaseCard key={c.id} c={c} />
                ))}
            </div>
        </section>
    )
}

export default async function CaseStudiesPage() {
    const all = await getCases()
    const easiestFirst = (a: CaseMetadata, b: CaseMetadata) =>
        Number(GUEST_CASE_IDS.includes(b.id)) - Number(GUEST_CASE_IDS.includes(a.id)) ||
        DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty) ||
        a.displayTitle.localeCompare(b.displayTitle)
    const live = all.filter((c) => c.live).sort(easiestFirst)
    // Every other case under its specialty, the biggest first; a live case is shown once, in its own group.
    const bySpecialty = new Map<string, CaseMetadata[]>()
    for (const c of all.filter((c) => !c.live)) bySpecialty.set(c.category, [...(bySpecialty.get(c.category) ?? []), c])
    const specialties = [...bySpecialty].map(([name, cases]) => ({ name, cases: cases.sort(easiestFirst) })).sort((a, b) => b.cases.length - a.cases.length || a.name.localeCompare(b.name))
    const allSpecialties = [...new Set(all.map((c) => c.category))]

    return (
        <main className="min-h-dvh bg-enc-desk">
            <Navbar />

            <div className="mx-auto max-w-6xl px-4">
                <header className="max-w-3xl pt-12 pb-8 sm:pt-16">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-brand-600 uppercase">Case library</p>
                    <h1 className="mt-3 text-4xl font-bold tracking-tight text-enc-ink sm:text-5xl">
                        {all.length} patients. <span className="text-brand-600">You work out what is wrong.</span>
                    </h1>
                    <p className="mt-4 text-[16.5px] leading-relaxed text-enc-ink-2">
                        Each one is shown as you would meet them: who they are and what brought them in. The diagnosis is yours to reach, across{" "}
                        {allSpecialties.length} specialties.
                        {live.length > 0 ? ` ${live.length} are live emergencies: the patient gets worse until you act.` : ""}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <Link href="/try" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700">
                            Try a case free <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/how-it-works" className="text-[14.5px] font-medium text-brand-700 hover:underline underline-offset-2">
                            How a case works
                        </Link>
                    </div>
                </header>

                {/* What every case takes you through, as one line of four steps */}
                <ol className="grid gap-px overflow-hidden rounded-xl border border-enc-line bg-enc-line sm:grid-cols-2 lg:grid-cols-4">
                    {LOOP.map((step, i) => (
                        <li key={step.title} className="bg-enc-sheet p-4">
                            <p className="flex items-center gap-2 text-[14px] font-semibold text-enc-ink">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{i + 1}</span>
                                {step.title}
                            </p>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-enc-ink-2">{step.text}</p>
                        </li>
                    ))}
                </ol>

                {/* Jump to a group: plain links, so they work without JavaScript */}
                <nav aria-label="Jump to a group" className="sticky top-[61px] z-30 -mx-4 mt-8 border-y border-enc-line bg-enc-desk/95 px-4 py-2.5 backdrop-blur">
                    <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {live.length > 0 && (
                            <li>
                                <a href="#live" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-enc-line-strong bg-enc-sheet px-3 text-[13px] font-medium whitespace-nowrap text-enc-ink hover:border-enc-ink">
                                    <span className="h-1.5 w-1.5 rounded-full bg-enc-crit" /> Live emergencies <span className="font-mono text-[11.5px] text-enc-ink-3">{live.length}</span>
                                </a>
                            </li>
                        )}
                        {specialties.map((s) => (
                            <li key={s.name}>
                                <a href={`#${slug(s.name)}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-enc-line-strong bg-enc-sheet px-3 text-[13px] whitespace-nowrap text-enc-ink-2 hover:border-enc-ink hover:text-enc-ink">
                                    {s.name} <span className="font-mono text-[11.5px] text-enc-ink-3">{s.cases.length}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="space-y-10 py-8 sm:space-y-12 sm:py-10">
                    {live.length > 0 && <Group id="live" title="Live emergencies" note="The patient gets worse until you act. Treat in time and they recover." cases={live} />}
                    {specialties.map((s) => (
                        <Group key={s.name} id={slug(s.name)} title={s.name} cases={s.cases} />
                    ))}
                </div>

                <section className="mb-16 rounded-2xl border border-enc-line bg-enc-sheet p-6 text-center sm:p-8">
                    <p className="mx-auto max-w-2xl text-[14px] leading-relaxed text-enc-ink-2">
                        Cases contributed by medical students, from patients they have seen, are checked by a doctor before they are published. The rest are written by the
                        MediKarya team from standard textbooks and current clinical guidelines.
                    </p>
                    <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/try" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700">
                            Try a case free <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/contribute" className="inline-flex items-center rounded-xl border border-enc-line-strong bg-enc-sheet px-5 py-2.5 text-[15px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink">
                            Write or review cases
                        </Link>
                    </div>
                </section>
            </div>
            <Footer />
        </main>
    )
}
