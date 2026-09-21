"use client"

// The whole encounter as a timeline, rendered from nothing but the event log —
// which is the point: timeline, scoring, replay and debrief all consume the same
// EncounterEvent[]. Standalone (no provider) so the debrief can replay a past
// attempt from its saved events.

import {
  Activity,
  AlertTriangle,
  ClipboardList,
  FileText,
  FlaskConical,
  GitBranch,
  Lightbulb,
  ListOrdered,
  MessageSquare,
  ScanSearch,
  Stethoscope,
  Syringe,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatClock, type ClinicalEvent } from "@/lib/simulation/encounter-events"
import { getIntervention } from "@/lib/simulation/intervention-catalog"
import { ASSIST_LABELS } from "@/lib/simulation/assist-policy"

interface Row {
  icon: typeof Activity
  tone: "neutral" | "good" | "warn" | "bad" | "muted"
  title: string
  detail?: string
}

const TONE: Record<Row["tone"], string> = {
  neutral: "bg-slate-100 text-slate-500",
  good: "bg-emerald-100 text-emerald-600",
  warn: "bg-amber-100 text-amber-600",
  bad: "bg-rose-100 text-rose-600",
  muted: "bg-slate-50 text-slate-300",
}

function describe(e: ClinicalEvent, examLabels: ReadonlyMap<string, string>): Row {
  switch (e.type) {
    case "HISTORY_TAKEN":
      return { icon: MessageSquare, tone: "neutral", title: `Asked: “${e.question}”`, detail: e.response }
    case "EXAM_PERFORMED":
      return { icon: Stethoscope, tone: "neutral", title: `Examined: ${examLabels.get(e.manoeuvre) ?? e.manoeuvre}`, detail: e.findings }
    case "TEST_ORDERED":
      return { icon: FlaskConical, tone: "neutral", title: `Ordered: ${e.testName}` }
    case "RESULT_INTERPRETED":
      return { icon: FileText, tone: "good", title: `Interpreted ${e.testId.replace(/_/g, " ")}`, detail: e.studentInterpretation }
    case "RESULT_REVEALED":
      return { icon: ScanSearch, tone: "warn", title: `Revealed the expert read: ${e.testId.replace(/_/g, " ")}` }
    case "INTERVENTION_GIVEN":
      return { icon: Syringe, tone: "neutral", title: `Gave: ${getIntervention(e.action)?.label ?? e.action}`, detail: e.consequence }
    case "ASSIST_USED":
      return { icon: Lightbulb, tone: "warn", title: `Assist: ${ASSIST_LABELS[e.assistType]} (−${e.cost})` }
    case "STATE_TRANSITION":
      return { icon: GitBranch, tone: "muted", title: `Patient state: ${e.from.replace(/_/g, " ")} → ${e.to.replace(/_/g, " ")}` }
    case "PATIENT_DETERIORATED":
      return { icon: AlertTriangle, tone: "bad", title: "Nurse alert", detail: e.narrative }
    case "DIFFERENTIAL_SUBMITTED":
      return { icon: ListOrdered, tone: "good", title: "Differential", detail: e.ranked.filter(Boolean).map((d, i) => `${i + 1}. ${d}`).join("  ·  ") }
    case "DIAGNOSIS_SUBMITTED":
      return { icon: Stethoscope, tone: "good", title: `Diagnosis: ${e.primary}`, detail: e.reasoning }
    case "MANAGEMENT_SUBMITTED":
      return { icon: ClipboardList, tone: "good", title: `Management plan (${e.steps.length} ${e.steps.length === 1 ? "step" : "steps"})`, detail: e.steps.join("  ·  ") }
  }
}

interface EncounterTimelineProps {
  events: readonly ClinicalEvent[]
  /** manoeuvre id → label */
  examLabels?: Record<string, string>
  className?: string
}

export function EncounterTimeline({ events, examLabels = {}, className }: EncounterTimelineProps) {
  const labels = new Map(Object.entries(examLabels))
  if (events.length === 0) {
    return <p className={cn("text-sm text-slate-400", className)}>No events were recorded.</p>
  }
  return (
    <ol className={cn("relative space-y-0", className)}>
      {events.map((e, i) => {
        const row = describe(e, labels)
        const Icon = row.icon
        return (
          <li key={i} className={cn("relative flex gap-3 pb-3", row.tone === "muted" && "opacity-70")}>
            {i < events.length - 1 && <span className="absolute top-7 bottom-0 left-[13px] w-px bg-slate-200" aria-hidden />}
            <span className={cn("z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TONE[row.tone])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug font-medium text-slate-800">
                <span className="mr-2 font-mono text-[11px] font-normal text-slate-400 tabular-nums">{formatClock(e.timestamp)}</span>
                {row.title}
              </p>
              {row.detail && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{row.detail}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
