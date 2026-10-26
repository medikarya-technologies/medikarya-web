"use client"

// The emergency tray: Airway · Circulation · Emergency Medications · Cardiac
// Procedures.
//
// Each intervention dispatches INTERVENTION_GIVEN → the manager resolves the
// consequence from the case's `action_consequences` against the patient as they
// are right now → state flags update → PatientState re-evaluates. What actually
// happens (and why) is shown immediately, in the tray.

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, Droplets, Info, Siren, Syringe } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatClock, type EventOf } from "@/lib/simulation/encounter-events"
import { hardLimitSeconds, type FluidInfusionDef } from "@/lib/simulation/case-schema"
import { fluidAction, fluidStatus, fluidStopAction } from "@/lib/simulation/fluid-infusion"
import { INTERVENTION_GROUPS, interventionLabel, interventionsForCase, type InterventionDef } from "@/lib/simulation/intervention-catalog"
import { REFUSED_PREFIX, availableFlag } from "@/lib/simulation/live-plan"
import { describeFindings } from "@/lib/simulation/reassessment"
import { EXACT_HOLD_SECONDS } from "@/lib/simulation/live-vitals"
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
  /** What a reassessment found, read by the engine from the patient (never typed by the student). */
  findings?: string[]
}

/**
 * The engine refused it (not yet available, a prerequisite missing, too soon, not indicated): it was not given. A live
 * plan runs only on a case with no rules of its own (withLivePlan), so a tray action's note is the plan's alone: a
 * refusal is the whole note, never mixed with another consequence.
 */
const refused = (consequence: string) => consequence.startsWith(REFUSED_PREFIX)

