"use client"

// The people on /contributors, one group at a time: pick Advisory board, Reviewers, Case writers or Early
// contributors and only that group shows. The tab is kept in the address (#advisors, #reviewers, #writers, #early),
// so a link can open straight onto a group (the old /early-contributors page redirects to #early).

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyAvatar, RoleMark, type ContributorRole } from "./role-mark"

export interface ContributorPerson {
    name: string
    line: string
    /** e.g. "3 cases reviewed" */
    note?: string
    /** Their own photo (their sign-in account's); the empty profile picture when there is none. */
    image?: string
}

export interface EarlyContributor {
    name: string
    role: string
    institution: string
    kind: "writer" | "reviewer"
    contribution: string
}

type Tab = "advisors" | "reviewers" | "writers" | "early"

const TABS: Array<{ id: Tab; role: ContributorRole; label: string }> = [
    { id: "advisors", role: "advisor", label: "Advisory board" },
    { id: "reviewers", role: "reviewer", label: "Reviewers" },
    { id: "writers", role: "writer", label: "Case writers" },
    { id: "early", role: "early", label: "Early contributors" },
]

/** "Dr." / "Prof." set apart from the name, so the name itself reads first. */
function splitTitle(name: string): { title: string | null; rest: string } {
    const m = name.match(/^(dr|prof)\.?\s+(.*)$/i)
    return m ? { title: m[1].toLowerCase() === "dr" ? "Dr." : "Prof.", rest: m[2] } : { title: null, rest: name }
}

function PersonCard({ person, badge }: { person: ContributorPerson; badge?: string }) {
    const { title, rest } = splitTitle(person.name)
    return (
        <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-4">
                {person.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                ) : (
                    <EmptyAvatar className="h-14 w-14" />
                )}
                <div className="min-w-0">
                    <p className="leading-tight">
                        {title && <span className="mr-1 text-[13px] font-semibold text-slate-400">{title}</span>}
                        <span className="text-[18px] font-bold tracking-tight text-slate-900">{rest}</span>
                    </p>
                    {person.line && <p className="mt-1 text-[13.5px] leading-snug text-slate-600">{person.line}</p>}
                </div>
            </div>
            {(person.note || badge) && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {badge && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 ring-1 ring-brand-100">{badge}</span>}
                    {person.note && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-700">{person.note}</span>}
                </div>
            )}
        </li>
    )
}

function Invitation({ text, cta, href, external = true }: { text: string; cta: string; href: string; external?: boolean }) {
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-slate-700">{text}</p>
            {external ? (
                <a href={href} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                    {cta} <ArrowRight className="ml-2 h-4 w-4" />
                </a>
            ) : (
                <Link href={href} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                    {cta} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            )}
        </div>
    )
}

function Intro({ role, eyebrow, title, text }: { role: ContributorRole; eyebrow: string; title: string; text: string }) {
    return (
        <div className="flex items-start gap-4">
            <RoleMark role={role} size="lg" />
            <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-slate-500 uppercase">{eyebrow}</p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
                <p className="mt-2 max-w-2xl text-[15.5px] leading-relaxed text-slate-600">{text}</p>
            </div>
        </div>
    )
}

