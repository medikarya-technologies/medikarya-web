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
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Send,
  FileText,
  Pill,
  Loader2
} from "lucide-react"
import { trackEvent } from "@/lib/clarity"

interface DiagnosisSubmissionProps {
  orderedTests: any[]
  testResults: any[]
  chatHistory: any[]
  onSubmit: (diagnosis: any) => void
  isLoading?: boolean
}

export function DiagnosisSubmission({
  orderedTests,
  testResults,
  chatHistory,
  onSubmit,
  isLoading = false,
}: DiagnosisSubmissionProps) {
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState("")
  const [managementPlan, setManagementPlan] = useState("")

  const handleSubmit = () => {
    if (!primaryDiagnosis.trim()) {
      alert("Please enter a primary diagnosis")
      return
    }

    const diagnosis = {
      primaryDiagnosis: primaryDiagnosis.trim(),
      // Split by newlines so EvaluationEngine receives a string[] of steps
      managementPlan: managementPlan.trim()
        ? managementPlan.trim().split(/\n+/).map(s => s.trim()).filter(Boolean)
        : [],
      submittedAt: new Date().toISOString()
    }

    onSubmit(diagnosis)
    trackEvent("Diagnosis_Submitted")
  }

  const completedTests = orderedTests.filter(t => t.status === "completed")
  const hasResults = testResults.length > 0

  return (
    <div className="h-[500px] sm:h-[550px] md:h-[600px] flex-1 min-h-0 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
      style={{ scrollbarWidth: 'thin' }}
      data-lenis-prevent
    >
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Stats Section */}
        <Card className="bg-brand-50/50 border-brand-200">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-600" />
              Case Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 text-center">
              <div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-brand-600">{chatHistory.length}</div>
                <div className="text-[10px] sm:text-xs text-brand-700">Questions</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600">{completedTests.length}</div>
                <div className="text-[10px] sm:text-xs text-purple-700">Tests</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{testResults.length}</div>
                <div className="text-[10px] sm:text-xs text-green-700">Results</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary Diagnosis */}
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="primary-diagnosis" className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2">
            <Stethoscope className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-600" />
            Primary Diagnosis *
          </Label>
          <Input
            id="primary-diagnosis"
            placeholder="Enter primary diagnosis..."
            value={primaryDiagnosis}
            onChange={(e) => setPrimaryDiagnosis(e.target.value)}
            className="h-9 sm:h-10 md:h-11 text-xs sm:text-sm"
            disabled={isLoading}
          />
          <p className="text-[10px] sm:text-xs text-slate-600">
            What is your main diagnosis based on the patient's presentation?
          </p>
        </div>

        <Separator />

        {/* Management Plan */}
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="management-plan" className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2">
            <Pill className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
            Management Plan (Optional)
          </Label>
          <Textarea
            id="management-plan"
            placeholder={`Enter each step on a new line, e.g.\nIV Iron Sucrose as per Ganzoni formula\nDietary counselling for iron-rich foods\nRepeat Hb after 3 weeks`}
            value={managementPlan}
            onChange={(e) => setManagementPlan(e.target.value)}
            className="min-h-[100px] sm:min-h-[120px] resize-none text-xs sm:text-sm font-mono"
            disabled={isLoading}
          />
          <p className="text-[10px] sm:text-xs text-slate-500">
            One step per line. Leave blank if you haven&apos;t decided yet.
          </p>
        </div>

        {/* Warning if no tests */}
        {!hasResults && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-amber-900">
                <p className="font-medium mb-1">No test results available</p>
                <p className="text-amber-800">
                  Consider ordering diagnostic tests before submitting.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-3 sm:pt-4">
          <Button
            onClick={handleSubmit}
            disabled={!primaryDiagnosis.trim() || isLoading}
            className="bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10 shadow-md min-w-[160px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Send className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Generate Feedback
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
