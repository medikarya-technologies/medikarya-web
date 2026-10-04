import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Activity, Baby, Brain, Clock, Droplet, HeartPulse, Stethoscope, Syringe, Thermometer, type LucideIcon } from "lucide-react"
import type { Metadata } from "next"
import { getCases, type CaseMetadata } from "@/data/cases"
import { GUEST_CASE_IDS } from "@/lib/plans/limits"

// The public case library: every published case as a student first meets it (who the patient is and what they came
// in with), never what they turn out to have. It reads the same list the signed-in library does, so a new case
// appears here by itself and nothing on this page can give a diagnosis away. What a case teaches is described once,
// for all of them: the loop every case runs through.

export const revalidate = 300

export const metadata: Metadata = {
    alternates: { canonical: "https://www.medikarya.in/case-studies" },
    title: "Clinical Cases — MediKarya Case Library",
    description: "Every patient in the MediKarya library, as you first meet them: who they are and what they came in with. Work each one up yourself, then see where your reasoning held and where it broke.",
    openGraph: {
        title: "MediKarya Case Library — Patients to Work Up Yourself",
        description: "Real presentations across paediatrics, obstetrics, medicine, surgery and more. Take the history, order the tests, commit to a diagnosis, then get a debrief and questions on what you missed.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "MediKarya Clinical Cases" }],
    },
    twitter: {
        card: "summary_large_image",
        images: ["https://www.medikarya.in/og-image.png"],
    },
}

const ICONS: Array<[RegExp, LucideIcon]> = [
    [/paediatr|pediatr|neonat/i, Baby],
    [/cardio|emergency/i, HeartPulse],
    [/neuro|psychiat/i, Brain],
    [/obstet|gynae|gyne/i, Activity],
    [/nephro|urolog|haemat|hemat/i, Droplet],
    [/infect|tropical/i, Thermometer],
    [/surg|ortho|ent/i, Syringe],
]
const iconFor = (category: string): LucideIcon => ICONS.find(([re]) => re.test(category))?.[1] ?? Stethoscope

const DIFFICULTY: Record<string, string> = {
    Beginner: "bg-green-50 text-green-700 border-green-200",
    Intermediate: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Advanced: "bg-red-50 text-red-700 border-red-200",
}

/** What happens in every case, in order. Each line is something the platform does today (see /how-it-works). */
const LOOP = [
    { title: "Work the patient up", text: "Take the history in your own words, watch a live bedside monitor, and order investigations that come back after a realistic wait." },
    { title: "Commit to an answer", text: "A ranked differential, the findings that support it, and what you would do next. No multiple choice." },
    { title: "See where your reasoning broke", text: "Two scores, what you did well beside the consequences of what you missed, the full record of the encounter, and an expert walkthrough of the case." },
    { title: "Close the gaps", text: "Five questions drawn from what this attempt showed you missed, so the next patient like this goes better." },
]

function CaseCard({ c }: { c: CaseMetadata }) {
    const Icon = iconFor(c.category)
    const free = GUEST_CASE_IDS.includes(c.id)
    return (
        <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
            <div className="flex items-start gap-4 p-6 pb-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                    <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{c.category}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DIFFICULTY[c.difficulty] ?? DIFFICULTY.Intermediate}`}>{c.difficulty}</span>
                        {c.live && <span className="rounded-full border border-slate-900 bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">Live simulation</span>}
                        {free && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Free, no account</span>}
                    </div>
                    <h2 className="font-bold leading-snug text-slate-900">{c.displayTitle}</h2>
                </div>
            </div>

            <div className="flex flex-1 flex-col px-6 pb-6">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">How they present</p>
                <p className="text-sm leading-relaxed text-slate-700">{c.displayDescription}</p>

                <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> About {c.estimatedTime} minutes
                    {c.live ? " · the patient changes with what you do, and with what you leave undone" : ""}
                </p>

                <Button asChild className="group mt-5 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                    <Link href={free ? "/try" : `/dashboard/cases/${c.id}`}>
                        {free ? "Try this case now" : "Work up this patient"}
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </div>
        </article>
    )
}

export default async function CaseStudiesPage() {
    const all = await getCases()
    // the free case first, then by difficulty, so the page opens on something a visitor can do at once
    const order = ["Beginner", "Intermediate", "Advanced"]
    const cases = [...all].sort(
        (a, b) => Number(GUEST_CASE_IDS.includes(b.id)) - Number(GUEST_CASE_IDS.includes(a.id)) || order.indexOf(a.difficulty) - order.indexOf(b.difficulty)
    )
    const specialties = [...new Set(cases.map((c) => c.category))]

    return (
        <main className="flex min-h-screen flex-col bg-white">
            <div className="relative flex-1">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />

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

                <div className="mx-auto max-w-6xl px-4">
                    <div className="mx-auto max-w-3xl space-y-5 py-16 text-center md:py-20">
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-800">
                            <Stethoscope className="h-4 w-4" />
                            <span>Case Library</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                            {cases.length} patients.{" "}
                            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">You work out what is wrong.</span>
                        </h1>
                        <p className="text-lg leading-relaxed text-slate-600">
                            Each one is shown here as you would meet them: who they are and what brought them in. The diagnosis is yours to reach
                            {specialties.length > 1 ? `, across ${specialties.slice(0, 5).join(", ").toLowerCase()}${specialties.length > 5 ? " and more" : ""}` : ""}.
                        </p>
                    </div>

                    {/* What every case teaches: the same loop, start to finish */}
                    <section className="mb-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">What every case takes you through</p>
                        <ol className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {LOOP.map((step, i) => (
                                <li key={step.title}>
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{i + 1}</span>
                                    <p className="mt-3 font-semibold text-slate-900">{step.title}</p>
                                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.text}</p>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-6 text-sm text-slate-500">
                            The full flow, step by step:{" "}
                            <Link href="/how-it-works" className="font-medium text-indigo-700 hover:underline">
                                how a case works
                            </Link>
                            .
                        </p>
                    </section>

                    <div className="grid grid-cols-1 gap-6 pb-8 md:grid-cols-2">
                        {cases.map((c) => (
                            <CaseCard key={c.id} c={c} />
                        ))}
                    </div>

                    <div className="py-16 text-center">
                        <p className="mb-4 text-sm text-slate-500">New cases are written by medical students from patients they have seen, and checked by a doctor before they go live.</p>
                        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Button asChild size="lg" className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90">
                                <Link href="/try">Try a case free →</Link>
                            </Button>
                            <Button asChild size="lg" variant="outline" className="rounded-full">
                                <Link href="/contribute">Write or review cases</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    )
}
