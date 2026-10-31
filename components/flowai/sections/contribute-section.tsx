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

// Compact on the home page (round 2 of the design review): a student reading this page is not the one being
// recruited, so each door is one line and its offer; the full account is on /contribute.
interface Door {
  role: ContributorRole
  who: string
  title: string
  text: string
  offer: string
  cta: string
  href: string
}

const DOORS: Door[] = [
  {
    role: "writer",
    who: "Medical students, interns and doctors",
    title: "Write a case",
    text: "Seen a patient worth teaching from? Write them up; a doctor reviews the case before it goes live.",
    offer: "Your name on it, a payout for each published case, and a certificate anyone can verify.",
    cta: "Start writing",
    href: studioLinks.writeACase,
  },
  {
    role: "reviewer",
    who: "Interns, PG residents, doctors and faculty",
    title: "Review cases",
    text: "One case at a time in your specialty, as a one-page report. Approve it, or say what is wrong.",
    offer: "About ten minutes a case, an honorarium for each, and your name only if you choose.",
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
    <section id="contribute" className="scroll-mt-20 bg-enc-desk py-16 sm:py-20" ref={ref}>
      <div className="mx-auto max-w-5xl px-4">
        <div {...appear()} className={cn("mx-auto max-w-2xl text-center", appear().className)}>
          <Eyebrow className="text-brand-600">Write or review</Eyebrow>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-enc-ink sm:text-3xl">Our patients come from people who saw them.</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-enc-ink-2">
            Cases contributed here are written from a real presentation and checked by a doctor before a student meets them. We are looking for writers and reviewers.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {DOORS.map((d, i) => (
            <div key={d.title} {...appear(100 + i * 100)} className={cn("flex flex-col rounded-2xl border border-enc-line-strong bg-enc-sheet p-5 shadow-enc-sheet sm:p-6", appear().className)}>
              <div className="flex items-center gap-3">
                <RoleMark role={d.role} size="lg" />
                <div>
                  <p className="text-[11px] font-semibold tracking-widest text-enc-ink-3 uppercase">{d.who}</p>
                  <h3 className="text-xl font-bold text-enc-ink">{d.title}</h3>
                </div>
              </div>
              <p className="mt-3 text-[14.5px] leading-relaxed text-enc-ink-2">{d.text}</p>
              <p className="mt-2 flex items-start gap-2 text-[14px] text-enc-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.4} /> {d.offer}
              </p>
              {/* at least a little air above the button, and the two buttons level with each other */}
              <div className="min-h-5 flex-1" />
              <a
                href={d.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-brand-600 px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-700"
              >
                {d.cta} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>

        <div {...appear(320)} className={cn("mt-6 flex flex-col items-center justify-center gap-x-6 gap-y-2 text-[14.5px] sm:flex-row", appear().className)}>
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
