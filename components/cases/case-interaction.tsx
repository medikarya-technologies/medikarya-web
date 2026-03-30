"use client"

import { useState, useEffect } from "react"
import { formatPatientAge } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  AlertCircle,
  Info,
  Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface CaseInteractionProps {
  caseData: any
  onExit: () => void
}

export function CaseInteraction({ caseData, onExit }: CaseInteractionProps) {
  // Create a unique key for this case
  const caseId = (caseData as any).id || caseData.patient.name.toLowerCase().replace(/\s+/g, '-')
  const STORAGE_KEY = `medikarya-case-storage-${caseId}`

  // Initialize state from local storage or defaults
  // We use a function in useState to avoid accessing localStorage on server-side (though this is client component, safe to do in effect too)

  const [isInitialized, setIsInitialized] = useState(false)
  const [activeTab, setActiveTab] = useState("chat")
  const [orderedTests, setOrderedTests] = useState<any[]>([])
  const [testResults, setTestResults] = useState<any[]>([])
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [diagnosisSubmitted, setDiagnosisSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<any>(null)
  const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)

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
          // Deduplicate loaded history
          const uniqueHistory = parsed.chatHistory.filter((msg: any, index: number, self: any[]) =>
            index === self.findIndex((m: any) => m.id === msg.id)
          )
          setChatHistory(uniqueHistory)
        }
        if (parsed.diagnosisSubmitted) setDiagnosisSubmitted(parsed.diagnosisSubmitted)
        if (parsed.feedback) setFeedback(parsed.feedback)

        // Load or initialize startTime
        if (parsed.startTime) {
          setStartTime(parsed.startTime)
        } else {
          setStartTime(Date.now())
        }
      } else {
        // No saved case, initialize start time
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
      // Sanitize orderedTests to remove React components (icons) which cause serialization issues
      const sanitizedOrderedTests = orderedTests.map(test => {
        const { icon, ...rest } = test
        return rest
      })

      const stateToSave = {
        activeTab,
        orderedTests: sanitizedOrderedTests,
        testResults,
        chatHistory,
        diagnosisSubmitted,
        feedback,
        startTime,
        lastSaved: new Date().toISOString()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch (e) {
      console.error("Failed to save case progress", e)
    }
  }, [activeTab, orderedTests, testResults, chatHistory, diagnosisSubmitted, feedback, startTime, isInitialized, STORAGE_KEY])

  const handleTestOrder = async (test: any) => {
    // Prevent duplicate orders
    if (orderedTests.some(t => t.id === test.id || t.name === test.name)) {
      return
    }

    // Add test to ordered tests
    const newTest = {
      ...test,
      _uid: Date.now(),      // UI-only unique key — does NOT overwrite test.id
      orderedAt: new Date().toISOString(),
      status: "processing"
    }
    setOrderedTests(prev => [...prev, newTest])

    // Simulate test processing and get results
    setTimeout(async () => {
      try {
        const response = await fetch("/api/tests/generate-result", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            test: newTest,
            caseData: {
              ...caseData,
              id: caseId // Ensure ID is passed
            },
            chatHistory
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to generate test results")
        }

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

        // Update test status
        setOrderedTests(prev =>
          prev.map(t => t._uid === newTest._uid ? { ...t, status: "completed" } : t)
        )
      } catch (error) {
        console.error("Error getting test results:", error)
        setOrderedTests(prev =>
          prev.map(t => t._uid === newTest._uid ? { ...t, status: "failed" } : t)
        )
      }
    }, 2000) // Simulate processing time
  }

  const [isEvaluating, setIsEvaluating] = useState(false)

  const handleDiagnosisSubmit = async (diagnosis: any) => {
    setIsEvaluating(true)
    setDiagnosisSubmitted(true)

    try {
      // Calculate time taken in seconds
      const timeTakenSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

      // Sanitize orderedTests to remove React components (icons) before passing to server action
      const sanitizedOrderedTests = orderedTests.map(test => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { icon, ...rest } = test
        return rest
      })

      // API call to get AI feedback
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
      // Prevent duplicates based on ID
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-accent-50/30">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Mobile Patient Info Button */}
              <Sheet open={isPatientInfoOpen} onOpenChange={setIsPatientInfoOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="lg:hidden h-8 w-8 p-0 flex-shrink-0"
                  >
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

              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900 text-xs sm:text-sm md:text-base truncate">{caseData.patient.name}</h2>
                <p className="text-[10px] sm:text-xs text-slate-600 truncate">
                  {formatPatientAge(caseData.patient.age).replace(/ old/g, '')} • {caseData.patient.gender}
                  <span className="hidden md:inline"> • {caseData.patient.chiefComplaint}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Badge variant="outline" className="bg-brand-50 text-brand-700 border-brand-200 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 hidden xs:flex">
                +{caseData.xpReward} XP
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExit}
                className="hover:bg-red-50 hover:text-red-600 h-7 sm:h-8 px-1.5 sm:px-3"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                <span className="hidden sm:inline text-xs sm:text-sm">Exit</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-2 sm:px-3 md:px-4 py-2 sm:py-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {/* Left Sidebar - Patient Info - Hidden on mobile, shown in sheet */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20">
              <PatientPresentation patient={caseData.patient} />
            </div>
          </div>

          {/* Main Interaction Area */}
          <div className="lg:col-span-2 min-w-0">
            <Card className="bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="border-b border-slate-200 bg-slate-50/50">
                  <div className="overflow-x-auto scrollbar-hide">
                    <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none inline-flex min-w-full">
                      <TabsTrigger
                        value="chat"
                        className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-brand-600 rounded-none text-[11px] sm:text-xs md:text-sm whitespace-nowrap flex-1 sm:flex-none"
                      >
                        <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                        <span className="hidden xs:inline">Interview</span>
                        <span className="xs:hidden">Chat</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="tests"
                        className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-brand-600 rounded-none text-[11px] sm:text-xs md:text-sm whitespace-nowrap flex-1 sm:flex-none relative"
                      >
                        <FlaskConical className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                        <span className="hidden xs:inline">Tests</span>
                        <span className="xs:hidden">Tests</span>
                        {orderedTests.length > 0 && (
                          <Badge className="ml-0.5 sm:ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 rounded-full p-0 flex items-center justify-center text-[9px] sm:text-[10px] md:text-xs">
                            {orderedTests.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="diagnosis"
                        className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-brand-600 rounded-none text-[11px] sm:text-xs md:text-sm whitespace-nowrap flex-1 sm:flex-none"
                      >
                        <Stethoscope className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                        <span className="hidden xs:inline">Diagnosis</span>
                        <span className="xs:hidden">Dx</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <TabsContent value="chat" className="p-0 m-0">
                  <AIPatientChat
                    caseData={caseData}
                    onMessageSent={handleChatMessage}
                    chatHistory={chatHistory}
                  />
                </TabsContent>

                <TabsContent value="tests" className="p-0 m-0">
                  <TestOrdering
                    orderedTests={orderedTests}
                    testResults={testResults}
                    onOrderTest={handleTestOrder}
                    caseData={caseData}
                  />
                </TabsContent>

                <TabsContent value="diagnosis" className="p-0 m-0">
                  <DiagnosisSubmission
                    orderedTests={orderedTests}
                    testResults={testResults}
                    chatHistory={chatHistory}
                    onSubmit={handleDiagnosisSubmit}
                    isLoading={isEvaluating}
                  />
                </TabsContent>
              </Tabs>
            </Card>

            {/* Quick Tips */}
            <Card className="mt-3 sm:mt-4 bg-brand-50/50 border-brand-200">
              <div className="p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-brand-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-brand-900 min-w-0">
                  <p className="font-medium mb-1">Clinical Tip</p>
                  <p className="text-brand-800 leading-relaxed">
                    Start by taking a thorough history. Ask about the onset, duration, and characteristics of symptoms.
                    Order tests strategically based on your clinical suspicion.
                    {caseData.patient.investigations.specimen && (
                      <span className="block mt-1 font-medium text-brand-700">
                        Tip: For this case, the ideal specimen for analysis is {caseData.patient.investigations.specimen.toLowerCase()}.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      {/* Evaluation overlay — shown while 4-layer engine is running */}
      {isEvaluating && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-400 to-accent-500 opacity-20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center">
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
                  <Loader2 className="h-3 w-3 animate-spin text-brand-500 flex-shrink-0" style={{ animationDelay: `${i * 0.3}s` }} />
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

// Helper function to generate test results (will be replaced with API call)
async function generateTestResult(test: any, caseData: any) {
  // If the test has pre-defined results (from case JSON), return them
  if (test.results) {
    return {
      id: Date.now(),
      testId: test.id,
      testName: test.name,
      category: test.category,
      completedAt: new Date().toISOString(),
      results: test.results
    }
  }

  // Fallback: Generate generic results
  return {
    id: Date.now(),
    testId: test.id,
    testName: test.name,
    category: test.category,
    completedAt: new Date().toISOString(),
    results: {
      summary: `${test.name} completed`,
      values: [],
      interpretation: "Results within normal limits",
      criticalFindings: []
    }
  }
}

// Helper function to generate feedback manually based on rules -> REPLACED BY SERVER ACTION in handleDiagnosisSubmit
// Only keeping this as a type definition or fallback if needed, but primarily we use the API now.
async function generateFeedback(diagnosis: any, tests: any[], chatHistory: any[], caseData: any) {
  // Fallback / Placeholder if API fails generally handled in the component
  return {
    correctDiagnosis: caseData.patient.final_diagnosis,
    studentDiagnosis: diagnosis.primaryDiagnosis,
    isCorrect: false,
    score: 0,
    feedback: {
      strengths: ["Evaluation not available"],
      improvements: ["Please check internet connection"],
      testingEfficiency: {
        appropriateTests: 0,
        unnecessaryTests: 0,
        missedTests: []
      }
    }
  }
}
