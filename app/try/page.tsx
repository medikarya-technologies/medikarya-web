"use client"

import { useState, useEffect, useCallback } from "react"
import { CaseInteraction } from "@/components/cases/case-interaction"
import { PatientCard } from "@/components/cases/patient-card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Play, Stethoscope } from "lucide-react"
import Link from "next/link"

const FREE_CASE_ID = "viral-gastroenteritis"

function getOrCreateGuestId(): string {
  const KEY = "medikarya-guest-id"
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // Fallback if localStorage is unavailable
    return crypto.randomUUID()
  }
}

export default function TryPage() {
  const [caseData, setCaseData] = useState<any>(null)
  const [caseStarted, setCaseStarted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string>("")

  const loadCase = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/cases/${FREE_CASE_ID}`)
      if (res.ok) {
        setCaseData(await res.json())
      } else {
        setError("Failed to load case")
      }
    } catch {
      setError("An error occurred while loading the case")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCase()
    setGuestId(getOrCreateGuestId())
  }, [loadCase])

  const handleStartCase = async () => {
    try {
      setIsStarting(true)
      await new Promise((resolve) => setTimeout(resolve, 800))
      const response = await fetch(`/api/cases/${FREE_CASE_ID}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (response.ok) {
        const updatedCase = await response.json()
        setCaseData(updatedCase)
      }
      setCaseStarted(true)
    } catch {
      setCaseStarted(true)
    } finally {
      setIsStarting(false)
    }
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-slate-50/50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
        <p className="text-slate-500 font-medium animate-pulse">
          Preparing clinical environment...
        </p>
      </div>
    )
  }

  // --- Error ---
  if (error || !caseData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50/50">
        <div className="text-center space-y-4">
          <p className="text-slate-600">{error || "Case not found"}</p>
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back Home
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // --- Active case ---
  if (caseStarted) {
    return (
      <CaseInteraction
        caseData={caseData}
        onExit={() => {
          setCaseStarted(false)
        }}
        guestId={guestId}
      />
    )
  }

  // --- Pre-start ---
  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button
          variant="ghost"
          asChild
          className="mb-8 hover:bg-white/80 text-slate-600 transition-all rounded-xl"
        >
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back Home
          </Link>
        </Button>

        <div className="max-w-3xl mx-auto space-y-8">
          {/* Guest badge */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border border-brand-200/60">
              <Stethoscope className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">
                Free Trial Case
              </span>
              <span className="text-xs text-brand-500">· No signup required</span>
            </div>
          </div>

          {/* Patient Card */}
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
                    <p className="text-sm font-bold text-slate-900">
                      Preparing Simulation
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Entering clinical environment...
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="text-center space-y-3 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Want to access all cases and track your progress?
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full border-slate-200 hover:bg-white hover:text-brand-600"
            >
              <Link href="/signup">
                Create Free Account
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
