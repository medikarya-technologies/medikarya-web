"use client"

// Mirrors /dashboard/cases/[id]: fetch the case, POST /start, render CaseInteraction.
// Passes no guestId on purpose, so finishing the case does NOT write an attempt to
// the database. Tips: add ?simSpeed=10 to run the clock 10x faster, and ?case=<id> to open
// any case (default: acute-anterior-stemi), e.g. ?case=viral-gastroenteritis.
// Add ?screen=briefing to begin on the intro card every case shows before it starts.

import { useEffect, useState } from "react"
import { CaseInteraction } from "@/components/cases/case-interaction"
import { PatientCard } from "@/components/cases/patient-card"
import { AttemptHistory } from "@/components/cases/attempt-history"
import { useInProgress } from "@/components/cases/use-in-progress"
import { clearInProgress } from "@/lib/simulation/resume"

export default function SimPreviewClient() {
  const [caseData, setCaseData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [briefing, setBriefing] = useState(false)
  // ?tour=1 opens the walkthrough as it would for a new student (nothing is remembered, so it comes back on every load).
  const [tourOn, setTourOn] = useState(false)
  // ?attempts=3 pretends the student has 3 earlier attempts, to see the strip under the briefing.
  const [attemptCount, setAttemptCount] = useState(0)
  // The same "Resume / Start over" the real briefing offers, from what this browser has saved for the case.
  const savedFor: string | undefined = caseData?.id
  const resume = useInProgress(savedFor ? [savedFor] : []).get(savedFor ?? "")

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const id = query.get("case") || "acute-anterior-stemi"
    setBriefing(query.get("screen") === "briefing")
    setTourOn(query.get("tour") === "1")
    setAttemptCount(Math.min(6, Number(query.get("attempts")) || 0))
    fetch(`/api/cases/${encodeURIComponent(id)}/start`, { method: "POST", headers: { "Content-Type": "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setCaseData)
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <div className="p-8 text-red-600">Failed to load the case: {error}</div>
  if (!caseData) return <div className="p-8 text-slate-500">Preparing clinical environment…</div>

  if (briefing) {
    return (
      <div className="min-h-screen bg-enc-desk pb-20">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <div className="mx-auto max-w-3xl">
            <PatientCard
              patient={caseData.patient}
              caseTitle={caseData.displayTitle || caseData.title}
              caseData={caseData}
              onStartCase={() => setBriefing(false)}
              resume={resume}
              onStartOver={
                resume
                  ? () => {
                      clearInProgress(caseData.id)
                      setBriefing(false)
                    }
                  : undefined
              }
            />
            {attemptCount > 0 && (
              <div className="mt-8">
                <AttemptHistory
                  attempts={Array.from({ length: attemptCount }, (_, i) => ({
                    id: String(i),
                    score: 84 - i * 9,
                    created_at: new Date(Date.UTC(2026, 8, 19 - i, 10, 15)).toISOString(),
                    feedback_json: i === attemptCount - 1 && attemptCount > 2 ? null : {},
                  }))}
                  onReview={(a) => console.log("review", a.id)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return <CaseInteraction caseData={caseData} tour={tourOn ? { auto: true } : undefined} onExit={() => (window.location.href = "/")} />
}
