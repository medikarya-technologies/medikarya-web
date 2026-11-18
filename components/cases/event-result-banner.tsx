"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Trophy } from "lucide-react"
import { medventureRoundTwoScoredAction } from "@/app/medventure/challenge/actions"

/**
 * Above a debrief: when this play was the student's scored MedVenture Round 2, a way back to their event result.
 * Draws nothing for everyone else (the server says no at once when no event room is open).
 */
export function EventResultBanner({ caseId }: { caseId: string | undefined }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!caseId) return
    let live = true
    medventureRoundTwoScoredAction(caseId).then((yes) => { if (live) setShow(yes) }).catch(() => {})
    return () => { live = false }
  }, [caseId])
  if (!show) return null
  return (
    <a href="/medventure/results" className="flex items-center justify-center gap-2 bg-[#173c2d] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#285640]">
      <Trophy className="h-4 w-4 shrink-0 text-[#f2c94c]" />
      This was your MedVenture Round 2. See your event result
      <ArrowRight className="h-4 w-4 shrink-0" />
    </a>
  )
}
