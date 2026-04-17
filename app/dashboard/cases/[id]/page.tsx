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
  Play, 
  Award, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  RotateCcw,
  Eye
} from "lucide-react"
import { getCaseAttemptHistory, type CaseAttempt } from "@/app/actions/case-attempts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle } from "lucide-react"

export default function CasePage() {
  const params = useParams()
  const router = useRouter()
  
  // State
  const [caseStarted, setCaseStarted] = useState(false)
  const [caseData, setCaseData] = useState<any>(null)
  const [attempts, setAttempts] = useState<CaseAttempt[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<CaseAttempt | null>(null)
  const [viewingHistory, setViewingHistory] = useState(false)
  const [showAllAttempts, setShowAllAttempts] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      // Fetch case data and attempt history in parallel
      const [caseRes, attemptsData] = await Promise.all([
        fetch(`/api/cases/${params.id}`),
        getCaseAttemptHistory(params.id as string)
      ])

      if (caseRes.ok) {
        const data = await caseRes.json()
        setCaseData(data)
      } else {
        setError('Failed to load case data')
      }

      setAttempts(attemptsData)
    } catch (error) {
      console.error('Error loading case data:', error)
      setError('An error occurred while loading the case')
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
        <p className="text-slate-500 font-medium animate-pulse">Preparing clinical environment...</p>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-slate-600">Case not found</p>
          <Button onClick={() => router.push("/dashboard/cases")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </div>
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
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/cases")}
          className="mb-8 hover:bg-white/80 text-slate-600 transition-all rounded-xl"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Case Library
        </Button>

        <div className="max-w-3xl mx-auto space-y-8">
          {/* Main Anonymized Patient Card */}
          <div className="relative">
            <PatientCard
              patient={caseData.patient}
              caseTitle={caseData.displayTitle || caseData.title}
              onStartCase={handleStartCase}
            />
            
            {isStarting && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center rounded-2xl animate-in fade-in duration-300">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
                    <Play className="absolute inset-0 m-auto h-4 w-4 text-brand-600 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">Preparing Simulation</p>
                    <p className="text-[11px] text-slate-500">Entering clinical environment...</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Discreet history link if attempts exist */}
          {attempts.length > 0 && (
            <div className="flex flex-col items-center gap-4 pt-4 border-t border-slate-200">
               <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Last Score</span>
                  <span className="text-2xl font-bold text-slate-900">{attempts[0].score}/100</span>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Attempts</span>
                  <span className="text-2xl font-bold text-slate-900">{attempts.length}</span>
                </div>
               </div>
               
               <div className="flex gap-3">
                 <Button 
                   variant="outline" 
                   size="sm"
                   onClick={() => handleReviewAttempt(attempts[0])}
                   className="rounded-xl border-slate-200 hover:bg-white hover:text-brand-600 group"
                 >
                   <Eye className="w-4 h-4 mr-2 text-slate-400 group-hover:text-brand-500" />
                   {attempts[0].feedback_json ? "Review Last Feedback" : "Legacy Attempt (No Replay)"}
                 </Button>

                 {attempts.length > 1 && (
                   <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllAttempts(!showAllAttempts)}
                    className="rounded-xl text-slate-500 hover:text-slate-900"
                   >
                    {showAllAttempts ? "Hide History" : "View All Attempts"}
                    {showAllAttempts ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                   </Button>
                 )}
               </div>

               {showAllAttempts && (
                 <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    {attempts.slice(1).map((attempt) => (
                      <div 
                        key={attempt.id}
                        onClick={() => handleReviewAttempt(attempt)}
                        className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-brand-200 cursor-pointer shadow-sm transition-all group"
                      >
                         <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] text-slate-400 font-bold uppercase">{formatDate(attempt.created_at)}</span>
                               {!attempt.feedback_json && (
                                 <Badge variant="outline" className="text-[8px] h-3.5 px-1 py-0 border-slate-200 text-slate-400">Legacy</Badge>
                               )}
                            </div>
                            <span className="text-lg font-bold text-slate-900 line-clamp-1">Score: {attempt.score}</span>
                         </div>
                         <div className="p-2 rounded-full bg-slate-50 group-hover:bg-brand-50 transition-colors">
                            <Eye className="w-4 h-4 text-slate-400 group-hover:text-brand-600" />
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
