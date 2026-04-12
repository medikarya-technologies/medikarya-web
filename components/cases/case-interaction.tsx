"use client"

import { useState, useEffect, useRef } from "react"
import { formatPatientAge } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AIPatientChat } from "./ai-patient-chat"
import { TestOrdering } from "./test-ordering"
import { DiagnosisSubmission } from "./diagnosis-submission"
import { CaseFeedback } from "./case-feedback"
import { evaluateCase } from "@/app/actions/evaluate"
import { PatientPresentation } from "./patient-presentation"
import {
  MessageSquare,
  FlaskConical,
  Stethoscope,
  X,
  User,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Lock,
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
// Checks message content for clinical domain coverage and SPECIFICITY weighting
// Returns a score 0–4 based on what the student has explored. If partial specificity, awards 0.5 points.
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
    
    // Quality heuristic: Is the question specific? (Open-ended, sufficient length, medical/quantity keywords)
    const isSpecific = /how|when|describe|frequency|how many|many times|what color|what colour|amount/.test(text) || text.length > 25

    if (/symptom|complain|problem|feel|bother|tell me|what happen|vomit|diarrhea|stool|motion|pain|fever/.test(text)) {
      symptomsExplored = true
      if (isSpecific) fullPoints++; else partialPoints++;
    }
    if (/how long|since when|when did|duration|days|week|start|begin|onset/.test(text)) {
      durationAsked = true
      if (isSpecific) fullPoints++; else partialPoints++;
    }
    if (/urine|pee|wet|thirst|drink|eat|appetite|weight|weak|dizzy|seizure|conscious|rash|fever|temperature/.test(text)) {
      associatedSymptomsAsked = true
      if (isSpecific) fullPoints++; else partialPoints++;
    }
    // Red flags usually are specific by nature
    if (/blood in stool|bloody|black stool|bilious|green vomit|seizure|unconscious|dehydration|sunken|skin turgor|no urine|not pee/.test(text)) {
      redFlagsChecked = true
      fullPoints++; // Always full points for asking about red flags
    }
  })

  const maxScore = [symptomsExplored, durationAsked, associatedSymptomsAsked, redFlagsChecked].filter(Boolean).length
  const score = Math.min(maxScore, fullPoints + (partialPoints * 0.5))

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
    color: "blue",
    bgActive: "bg-blue-600",
    bgMuted: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    ring: "ring-blue-300",
    transitionMsg: "You've formed initial observations. Now validate your hypotheses with targeted investigations.",
  },
  {
    value: "tests" as TabValue,
    step: 2,
    label: "Tests",
    hint: "Order targeted investigations",
    icon: FlaskConical,
    color: "purple",
    bgActive: "bg-purple-600",
    bgMuted: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    ring: "ring-purple-300",
    transitionMsg: "Based on your findings, commit to a diagnosis and outline your management plan.",
  },
  {
    value: "diagnosis" as TabValue,
    step: 3,
    label: "Diagnosis",
    hint: "Submit diagnosis & plan",
    icon: Stethoscope,
    color: "emerald",
    bgActive: "bg-emerald-600",
    bgMuted: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    ring: "ring-emerald-300",
    transitionMsg: "",
  },
]

