import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { RoleMark, type ContributorRole } from "@/components/contributors/role-mark"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/flowai/footer"
import { studioLinks } from "@/lib/site-links"

// How to write or review cases. The work itself happens in the Case Studio (a separate site): this page explains the
// two ways in and sends people straight there. Everything said here is how the programme works today.

export const metadata: Metadata = {
    alternates: { canonical: "https://www.medikarya.in/contribute" },
    title: "Contribute",
    description: "MediKarya's cases are written by medical students from patients they have seen and checked by doctors. Write a case, or review cases in your specialty.",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "Write or Review Clinical Cases | MediKarya",
        description: "Students write up patients they have seen; doctors check them; published cases carry their names. Titles and verifiable certificates for both.",
        url: "/contribute",
    },
}

const JOURNEY = [
    "A student writes up a patient they saw, on a structured case sheet.",
    "With the author's permission, MediKarya turns it into an interactive patient (or sends it back saying what to add).",
    "One review: a doctor of that specialty approves the interactive version, or says what to fix.",
    "It goes live for students, with the author's name on it.",
]

const WRITERS = [
    "Write up a patient you saw on a seven-part case sheet. Made-up name, no real identifiers.",
    "You decide whether MediKarya may publish it. If you allow it, we turn it into an interactive patient and you are credited on it.",
    "A doctor reviews that patient. If something in your sheet needs fixing, it comes back to you to fix.",
    "Published cases earn a reward and count towards a contributor title. Each title comes with a certificate.",
]

const REVIEWERS = [
    "Apply with your medical council registration. We check it on the Indian Medical Register.",
    "You are given one case at a time in your specialty, as a one-page report you can read on your phone or print.",
    "Approve it, or say what is wrong. About ten minutes a case.",
    "Each accepted review earns an honorarium and counts towards a reviewer title. You are named on a case only if you choose to be.",
]

function Way({
    role,
    who,
    title,
    points,
    href,
    cta,
    dark,
}: {
    role: ContributorRole
    who: string
    title: string
    points: string[]
    href: string
    cta: string
    dark?: boolean
}) {
    return (
        <div className={`flex flex-col rounded-2xl p-7 shadow-sm ring-1 ${dark ? "bg-slate-900 text-white ring-slate-900" : "bg-white ring-slate-200"}`}>
            <div className="flex items-center gap-3">
                <RoleMark role={role} size="lg" tone={dark ? "dark" : "light"} />
                <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${dark ? "text-emerald-300" : "text-slate-500"}`}>{who}</p>
                    <h2 className={`text-xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>{title}</h2>
                </div>
            </div>
            <ol className={`mt-5 flex-1 space-y-3 text-[15px] leading-relaxed ${dark ? "text-white/80" : "text-slate-700"}`}>
                {points.map((p, i) => (
                    <li key={p} className="flex gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${dark ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>{i + 1}</span>
                        <span>{p}</span>
                    </li>
                ))}
            </ol>
            <Button asChild size="lg" className={`group mt-7 w-full rounded-xl ${dark ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                <a href={href}>
                    {cta}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
            </Button>
        </div>
    )
}

export default function ContributePage() {
    return (
        <main className="flex min-h-screen flex-col bg-white">
            <div className="relative flex-1">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-brand-50/40" />

                <header className="px-4 pt-6 sm:px-8">
                    <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:bg-slate-100 hover:text-brand-600">
                        <Link href="/" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Home
                        </Link>
                    </Button>
                </header>

                <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:pt-14">
                    <p className="text-center text-xs font-semibold uppercase tracking-widest text-brand-600">The MediKarya Case Studio</p>
                    <h1 className="mx-auto mt-3 max-w-3xl text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                        The cases students practise on are written by students, and checked by doctors.
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-slate-600">
                        Every new patient on MediKarya starts as a real one someone saw on the ward. Writing and reviewing happen in the Case Studio; pick your way in
                        below.
                    </p>

                    <div className="mt-10 grid gap-6 md:grid-cols-2">
                        <Way role="writer" who="MBBS students and interns" title="Write a case" points={WRITERS} href={studioLinks.writeACase} cta="Start writing in the Case Studio" />
                        <Way role="reviewer" who="Interns, PG residents and faculty" title="Review cases" points={REVIEWERS} href={studioLinks.becomeAReviewer} cta="Apply to review" dark />
                    </div>

                    <section className="mt-12 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">From the ward to the platform</p>
                        <ol className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {JOURNEY.map((step, i) => (
                                <li key={step}>
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{i + 1}</span>
                                    <p className="mt-3 text-sm leading-relaxed text-slate-700">{step}</p>
                                </li>
                            ))}
                        </ol>
                    </section>

                    <section className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-emerald-50 p-7 ring-1 ring-emerald-200 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-3">
                            <RoleMark role="advisor" size="sm" />
                            <div>
                                <p className="font-semibold text-emerald-950">Recognition anyone can check</p>
                                <p className="mt-1 text-sm leading-relaxed text-emerald-900">
                                    Each title comes with a certificate carrying a credential ID and a QR code. Scanning it opens a page on medikarya.in that says who it was
                                    issued to, for what, and that it is valid.
                                </p>
                            </div>
                        </div>
                        <Button asChild variant="outline" className="shrink-0 rounded-xl border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100">
                            <a href={studioLinks.contributors}>See the contributors</a>
                        </Button>
                    </section>

                    <p className="mt-8 text-center text-sm text-slate-500">
                        <a href={studioLinks.rewards} className="font-semibold text-brand-700 hover:underline">
                            See what you get at each milestone
                        </a>
                        . A question first? Write to{" "}
                        <a href="mailto:collab@medikarya.in" className="font-medium text-brand-700 hover:underline">
                            collab@medikarya.in
                        </a>
                        .
                    </p>
                </div>
            </div>
            <Footer />
        </main>
    )
}
