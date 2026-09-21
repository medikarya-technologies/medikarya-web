"use client"

// The emergency tray: Airway · Circulation · Emergency Medications · Cardiac
// Procedures.
//
// Each intervention dispatches INTERVENTION_GIVEN → the manager resolves the
// consequence from the case's `action_consequences` against the patient as they
// are right now → state flags update → PatientState re-evaluates. What actually
// happens (and why) is shown immediately, in the tray.

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Info, Siren, Syringe } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatClock, type EventOf } from "@/lib/simulation/encounter-events"
import { INTERVENTION_GROUPS, getIntervention, interventionsForCase } from "@/lib/simulation/intervention-catalog"
import { useClinicalEvents } from "./clinical-event-manager"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Outcome {
  id: string
  label: string
  consequence: string
  unsafe: boolean
  at: number
}

export function EmergencyInterveneModal({ open, onOpenChange }: Props) {
  const { config, events, actions, isExpired, patient, now } = useClinicalEvents()
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [cooling, setCooling] = useState<ReadonlySet<string>>(new Set())

  const tray = useMemo(() => interventionsForCase(config), [config])
  const recent = useMemo(
    () => events.filter((e): e is EventOf<"INTERVENTION_GIVEN"> => e.type === "INTERVENTION_GIVEN").slice(-5).reverse(),
    [events]
  )
  const givenCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events) if (e.type === "INTERVENTION_GIVEN") counts.set(e.action, (counts.get(e.action) ?? 0) + 1)
    return counts
  }, [events])

  const give = (id: string) => {
    if (cooling.has(id)) return
    const result = actions.giveIntervention(id)
    if (!result) return
    // Show when it actually happened (the event's own timestamp), not the display clock.
    const given = result.appended.find((e) => e.type === "INTERVENTION_GIVEN")
    setOutcome({
      id,
      label: getIntervention(id)?.label ?? id,
      consequence: result.consequence,
      unsafe: result.safetyPenalty,
      at: given?.timestamp ?? now,
    })
    // Guard against a double-click giving the same drug twice.
    setCooling((prev) => new Set(prev).add(id))
    window.setTimeout(() => {
      setCooling((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 700)
  }

  const critical = patient.stability === "critical" || patient.stability === "arrest"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-[96vw] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-enc-line-strong px-4 py-3 pr-12 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-enc-ink">
            <Siren className={cn("h-5 w-5", critical ? "text-enc-crit" : "text-enc-ink-2")} />
            Emergency interventions
          </DialogTitle>
          <DialogDescription className="text-xs text-enc-ink-2">
            Actions take effect immediately. Read what happens — every drug has a context.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent style={{ scrollbarWidth: "thin" }}>
          {/* Consequence feedback */}
          {outcome && (
            <div
              role="status"
              className={cn(
                "sticky top-0 z-10 flex items-start gap-2.5 border-b px-4 py-3 text-sm sm:px-6",
                outcome.unsafe ? "border-enc-crit/25 bg-enc-crit-soft text-enc-crit" : "border-enc-ok/25 bg-enc-ok-soft text-enc-ok"
              )}
            >
              {outcome.unsafe ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-enc-crit" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-enc-ok" />}
              <div className="min-w-0">
                <p className="font-semibold">
                  {outcome.label} <span className="ml-1 font-mono text-[11px] font-normal opacity-60">{formatClock(outcome.at)}</span>
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed">{outcome.consequence}</p>
              </div>
            </div>
          )}

          <div className="space-y-5 px-4 py-4 sm:px-6">
            {INTERVENTION_GROUPS.map((group) => {
              const items = tray.filter((i) => i.group === group.id)
              if (items.length === 0) return null
              return (
                <section key={group.id}>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-enc-ink-3 uppercase">{group.label}</h3>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {items.map((item) => {
                      const count = givenCount.get(item.id) ?? 0
                      return (
                        <div key={item.id} className={cn("flex items-center gap-2 rounded-lg border bg-white p-2.5", count > 0 ? "border-enc-line-strong bg-enc-desk" : "border-enc-line-strong")}>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] leading-tight font-medium text-enc-ink">{item.label}</p>
                            <p className="mt-0.5 truncate text-[11px] text-enc-ink-2">{item.detail}</p>
                          </div>
                          {count > 0 && <span className="shrink-0 rounded-full bg-enc-console-hover px-1.5 py-0.5 text-[10px] font-semibold text-enc-ink-2">×{count}</span>}
                          <Button
                            type="button"
                            size="sm"
                            disabled={isExpired || cooling.has(item.id)}
                            onClick={() => give(item.id)}
                            className="h-7 shrink-0 gap-1 bg-brand-600 px-3 text-[11px] hover:bg-brand-700"
                          >
                            <Syringe className="h-3 w-3" /> Give
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="shrink-0 border-t border-enc-line-strong bg-enc-desk px-4 py-2.5 sm:px-6">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-enc-ink-3 uppercase">
              <Info className="h-3 w-3" /> Recent
            </p>
            <ul className="space-y-0.5">
              {recent.map((e, i) => (
                <li key={`${e.timestamp}-${i}`} className="flex gap-2 text-[11px] text-enc-ink-2">
                  <span className="font-mono tabular-nums">{formatClock(e.timestamp)}</span>
                  <span className="font-medium text-enc-ink">{getIntervention(e.action)?.label ?? e.action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
