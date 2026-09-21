"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Stethoscope,
  Send,
  Pill,
  Loader2,
  List,
  Search,
  ClipboardList,
  MessageSquare,
  FlaskConical,
  FileText,
} from "lucide-react"
import { trackEvent } from "@/lib/clarity"
import { cn } from "@/lib/utils"
import { Paper, PaperHeader } from "./encounter-ui"

interface DiagnosisSubmissionProps {
  orderedTests: any[]
  testResults: any[]
  chatHistory: any[]
  onSubmit: (diagnosis: any) => void
  isLoading?: boolean
  coverageScore?: number
  /**
   * Simulation cases: a ranked differential + reasoning + management plan,
   * submitted as one assessment. When present, the legacy form is not shown.
   */
  ranked?: RankedDiagnosisProps
}

export interface RankedAssessment {
  /** Three slots, always: [most likely, important alternative, can't miss]. Blank slots stay blank. */
  ranked: string[]
  primary: string
  reasoning: string
  steps: string[]
}

interface RankedDiagnosisProps {
  questionCount: number
  testCount: number
  resultCount: number
  initialDifferential?: string[]
  isLoading?: boolean
  /** The encounter has run out of time: the assessment is all that is left to do. */
  expired?: boolean
  onSubmit: (assessment: RankedAssessment) => void
}

/** Switches between the legacy form and the ranked-differential form. */
export function DiagnosisSubmission(props: DiagnosisSubmissionProps) {
  if (props.ranked) return <RankedDiagnosisSubmission {...props.ranked} />
  return <LegacyDiagnosisSubmission {...props} />
}

// ─── Ranked differential (simulation cases) ───────────────────────────────────

const SLOTS = [
  { label: "Most likely", hint: "Your working diagnosis — the one you would act on now.", placeholder: "Your working diagnosis" },
  { label: "Important alternative", hint: "The diagnosis that most plausibly competes with it.", placeholder: "What else could explain this picture?" },
  { label: "Can't miss", hint: "The dangerous diagnosis you must exclude, even if unlikely.", placeholder: "What dangerous diagnosis must you rule out?" },
] as const

