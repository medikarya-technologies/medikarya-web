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

interface DiagnosisSubmissionProps {
  orderedTests: any[]
  testResults: any[]
  chatHistory: any[]
  onSubmit: (diagnosis: any) => void
  isLoading?: boolean
  coverageScore?: number
}

export function DiagnosisSubmission({
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
