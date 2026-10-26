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
import type { BedsideScore, BedsideStatus, FluidStepStatus } from "@/lib/simulation/live-plan"

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

/** What a live case's bedside scored (lib/simulation/live-plan.ts, scoreBedside), as the server returned it. */
type Bedside = BedsideScore & { share: number; consultationScore: number }

// Every status the engine can return has to be here: a missing one is a type error, not a crash in the debrief.
const BEDSIDE_STATUS: Record<BedsideStatus, { text: string; tone: string }> = {
  on_time: { text: "In time", tone: "bg-enc-ok-soft text-enc-ok" },
  late: { text: "Late", tone: "bg-enc-warn-soft text-enc-warn" },
  missed: { text: "Not given", tone: "bg-enc-crit-soft text-enc-crit" },
  not_needed: { text: "Not needed", tone: "bg-enc-sheet text-enc-ink-3" },
  not_due: { text: "Still in time", tone: "bg-enc-sheet text-enc-ink-3" },
}

const FLUID_STEP_STATUS: Record<FluidStepStatus, string> = {
  on_time: "in time",
  early: "too soon",
  late: "too late",
  missed: "not done in time",
  not_due: "still in time when the encounter ended, so it does not count",
  wrong: "the wrong rate",
}

/** The line under a bedside item: when it was needed and when it was given. */
function bedsideTiming(i: Bedside["items"][number]): string {
  if (i.fluid_steps) return `Started at ${i.at_minutes} min; each rate is scored on how long it ran before the next step`
  if (i.status === "not_needed") return "Your patient never came to need this, so it does not count either way"
  if (i.status === "not_due") return `Needed from ${i.required_at_minutes} min, but the encounter ended while there was still time to give it, so it does not count either way`
  const from = i.required_at_minutes !== undefined ? `needed from ${i.required_at_minutes} min, within ${i.within_minutes} min` : `needed within ${i.within_minutes} min`
  return i.at_minutes === null ? from.charAt(0).toUpperCase() + from.slice(1) : `Given at ${i.at_minutes} min; ${from}`
}

/** "At the bedside": in a live case, what the student gave and when, what harmed, and how the patient ended up. */
export function BedsideSummary({ bedside, total }: { bedside: Bedside; total: number }) {
  const { outcome } = bedside
  const ending = outcome.recovered
    ? outcome.worst_stage
      ? `Your patient reached "${outcome.worst_stage}" before you stabilised them, then recovered.`
      : "You stabilised your patient before they got any worse, and they recovered."
    : outcome.stabilised
      ? "You stabilised your patient just before the encounter ended."
      : outcome.worst_stage
        ? `Your patient was never stabilised and reached "${outcome.worst_stage}".`
        : "Your patient was never stabilised."
  const consultationShare = Math.round((1 - bedside.share) * 100)
  return (
    <div className="overflow-hidden rounded-xl border border-enc-line bg-enc-desk">
      <div className="flex items-center justify-between border-b border-enc-line bg-enc-sheet px-4 py-2.5">
        <h4 className="text-[10px] font-bold tracking-widest text-enc-ink-3 uppercase">At the bedside</h4>
        <span className="text-sm font-bold text-enc-ink">
          {bedside.score}
          <span className="text-[10px] font-medium text-enc-ink-3"> / 100</span>
        </span>
      </div>
      <div className="space-y-2.5 p-3">
        <p className="text-sm font-medium text-enc-ink">{ending}</p>
        {outcome.path && outcome.path !== "usual" && <p className="text-xs text-enc-ink-2">They were stabilised through: {outcome.path}.</p>}
        <ul className="space-y-1.5">
          {bedside.items.map((i) => (
            <li key={i.id} className="rounded-lg bg-enc-sheet p-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-enc-ink">{i.label}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BEDSIDE_STATUS[i.status].tone}`}>{BEDSIDE_STATUS[i.status].text}</span>
              </div>
              <p className="mt-0.5 text-xs text-enc-ink-2">
                {bedsideTiming(i)}
                {i.why ? `. ${i.why}` : ""}
              </p>
              {i.fluid_steps && (
                <ul className="mt-1 space-y-0.5">
                  {i.fluid_steps.map((s, n) => (
                    <li key={n} className="text-xs text-enc-ink-2">
                      {s.label}: {s.at_minutes === null ? "" : `at ${s.at_minutes} min, `}
                      {FLUID_STEP_STATUS[s.status]}
                      {s.note ? `. ${s.note}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {i.doses && (
                <ul className="mt-1 space-y-0.5">
                  {i.doses.map((d) => (
                    <li key={d.dose} className="text-xs text-enc-ink-2">
                      Dose {d.dose}: {d.status === "not_needed" ? "not needed" : `${d.at_minutes === null ? "not given" : `given at ${d.at_minutes} min`} (${BEDSIDE_STATUS[d.status].text.toLowerCase()})`}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {bedside.refused?.map((r, n) => (
            <li key={`${r.id}-${n}`} className="rounded-lg bg-enc-warn-soft p-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-enc-ink">{r.label}</span>
                <span className="shrink-0 rounded-full bg-enc-sheet px-2 py-0.5 text-[11px] font-semibold text-enc-warn">{r.reason === "unavailable" || r.reason === "needs_first" ? "Not given" : r.reason === "fluid" ? "Not changed" : "Dose refused"}</span>
              </div>
              <p className="mt-0.5 text-xs text-enc-ink-2">
                At {r.at_minutes} min. {r.said}
              </p>
            </li>
          ))}
          {bedside.harmful.map((h) => (
            <li key={h.id} className="rounded-lg bg-enc-crit-soft p-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-enc-ink">{h.label}</span>
                <span className="shrink-0 rounded-full bg-enc-sheet px-2 py-0.5 text-[11px] font-semibold text-enc-crit">Harmful here</span>
              </div>
              <p className="mt-0.5 text-xs text-enc-ink-2">
                {h.id.includes(":overload") ? "At" : "Given at"} {h.at_minutes} min{h.why ? `. ${h.why}` : ""}
              </p>
            </li>
          ))}
        </ul>
        {bedside.limitations && <p className="rounded-lg bg-enc-sheet p-2.5 text-xs text-enc-ink-2">{bedside.limitations}</p>}
        <p className="text-xs text-enc-ink-3">
          Total {total} = {consultationShare}% of the consultation ({bedside.consultationScore}) + {100 - consultationShare}% of the bedside ({bedside.score}).
        </p>
      </div>
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