export function ContributorTabs({
    advisors,
    reviewers,
    writers,
    early,
    writeHref,
    reviewHref,
}: {
    advisors: ContributorPerson[]
    reviewers: ContributorPerson[]
    writers: ContributorPerson[]
    early: EarlyContributor[]
    writeHref: string
    reviewHref: string
}) {
    const [tab, setTab] = useState<Tab>("advisors")

    useEffect(() => {
        const fromHash = () => {
            const h = window.location.hash.replace("#", "") as Tab
            if (TABS.some((t) => t.id === h)) setTab(h)
        }
        fromHash()
        window.addEventListener("hashchange", fromHash)
        return () => window.removeEventListener("hashchange", fromHash)
    }, [])

    const choose = (t: Tab) => {
        setTab(t)
        try {
            window.history.replaceState(null, "", `#${t}`)
        } catch {}
    }
    const counts: Record<Tab, number> = { advisors: advisors.length, reviewers: reviewers.length, writers: writers.length, early: early.length }

    return (
        <div>
            <div role="tablist" aria-label="Contributors" className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2">
                {TABS.map((t) => {
                    const on = t.id === tab
                    return (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={on}
                            onClick={() => choose(t.id)}
                            className={cn(
                                "flex items-center gap-2.5 rounded-2xl border py-2 pr-4 pl-2 text-[14.5px] font-semibold transition-all",
                                on ? "border-slate-900 bg-slate-900 text-white shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                            )}
                        >
                            <RoleMark role={t.role} size="sm" tone={on ? "dark" : "light"} />
                            {t.label}
                            <span className={cn("rounded-full px-2 py-0.5 text-[11.5px]", on ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600")}>{counts[t.id]}</span>
                        </button>
                    )
                })}
            </div>

            <div role="tabpanel" className="mt-12 space-y-6">
                {tab === "advisors" && (
                    <>
                        <Intro
                            role="advisor"
                            eyebrow="Senior clinicians"
                            title="Clinical Advisory Board"
                            text="Professors and senior doctors who have worked through our cases as a student would, and told us what to change. Membership is honorary."
                        />
                        {advisors.length > 0 ? (
                            <ul className="grid gap-4 sm:grid-cols-2">
                                {advisors.map((a) => (
                                    <PersonCard key={a.name} person={a} badge="Clinical Advisory Board" />
                                ))}
                            </ul>
                        ) : (
                            <Invitation text="We are forming the board now. If you teach clinical medicine and would look at a case for us, write to us." cta="Write to us" href="/contact" external={false} />
                        )}
                    </>
                )}

                {tab === "reviewers" && (
                    <>
                        <Intro
                            role="reviewer"
                            eyebrow="Doctors"
                            title="Our case reviewers"
                            text="Every case is reviewed by a doctor before a student sees it. Reviewers are named only if they choose to be, so this list is shorter than the work behind it."
                        />
                        {reviewers.length > 0 && (
                            <ul className="grid gap-4 sm:grid-cols-2">
                                {reviewers.map((r) => (
                                    <PersonCard key={r.name} person={r} />
                                ))}
                            </ul>
                        )}
                        <Invitation
                            text="Intern, PG resident, practising doctor or faculty? Review cases in your specialty: about ten minutes each, paid, with a title and a certificate."
                            cta="Become a reviewer"
                            href={reviewHref}
                        />
                    </>
                )}

                {tab === "writers" && (
                    <>
                        <Intro
                            role="writer"
                            eyebrow="Medical students and doctors"
                            title="Our case writers"
                            text="The patients in our library come from people who saw them. A writer is credited by name on every case of theirs that goes live."
                        />
                        {writers.length > 0 && (
                            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {writers.map((w) => (
                                    <PersonCard key={w.name} person={w} />
                                ))}
                            </ul>
                        )}
                        <Invitation
                            text="Seen a patient worth teaching from? Write it up on a structured case sheet. Published cases earn a payout, a title and a certificate."
                            cta="Write a case"
                            href={writeHref}
                        />
                    </>
                )}

                {tab === "early" && (
                    <>
                        <Intro
                            role="early"
                            eyebrow="Before there was a platform"
                            title="Early contributors"
                            text="MediKarya started as a pilot on four clinical cases. These are the people who made those four possible."
                        />
                        <ul className="space-y-4">
                            {early.map((p) => (
                                <li key={p.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <EmptyAvatar className="h-14 w-14" />
                                        <div className="min-w-0">
                                            <p className="text-[18px] font-bold tracking-tight text-slate-900">{p.name}</p>
                                            <p className="text-sm font-medium text-slate-600">
                                                {p.role} · {p.institution}
                                            </p>
                                            <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">{p.contribution}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    )
}