export function CaseInteraction({ caseData, onExit }: CaseInteractionProps) {
  const caseId = (caseData as any).id || caseData.patient.name.toLowerCase().replace(/\s+/g, '-')
  const STORAGE_KEY = `medikarya-case-storage-${caseId}`

  const [isInitialized, setIsInitialized] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>("chat")
  const [orderedTests, setOrderedTests] = useState<any[]>([])
  const [testResults, setTestResults] = useState<any[]>([])
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [diagnosisSubmitted, setDiagnosisSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<any>(null)
  const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)

  // Transition banner
  const [transitionMsg, setTransitionMsg] = useState<string | null>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hint collapsed state
  const [hintOpen, setHintOpen] = useState(false)

  // Load from storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.activeTab) setActiveTab(parsed.activeTab)
        if (parsed.orderedTests) setOrderedTests(parsed.orderedTests)
        if (parsed.testResults) setTestResults(parsed.testResults)
        if (parsed.chatHistory) {
          const uniqueHistory = parsed.chatHistory.filter((msg: any, index: number, self: any[]) =>
            index === self.findIndex((m: any) => m.id === msg.id)
          )
          setChatHistory(uniqueHistory)
        }
        if (parsed.diagnosisSubmitted) setDiagnosisSubmitted(parsed.diagnosisSubmitted)
        if (parsed.feedback) setFeedback(parsed.feedback)
        if (parsed.startTime) {
          setStartTime(parsed.startTime)
        } else {
          setStartTime(Date.now())
        }
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

  // Save to storage on change
  useEffect(() => {
    if (!isInitialized) return
    try {
      const sanitizedOrderedTests = orderedTests.map(test => {
        const { icon, ...rest } = test
        return rest
      })
      const stateToSave = {
        activeTab, orderedTests: sanitizedOrderedTests,
        testResults, chatHistory, diagnosisSubmitted, feedback, startTime,
        lastSaved: new Date().toISOString()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch (e) {
      console.error("Failed to save case progress", e)
    }
  }, [activeTab, orderedTests, testResults, chatHistory, diagnosisSubmitted, feedback, startTime, isInitialized, STORAGE_KEY])

  // ─── Soft gate logic ─────────────────────────────────────────────────────
  const coverage = computeHistoryCoverage(chatHistory)
  // Tests: advised after score >= 2, allowed always (with warning if < 2)
  const testsAdvisable = coverage.score >= 2
  // Diagnosis: advised after score >= 3 AND >= 1 test result, allowed always (with warning)
  const diagnosisAdvisable = coverage.score >= 3 && testResults.length >= 1

  // Soft warning when switching prematurely
  const [softWarning, setSoftWarning] = useState<string | null>(null)

  const handleTabChange = (newTab: TabValue) => {
    if (newTab === activeTab) return

    // Clear any previous soft warning
    setSoftWarning(null)

    // Show transition message (from the step we're ENTERING)
    const enteringStep = STEP_META.find(s => s.value === newTab)
    const leavingStep = STEP_META.find(s => s.value === activeTab)
    const msg = leavingStep?.transitionMsg || null

    if (msg) {
      setTransitionMsg(msg)
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = setTimeout(() => setTransitionMsg(null), 5000)
    }

    // Soft warnings for premature progression
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

  const handleTestOrder = async (test: any) => {
    if (orderedTests.some(t => t.id === test.id || t.name === test.name)) return
    const newTest = {
      ...test,
      _uid: Date.now(),
      orderedAt: new Date().toISOString(),
      status: "processing"
    }
    setOrderedTests(prev => [...prev, newTest])

    setTimeout(async () => {
      try {
        const response = await fetch("/api/tests/generate-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test: newTest,
            caseData: { ...caseData, id: caseId },
            chatHistory
          }),
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
        setTestResults(prev => [...prev, result])
        setOrderedTests(prev =>
          prev.map(t => t._uid === newTest._uid ? { ...t, status: "completed" } : t)
        )
      } catch (error) {
        console.error("Error getting test results:", error)
        setOrderedTests(prev =>
          prev.map(t => t._uid === newTest._uid ? { ...t, status: "failed" } : t)
        )
      }
    }, 2000)
  }

  const [isEvaluating, setIsEvaluating] = useState(false)

  const handleDiagnosisSubmit = async (diagnosis: any) => {
    setIsEvaluating(true)
    setDiagnosisSubmitted(true)
    try {
      const timeTakenSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
      const sanitizedOrderedTests = orderedTests.map(test => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { icon, ...rest } = test
        return rest
      })
      const aiFeedback = await evaluateCase(diagnosis, sanitizedOrderedTests, chatHistory, caseData, timeTakenSeconds)
      setFeedback(aiFeedback)
    } catch (error) {
      console.error("Evaluation failed", error)
      const fallback = await generateFeedback(diagnosis, orderedTests, chatHistory, caseData)
      setFeedback(fallback)
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleChatMessage = (message: any) => {
    setChatHistory(prev => {
      if (prev.some(m => m.id === message.id)) return prev
      return [...prev, message]
    })
  }

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
          } catch (e) {
            console.error("Failed to reset case", e)
            window.location.reload()
          }
        }}
      />
    )
  }

  const activeStepMeta = STEP_META.find(s => s.value === activeTab)!
  const adaptiveNudge = getAdaptiveNudge(coverage, activeTab)

  // Case objective from caseData (derive from chiefComplaint + category)
  const caseObjective = caseData.objective ||
    `Evaluate a ${formatPatientAge(caseData.patient.age)} ${caseData.patient.gender.toLowerCase()} presenting with ${caseData.patient.chiefComplaint.toLowerCase()}. Identify the underlying diagnosis, order appropriate investigations, and outline a management plan.`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Mobile Patient Info */}
              <Sheet open={isPatientInfoOpen} onOpenChange={setIsPatientInfoOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden h-8 w-8 p-0 flex-shrink-0">
                    <Info className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
                  <SheetHeader className="px-4 py-3 border-b">
                    <SheetTitle>Patient Information</SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto h-[calc(100vh-60px)] p-4">
                    <PatientPresentation patient={caseData.patient} />
                  </div>
                </SheetContent>
              </Sheet>

              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900 text-xs sm:text-sm md:text-base truncate">{caseData.patient.name}</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                  {formatPatientAge(caseData.patient.age).replace(/ old/g, '')} • {caseData.patient.gender}
                  <span className="hidden md:inline"> • {caseData.patient.chiefComplaint}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 hidden xs:flex">
                +{caseData.xpReward} XP
              </Badge>
              <Button
                variant="ghost" size="sm" onClick={onExit}
                className="hover:bg-red-50 hover:text-red-600 h-7 sm:h-8 px-1.5 sm:px-3"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                <span className="hidden sm:inline text-xs sm:text-sm">Exit</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="container mx-auto px-2 sm:px-3 md:px-4 py-2 sm:py-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">

          {/* Left Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20">
              <PatientPresentation patient={caseData.patient} />
            </div>
          </div>

          {/* Main Interaction Area */}
          <div className="lg:col-span-2 min-w-0 space-y-3">

            {/* ── Case Objective Banner ─────────────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-start gap-3">
              <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Case Objective</p>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{caseObjective}</p>
              </div>
            </div>

            {/* ── Workflow Step Bar ─────────────────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Clinical Workflow</p>
              </div>
              <div className="grid grid-cols-3 gap-0 px-3 pb-3">
                {STEP_META.map((step, idx) => {
                  const StepIcon = step.icon
                  const isActive = activeTab === step.value

                  // Determine step state for visual
                  const isCompleted =
                    (step.value === "chat" && chatHistory.filter(m => m.role === "user").length > 0 && activeTab !== "chat") ||
                    (step.value === "tests" && orderedTests.length > 0 && activeTab === "diagnosis")

                  // Warn state: if not advisable but user is here or about to go
                  const showWarningDot =
                    (step.value === "tests" && !testsAdvisable && activeTab === "tests") ||
                    (step.value === "diagnosis" && !diagnosisAdvisable && activeTab === "diagnosis")

                  return (
                    <div key={step.value} className="flex items-center">
                      <button
                        onClick={() => handleTabChange(step.value)}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl transition-all duration-200 relative group",
                          isActive
                            ? `${step.bgActive} text-white shadow-md`
                            : "hover:bg-slate-50 text-slate-500"
                        )}
                      >
                        {/* Step number pill */}
                        <div className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all",
                          isActive
                            ? "bg-white/20 text-white"
                            : isCompleted
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                        )}>
                          {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.step}
                        </div>

                        {/* Icon */}
                        <StepIcon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")} />

                        {/* Label */}
                        <div className="text-center">
                          <p className={cn("text-[10px] sm:text-xs font-semibold leading-tight", isActive ? "text-white" : "text-slate-600")}>
                            {step.label}
                          </p>
                          <p className={cn("text-[9px] leading-tight hidden sm:block", isActive ? "text-white/70" : "text-slate-400")}>
                            {step.hint}
                          </p>
                        </div>

                        {/* Warning dot */}
                        {showWarningDot && (
                          <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                        )}

                        {/* Test count badge */}
                        {step.value === "tests" && orderedTests.length > 0 && (
                          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[9px] bg-purple-600 text-white border-0">
                            {orderedTests.length}
                          </Badge>
                        )}
                      </button>

                      {/* Connector arrow */}
                      {idx < STEP_META.length - 1 && (
                        <div className="flex items-center justify-center w-5 flex-shrink-0">
                          <div className={cn(
                            "h-px flex-1 transition-all duration-500",
                            activeTab === STEP_META[idx + 1].value || (idx === 0 && activeTab === "diagnosis")
                              ? "bg-slate-400"
                              : "bg-slate-200"
                          )} />
                          <svg className="h-3 w-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 6 10">
                            <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Progress awareness bar */}
              <div className={cn(
                "px-4 py-2 border-t text-xs flex items-center gap-2",
                activeTab === "chat" ? "bg-blue-50 border-blue-100" :
                  activeTab === "tests" ? "bg-purple-50 border-purple-100" :
                    "bg-emerald-50 border-emerald-100"
              )}>
                {activeTab === "chat" && (
                  <>
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={cn(
                          "h-1.5 w-5 rounded-full transition-all",
                          i < coverage.score ? "bg-blue-500" : "bg-blue-200"
                        )} />
                      ))}
                    </div>
                    <span className={cn(
                      "font-medium",
                      coverage.score >= 3 ? "text-blue-700" :
                        coverage.score >= 2 ? "text-blue-600" : "text-slate-500"
                    )}>
                      {coverage.score === 0 && "Start taking history from the patient"}
                      {coverage.score === 1 && "Good start — explore more clinical domains"}
                      {coverage.score === 2 && "You may proceed to tests, but more history is recommended"}
                      {coverage.score === 3 && "Strong history — you're ready to investigate"}
                      {coverage.score === 4 && "Thorough history — excellent clinical reasoning"}
                    </span>
                  </>
                )}
                {activeTab === "tests" && (
                  <>
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className={cn(
                          "h-1.5 w-5 rounded-full transition-all",
                          i < testResults.length ? "bg-purple-500" : "bg-purple-200"
                        )} />
                      ))}
                    </div>
                    <span className="text-purple-700 font-medium">
                      {testResults.length === 0 && "Order investigations to validate your clinical hypothesis"}
                      {testResults.length === 1 && "1 result available — order more if needed before diagnosing"}
                      {testResults.length >= 2 && `${testResults.length} results available — ready to diagnose`}
                    </span>
                  </>
                )}
                {activeTab === "diagnosis" && (
                  <span className="text-emerald-700 font-medium">
                    Commit to your diagnosis. Justify with your history and test findings.
                  </span>
                )}
              </div>
            </div>

            {/* ── UI Signals Banner (Priority: Warning > Hint > Progress) ─────────────────── */}
            {softWarning ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-900 font-medium">{softWarning}</p>
                  <p className="text-amber-700 text-xs mt-0.5">You may proceed — this will be reflected in your evaluation.</p>
                </div>
                <button onClick={() => setSoftWarning(null)} className="flex-shrink-0 text-amber-500 hover:text-amber-700 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : adaptiveNudge ? (
              <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <button
                  onClick={() => setHintOpen(h => !h)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <Lightbulb className={cn("h-4 w-4 flex-shrink-0", hintOpen ? "text-amber-500" : "text-amber-400")} />
                  <span className="text-sm font-medium text-slate-700 flex-1">Clinical Hint Available</span>
                  <span className="text-xs text-slate-400 mr-1">{hintOpen ? "hide" : "show"}</span>
                  {hintOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {hintOpen && (
                  <div className="px-4 pb-4 pt-0 border-t border-amber-100 bg-amber-50 animate-in fade-in duration-200">
                    <p className="text-sm text-amber-900 mt-3 leading-relaxed">{adaptiveNudge}</p>
                  </div>
                )}
              </div>
            ) : transitionMsg ? (
              <div className="bg-slate-800 text-white rounded-xl px-4 py-3 flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-white font-medium">{transitionMsg}</p>
                </div>
                <button onClick={() => setTransitionMsg(null)} className="flex-shrink-0 text-white/50 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3 text-sm shadow-sm animate-in fade-in duration-500">
                <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <p className="text-slate-500 font-medium">
                  {activeTab === "chat" ? "Continue asking questions to build clinical context." :
                   activeTab === "tests" ? "Order targeted investigations based on your hypothesis." :
                   "Review all findings and submit your final diagnosis."}
                </p>
              </div>
            )}

            {/* ── Mode Panel ───────────────────────────────────────── */}
            <Card className="bg-white border border-slate-200 shadow-lg overflow-hidden">

              {/* Mode-specific header band */}
              <div className={cn(
                "px-4 py-3 border-b flex items-center gap-3",
                activeTab === "chat" ? "bg-blue-50 border-blue-100" :
                  activeTab === "tests" ? "bg-purple-50 border-purple-100" :
                    "bg-emerald-50 border-emerald-100"
              )}>
                <div className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0",
                  activeTab === "chat" ? "bg-blue-600" :
                    activeTab === "tests" ? "bg-purple-600" :
                      "bg-emerald-600"
                )}>
                  {activeTab === "chat" && <MessageSquare className="h-4 w-4 text-white" />}
                  {activeTab === "tests" && <FlaskConical className="h-4 w-4 text-white" />}
                  {activeTab === "diagnosis" && <Stethoscope className="h-4 w-4 text-white" />}
                </div>
                <div>
                  <p className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    activeTab === "chat" ? "text-blue-800" :
                      activeTab === "tests" ? "text-purple-800" :
                        "text-emerald-800"
                  )}>
                    {activeTab === "chat" ? "History Taking Mode" :
                      activeTab === "tests" ? "Investigation Mode" :
                        "Final Decision"}
                  </p>
                  <p className={cn(
                    "text-[11px]",
                    activeTab === "chat" ? "text-blue-600" :
                      activeTab === "tests" ? "text-purple-600" :
                        "text-emerald-600"
                  )}>
                    {activeTab === "chat" && "Your goal: Identify key symptoms before ordering tests."}
                    {activeTab === "tests" && "Your goal: Validate your hypotheses with targeted investigations."}
                    {activeTab === "diagnosis" && "Your goal: Commit to a diagnosis you can justify."}
                  </p>
                </div>
              </div>

              {/* Tab content */}
              {activeTab === "chat" && (
                <AIPatientChat
                  caseData={caseData}
                  onMessageSent={handleChatMessage}
                  chatHistory={chatHistory}
                  coverage={coverage}
                />
              )}
              {activeTab === "tests" && (
                <TestOrdering
                  orderedTests={orderedTests}
                  testResults={testResults}
                  onOrderTest={handleTestOrder}
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
            </Card>


          </div>
        </div>
      </div>

      {/* ── Evaluation overlay ────────────────────────────────────────── */}
      {isEvaluating && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-emerald-500 opacity-20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-emerald-600 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Evaluating your performance</h3>
              <p className="text-sm text-slate-500">AI is analysing your history taking,<br />reasoning, and diagnosis…</p>
            </div>
            <div className="space-y-2 text-left">
              {[
                "Extracting clinical intents",
                "Scoring history coverage",
                "Reasoning through diagnosis",
                "Checking red flag safety",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500 flex-shrink-0" style={{ animationDelay: `${i * 0.3}s` }} />
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

async function generateFeedback(diagnosis: any, tests: any[], chatHistory: any[], caseData: any) {
  return {
    correctDiagnosis: caseData.patient.final_diagnosis,
    studentDiagnosis: diagnosis.primaryDiagnosis,
    isCorrect: false, score: 0,
    feedback: {
      strengths: ["Evaluation not available"],
      improvements: ["Please check internet connection"],
      testingEfficiency: { appropriateTests: 0, unnecessaryTests: 0, missedTests: [] }
    }
  }
}
