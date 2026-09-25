"use client"

// Before a student's very first case, ever: a real consent gate, not a toast — the two things
// this app should say up front rather than leave buried in Terms/Privacy: this is a training
// simulation, not real medical guidance, and what a student does in a case is recorded. Shown
// once per browser (localStorage), never again after it's been agreed to once.
//
// Wired in wherever a case can be started (app/try/page.tsx for guests, app/dashboard/cases/[id]/
// page.tsx for signed-in students) by wrapping each page's own onStartCase: check consent first,
// show this dialog if it hasn't been given yet, and only call the real start function on Agree.

import { useEffect, useState } from "react"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const CONSENT_KEY = "medikarya-first-case-consent"

export function hasFirstCaseConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1"
  } catch {
    // Storage unavailable (private browsing, etc.) — don't block the case on every load over this.
    return true
  }
}

function persistFirstCaseConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "1")
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
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (open) setChecked(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="gap-1 border-b border-enc-line px-5 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold text-enc-ink">
            <ShieldCheck className="h-4 w-4 text-enc-ink-3" strokeWidth={1.9} />
            Before your first case
          </DialogTitle>
          <DialogDescription className="text-[13.5px] leading-snug text-enc-ink-2">
            Two things worth knowing before you start.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="flex gap-3 rounded-xl bg-enc-warn-soft p-3.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-enc-warn mt-0.5" />
            <p className="text-[13.5px] leading-relaxed text-enc-ink">
              <span className="font-semibold">This is a training simulation, not medical advice.</span> Nothing here is a substitute for professional clinical judgment — never use it to guide care for a real patient.
            </p>
          </div>

          <p className="text-[13.5px] leading-relaxed text-enc-ink-2">
            Everything you do in a case — the questions you ask, the tests you order, your diagnosis — is recorded so it can be scored and so we can improve the cases. See our{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-brand-700 underline-offset-2 hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" target="_blank" className="font-medium text-brand-700 underline-offset-2 hover:underline">
              Terms of Service
            </Link>
            .
          </p>

          <label className="flex items-start gap-2.5 text-[13.5px] leading-snug text-enc-ink">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
            I understand this is a simulation, not real medical advice, and that my attempt is recorded.
          </label>
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-enc-line px-5 py-3">
          <Button type="button" variant="ghost" onClick={onCancel} className="h-10 rounded-lg px-4 text-[14px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink">
            Not now
          </Button>
          <Button type="button" disabled={!checked} onClick={onAgree} className="h-10 rounded-lg bg-brand-600 px-5 text-[14px] font-semibold text-white shadow-none hover:bg-brand-700 disabled:opacity-50">
            I understand, continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
