"use client"

// Pieces of the encounter debrief shared by the two review flows: the simulation
// debrief (rubric-scored cases) and the classic step-by-step review of a classic
// case that was run at the bedside. Each is the CONTENT of one wizard step.

import { useState } from "react"
import { Clock, ListChecks, Stethoscope, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatClock } from "@/lib/simulation/encounter-events"
import { EncounterTimeline } from "./encounter-timeline"

interface AssistanceLine {
  label: string
  clock: string
  cost: number
}

/** "Why the difference?": every point between the two scores, itemised. */
export function AssistanceAudit({
  clinical,
  independent,
  cost,
  assistance,
}: {
  clinical: number
  independent: number
  cost: number
  assistance: AssistanceLine[]
}) {
  return (
    <div className="space-y-5">
      <p className="text-base text-slate-500">
        Your Clinical score ({clinical}) is what you did. Your Independent score ({independent}) is what you did without help. Every point of difference
        is one of the lines below.
      </p>
      <ul className="space-y-2">
        {assistance.map((a, i) => (
          <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <span className="text-sm text-slate-700">{a.label}</span>
            <span className="flex shrink-0 items-baseline gap-3">
              <span className="font-mono text-xs text-slate-400 tabular-nums">{a.clock}</span>
              <span className="w-10 text-right font-semibold text-rose-600 tabular-nums">−{a.cost}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-700">
        <span>Total assistance cost</span>
        <span className="text-rose-600 tabular-nums">−{cost}</span>
      </div>
      <p className="text-xs text-slate-400">Help costs the Independent track only, so your Clinical score is unaffected.</p>
    </div>
  )
}

/** "Review the encounter": the headline numbers, and the whole record on request. */
export function EncounterReview({ sim, examLabels }: { sim: any; examLabels: Record<string, string> }) {
  const [showTimeline, setShowTimeline] = useState(false)
  const milestones = sim.milestones ?? {}

  // ECG timing is the headline milestone for chest-pain cases; otherwise show when the first test went in.
  const orderTimes: number[] = Object.values(milestones.firstOrderedAt ?? {})
  const ecgAt: number | undefined = milestones.firstOrderedAt?.ecg_12_lead
  const firstTestAt: number | undefined = orderTimes.length ? Math.min(...orderTimes) : undefined
  const timing =
    ecgAt !== undefined
      ? { label: "ECG at", value: formatClock(ecgAt) }
      : { label: "First test at", value: firstTestAt !== undefined ? formatClock(firstTestAt) : "—" }

  const hasBudget = milestones.recommendedActions !== undefined

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Clock className="h-3 w-3" /> Duration
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-slate-800">{formatClock(milestones.endedAt ?? 0)}</dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Zap className="h-3 w-3" /> Orders
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-800">
            {milestones.budgetedActions ?? 0}
            {hasBudget && <span className="font-normal text-slate-400"> / {milestones.recommendedActions}</span>}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Stethoscope className="h-3 w-3" /> {timing.label}
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-slate-800">{timing.value}</dd>
        </div>
      </dl>
      <p className="text-sm text-slate-500">
        {hasBudget
          ? "Orders counts investigations and interventions; the second number is the recommended amount for this case."
          : "Orders counts the investigations and interventions you asked for."}
      </p>
      <Button
        variant="outline"
        onClick={() => setShowTimeline((v) => !v)}
        className="h-11 w-full gap-2 rounded-xl border-slate-300 font-semibold tracking-wide"
      >
        <ListChecks className="h-4 w-4" /> {showTimeline ? "HIDE TIMELINE" : "REVIEW CASE, MINUTE BY MINUTE"}
      </Button>
      {showTimeline && <EncounterTimeline events={sim.events ?? []} examLabels={examLabels} />}
    </div>
  )
}
