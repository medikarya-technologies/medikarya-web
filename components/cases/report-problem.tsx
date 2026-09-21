"use client"

// "Report a problem with this case": one kind of problem, a sentence about it, and the case and where in it the
// student was, which the app adds itself. It is offered in the encounter's top bar and on the feedback screens,
// because a student is the fastest way to find a wrong value in a case. The encounter clock is frozen while it is
// open (simulation-interaction.tsx), so reporting never costs time.
//
// If the report cannot be stored (the table has not been created yet, the connection dropped) the same report is
// offered as an email, so it is never lost. The rules are in lib/reports/case-report.ts; the storing in
// app/actions/case-reports.ts.

import { useEffect, useState } from "react"
import { CheckCircle2, Flag, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { reportCaseProblem } from "@/app/actions/case-reports"
import { MAX_MESSAGE, MIN_MESSAGE, REPORT_CATEGORIES, normaliseReport, reportMailto, type ReportCategory, type ReportInput, type ReportPlace } from "@/lib/reports/case-report"

type Phase = { kind: "form" } | { kind: "sending" } | { kind: "sent" } | { kind: "failed"; message: string; mailto: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  place: ReportPlace
  /** The encounter clock when the dialog was opened, in seconds. */
  clockSeconds?: number
  tab?: string
  guestId?: string
}

export function ReportProblemDialog({ open, onOpenChange, caseId, place, clockSeconds, tab, guestId }: Props) {
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [message, setMessage] = useState("")
  const [phase, setPhase] = useState<Phase>({ kind: "form" })

  // Opened again after a failure: back to the form, with what was typed still there.
  useEffect(() => {
    if (open) setPhase({ kind: "form" })
  }, [open])

  const chosen = REPORT_CATEGORIES.find((c) => c.id === category)
  const length = message.trim().length
  const ready = !!category && length >= MIN_MESSAGE && phase.kind !== "sending"

  const send = async () => {
    if (!category) return
    const draft: ReportInput = { caseId, category, message, place, clockSeconds, tab, guestId }
    const fallback = () => {
      const checked = normaliseReport(draft)
      return checked.ok ? reportMailto(checked.report) : ""
    }
    setPhase({ kind: "sending" })
    try {
      const result = await reportCaseProblem(draft)
      if (result.ok) {
        setPhase({ kind: "sent" })
        setCategory(null)
        setMessage("")
      } else {
        setPhase({ kind: "failed", message: result.message, mailto: result.reason === "invalid" ? "" : fallback() })
      }
    } catch {
      setPhase({ kind: "failed", message: "We could not send that just now.", mailto: fallback() })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {phase.kind === "sent" ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-enc-ok-soft text-enc-ok" aria-hidden>
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <DialogTitle className="mt-4 text-[17px] font-semibold text-enc-ink">Thank you</DialogTitle>
            <DialogDescription className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-enc-ink-2">Your report has been sent with the case and where you were in it.</DialogDescription>
            <Button onClick={() => onOpenChange(false)} className="mt-6 h-10 rounded-lg bg-brand-600 px-6 text-[14px] font-semibold text-white shadow-none hover:bg-brand-700">
              Close
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (ready) void send()
            }}
          >
            <DialogHeader className="gap-1 border-b border-enc-line px-5 py-4 pr-12 text-left">
              <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold text-enc-ink">
                <Flag className="h-4 w-4 text-enc-ink-3" strokeWidth={1.9} />
                Report a problem with this case
              </DialogTitle>
              <DialogDescription className="text-[13.5px] leading-snug text-enc-ink-2">Something wrong, or unclear? Tell us what you saw. We add the case and where you were in it.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 py-4">
              <fieldset>
                <legend className="text-[13px] font-semibold text-enc-ink">What kind of problem is it?</legend>
                <div role="radiogroup" aria-label="Kind of problem" className="mt-2 flex flex-wrap gap-2">
                  {REPORT_CATEGORIES.map((c) => {
                    const active = category === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setCategory(c.id)}
                        className={cn(
                          "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-left text-[13px] leading-snug outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-300",
                          active ? "border-enc-ink bg-enc-sheet font-medium text-enc-ink" : "border-enc-line-strong bg-enc-sheet text-enc-ink-2 hover:text-enc-ink"
                        )}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
                {chosen && <p className="mt-2 text-[12.5px] leading-snug text-enc-ink-3">{chosen.hint}</p>}
              </fieldset>

              <div>
                <label htmlFor="report-message" className="text-[13px] font-semibold text-enc-ink">
                  What did you see?
                </label>
                <Textarea
                  id="report-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MAX_MESSAGE}
                  rows={4}
                  placeholder={category === "clinical" || category === "result" ? "Which value or finding, and what did you expect it to be?" : "Describe it in a sentence or two, and what you expected."}
                  className="mt-2 min-h-24 resize-y text-enc-ink"
                />
                <p className="mt-1 text-right font-mono text-[11.5px] text-enc-ink-3 tabular-nums">
                  {length < MIN_MESSAGE ? `${MIN_MESSAGE - length} more to send` : `${length} / ${MAX_MESSAGE}`}
                </p>
              </div>

              {phase.kind === "failed" && (
                <div role="alert" className="rounded-lg border border-enc-crit/30 bg-enc-crit-soft px-3.5 py-3 text-[13px] leading-snug text-enc-ink">
                  <p className="font-medium text-enc-crit">{phase.message}</p>
                  {phase.mailto && (
                    <p className="mt-1 text-enc-ink-2">
                      Your report is still here.{" "}
                      <a href={phase.mailto} className="inline-flex items-center gap-1 font-medium text-brand-700 underline-offset-2 hover:underline">
                        <Mail className="h-3.5 w-3.5" />
                        Send it by email instead
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-enc-line px-5 py-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-10 rounded-lg px-4 text-[14px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink">
                Cancel
              </Button>
              <Button type="submit" disabled={!ready} className="h-10 gap-2 rounded-lg bg-brand-600 px-5 text-[14px] font-semibold text-white shadow-none hover:bg-brand-700 disabled:opacity-50">
                {phase.kind === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                {phase.kind === "sending" ? "Sending" : phase.kind === "failed" ? "Try again" : "Send report"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
