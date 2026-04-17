"use client"

import { useState, useEffect, useRef } from "react"
import { formatPatientAge } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AIPatientChat } from "./ai-patient-chat"
import { TestOrdering } from "./test-ordering"
import { DiagnosisSubmission } from "./diagnosis-submission"
import { CaseFeedback } from "./case-feedback"
import { CaseSidebar } from "./case-sidebar"
import { evaluateCase } from "@/app/actions/evaluate"
import { extractHistoryFacts } from "@/lib/extract-history-facts"
import {
  MessageSquare,
  FlaskConical,
  Stethoscope,
  X,
  Info,
  Loader2,
  CheckCircle2,
  Brain,
  User,
  Award,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface CaseInteractionProps {
  caseData: any
  onExit: () => void
}

// ─── History Coverage Heuristic ─────────────────────────────────────────────
function computeHistoryCoverage(chatHistory: any[]): {
  symptomsExplored: boolean
  durationAsked: boolean
  associatedSymptomsAsked: boolean
  redFlagsChecked: boolean
  score: number
} {
  let symptomsExplored = false
  let durationAsked = false
  let associatedSymptomsAsked = false
  let redFlagsChecked = false

  let partialPoints = 0
  let fullPoints = 0

  chatHistory.filter((m) => m.role === "user").forEach((m) => {
    const text = m.content.toLowerCase()
    const isSpecific = /how|when|describe|frequency|how many|many times|what color|what colour|amount/.test(text) || text.length > 25

    if (/symptom|complain|problem|feel|bother|tell me|what happen|vomit|diarrhea|stool|motion|pain|fever/.test(text)) {
      symptomsExplored = true
      if (isSpecific) fullPoints++; else partialPoints++
    }
    if (/how long|since when|when did|duration|days|week|start|begin|onset/.test(text)) {
      durationAsked = true
      if (isSpecific) fullPoints++; else partialPoints++
    }
    if (/urine|pee|wet|thirst|drink|eat|appetite|weight|weak|dizzy|seizure|conscious|rash|fever|temperature/.test(text)) {
      associatedSymptomsAsked = true
      if (isSpecific) fullPoints++; else partialPoints++
    }
    if (/blood in stool|bloody|black stool|bilious|green vomit|seizure|unconscious|dehydration|sunken|skin turgor|no urine|not pee/.test(text)) {
      redFlagsChecked = true
      fullPoints++
    }
  })

  const maxScore = [symptomsExplored, durationAsked, associatedSymptomsAsked, redFlagsChecked].filter(Boolean).length
  const score = Math.min(maxScore, fullPoints + partialPoints * 0.5)

  return { symptomsExplored, durationAsked, associatedSymptomsAsked, redFlagsChecked, score }
}

// ─── Adaptive Nudge ──────────────────────────────────────────────────────────
function getAdaptiveNudge(coverage: ReturnType<typeof computeHistoryCoverage>, tab: string): string | null {
  if (tab !== "chat") return null
  if (!coverage.durationAsked) return "You haven't explored symptom duration — this is often critical for narrowing the differential."
  if (!coverage.redFlagsChecked) return "You haven't checked for red flags (blood in stool, bilious vomiting, dehydration signs) — these change management."
  if (!coverage.associatedSymptomsAsked) return "Consider asking about associated symptoms: urine output, appetite, fever pattern."
  return null
}

type TabValue = "chat" | "tests" | "diagnosis"

const STEP_META = [
  {
    value: "chat" as TabValue,
    step: 1,
    label: "Interview",
    hint: "Take focused history",
    icon: MessageSquare,
    modeLabel: "History taking mode",
    modeSub: "Identify key symptoms before ordering tests",
    modePill: "bg-brand-50 text-brand-600 border-brand-200",
    transitionMsg: "You've formed initial observations. Now validate your hypotheses with targeted investigations.",
  },
  {
    value: "tests" as TabValue,
    step: 2,
    label: "Tests",
    hint: "Order targeted investigations",
    icon: FlaskConical,
    modeLabel: "Investigation mode",
    modeSub: "Validate your hypotheses with targeted investigations",
    modePill: "bg-violet-50 text-violet-700 border-violet-200",
    transitionMsg: "Based on your findings, commit to a diagnosis and outline your management plan.",
  },
  {
    value: "diagnosis" as TabValue,
    step: 3,
    label: "Diagnosis",
    hint: "Submit diagnosis & plan",
    icon: Stethoscope,
    modeLabel: "Final decision",
    modeSub: "Commit to a diagnosis you can justify",
    modePill: "bg-orange-50 text-orange-700 border-orange-200",
    transitionMsg: "",
  },
]

export function CaseInteraction({ caseData, onExit }: CaseInteractionProps) {
  const caseId = (caseData as any).id || caseData.patient.name.toLowerCase().replace(/\s+/g, "-")
  const STORAGE_KEY = `medikarya-case-storage-${caseId}`

  const [isInitialized, setIsInitialized] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>("chat")
  const [orderedTests, setOrderedTests] = useState<any[]>([])
  const [testResults, setTestResults] = useState<any[]>([])
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [diagnosisSubmitted, setDiagnosisSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<any>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [historyGathered, setHistoryGathered] = useState<string[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false)
  const [softWarning, setSoftWarning] = useState<string | null>(null)
  const [adaptiveNudge, setAdaptiveNudge] = useState<string | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)

  // ─── Restore from localStorage ──────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.activeTab) setActiveTab(parsed.activeTab)
        if (parsed.orderedTests) setOrderedTests(parsed.orderedTests)
        if (parsed.testResults) setTestResults(parsed.testResults)
        if (parsed.chatHistory) {
          const unique = parsed.chatHistory.filter((msg: any, index: number, self: any[]) =>
            index === self.findIndex((m: any) => m.id === msg.id)
          )
          setChatHistory(unique)
        }
        if (parsed.diagnosisSubmitted) setDiagnosisSubmitted(parsed.diagnosisSubmitted)
        if (parsed.feedback) setFeedback(parsed.feedback)
        if (parsed.startTime) setStartTime(parsed.startTime)
        else setStartTime(Date.now())
        if (parsed.historyGathered) setHistoryGathered(parsed.historyGathered)
      } else {
        setStartTime(Date.now())
      }
    } catch (e) {
      console.error("Failed to load case progress", e)
      setStartTime(Date.now())
    } finally {
      setIsInitialized(true)
    }
  }, [STORAGE_KEY])

  // ─── Persist to localStorage ─────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized) return
    try {
      const sanitizedOrderedTests = orderedTests.map((test) => {
        const { icon, ...rest } = test
        return rest
      })
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeTab,
          orderedTests: sanitizedOrderedTests,
          testResults,
          chatHistory,
          diagnosisSubmitted,
          feedback,
          startTime,
          historyGathered,
          lastSaved: new Date().toISOString(),
        })
      )
    } catch (e) {
      console.error("Failed to save case progress", e)
    }
  }, [activeTab, orderedTests, testResults, chatHistory, diagnosisSubmitted, feedback, startTime, historyGathered, isInitialized, STORAGE_KEY])

  // ─── Coverage & nudge ───────────────────────────────────────────────────
  const coverage = computeHistoryCoverage(chatHistory)
  const testsAdvisable = coverage.score >= 2
  const diagnosisAdvisable = coverage.score >= 3 && testResults.length >= 1

  useEffect(() => {
    setAdaptiveNudge(getAdaptiveNudge(coverage, activeTab))
  }, [chatHistory, activeTab])

  // ─── Tab navigation ─────────────────────────────────────────────────────
  const handleTabChange = (newTab: TabValue) => {
    if (newTab === activeTab) return
    setSoftWarning(null)

    if (newTab === "tests" && !testsAdvisable) {
      setSoftWarning("You're ordering tests with limited history. This may reduce your diagnostic accuracy and overall score.")
    }
    if (newTab === "diagnosis" && !diagnosisAdvisable) {
      if (testResults.length === 0) {
        setSoftWarning("Diagnosis submitted without investigation. Your reasoning will be scored against available evidence.")
      } else if (coverage.score < 3) {
        setSoftWarning("Your history is incomplete. A stronger clinical picture would support a more confident diagnosis.")
      }
    }
    setActiveTab(newTab)
  }

  // ─── Test ordering ──────────────────────────────────────────────────────
  const handleTestOrder = async (test: any) => {
    if (orderedTests.some((t) => t.id === test.id || t.name === test.name)) return
    const newTest = {
      ...test,
      _uid: Date.now(),
      orderedAt: new Date().toISOString(),
      status: "processing",
    }
    setOrderedTests((prev) => [...prev, newTest])

    setTimeout(async () => {
      try {
        const response = await fetch("/api/tests/generate-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: newTest, caseData: { ...caseData, id: caseId }, chatHistory }),
        })
        if (!response.ok) throw new Error("Failed to generate test results")
        const data = await response.json()
        const result = {
          ...data.results,
          id: Date.now(),
          testId: newTest.id,
          testName: newTest.name,
          category: newTest.category,
          completedAt: new Date().toISOString(),
        }
        setTestResults((prev) => [...prev, result])
        setOrderedTests((prev) => prev.map((t) => (t._uid === newTest._uid ? { ...t, status: "completed" } : t)))
      } catch {
        setOrderedTests((prev) => prev.map((t) => (t._uid === newTest._uid ? { ...t, status: "failed" } : t)))
      }
    }, 2000)
  }

  // ─── Test removal ────────────────────────────────────────────────────────
  const handleTestRemove = (testId: string) => {
    setOrderedTests((prev) => prev.filter((t) => t.id !== testId && t._uid !== testId))
  }

  // ─── Diagnosis submission ────────────────────────────────────────────────
  const handleDiagnosisSubmit = async (diagnosis: any) => {
    setIsEvaluating(true)
    setDiagnosisSubmitted(true)
    try {
      const timeTakenSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
      const sanitizedOrderedTests = orderedTests.map(({ icon, ...rest }) => rest)
      const aiFeedback = await evaluateCase(diagnosis, sanitizedOrderedTests, chatHistory, caseData, timeTakenSeconds)
      setFeedback(aiFeedback)
    } catch (error) {
      console.error("Evaluation failed", error)
      setFeedback({
        correctDiagnosis: caseData.patient.final_diagnosis,
        studentDiagnosis: diagnosis.primaryDiagnosis,
        isCorrect: false,
        score: 0,
        feedback: {
          strengths: ["Evaluation not available"],
          improvements: ["Please check internet connection"],
          testingEfficiency: { appropriateTests: 0, unnecessaryTests: 0, missedTests: [] },
        },
      })
    } finally {
      setIsEvaluating(false)
    }
  }

  // ─── Chat message handler ────────────────────────────────────────────────
  const handleChatMessage = (message: any) => {
    setChatHistory((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev
      return [...prev, message]
    })
    // Extract facts from AI patient responses only
    if (message.role === "assistant") {
      const newFacts = extractHistoryFacts(message.content)
      if (newFacts.length > 0) {
        setHistoryGathered((prev) => {
          const combined = [...prev, ...newFacts]
          // Deduplicate by exact string
          return Array.from(new Set(combined)).slice(0, 15)
        })
      }
    }
  }

  // ─── Feedback screen ─────────────────────────────────────────────────────
  if (diagnosisSubmitted && feedback) {
    return (
      <CaseFeedback
        feedback={feedback}
        caseData={caseData}
        orderedTests={orderedTests}
        onExit={onExit}
        onReset={() => {
          try {
            localStorage.removeItem(STORAGE_KEY)
            window.location.reload()
          } catch {
            window.location.reload()
          }
        }}
      />
    )
  }

  const activeStepMeta = STEP_META.find((s) => s.value === activeTab)!
  const caseObjective =
    caseData.objective ||
    `Evaluate a ${formatPatientAge(caseData.patient.age)} ${caseData.patient.gender.toLowerCase()} presenting with ${caseData.patient.chiefComplaint.toLowerCase()}. Identify the underlying diagnosis, order appropriate investigations, and outline a management plan.`

  const patientInitials = caseData.patient.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div className="h-[52px] flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 flex items-center px-3 gap-2 z-50 shadow-sm">

        {/* Patient chip */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          {/* Mobile: patient info sheet trigger — whole chip is tappable */}
          <Sheet open={isPatientInfoOpen} onOpenChange={setIsPatientInfoOpen}>
            <SheetTrigger asChild>
              <button
                className="lg:hidden flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                aria-label="View patient information"
              >
                {/* Avatar circle */}
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                  {patientInitials}
                </div>
                {/* Name + label */}
                <div className="min-w-0 text-left">
                  <p className="font-semibold text-slate-900 text-xs leading-tight truncate max-w-[90px]">
                    {caseData.patient.name.split(" ")[0]}
                  </p>
                  <p className="text-[10px] text-brand-500 leading-tight">Patient info ›</p>
                </div>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-2xl overflow-hidden flex flex-col">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="h-1 w-10 rounded-full bg-slate-200" />
              </div>
              {/* Sheet header */}
              <SheetHeader className="px-4 pb-3 border-b border-slate-100 flex-shrink-0">
                <SheetTitle className="text-left text-base">Patient Record</SheetTitle>
              </SheetHeader>
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto" data-lenis-prevent>
                <CaseSidebar
                  patient={caseData.patient}
                  activeTab={activeTab}
                  historyGathered={historyGathered}
                  orderedTests={orderedTests}
                  coverageScore={coverage.score}
                  isCollapsed={false}
                  onToggleCollapse={() => {}}
                  mobileLayout={true}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop: avatar + name + meta */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{patientInitials}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm leading-tight">{caseData.patient.name}</p>
              <p className="text-[11px] text-slate-400 leading-tight">
                {formatPatientAge(caseData.patient.age).replace(/ old/g, "")} · {caseData.patient.gender}
                {caseData.patient.mrn && ` · ${caseData.patient.mrn}`}
              </p>
            </div>
          </div>
        </div>

        {/* Flex spacer */}
        <div className="flex-1" />

        {/* ── Step progress indicator — tablet and above only ─────────── */}
        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
          {STEP_META.map((step, idx) => {
            const StepIcon = step.icon
            const isActive = activeTab === step.value
            const isCompleted =
              (step.value === "chat" && chatHistory.filter((m) => m.role === "user").length > 0 && activeTab !== "chat") ||
              (step.value === "tests" && orderedTests.length > 0 && activeTab === "diagnosis")

            return (
              <div key={step.value} className="flex items-center gap-1">
                <button
                  onClick={() => handleTabChange(step.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border",
                    isActive
                      ? "bg-brand-600 text-white border-transparent shadow-sm"
                      : isCompleted
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" />
                  )}
                  {step.label}
                </button>
                {idx < STEP_META.length - 1 && (
                  <span className="text-slate-300 text-xs">›</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Flex spacer */}
        <div className="flex-1" />

        {/* XP badge + Exit */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0.5 hidden xs:flex">
            <Award className="h-3 w-3 mr-1" />
            +{caseData.xpReward} XP
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="hover:bg-red-50 hover:text-red-600 h-7 px-2 text-xs gap-1"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </Button>
        </div>
      </div>

      {/* ── BODY: Sidebar + Main Panel ────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Sidebar — desktop only */}
        <div className="hidden lg:flex">
          <CaseSidebar
            patient={caseData.patient}
            activeTab={activeTab}
            historyGathered={historyGathered}
            orderedTests={orderedTests}
            coverageScore={coverage.score}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          />
        </div>

        {/* ── MAIN PANEL ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Objective strip — desktop/tablet only; bottom tab bar covers this on mobile */}
          <div className="hidden md:flex flex-shrink-0 bg-white border-b border-slate-100 px-4 h-9 items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <p className="text-[11px] text-slate-500 truncate">{caseObjective}</p>
          </div>

          {/* Warning banner (one at a time) — appears below objective */}
          {softWarning && (
            <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Info className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              <p className="text-[11px] text-amber-800 flex-1">{softWarning}</p>
              <button
                onClick={() => setSoftWarning(null)}
                className="text-amber-500 hover:text-amber-700 flex-shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Mode pill row — desktop/tablet only; too crowded on mobile */}
          <div className="hidden md:flex flex-shrink-0 px-4 pt-2 pb-1 items-center gap-2 bg-white border-b border-slate-100">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                activeStepMeta.modePill
              )}
            >
              <activeStepMeta.icon className="h-3 w-3" />
              {activeStepMeta.modeLabel}
            </span>
            <span className="text-[11px] text-slate-400">{activeStepMeta.modeSub}</span>
          </div>

          {/* Step content — flex-1, scrolls internally */}
          {/* pb-[60px] on mobile leaves room for the bottom tab bar */}
          <div className="flex-1 min-h-0 overflow-hidden bg-white">
            {activeTab === "chat" && (
              <AIPatientChat
                caseData={caseData}
                onMessageSent={handleChatMessage}
                chatHistory={chatHistory}
                coverage={coverage}
                adaptiveNudge={adaptiveNudge}
              />
            )}
            {activeTab === "tests" && (
              <TestOrdering
                orderedTests={orderedTests}
                testResults={testResults}
                onOrderTest={handleTestOrder}
                onRemoveTest={handleTestRemove}
                onProceedToDiagnosis={() => handleTabChange("diagnosis")}
                caseData={caseData}
                hasLimitedHistory={!testsAdvisable}
              />
            )}
            {activeTab === "diagnosis" && (
              <DiagnosisSubmission
                orderedTests={orderedTests}
                testResults={testResults}
                chatHistory={chatHistory}
                onSubmit={handleDiagnosisSubmit}
                isLoading={isEvaluating}
                coverageScore={coverage.score}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR (hidden on md+) ───────────────────────── */}
      <div className="md:hidden flex-shrink-0 bg-white border-t border-slate-200 flex items-stretch h-[60px] z-40 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        {STEP_META.map((step) => {
          const StepIcon = step.icon
          const isActive = activeTab === step.value
          const isCompleted =
            (step.value === "chat" && chatHistory.filter((m) => m.role === "user").length > 0 && activeTab !== "chat") ||
            (step.value === "tests" && orderedTests.length > 0 && activeTab === "diagnosis")
          const testsBadge = step.value === "tests" && orderedTests.length > 0

          return (
            <button
              key={step.value}
              onClick={() => handleTabChange(step.value)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors",
                isActive ? "text-brand-600" : "text-slate-400"
              )}
            >
              {/* Active indicator bar at top */}
              {isActive && (
                <span className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-brand-600 rounded-b-full" />
              )}
              <div className="relative">
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <StepIcon className={cn("h-5 w-5", isActive ? "text-brand-600" : "text-slate-400")} />
                )}
                {testsBadge && (
                  <span className="absolute -top-1 -right-1.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {orderedTests.length}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-medium leading-none", isActive ? "text-brand-600" : "text-slate-400")}>
                {step.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Evaluation overlay ─────────────────────────────────────────────── */}
      {isEvaluating && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 opacity-20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Reviewing your case</h3>
              <p className="text-sm text-slate-500">
                Scoring your history, investigations,
                <br />and final diagnosis…
              </p>
            </div>
            <div className="space-y-2 text-left">
              {["Reviewing history taken", "Checking investigation choices", "Evaluating diagnosis", "Assessing management plan"].map(
                (step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin text-brand-400 flex-shrink-0" style={{ animationDelay: `${i * 0.3}s` }} />
                    {step}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