/** Three ranked slots. Shared by the final assessment and the mid-case differential. */
export function DifferentialSlots({
  values,
  onChange,
  disabled,
}: {
  values: readonly string[]
  onChange: (index: number, value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-4">
      {SLOTS.map((slot, i) => (
        <div key={slot.label}>
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
                i === 0 ? "bg-enc-fill text-white" : "bg-enc-console text-enc-ink-2"
              )}
            >
              {i + 1}
            </span>
            <label htmlFor={`differential-${i}`} className="text-[13px] font-semibold text-enc-ink">
              {slot.label}
            </label>
            {i === 0 && <span className="text-[11px] text-enc-ink-3">required</span>}
          </div>
          <input
            id={`differential-${i}`}
            value={values[i] ?? ""}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={slot.placeholder}
            disabled={disabled}
            className="h-10 w-full rounded-lg border border-enc-line-strong bg-enc-sheet px-3 text-[14px] text-enc-ink transition outline-none placeholder:text-enc-ink-3 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-60"
          />
          <p className="mt-1 text-[12px] text-enc-ink-3">{slot.hint}</p>
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ icon: Icon, title, hint }: { icon: typeof List; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <Icon className="h-4 w-4 shrink-0 translate-y-0.5 text-enc-ink-3" />
      <h3 className="text-[14px] font-semibold text-enc-ink">{title}</h3>
      {hint && <span className="text-[12px] text-enc-ink-3">{hint}</span>}
    </div>
  )
}

function RankedDiagnosisSubmission({
  questionCount,
  testCount,
  resultCount,
  initialDifferential,
  isLoading = false,
  expired = false,
  onSubmit,
}: RankedDiagnosisProps) {
  const [slots, setSlots] = useState<string[]>(() => [0, 1, 2].map((i) => initialDifferential?.[i] ?? ""))
  const [reasoning, setReasoning] = useState("")
  const [management, setManagement] = useState("")

  const primary = slots[0].trim()
  const setSlot = (index: number, value: string) => setSlots((prev) => prev.map((s, i) => (i === index ? value : s)))

  const handleSubmit = () => {
    if (!primary) return
    onSubmit({
      ranked: slots.map((s) => s.trim()),
      primary,
      reasoning: reasoning.trim(),
      steps: management
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
    })
    trackEvent("Diagnosis_Submitted")
  }

  const stat = (label: string, value: number, icon: typeof List) => {
    const Icon = icon
    return (
      <div className="flex flex-1 items-center gap-3 px-4 py-3">
        <Icon className="h-4 w-4 shrink-0 text-enc-ink-3" />
        <div>
          <p className="text-[12px] text-enc-ink-2">{label}</p>
          <p className={cn("font-mono text-[20px] leading-tight font-medium tabular-nums", value === 0 ? "text-enc-warn" : "text-enc-ink")}>{value}</p>
        </div>
      </div>
    )
  }

  const areaClass =
    "w-full resize-none rounded-lg border border-enc-line-strong bg-enc-sheet p-3 text-[14px] leading-relaxed text-enc-ink transition outline-none placeholder:text-enc-ink-3 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-60"

  return (
    <div className="flex h-full min-h-0 flex-col bg-enc-desk">
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }} data-lenis-prevent>
        <div className="mx-auto max-w-[760px] space-y-5 p-5">
          {expired && (
            <div className="rounded-lg border border-enc-warn/30 bg-enc-warn-soft p-3 text-[13px] text-enc-warn">
              <span className="font-semibold">Time is up.</span> Commit to your assessment. It will be scored on everything you did.
            </div>
          )}

          <Paper className="flex divide-x divide-enc-line overflow-hidden" aria-label="What you have done so far">
            {stat("Questions asked", questionCount, MessageSquare)}
            {stat("Investigations", testCount, FlaskConical)}
            {stat("Results reviewed", resultCount, FileText)}
          </Paper>

          <Paper className="overflow-hidden">
            <PaperHeader title="Assessment" description="Commit to a diagnosis you can justify. The order of your differential matters, not just what is on the list." />
            <div className="divide-y divide-enc-line">
              <section className="p-4">
                <SectionTitle icon={List} title="Ranked differential" />
                <DifferentialSlots values={slots} onChange={setSlot} disabled={isLoading} />
              </section>

              <section className="p-4">
                <SectionTitle icon={Search} title="Your reasoning" />
                <label htmlFor="ranked-reasoning" className="sr-only">
                  Your reasoning
                </label>
                <textarea
                  id="ranked-reasoning"
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  disabled={isLoading}
                  placeholder="Which findings (from the history, examination and investigations) support your first diagnosis over the others?"
                  className={cn(areaClass, "min-h-[104px]")}
                />
              </section>

              <section className="p-4">
                <SectionTitle icon={Pill} title="Management plan" hint="one step per line" />
                <label htmlFor="ranked-management" className="sr-only">
                  Management plan
                </label>
                <textarea
                  id="ranked-management"
                  value={management}
                  onChange={(e) => setManagement(e.target.value)}
                  disabled={isLoading}
                  placeholder={"What you would do next, in order.\nSteps you have already carried out still count: list the plan as you would hand it over."}
                  className={cn(areaClass, "min-h-[120px] font-mono text-[13px]")}
                />
              </section>
            </div>
          </Paper>
        </div>
      </div>

      {/* The dock: the one irreversible action stays in view, with what it does said plainly. */}
      <div className="shrink-0 border-t border-enc-line-strong bg-enc-sheet shadow-enc-dock">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4 px-5 py-3">
          <p className="text-[12px] leading-snug text-enc-ink-3">Submitting ends the encounter. Both scores are calculated from everything you did.</p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!primary || isLoading}
            className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-5 text-[14px] font-semibold text-white transition-colors outline-none hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-enc-line-strong disabled:text-enc-ink-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Scoring the encounter…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit assessment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Legacy form (unchanged) ──────────────────────────────────────────────────

function LegacyDiagnosisSubmission({
  orderedTests,
  testResults,
  chatHistory,
  onSubmit,
  isLoading = false,
  coverageScore = 0,
}: DiagnosisSubmissionProps) {
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState("")
  const [differential1, setDifferential1] = useState("")
  const [differential2, setDifferential2] = useState("")
  const [supportingFindings, setSupportingFindings] = useState("")
  const [missingInfo, setMissingInfo] = useState("")
  const [managementPlan, setManagementPlan] = useState("")

  const handleSubmit = () => {
    if (!primaryDiagnosis.trim()) {
      alert("Please enter a primary diagnosis")
      return
    }

    const diagnosis = {
      primaryDiagnosis: primaryDiagnosis.trim(),
      differentials: [differential1.trim(), differential2.trim()].filter(Boolean),
      supportingFindings: supportingFindings.trim()
        ? supportingFindings.trim().split(/\n+/).map((s) => s.trim()).filter(Boolean)
        : [],
      missingInformation: missingInfo.trim()
        ? missingInfo.trim().split(/\n+/).map((s) => s.trim()).filter(Boolean)
        : [],
      managementPlan: managementPlan.trim()
        ? managementPlan.trim().split(/\n+/).map((s) => s.trim()).filter(Boolean)
        : [],
      submittedAt: new Date().toISOString(),
    }

    onSubmit(diagnosis)
    trackEvent("Diagnosis_Submitted")
  }

  const completedTests = orderedTests.filter((t) => t.status === "completed")
  const userQuestions = chatHistory.filter((m) => m.role === "user").length

  // Workup metric colour: amber if 0
  const metricCn = (val: number) =>
    cn("font-bold text-sm", val === 0 ? "text-amber-600" : "text-slate-800")

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ scrollbarWidth: "thin" }}
      data-lenis-prevent
    >
      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* ── Workup summary bar ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-500">Questions</span>
            <span className={metricCn(userQuestions)}>{userQuestions}</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-500">Tests</span>
            <span className={metricCn(orderedTests.length)}>{orderedTests.length}</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-500">Results</span>
            <span className={metricCn(testResults.length)}>{testResults.length}</span>
          </div>
        </div>

        {/* ── Primary Diagnosis ──────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="primary-diagnosis" className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Stethoscope className="h-4 w-4 text-slate-400" />
            Primary diagnosis
            <span className="text-slate-400 font-normal text-xs">*required</span>
          </Label>
          <Input
            id="primary-diagnosis"
            placeholder="e.g. Viral gastroenteritis due to Rotavirus"
            value={primaryDiagnosis}
            onChange={(e) => setPrimaryDiagnosis(e.target.value)}
            className="h-10 text-sm border-slate-200 focus:border-brand-300 focus:ring-brand-100"
            disabled={isLoading}
          />
          <p className="text-[11px] text-slate-400">
            State your most confident diagnosis based on the full clinical picture.
          </p>
        </div>

        <Separator />

        {/* ── Top 2 Differentials ──────────────────────────────────────── */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <List className="h-4 w-4 text-slate-400" />
            Top 2 differentials
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Differential #1"
              value={differential1}
              onChange={(e) => setDifferential1(e.target.value)}
              className="h-9 text-sm border-slate-200"
              disabled={isLoading}
            />
            <Input
              placeholder="Differential #2"
              value={differential2}
              onChange={(e) => setDifferential2(e.target.value)}
              className="h-9 text-sm border-slate-200"
              disabled={isLoading}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            What else could explain this presentation? Consider and rule out.
          </p>
        </div>

        <Separator />

        {/* ── Supporting Findings ──────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="supporting-findings" className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Search className="h-4 w-4 text-slate-400" />
            Supporting findings
          </Label>
          <Textarea
            id="supporting-findings"
            placeholder={`Key history and test results that support your diagnosis — one per line.\ne.g. Profuse watery diarrhoea × 2 days\nRotavirus ELISA positive\nMild hyponatraemia on electrolytes`}
            value={supportingFindings}
            onChange={(e) => setSupportingFindings(e.target.value)}
            className="min-h-[80px] resize-none text-sm border-slate-200 focus:border-brand-300"
            disabled={isLoading}
          />
          <p className="text-[11px] text-slate-400">One finding per line.</p>
        </div>

        <Separator />

        {/* ── Missing Information ──────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="missing-info" className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            Missing information
            <span className="text-slate-400 font-normal text-xs">optional</span>
          </Label>
          <Textarea
            id="missing-info"
            placeholder={`What would have strengthened your diagnosis?\ne.g. Immunisation history not confirmed\nUrine output not assessed`}
            value={missingInfo}
            onChange={(e) => setMissingInfo(e.target.value)}
            className="min-h-[60px] resize-none text-sm border-slate-200"
            disabled={isLoading}
          />
          <p className="text-[11px] text-slate-400">Acknowledging gaps shows clinical self-awareness.</p>
        </div>

        <Separator />

        {/* ── Management Plan ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="management-plan" className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Pill className="h-4 w-4 text-slate-400" />
            Management plan
            <span className="text-slate-400 font-normal text-xs">optional</span>
          </Label>
          <Textarea
            id="management-plan"
            placeholder={`One step per line:\nOral rehydration solution (ORS)\nMonitor hydration status\nHygiene counselling`}
            value={managementPlan}
            onChange={(e) => setManagementPlan(e.target.value)}
            className="min-h-[90px] resize-none text-sm border-slate-200 font-mono"
            disabled={isLoading}
          />
        </div>

        {/* ── Submit ──────────────────────────────────────────────────── */}
        <div className="pt-1 pb-4 space-y-1.5">
          <Button
            onClick={handleSubmit}
            disabled={!primaryDiagnosis.trim() || isLoading}
            className="w-full h-10 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Evaluating…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit diagnosis
              </>
            )}
          </Button>
          <p className="text-[10px] text-slate-400 text-center">
            Your reasoning will be scored against clinical evidence.
          </p>
        </div>
      </div>
    </div>
  )
}
