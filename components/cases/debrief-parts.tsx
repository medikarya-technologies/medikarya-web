"use client"

// Pieces of the encounter debrief shared by the two review flows: the simulation
// debrief (rubric-scored cases) and the classic step-by-step review of a classic
// case that was run at the bedside. Each is the CONTENT of one wizard step.
//
// Redesigned this round: enc-* tokens throughout (was slate-*/rose-*, fixed colours
// with no dark-mode counterpart — this screen never actually worked in dark mode
// before, unlike the rest of the dashboard), and a new InfoAccordion built on the
// project's own (already-installed, previously-unused-here) Radix accordion —
// the "performance summary / clinical takeaway as click-to-see-more" piece of this
// round's redesign, shared so both flows render it identically.

import { useState } from "react"
import { Clock, ListChecks, Stethoscope, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
      <p className="text-base text-enc-ink-2">
        Your Clinical score ({clinical}) is what you did. Your Independent score ({independent}) is what you did without help. Every point of difference
        is one of the lines below.
      </p>
      <ul className="space-y-2">
        {assistance.map((a, i) => (
          <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-enc-line bg-enc-desk p-3">
            <span className="text-sm text-enc-ink-2">{a.label}</span>
            <span className="flex shrink-0 items-baseline gap-3">
              <span className="font-mono text-xs text-enc-ink-3 tabular-nums">{a.clock}</span>
              <span className="w-10 text-right font-semibold text-enc-crit tabular-nums">−{a.cost}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-enc-line pt-3 text-sm font-semibold text-enc-ink">
        <span>Total assistance cost</span>
        <span className="text-enc-crit tabular-nums">−{cost}</span>
      </div>
      <p className="text-xs text-enc-ink-3">Help costs the Independent track only, so your Clinical score is unaffected.</p>
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
        <div className="rounded-xl border border-enc-line bg-enc-desk p-3">
          <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide text-enc-ink-3 uppercase">
            <Clock className="h-3 w-3" /> Duration
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-enc-ink">{formatClock(milestones.endedAt ?? 0)}</dd>
        </div>
        <div className="rounded-xl border border-enc-line bg-enc-desk p-3">
          <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide text-enc-ink-3 uppercase">
            <Zap className="h-3 w-3" /> Orders
          </dt>
          <dd className="mt-1 text-sm font-semibold text-enc-ink">
            {milestones.budgetedActions ?? 0}
            {hasBudget && <span className="font-normal text-enc-ink-3"> / {milestones.recommendedActions}</span>}
          </dd>
        </div>
        <div className="rounded-xl border border-enc-line bg-enc-desk p-3">
          <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide text-enc-ink-3 uppercase">
            <Stethoscope className="h-3 w-3" /> {timing.label}
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-enc-ink">{timing.value}</dd>
        </div>
      </dl>
      <p className="text-sm text-enc-ink-3">
        {hasBudget
          ? "Orders counts investigations and interventions; the second number is the recommended amount for this case."
          : "Orders counts the investigations and interventions you asked for."}
      </p>
      <Button
        variant="outline"
        onClick={() => setShowTimeline((v) => !v)}
        className="h-11 w-full gap-2 rounded-xl border-enc-line-strong text-enc-ink-2 font-semibold tracking-wide hover:bg-enc-desk"
      >
        <ListChecks className="h-4 w-4" /> {showTimeline ? "HIDE TIMELINE" : "REVIEW CASE, MINUTE BY MINUTE"}
      </Button>
      {showTimeline && <EncounterTimeline events={sim.events ?? []} examLabels={examLabels} />}
    </div>
  )
}

export interface InfoAccordionItem {
  id: string
  icon: React.ElementType
  title: string
  teaser: string
  content: React.ReactNode
}

/** "Performance summary / clinical takeaway as additional info, click to see more" — one shared,
 *  collapsed-by-default accordion so both feedback flows present optional extra reading identically. */
export function InfoAccordion({ items }: { items: InfoAccordionItem[] }) {
  return (
    <Accordion type="single" collapsible className="space-y-3">
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          value={item.id}
          className="overflow-hidden rounded-xl border border-enc-line bg-enc-desk px-4 border-b-0 last:border-b-0"
        >
          <AccordionTrigger className="py-4 hover:no-underline focus-visible:ring-brand-300">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-enc-line bg-enc-sheet text-enc-ink-2">
                <item.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-base font-semibold text-enc-ink">{item.title}</p>
                <p className="text-xs font-normal text-enc-ink-3">{item.teaser}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-1 pl-13">{item.content}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
