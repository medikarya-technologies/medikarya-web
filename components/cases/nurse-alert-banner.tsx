"use client"

// The deterioration alert. Raised from the event log (PATIENT_DETERIORATED) —
// a nurse tells you, in words, what has changed. It doesn't tell you what to do.
//
// The one place on the screen that is allowed to be loud: a red rule down the left,
// a tinted band across the top, and nothing else changes colour.

import { Siren } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatClock } from "@/lib/simulation/encounter-events"
import { useClinicalEvents } from "./clinical-event-manager"

export function NurseAlertBanner({ onIntervene }: { onIntervene?: () => void }) {
  const { alert, dismissAlert, isExpired } = useClinicalEvents()
  if (!alert) return null

  return (
    <div
      role="alert"
      className="flex shrink-0 animate-in slide-in-from-top-2 items-start gap-3 border-b border-l-4 border-b-enc-crit/25 border-l-enc-crit bg-enc-crit-soft px-5 py-3 duration-300 fade-in"
    >
      <Siren className="mt-0.5 h-5 w-5 shrink-0 text-enc-crit" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-[0.09em] text-enc-crit uppercase">
          Nurse alert <span className="ml-1.5 font-mono font-normal tracking-normal opacity-80">{formatClock(alert.timestamp)}</span>
        </p>
        <p className="mt-0.5 text-[14px] leading-snug text-enc-ink">{alert.narrative}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        {!isExpired && onIntervene && (
          <Button type="button" size="sm" onClick={onIntervene} className="h-8 rounded-lg bg-enc-crit px-3 text-[12px] font-semibold hover:bg-enc-crit/90">
            Intervene
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={dismissAlert} className="h-8 rounded-lg px-2.5 text-[12px] text-enc-ink-2 hover:bg-enc-crit/10">
          Dismiss
        </Button>
      </div>
    </div>
  )
}
