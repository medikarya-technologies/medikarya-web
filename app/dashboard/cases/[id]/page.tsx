"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { PatientCard } from "@/components/cases/patient-card"
import { CaseInteraction } from "@/components/cases/case-interaction"
import { CaseFeedback } from "@/components/cases/case-feedback"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Loader2, 
  History,
  Award,
  Clock,
  RotateCcw,
  Compass,
  TriangleAlert
} from "lucide-react"
import { getCaseAttemptHistory, type CaseAttempt } from "@/app/actions/case-attempts"
import { getTourContext } from "@/app/actions/case-progress"
import { shouldAutoTour, tourSeen, type EncounterTourConfig } from "@/lib/tour/tour-storage"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AttemptHistory } from "@/components/cases/attempt-history"
import { PRIMARY_BUTTON, SECONDARY_BUTTON, StatePanel } from "@/components/dashboard/dashboard-ui"
import { useInProgress } from "@/components/cases/use-in-progress"
import { clearInProgress } from "@/lib/simulation/resume"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle } from "lucide-react"

// The briefing before a case. It reads what the encounter has saved each time it is shown, so coming back from
// the bedside offers "Resume" without a reload.
function Briefing({ caseId, caseData, isStarting, onStart }: { caseId: string; caseData: any; isStarting: boolean; onStart: () => void }) {
  const resume = useInProgress([caseId]).get(caseId)
  return (
    <PatientCard
      patient={caseData.patient}
      caseTitle={caseData.displayTitle || caseData.title}
      caseData={caseData}
      starting={isStarting}
      onStartCase={onStart}
      resume={resume}
      onStartOver={
        resume
          ? () => {
              clearInProgress(caseId)
              onStart()
            }
          : undefined
      }
    />
  )
}

export default function CasePage() {
  const params = useParams()
  const router = useRouter()
  
  // State
  const [caseStarted, setCaseStarted] = useState(false)
  const [caseData, setCaseData] = useState<any>(null)
  const [attempts, setAttempts] = useState<CaseAttempt[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<CaseAttempt | null>(null)
  const [viewingHistory, setViewingHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // The bedside screen walks a new student through itself once, on their first case: someone with no attempts on
  // any case who has not seen it on this device. It is worked out here, while the briefing is on screen.
  const [tour, setTour] = useState<EncounterTourConfig | undefined>()
  useEffect(() => {
    let cancelled = false
    getTourContext()
      .then((who) => {
        if (cancelled || !who) return
        setTour({ who: who.userId, auto: shouldAutoTour({ hasAttempts: who.hasAttempts, seen: tourSeen(who.userId) }) })
      })
      .catch(() => {
        /* no tour by itself; the ? button still works */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // Fetch case data and attempt history in parallel
      const [caseRes, attemptsData] = await Promise.all([
        fetch(`/api/cases/${params.id}`),
        getCaseAttemptHistory(params.id as string)
      ])

      if (caseRes.ok) {
        const data = await caseRes.json()
        setCaseData(data)
      } else {
        // 404: there is no such case. Anything else: it exists, we just could not get it.
        setError(caseRes.status === 404 ? 'not-found' : 'failed')
      }

      setAttempts(attemptsData)
    } catch (error) {
      console.error('Error loading case data:', error)
      setError('failed')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStartCase = async () => {
    try {
      setIsStarting(true)
      // Small delay for smoother transition feel
      await new Promise(resolve => setTimeout(resolve, 800))

      const response = await fetch(`/api/cases/${params.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to start case');
      }

      const updatedCase = await response.json();
      setCaseData(updatedCase);
      setCaseStarted(true);
    } catch (error) {
      console.error('Error starting case:', error);
      // Fallback: just start it locally if API fails
      setCaseStarted(true);
    } finally {
      setIsStarting(false)
    }
  }

  const handleReviewAttempt = (attempt: CaseAttempt) => {
    if (!attempt.feedback_json) {
      toast({
        title: "History Unavailable 🏺",
        description: "Detailed history is not available for this legacy attempt. Please attempt the case again to store your feedback replay.",
        variant: "destructive"
      })
      return
    }
    setSelectedAttempt(attempt)
    setViewingHistory(true)
  }

  const handleExitReplay = () => {
    setViewingHistory(false)
    setSelectedAttempt(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-3 bg-enc-desk">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        <p className="text-[14px] font-medium text-enc-ink-2 animate-pulse">Preparing clinical environment...</p>
      </div>
    )
  }

  if (!caseData) {
    const missing = error === 'not-found'
    return (
      <div className="min-h-screen bg-enc-desk">
        <StatePanel
          icon={missing ? <Compass className="h-6 w-6" strokeWidth={1.6} /> : <TriangleAlert className="h-6 w-6" strokeWidth={1.6} />}
          title={missing ? "That case is not here" : "We could not load this case"}
          actions={
            <>
              {!missing && (
                <Button onClick={() => loadData()} className={PRIMARY_BUTTON}>
                  <RotateCcw className="h-4 w-4" strokeWidth={1.9} />
                  Try again
                </Button>
              )}
              <Button variant={missing ? "default" : "outline"} onClick={() => router.push("/dashboard/cases")} className={missing ? PRIMARY_BUTTON : SECONDARY_BUTTON}>
                <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />
                Case library
              </Button>
            </>
          }
        >
          {missing ? "The link may be old, or the case may have been taken down." : "Check your connection and try again. Anything you have saved is unaffected."}
        </StatePanel>
      </div>
    )
  }

  // --- REPLAY STATE ---
  if (viewingHistory && selectedAttempt) {
    return (
      <CaseFeedback
        feedback={selectedAttempt.feedback_json}
        caseData={caseData}
        orderedTests={[]} // Historical review doesn't need to rebuild active test lists
        onExit={handleExitReplay}
        onReset={() => {
          setViewingHistory(false)
          setSelectedAttempt(null)
          handleStartCase()
        }}
        mode="history"
      />
    )
  }

  // --- ACTIVE SIMULATION STATE ---
  if (caseStarted) {
    return (
      <CaseInteraction
        caseData={caseData}
        tour={tour}
        onExit={() => {
          setCaseStarted(false)
          loadData() // Reload history after completion
        }}
      />
    )
  }

  // --- PRE-START STATE ---
  const latestAttempt = attempts.length > 0 ? attempts[0] : null;

  return (
    <div className="min-h-screen bg-enc-desk pb-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="max-w-3xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/cases")}
            className="-ml-2 h-9 gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Case library
          </Button>

          <Briefing caseId={params.id as string} caseData={caseData} isStarting={isStarting} onStart={handleStartCase} />

          <AttemptHistory attempts={attempts} onReview={handleReviewAttempt} />
        </div>
      </div>
    </div>
  )
}
