"use client"

// The multimodal diagnostic viewer — the same workflow for ECG, imaging and labs:
//
//   Student orders an investigation             TEST_ORDERED
//        ↓  (turnaround: results are not instant)
//   The study is displayed                       ECG grid / report / lab table
//        ↓
//   "Record your interpretation"                 RESULT_INTERPRETED
//        ↓
//   ─────────────────────────────────────────
//   🔍 Reveal expert interpretation
//      This will be recorded in your Independent Score.
//   ─────────────────────────────────────────
//        ↓ (if revealed)                         ASSIST_USED + RESULT_REVEALED
//   The expert read appears; the cost lands on the Independent track ONLY.
//
// Until revealed, an ECG or imaging study carries no diagnostic wording at all —
// not even a "critical finding" banner. The debrief reveals every expert read to
// every student, so nobody leaves without learning what the expert saw.

import { Fragment, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock,
  FileText,
  Loader2,
  Lock,
  Save,
  ScanSearch,
} from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { assistTypeForTest } from "@/lib/clinical-catalog"
import { getTestDef } from "@/lib/simulation/test-catalog"
import { formatClock } from "@/lib/simulation/encounter-events"
import {
  interpretationFor,
  isResultReady,
  isRevealed,
  readyAt,
  type InvestigationOrder,
  type ResolvedResult,
  type ResolvedValue,
} from "@/lib/simulation/case-resolvers"
import { useClinicalEvents } from "./clinical-event-manager"
import { Ecg12LeadViewer } from "./ecg-12-lead"
import { StatusPill } from "./encounter-ui"

// ── Small pieces ────────────────────────────────────────────────────────────

// A lab report, not a stack of cards: the parameter, the result in a monospace face, the
// reference range, and a flag. An abnormal row is tinted, and only that row.
const ROW_TINT: Record<string, string> = {
  normal: "",
  high: "bg-enc-warn-soft/60",
  low: "bg-enc-warn-soft/60",
  abnormal: "bg-enc-warn-soft/60",
  critical: "bg-enc-crit-soft",
}

function Flag({ status }: { status: string }) {
  if (status === "normal") return <span className="text-[12px] text-enc-ink-3">Normal</span>
  const label = status === "high" ? "High" : status === "low" ? "Low" : status === "critical" ? "Critical" : "Abnormal"
  const icon = status === "high" ? <ArrowUp className="h-3 w-3" /> : status === "low" ? <ArrowDown className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />
  return (
    <StatusPill tone={status === "critical" ? "crit" : "warn"} icon={icon}>
      {label}
    </StatusPill>
  )
}

