"use client"

// The call for case writers and reviewers, on the home page itself (it used to be one link at the bottom of the
// footer). Two doors, one for each, straight to the Case Studio; and a way to see who is already through them
// (/contributors). It says only how the programme works today: what a writer and a reviewer do, and what they get.

import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { RoleMark, type ContributorRole } from "@/components/contributors/role-mark"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"
import { Eyebrow } from "@/components/cases/encounter-ui"
import { studioLinks } from "@/lib/site-links"

interface Door {
  role: ContributorRole
  who: string
  title: string
  text: string
  points: string[]
  cta: string
  href: string
}

const DOORS: Door[] = [
  {
    role: "writer",
    who: "Medical students, interns and doctors",
    title: "Write a case",
    text: "Seen a patient worth teaching from? Write them up on a structured case sheet. We turn it into a patient other students learn from, and a doctor reviews it before it goes live.",
    points: ["Your name on every case of yours that goes live", "A payout for each published case", "Titles and a certificate anyone can verify"],
    cta: "Start writing",
    href: studioLinks.writeACase,
  },
  {
    role: "reviewer",
    who: "Interns, PG residents, doctors and faculty",
    title: "Review cases",
    text: "You are handed one case at a time in your specialty, as a one-page report. Approve it, or say what is wrong.",
    points: ["About ten minutes a case, no need to play it", "An honorarium for each case you review", "Named on a case only if you choose to be"],
    cta: "Become a reviewer",
    href: studioLinks.becomeAReviewer,
  },
]

export default function ContributeSection() {
  const { ref, isVisible } = useScrollAnimation(0.15)
  const appear = (delay = 0) => ({
    className: cn("transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"),
    style: { transitionDelay: isVisible ? `${delay}ms` : "0ms" },
  })

  return (
    <section id="contribute" className="scroll-mt-20 bg-enc-desk py-20 sm:py-28" ref={ref}>
      <div className="mx-auto max-w-5xl px-4">
        <div {...appear()} className={cn("mx-auto max-w-2xl text-center", appear().className)}>
          <Eyebrow className="text-brand-600">Write or review</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">Our patients come from people who saw them.</h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-enc-ink-2">
            Cases contributed here are written by a medical student or doctor from a real presentation, then checked by a doctor before a student meets them.
            We are looking for both.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {DOORS.map((d, i) => (
            <div key={d.title} {...appear(100 + i * 100)} className={cn("flex flex-col rounded-2xl border border-enc-line-strong bg-enc-sheet p-6 shadow-enc-lift sm:p-7", appear().className)}>
              <div className="flex items-center gap-3">
                <RoleMark role={d.role} size="lg" />
                <div>
                  <p className="text-[11px] font-semibold tracking-widest text-enc-ink-3 uppercase">{d.who}</p>
                  <h3 className="text-xl font-bold text-enc-ink">{d.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-enc-ink-2">{d.text}</p>
              <ul className="mt-4 space-y-2">
                {d.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[14.5px] text-enc-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.4} /> {p}
                  </li>
                ))}
              </ul>
              <a
                href={d.href}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center justify-center gap-2 self-start rounded-xl bg-brand-600 px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-700"
              >
                {d.cta} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>

        <div {...appear(320)} className={cn("mt-8 flex flex-col items-center justify-center gap-x-6 gap-y-2 text-[14.5px] sm:flex-row", appear().className)}>
          <Link href="/contributors" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
            Meet our writers, reviewers and advisors <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/contribute" className="text-enc-ink-2 hover:text-enc-ink hover:underline">
            How contributing works
          </Link>
          <a href={studioLinks.rewards} className="text-enc-ink-2 hover:text-enc-ink hover:underline">
            Rewards at each milestone
          </a>
        </div>
      </div>
    </section>
  )
}
