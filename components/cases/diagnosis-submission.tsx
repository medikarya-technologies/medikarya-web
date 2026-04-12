"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Stethoscope,
  AlertCircle,
  Send,
  FileText,
  Pill,
  Loader2,
  List,
  Search,
  ClipboardList,
  CheckCircle2,
  XCircle,
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
        ? supportingFindings.trim().split(/\n+/).map(s => s.trim()).filter(Boolean)
        : [],
      missingInformation: missingInfo.trim()
        ? missingInfo.trim().split(/\n+/).map(s => s.trim()).filter(Boolean)
        : [],
      managementPlan: managementPlan.trim()
        ? managementPlan.trim().split(/\n+/).map(s => s.trim()).filter(Boolean)
        : [],
      submittedAt: new Date().toISOString(),
    }

    onSubmit(diagnosis)
    trackEvent("Diagnosis_Submitted")
  }

  const completedTests = orderedTests.filter(t => t.status === "completed")
  const hasResults = testResults.length > 0
  const userQuestions = chatHistory.filter(m => m.role === "user").length

  // Readiness assessment
  const readinessIssues: string[] = []
  if (coverageScore < 2) readinessIssues.push("Limited patient history")
  if (!hasResults) readinessIssues.push("No investigations ordered")
  if (coverageScore < 3 && hasResults) readinessIssues.push("History may be incomplete")
  const isWeak = readinessIssues.length >= 2

  return (
    <div
      className="h-[500px] sm:h-[550px] md:h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
      style={{ scrollbarWidth: 'thin' }}
      data-lenis-prevent
    >
      <div className="p-3 sm:p-4 md:p-5 space-y-4">

        {/* Readiness summary */}
        <Card className={cn(
          "border",
          isWeak ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
        )}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              {isWeak
                ? <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                : <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1">
                <p className={cn(
                  "text-sm font-semibold mb-1",
                  isWeak ? "text-amber-900" : "text-emerald-900"
                )}>
                  {isWeak ? "Submitting with incomplete workup" : "Ready to diagnose"}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center mt-2">
                  <div className="bg-white/70 rounded-lg py-1.5 px-2">
                    <p className="text-base font-bold text-blue-600">{userQuestions}</p>
                    <p className="text-[10px] text-blue-700">Questions</p>
                  </div>
                  <div className="bg-white/70 rounded-lg py-1.5 px-2">
                    <p className="text-base font-bold text-purple-600">{completedTests.length}</p>
                    <p className="text-[10px] text-purple-700">Tests done</p>
                  </div>
                  <div className="bg-white/70 rounded-lg py-1.5 px-2">
                    <p className="text-base font-bold text-emerald-600">{testResults.length}</p>
                    <p className="text-[10px] text-emerald-700">Results in</p>
                  </div>
                </div>
                {readinessIssues.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {readinessIssues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-amber-800">
                        <XCircle className="h-3 w-3 flex-shrink-0" />
                        {issue} — will affect your score
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Primary Diagnosis ──────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="primary-diagnosis" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-emerald-600" />
            Primary Diagnosis *
          </Label>
          <Input
            id="primary-diagnosis"
            placeholder="e.g. Viral gastroenteritis due to Rotavirus"
            value={primaryDiagnosis}
            onChange={(e) => setPrimaryDiagnosis(e.target.value)}
            className="h-10 text-sm border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
            disabled={isLoading}
          />
          <p className="text-[10px] sm:text-xs text-slate-500">
            State your most confident diagnosis based on the full clinical picture.
          </p>
        </div>

        <Separator />

        {/* ── Differentials ────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <List className="h-4 w-4 text-purple-600" />
            Top 2 Differentials
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Input
                placeholder="Differential #1"
                value={differential1}
                onChange={(e) => setDifferential1(e.target.value)}
                className="h-9 text-sm border-purple-200 focus:border-purple-400 focus:ring-purple-100"
                disabled={isLoading}
              />
            </div>
            <div>
              <Input
                placeholder="Differential #2"
                value={differential2}
                onChange={(e) => setDifferential2(e.target.value)}
                className="h-9 text-sm border-purple-200 focus:border-purple-400 focus:ring-purple-100"
                disabled={isLoading}
              />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500">
            What else could explain this presentation? Consider and rule out.
          </p>
        </div>

        <Separator />

        {/* ── Supporting Findings ──────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="supporting-findings" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-blue-600" />
            Supporting Findings
          </Label>
          <Textarea
            id="supporting-findings"
            placeholder={`Key history and test results that support your diagnosis — one per line.\ne.g. Profuse watery diarrhoea × 2 days\nRotavirus ELISA positive\nMild hyponatraemia on electrolytes`}
            value={supportingFindings}
            onChange={(e) => setSupportingFindings(e.target.value)}
            className="min-h-[80px] resize-none text-xs sm:text-sm border-blue-200 focus:border-blue-400 focus:ring-blue-100"
            disabled={isLoading}
          />
        </div>

        <Separator />

        {/* ── Missing Information ──────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="missing-info" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            Missing Information <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Textarea
            id="missing-info"
            placeholder={`What information would have strengthened your diagnosis?\ne.g. Immunisation history not confirmed\nUrine output not assessed`}
            value={missingInfo}
            onChange={(e) => setMissingInfo(e.target.value)}
            className="min-h-[60px] resize-none text-xs sm:text-sm"
            disabled={isLoading}
          />
          <p className="text-[10px] sm:text-xs text-slate-500">
            Acknowledging gaps shows clinical self-awareness — it helps your score.
          </p>
        </div>

        <Separator />

        {/* ── Management Plan ─────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="management-plan" className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <Pill className="h-4 w-4 text-emerald-600" />
            Management Plan <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Textarea
            id="management-plan"
            placeholder={`One step per line:\nOral rehydration solution (ORS)\nMonitor hydration status\nHygiene counselling`}
            value={managementPlan}
            onChange={(e) => setManagementPlan(e.target.value)}
            className="min-h-[90px] resize-none text-xs sm:text-sm font-mono"
            disabled={isLoading}
          />
          <p className="text-[10px] text-slate-500">One step per line.</p>
        </div>

        {/* ── Submit ─────────────────────────────────────────────── */}
        <div className="flex justify-end pt-2 pb-1">
          <Button
            onClick={handleSubmit}
            disabled={!primaryDiagnosis.trim() || isLoading}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md px-6 h-10 text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Evaluating…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit & Get Feedback
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