function LabTable({ values, showNotes }: { values: ResolvedValue[]; showNotes: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-enc-line-strong">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-enc-line-strong bg-enc-desk text-[11px] tracking-[0.08em] text-enc-ink-3 uppercase">
            <th className="px-3 py-2 font-semibold">Parameter</th>
            <th className="px-3 py-2 font-semibold">Result</th>
            <th className="hidden px-3 py-2 font-semibold sm:table-cell">Reference</th>
            <th className="px-3 py-2 text-right font-semibold">Flag</th>
          </tr>
        </thead>
        <tbody>
          {values.map((v) => (
            <Fragment key={v.key}>
              <tr className={cn("border-b border-enc-line last:border-b-0", ROW_TINT[v.status])}>
                <td className="px-3 py-2.5 text-[14px] font-medium text-enc-ink">{v.parameter}</td>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-[15px] font-medium text-enc-ink tabular-nums">{v.value}</span>
                  {v.unit && <span className="ml-1 text-[12px] text-enc-ink-3">{v.unit}</span>}
                  <span className="mt-0.5 block text-[11px] text-enc-ink-3 sm:hidden">Ref {v.referenceRange}</span>
                </td>
                <td className="hidden px-3 py-2.5 text-[13px] text-enc-ink-2 sm:table-cell">{v.referenceRange}</td>
                <td className="px-3 py-2.5 text-right">
                  <Flag status={v.status} />
                </td>
              </tr>
              {showNotes && v.note && (
                <tr className={cn("border-b border-enc-line last:border-b-0", ROW_TINT[v.status])}>
                  <td colSpan={4} className="px-3 pb-3 text-[12px] leading-relaxed text-enc-ink-2">
                    {v.note}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ImagingPanel({ result }: { result: ResolvedResult }) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-enc-line-strong bg-slate-900/5">
        {result.imageUrl ? (
          <div className="flex aspect-video w-full items-center justify-center bg-black/90 p-2">
            <img src={result.imageUrl} alt={result.testName} className="max-h-[360px] w-auto max-w-full rounded object-contain shadow" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
            <ScanSearch className="h-8 w-8 text-enc-ink-3" />
            <p className="text-sm font-medium text-enc-ink-2">Report only</p>
            <p className="max-w-xs text-xs text-enc-ink-3">No image is attached to this study in this build — the radiologist&apos;s findings are below.</p>
          </div>
        )}
      </div>
      {result.report && (
        <div className="rounded-lg border border-enc-line-strong bg-white p-3 sm:p-4">
          {result.report.technique && <p className="mb-2 text-[11px] text-enc-ink-3">{result.report.technique}</p>}
          <h4 className="mb-1 text-xs font-semibold tracking-wide text-enc-ink-2 uppercase">Findings</h4>
          <p className="text-sm leading-relaxed text-enc-ink">{result.report.findings}</p>
        </div>
      )}
    </div>
  )
}

// ── The viewer ──────────────────────────────────────────────────────────────

interface SimulationResultViewProps {
  order: InvestigationOrder | null
  open: boolean
  onClose: () => void
}

export function SimulationResultView({ order, open, onClose }: SimulationResultViewProps) {
  const { config, events, now, policy, actions, resolveResult } = useClinicalEvents()
  const { toast } = useToast()

  const savedInterpretation = order ? interpretationFor(events, order) : undefined
  const [draft, setDraft] = useState(savedInterpretation ?? "")
  useEffect(() => {
    setDraft(savedInterpretation ?? "")
    // Reset only when the student opens a different order, not whenever the log grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.key])

  const ready = order ? isResultReady(config, order, now) : false

  // A result is a pure function of the log UP TO the order, and that prefix never
  // changes — so resolve it once per (order, ready), not on every clock tick.
  // (Re-resolving would hand the 12-lead viewer a fresh object 4×/second and make
  // it re-synthesise ~12,000 samples each time.)
  const resolved = useMemo(
    () => (order && ready ? resolveResult(order) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order?.key, ready]
  )

  if (!order) return null

  const test = getTestDef(config, order.testId)

  const kind = test?.kind ?? "lab"
  const assistType = test ? assistTypeForTest(test) : "explain_abnormal"
  const availability = policy.availability(assistType)
  const revealed = isRevealed(events, order)
  const isExpertGated = kind === "ecg" || kind === "imaging"

  const secondsLeft = Math.max(0, readyAt(config, order) - now)
  const totalSeconds = Math.max(1, readyAt(config, order) - order.orderedAt)

  const dirty = draft.trim().length > 0 && draft.trim() !== (savedInterpretation ?? "")

  // Only offer a paid reveal when there is something behind it. A result the case authored
  // without any expert commentary would otherwise charge the student for an empty panel.
  const hasExpertRead =
    !!resolved &&
    Boolean(
      resolved.interpretation ||
        resolved.report?.impression ||
        resolved.hint ||
        (isExpertGated && resolved.criticalFindings.length > 0) ||
        (!isExpertGated && resolved.values.some((v) => v.note))
    )

  const save = () => {
    actions.interpretResult(order, draft.trim())
    toast({ title: "Interpretation recorded", description: `${order.testName} — ${formatClock(now)}`, duration: 2500 })
  }

  const reveal = () => {
    const result = actions.revealResult(order)
    if (result.ok && result.charged) {
      toast({
        title: "Expert interpretation revealed",
        description: `Recorded on your Independent score (−${result.cost}).`,
        duration: 3500,
      })
    }
  }

  const revealLabel =
    kind === "ecg" ? "Reveal expert ECG interpretation" : kind === "imaging" ? "Reveal radiology impression" : "Explain the abnormal values"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-[96vw] flex-col gap-0 p-0 sm:max-w-3xl md:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-enc-line-strong px-4 py-3 pr-12 sm:px-6 sm:py-4">
          <DialogTitle className="text-base font-bold text-enc-ink sm:text-xl">{order.testName}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-enc-ink-2">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Ordered {formatClock(order.orderedAt)}
            </span>
            {ready && <span>Resulted {formatClock(readyAt(config, order))}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent style={{ scrollbarWidth: "thin" }}>
          <div className="space-y-4 px-3 py-4 sm:px-6">
            {/* ── Pending ─────────────────────────────────────────────── */}
            {!ready && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-enc-line-strong bg-enc-desk px-6 py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                <div>
                  <p className="text-sm font-semibold text-enc-ink">Result pending</p>
                  <p className="text-xs text-enc-ink-2">
                    Ready in <span className="font-mono font-semibold tabular-nums">{formatClock(secondsLeft)}</span> — you can keep working the case.
                  </p>
                </div>
                <div className="h-1.5 w-56 overflow-hidden rounded-full bg-enc-console-hover">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, (1 - secondsLeft / totalSeconds) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* ── The study ───────────────────────────────────────────── */}
            {resolved && (
              <>
                {resolved.ecg && <Ecg12LeadViewer ecg={resolved.ecg} />}
                {kind === "imaging" && <ImagingPanel result={resolved} />}
                {resolved.values.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-enc-ink sm:text-base">Results</h3>
                    <LabTable values={resolved.values} showNotes={revealed} />
                    {!isExpertGated && !revealed && resolved.values.some((v) => v.note) && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-enc-ink-3">
                        <Lock className="h-3 w-3" /> Explanations of the abnormal values are available below.
                      </p>
                    )}
                  </section>
                )}

                {/* No table, tracing or scan: the written result is the study. */}
                {resolved.values.length === 0 && !resolved.ecg && kind !== "imaging" && resolved.summary && (
                  <section className="rounded-lg border border-enc-line-strong bg-white p-3 sm:p-4">
                    <h3 className="mb-1 text-sm font-semibold text-enc-ink sm:text-base">Result</h3>
                    <p className="text-sm leading-relaxed text-enc-ink">{resolved.summary}</p>
                  </section>
                )}

                {/* A lab's critical value is called to the ED; an ECG or scan gives nothing away until revealed. */}
                {!isExpertGated && resolved.criticalFindings.length > 0 && (
                  <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3">
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-red-900">
                      <AlertCircle className="h-4 w-4 text-red-600" /> Critical value
                    </h3>
                    <ul className="space-y-1">
                      {resolved.criticalFindings.map((f) => (
                        <li key={f} className="text-xs text-red-800">{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── Interpret ─────────────────────────────────────── */}
                <section className="rounded-xl border border-enc-line-strong bg-white p-3 sm:p-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-enc-ink">
                    <FileText className="h-4 w-4 text-enc-ink-3" />
                    Record your interpretation
                    {!isExpertGated && <span className="text-xs font-normal text-enc-ink-3">optional</span>}
                  </h3>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      kind === "ecg"
                        ? "Rate, rhythm, axis, intervals — then the ST-T findings, lead by lead. What is your read?"
                        : kind === "imaging"
                          ? "What do the findings mean for this patient?"
                          : "What do these results tell you, and do they change what you do?"
                    }
                    className="min-h-[96px] resize-y text-sm"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-enc-ink-3">
                      {savedInterpretation !== undefined && !dirty ? "Recorded. Edit and save to update." : "Your reading is part of the case record."}
                    </p>
                    <Button type="button" size="sm" onClick={save} disabled={!dirty} className="h-8 gap-1.5 bg-brand-600 text-xs hover:bg-brand-700">
                      <Save className="h-3.5 w-3.5" /> Save interpretation
                    </Button>
                  </div>
                </section>

                {/* ── Reveal ────────────────────────────────────────── */}
                {!revealed && !hasExpertRead && (
                  <p className="text-[11px] text-enc-ink-3">This result comes with no separate expert commentary.</p>
                )}
                {!revealed && hasExpertRead && (
                  <section className="rounded-xl border border-dashed border-slate-300 bg-enc-desk p-3 sm:p-4">
                    {availability.available ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-enc-ink">
                            <ScanSearch className="h-4 w-4 text-brand-600" /> {revealLabel}
                          </p>
                          <p className="mt-0.5 text-xs text-enc-ink-2">
                            This will be recorded in your Independent Score{" "}
                            <span className="font-semibold text-enc-ink">(−{availability.cost})</span>. Your Clinical Score is unaffected.
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={reveal} className="shrink-0 gap-1.5">
                          <ScanSearch className="h-3.5 w-3.5" /> Reveal
                        </Button>
                      </div>
                    ) : (
                      <p className="flex items-start gap-2 text-xs text-enc-ink-2">
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Expert help isn&apos;t available for this case.
                        {config.scoring_mode !== "classic" && " The expert read is shown to everyone in the debrief."}
                      </p>
                    )}
                  </section>
                )}

                {revealed && (
                  <section className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-3 sm:p-4">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-900">
                      <ScanSearch className="h-4 w-4" /> Expert interpretation
                    </h3>
                    {resolved.hint && (
                      <p className="rounded-md bg-white/70 p-2.5 text-xs leading-relaxed text-brand-900">
                        <span className="font-semibold">Where to look: </span>
                        {resolved.hint}
                      </p>
                    )}
                    {resolved.report?.impression && (
                      <p className="text-sm leading-relaxed text-brand-950">
                        <span className="font-semibold">Impression: </span>
                        {resolved.report.impression}
                      </p>
                    )}
                    {resolved.interpretation && <p className="text-sm leading-relaxed text-brand-950">{resolved.interpretation}</p>}
                    {isExpertGated && resolved.criticalFindings.length > 0 && (
                      <ul className="space-y-1 rounded-md border border-red-200 bg-red-50 p-2.5">
                        {resolved.criticalFindings.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs font-medium text-red-800">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </>
            )}

            <p className="border-t border-enc-line-strong pt-3 text-[10px] text-enc-ink-3 italic">
              This is a simulated case for educational purposes.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-enc-line-strong bg-enc-desk px-4 py-3 sm:px-6">
          <Button type="button" onClick={onClose} className="h-9 bg-brand-600 text-sm hover:bg-brand-700">
            Continue case
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
