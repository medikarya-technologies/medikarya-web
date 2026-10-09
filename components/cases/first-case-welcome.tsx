"use client"

// Above the briefing of a brand-new account's first case (/dashboard/cases/<id>?first=1, see lib/library/first-case.ts):
// who this is for, what the next quarter of an hour looks like, and two clear ways out for anyone who has played this
// case already or would rather look around. The briefing below it does the rest: the patient, why they came, and
// their vitals on arrival.

import { useEffect } from "react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { Clock, Compass, FlaskConical, Hand, LayoutGrid, MessageSquare, PauseCircle, Stethoscope } from "lucide-react"
import { Paper } from "@/components/cases/encounter-ui"
import { trackEvent } from "@/lib/clarity"

// The same four steps, names and icons as the tabs at the bedside, so the student recognises them there. Each has
// its own colour; brand and accent follow the theme by themselves, the other two have their dark-mode shades here.
const STEPS = [
  { icon: MessageSquare, title: "History", text: "Ask the patient anything, in your own words.", tone: "bg-brand-100 text-brand-700" },
  { icon: Hand, title: "Examine", text: "Choose what to examine and see what you find.", tone: "bg-accent-100 text-accent-700" },
  {
    icon: FlaskConical,
    title: "Investigations",
    text: "Order the tests you would really order.",
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    icon: Stethoscope,
    title: "Diagnose",
    text: "Rank your diagnoses, plan treatment, get feedback.",
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
]

const CHIP = "inline-flex items-center gap-1.5 rounded-full border border-enc-line bg-enc-sheet px-2.5 py-1 text-[12.5px] font-medium text-enc-ink-2"
const WAY_OUT = "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13.5px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-300"

export function FirstCaseWelcome() {
  // Only a first name the account really has. Made up from an email address it can read oddly ("Daily, meet…").
  const { user } = useUser()
  const firstName = user?.firstName?.trim().split(/\s+/)[0] ?? ""

  useEffect(() => trackEvent("first_case_welcome"), [])

  return (
    <Paper className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-50 via-enc-sheet to-accent-50 px-5 pt-5 pb-4 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.09em] text-brand-700 uppercase">Welcome to MediKarya</p>
        <h2 className="mt-1.5 text-[22px] leading-tight font-semibold text-enc-ink sm:text-[24px]">
          {firstName ? `${firstName}, meet your first patient` : "Meet your first patient"}
        </h2>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-enc-ink-2">
          Below is what you would know walking up to the bed: who they are, why they came, and their vitals on arrival. Then it is your call, step by
          step.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={CHIP}>
            <Clock className="h-3.5 w-3.5 text-brand-600" aria-hidden /> About 15 to 20 minutes
          </span>
          <span className={CHIP}>
            <PauseCircle className="h-3.5 w-3.5 text-accent-600" aria-hidden /> Stop and come back any time
          </span>
        </div>
      </div>

      {/* two by two on a phone, so Start is not pushed far down; the 1px gaps over the line colour draw the rules */}
      <ol className="grid grid-cols-2 gap-px border-t border-enc-line bg-enc-line sm:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text, tone }, i) => (
          <li key={title} className="flex flex-col gap-2 bg-enc-sheet px-4 py-3 sm:px-5 sm:py-3.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold text-enc-ink">
                {i + 1}. {title}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-enc-ink-3">{text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2.5 border-t border-enc-line bg-enc-desk px-5 py-4 sm:px-6">
        <p className="text-[13px] leading-snug text-enc-ink-2">Played this one on the free page already, or want to look around?</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/cases" className={`${WAY_OUT} border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100`}>
            <LayoutGrid className="h-4 w-4" aria-hidden /> Pick another case
          </Link>
          <Link href="/dashboard" className={`${WAY_OUT} border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100`}>
            <Compass className="h-4 w-4" aria-hidden /> Explore the platform first
          </Link>
        </div>
      </div>
    </Paper>
  )
}
