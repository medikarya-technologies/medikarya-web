"use client"

// The first thing a brand-new account sees, as a dialog over its first case's briefing (/dashboard/cases/<id>?first=1,
// see lib/library/first-case.ts): what the next quarter of an hour looks like, and the first-case note about teaching
// cases (components/cases/first-case-consent.tsx), so this is the only pop-up before the case. "See my patient" closes
// it onto the briefing (the patient, why they came, their vitals) and counts as agreeing, so Start goes straight in.
// Closing it any other way agrees to nothing: the usual note then comes when they press Start.

import { useEffect } from "react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { ArrowRight, Clock, Compass, FlaskConical, Hand, LayoutGrid, MessageSquare, PauseCircle, Stethoscope } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
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
const WAY_OUT =
  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-300"

/** What the student did with the welcome, for Clarity (welcome_choice). */
export type WelcomeChoice = "see_patient" | "another_case" | "explore" | "dismissed"

export function FirstCaseWelcomeDialog({
  open,
  onSeePatient,
  onDismiss,
}: {
  open: boolean
  /** The main button: close onto the briefing, agreeing to the first-case note. */
  onSeePatient: () => void
  /** Closed with ✕, Escape or a click outside. */
  onDismiss: () => void
}) {
  // Only a first name the account really has. Made up from an email address it can read oddly ("Daily, meet…").
  const { user } = useUser()
  const firstName = user?.firstName?.trim().split(/\s+/)[0] ?? ""

  useEffect(() => {
    if (open) trackEvent("first_case_welcome")
  }, [open])

  const chose = (choice: WelcomeChoice) => trackEvent("first_case_welcome_choice", { welcome_choice: choice })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          chose("dismissed")
          onDismiss()
        }
      }}
    >
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-enc-line bg-enc-sheet p-0 sm:max-w-[560px]">
        <div className="bg-gradient-to-br from-brand-50 via-enc-sheet to-accent-50 px-5 pt-5 pb-4 pr-12 sm:px-6">
          <p className="text-[11px] font-semibold tracking-[0.09em] text-brand-700 uppercase">Welcome to MediKarya</p>
          <DialogTitle className="mt-1.5 text-[22px] leading-tight font-semibold text-enc-ink">
            {firstName ? `${firstName}, meet your first patient` : "Meet your first patient"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-[14px] leading-relaxed text-enc-ink-2">
            Behind this is what you would know walking up to the bed: who they are, why they came, and their vitals on arrival. Then it is your
            call, step by step.
          </DialogDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={CHIP}>
              <Clock className="h-3.5 w-3.5 text-brand-600" aria-hidden /> About 15 to 20 minutes
            </span>
            <span className={CHIP}>
              <PauseCircle className="h-3.5 w-3.5 text-accent-600" aria-hidden /> Stop and come back any time
            </span>
          </div>
        </div>

        {/* the 1px gaps over the line colour draw the rules between the steps */}
        <ol className="grid grid-cols-2 gap-px border-y border-enc-line bg-enc-line">
          {STEPS.map(({ icon: Icon, title, text, tone }, i) => (
            <li key={title} className="flex flex-col gap-2 bg-enc-sheet px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-enc-ink">
                  {i + 1}. {title}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-enc-ink-3">{text}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="space-y-3 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              chose("see_patient")
              onSeePatient()
            }}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-[15px] font-semibold text-white transition-colors outline-none hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            See my patient <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <p className="text-[12px] leading-relaxed text-enc-ink-3">
            These are teaching cases, made for practice rather than for guiding the care of real patients. We save your answers to score them and
            keep improving the cases. By continuing, you agree to our{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-enc-ink-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-enc-ink-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="border-t border-enc-line bg-enc-desk px-5 py-4 sm:px-6">
          <p className="text-[13px] leading-snug text-enc-ink-2">Played this one on the free page already, or want to look around?</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link href="/dashboard/cases" onClick={() => chose("another_case")} className={`${WAY_OUT} border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100`}>
              <LayoutGrid className="h-4 w-4" aria-hidden /> Pick another case
            </Link>
            <Link href="/dashboard" onClick={() => chose("explore")} className={`${WAY_OUT} border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100`}>
              <Compass className="h-4 w-4" aria-hidden /> Explore the platform first
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
