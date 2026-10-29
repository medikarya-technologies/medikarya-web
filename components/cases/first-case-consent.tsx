"use client"

// Before a student's very first case, ever: a short, calm note with the two things worth saying up front rather
// than leaving them in Terms/Privacy (these are practice cases, not guidance for real patients; answers are saved
// to score them). Starting the case is the agreement, with the Terms and Privacy links right there: no checkbox or
// warning styling, which made a teaching tool read like a liability notice. Shown once per browser (localStorage).
//
// Wired in wherever a case can be started (app/try/page.tsx for guests, app/dashboard/cases/[id]/
// page.tsx for signed-in students) by wrapping each page's own onStartCase: check consent first,
// show this dialog if it hasn't been given yet, and only call the real start function on Agree.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const CONSENT_KEY = "medikarya-first-case-consent-2026-10-29"

export function hasFirstCaseConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== null
  } catch {
    // Storage unavailable (private browsing, etc.) — don't block the case on every load over this.
    return true
  }
}

function persistFirstCaseConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: "2026-10-29", acceptedAt: new Date().toISOString() }))
  } catch {
    /* ignore */
  }
}

/** Consent state, read once on mount (avoids a server/client flash — this is a client-only check). */
export function useFirstCaseConsent() {
  const [hasConsented, setHasConsented] = useState(true)
  useEffect(() => {
    setHasConsented(hasFirstCaseConsent())
  }, [])
  const markConsented = () => {
    persistFirstCaseConsent()
    setHasConsented(true)
  }
  return { hasConsented, markConsented }
}

export function FirstCaseConsentDialog({
  open,
  onAgree,
  onCancel,
}: {
  open: boolean
  onAgree: () => void
  onCancel: () => void
}) {
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  useEffect(() => {
    if (open) setAdultConfirmed(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="gap-0 p-0 sm:max-w-sm">
        <DialogHeader className="gap-1.5 px-5 pt-5 pb-0 pr-12 text-left">
          <DialogTitle className="text-[15.5px] font-semibold text-enc-ink">A quick note before you start</DialogTitle>
          <DialogDescription className="text-[13.5px] leading-relaxed text-enc-ink-2">
            These are fictional teaching cases, not guidance for real patient care. Your messages are sent to Google Gemini for patient replies. Your submitted answers may be sent to Google Gemini for scoring, feedback and quizzes, and scores are saved to your learning history. In-progress chat and case actions are saved in this browser so you can resume. Do not enter a real patient’s name, contact details, medical record, or any real person’s health information.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-3 px-5 pt-4 pb-5 sm:flex-col">
          <label className="flex items-start gap-2 text-left text-[12px] leading-relaxed text-enc-ink-3">
            <input type="checkbox" className="mt-0.5" checked={adultConfirmed} onChange={(e) => setAdultConfirmed(e.target.checked)} />
            <span>I confirm that I am at least 18 years old.</span>
          </label>
          <Button type="button" disabled={!adultConfirmed} onClick={onAgree} className="h-10 w-full rounded-lg bg-brand-600 text-[14px] font-semibold text-white shadow-none hover:bg-brand-700">
            Start the case
          </Button>
          <p className="text-center text-[12px] leading-snug text-enc-ink-3">
            By starting, you agree to our{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-enc-ink-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-enc-ink-2">
              Privacy Policy
            </Link>
            .
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