/** "30 min", "1 h", "4 h". */
const waitLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${minutes / 60} h`)

/**
 * A rate-controlled infusion on the tray: start it at one of its rates, then step it down one rate at a time or stop it.
 * What it shows (rate, volume given and left) is worked out from the patient's flags, as the server works it out.
 */
function FluidCard({ item, fluid, flags, flagSetAt, now, disabled, cooling, onGive }: {
  item: InterventionDef
  fluid: FluidInfusionDef
  flags: Record<string, boolean>
  flagSetAt: Record<string, number>
  now: number
  disabled: boolean
  cooling: ReadonlySet<string>
  onGive: (action: string) => void
}) {
  const status = fluidStatus(item.id, fluid, flags, flagSetAt, now)
  const index = fluid.levels.findIndex((l) => l.id === status.level)
  const level = fluid.levels[index]
  const next = index >= 0 ? fluid.levels[index + 1] : undefined
  const button = (action: string, text: string, primary = false) => (
    <Button
      key={action}
      type="button"
      size="sm"
      variant={primary ? "default" : "outline"}
      disabled={disabled || cooling.has(action)}
      onClick={() => onGive(action)}
      className={cn("h-7 px-2.5 text-[11px]", primary && "bg-brand-600 hover:bg-brand-700")}
    >
      {text}
    </Button>
  )
  return (
    <div className="rounded-lg border border-enc-line-strong bg-white p-2.5 sm:col-span-2">
      <div className="flex items-start gap-2">
        <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-enc-ink-3" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-tight font-medium text-enc-ink">{item.label}</p>
          <p className="mt-0.5 text-[11px] text-enc-ink-2">{item.detail}</p>
          {status.state !== "not_started" && level && (
            <p className="mt-1 font-mono text-[11px] text-enc-ink tabular-nums">
              {status.state === "running"
                ? `Running at ${level.label} (${level.ml_per_h} mL/h) since ${formatClock(status.since ?? 0)}`
                : `${status.state === "completed" ? "Finished" : "Stopped"} at ${formatClock(status.endedAt ?? 0)}`}
              {` · ${status.deliveredMl} mL given`}
              {status.remainingMl !== null && ` · ${status.remainingMl} mL left`}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {status.state === "not_started" && (
          <>
            <span className="text-[11px] text-enc-ink-3">Start at</span>
            {fluid.levels.map((l) => button(fluidAction(item.id, l.id), l.label))}
          </>
        )}
        {status.state === "running" && next && button(fluidAction(item.id, next.id), `Step down to ${next.label}`, true)}
        {status.state === "running" && button(fluidStopAction(item.id), "Stop")}
        {status.canRestart && (
          <>
            <span className="text-[11px] text-enc-ink-3">Restart at</span>
            {fluid.levels.map((l) => button(fluidAction(item.id, l.id), l.label))}
          </>
        )}
      </div>
    </div>
  )
}

export function EmergencyInterveneModal({ open, onOpenChange }: Props) {
  const { config, events, actions, isExpired, patient, now } = useClinicalEvents()
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [cooling, setCooling] = useState<ReadonlySet<string>>(new Set())
  const [waited, setWaited] = useState<string | null>(null)

  // Waiting moves the clock on; a nurse alert ends the wait early, so a deterioration is never skipped past.
  const waitFor = (minutes: number) => {
    const { to, stopped } = actions.wait(minutes)
    setWaited(`Waited until ${formatClock(to)}${stopped === "alert" ? ": stopped early, the nurse is calling." : stopped === "limit" ? ": the encounter has ended." : "."}`)
    setOutcome(null)
  }

  const tray = useMemo(() => interventionsForCase(config), [config])
  const fluids = useMemo(() => new Map((config.custom_interventions ?? []).flatMap((i) => (i.fluid ? [[i.id, i.fluid] as const] : []))), [config])
  // A case that runs on for hours (a fluid ladder) also lets the student wait through them; a wait still stops at a nurse alert.
  const waits = hardLimitSeconds(config) > 3600 ? [1, 5, 30, 60, 240] : [1, 5]
  const recent = useMemo(
    () => events.filter((e): e is EventOf<"INTERVENTION_GIVEN"> => e.type === "INTERVENTION_GIVEN").slice(-5).reverse(),
    [events]
  )
  const givenCount = useMemo(() => {
    const counts = new Map<string, number>()
    // A further dose the engine refused (too soon, not indicated, over the limit) was not given, so it is not counted.
    for (const e of events) if (e.type === "INTERVENTION_GIVEN" && !e.consequence.startsWith(REFUSED_PREFIX)) counts.set(e.action, (counts.get(e.action) ?? 0) + 1)
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
      label: interventionLabel(config, id),
      consequence: result.consequence,
      unsafe: result.safetyPenalty,
      at: given?.timestamp ?? now,
      findings: (() => {
        const found = result.appended.find((e) => e.type === "REASSESSED")
        return found && found.type === "REASSESSED" ? describeFindings(found.findings) : undefined
      })(),
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

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-enc-line-strong px-4 py-2 sm:px-6">
          <span className="flex items-center gap-1 text-[12px] font-medium text-enc-ink-2">
            <Clock className="h-3.5 w-3.5" /> Wait and watch
          </span>
          {waits.map((m) => (
            <Button key={m} type="button" size="sm" variant="outline" disabled={isExpired} onClick={() => waitFor(m)} className="h-7 px-2.5 text-[11px]">
              {waitLabel(m)}
            </Button>
          ))}
          {waited && <span className="text-[12px] text-enc-ink-2">{waited}</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent style={{ scrollbarWidth: "thin" }}>
          {/* Consequence feedback */}
          {outcome && (
            <div
              role="status"
              className={cn(
                "sticky top-0 z-10 flex items-start gap-2.5 border-b px-4 py-3 text-sm sm:px-6",
                outcome.unsafe
                  ? "border-enc-crit/25 bg-enc-crit-soft text-enc-crit"
                  : refused(outcome.consequence)
                    ? "border-enc-warn/25 bg-enc-warn-soft text-enc-warn"
                    : "border-enc-ok/25 bg-enc-ok-soft text-enc-ok"
              )}
            >
              {outcome.unsafe ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-enc-crit" />
              ) : refused(outcome.consequence) ? (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-enc-warn" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-enc-ok" />
              )}
              <div className="min-w-0">
                <p className="font-semibold">
                  {outcome.label} <span className="ml-1 font-mono text-[11px] font-normal opacity-60">{formatClock(outcome.at)}</span>
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed">{outcome.consequence}</p>
                {outcome.findings && outcome.findings.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Readings at this reassessment">
                    {outcome.findings.map((f) => (
                      <li key={f} className="rounded-md border border-current/20 bg-white/60 px-1.5 py-0.5 font-mono text-[11px] text-enc-ink">
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                {outcome.findings && outcome.findings.length > 0 && (
                  <p className="mt-1 text-[11px] opacity-75">
                    Exact readings at {formatClock(outcome.at)}. The monitor shows the same numbers for {EXACT_HOLD_SECONDS} seconds, then its natural variation of a beat or a point resumes; decide on these.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-5 px-4 py-4 sm:px-6">
            {INTERVENTION_GROUPS.map((group) => {
              // A treatment that is only on the tray once the patient needs it (available_when) stays hidden until then.
              const items = tray.filter((i) => i.group === group.id && patient.flags[availableFlag(i.id)] !== false)
              if (items.length === 0) return null
              return (
                <section key={group.id}>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-enc-ink-3 uppercase">{group.label}</h3>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {items.map((item) => {
                      const fluid = fluids.get(item.id)
                      if (fluid) {
                        return (
                          <FluidCard
                            key={item.id}
                            item={item}
                            fluid={fluid}
                            flags={patient.flags}
                            flagSetAt={patient.flagSetAt}
                            now={now}
                            disabled={isExpired}
                            cooling={cooling}
                            onGive={give}
                          />
                        )
                      }
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
                  <span className={cn("font-medium", refused(e.consequence) ? "text-enc-ink-3 line-through" : "text-enc-ink")}>{interventionLabel(config, e.action)}</span>
                  {refused(e.consequence) && <span className="text-enc-warn">not given</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
