"use client"

import { useState, useEffect, useCallback } from "react"
import { CaseInteraction } from "@/components/cases/case-interaction"
import { PatientCard } from "@/components/cases/patient-card"
import { StatusPill } from "@/components/cases/encounter-ui"
import { FirstCaseConsentDialog, useFirstCaseConsent } from "@/components/cases/first-case-consent"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Stethoscope } from "lucide-react"
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
  const { hasConsented, markConsented } = useFirstCaseConsent()
  const [consentOpen, setConsentOpen] = useState(false)

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

  // First-ever case only: gate the real start behind a one-time consent dialog.
  const requestStartCase = () => {
    if (!hasConsented) {
      setConsentOpen(true)
      return
    }
    void handleStartCase()
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-3 bg-enc-desk">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        <p className="text-[14px] text-enc-ink-2 font-medium animate-pulse">
          Preparing clinical environment...
        </p>
      </div>
    )
  }

  // --- Error ---
  if (error || !caseData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-enc-desk">
        <div className="text-center space-y-4">
          <p className="text-enc-ink-2">{error || "Case not found"}</p>
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
    <div className="min-h-screen bg-enc-desk pb-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="max-w-3xl mx-auto space-y-6">
          <Button
            variant="ghost"
            asChild
            className="-ml-2 h-9 gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back home
            </Link>
          </Button>

          {/* Guest note */}
          <div className="flex items-center gap-2 text-[13px] text-enc-ink-2">
            <StatusPill tone="accent" icon={<Stethoscope className="h-3 w-3" />}>
              Free trial case
            </StatusPill>
            <span className="text-enc-ink-3">No signup required</span>
          </div>

          <PatientCard
            patient={caseData.patient}
            caseTitle={caseData.displayTitle || caseData.title}
            caseData={caseData}
            starting={isStarting}
            onStartCase={requestStartCase}
          />

          {/* Info note */}
          <div className="text-center space-y-3 pt-6 border-t border-enc-line-strong">
            <p className="text-[14px] text-enc-ink-2">
              Want to access all cases and track your progress?
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-lg border-enc-line-strong bg-enc-sheet text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink"
            >
              <Link href="/signup">
                Create free account
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <FirstCaseConsentDialog
        open={consentOpen}
        onCancel={() => setConsentOpen(false)}
        onAgree={() => {
          markConsented()
          setConsentOpen(false)
          void handleStartCase()
        }}
      />
    </div>
  )
}
