"use client"

// Above the briefing of a brand-new account's first case (/dashboard/cases/<id>?first=1, see lib/library/first-case.ts):
// who this is for, what the next quarter of an hour looks like, and a way out for anyone who would rather look around.
// The briefing below it does the rest: the patient, why they came, and their vitals on arrival.

import { useEffect } from "react"
import Link from "next/link"
import { FlaskConical, Hand, MessageSquare, Stethoscope } from "lucide-react"
import { Eyebrow, Paper } from "@/components/cases/encounter-ui"
import { useDisplayName } from "@/components/dashboard/use-display-name"
import { trackEvent } from "@/lib/clarity"

// The same four steps, names and icons as the tabs at the bedside, so the student recognises them there.
const STEPS = [
  { icon: MessageSquare, title: "History", text: "Ask the patient anything, in your own words." },
  { icon: Hand, title: "Examine", text: "Choose what to examine and see what you find." },
  { icon: FlaskConical, title: "Investigations", text: "Order the tests you would really order." },
  { icon: Stethoscope, title: "Diagnose", text: "Rank your diagnoses, plan treatment, get feedback." },
]

export function FirstCaseWelcome() {
  const me = useDisplayName()

  useEffect(() => trackEvent("first_case_welcome"), [])

  return (
    <Paper className="overflow-hidden">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <Eyebrow>Welcome to MediKarya</Eyebrow>
        <h2 className="mt-1.5 text-[22px] leading-tight font-semibold text-enc-ink sm:text-[24px]">
          {me.firstName ? `${me.firstName}, meet your first patient` : "Meet your first patient"}
        </h2>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-enc-ink-2">
          Below is what you would know walking up to the bed: who they are, why they came, and their vitals on arrival. Then it is your call, step by
          step. It takes about 15 to 20 minutes, and you can stop and come back.
        </p>
      </div>
      {/* two by two on a phone, so Start is not pushed far down; the 1px gaps over the line colour draw the rules */}
      <ol className="grid grid-cols-2 gap-px border-t border-enc-line bg-enc-line sm:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex flex-col gap-2 bg-enc-sheet px-4 py-3 sm:px-5 sm:py-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-enc-console text-enc-ink-2">
              <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
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
      <p className="border-t border-enc-line bg-enc-desk px-5 py-3 text-[12.5px] text-enc-ink-3 sm:px-6">
        Played this one on the free page already?{" "}
        <Link href="/dashboard/cases" className="font-medium text-enc-ink-2 underline-offset-2 hover:underline">
          Pick another case
        </Link>{" "}
        or{" "}
        <Link href="/dashboard" className="font-medium text-enc-ink-2 underline-offset-2 hover:underline">
          look around first
        </Link>
        .
      </p>
    </Paper>
  )
}
