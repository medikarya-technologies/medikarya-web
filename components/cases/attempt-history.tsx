"use client"

// The student's earlier attempts at this case, shown under the briefing: last score, how many
// tries, and a way back into the feedback of any of them.

import { useState } from "react"
import { ChevronDown, ChevronUp, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Eyebrow, StatusPill } from "./encounter-ui"

export interface AttemptSummary {
  id: string
  score: number
  created_at: string
  feedback_json?: unknown
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })

export function AttemptHistory<T extends AttemptSummary>({ attempts, onReview }: { attempts: T[]; onReview: (attempt: T) => void }) {
  const [showAll, setShowAll] = useState(false)
  if (attempts.length === 0) return null

  return (
    <section aria-label="Your attempts" className="flex flex-col items-center gap-4 border-t border-enc-line-strong pt-6">
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center">
          <Eyebrow>Last score</Eyebrow>
          <span className="mt-1 font-mono text-[24px] leading-none font-medium text-enc-ink tabular-nums">
            {attempts[0].score}
            <span className="text-[14px] text-enc-ink-3">/100</span>
          </span>
        </div>
        <div className="h-9 w-px bg-enc-line-strong" />
        <div className="flex flex-col items-center">
          <Eyebrow>Attempts</Eyebrow>
          <span className="mt-1 font-mono text-[24px] leading-none font-medium text-enc-ink tabular-nums">{attempts.length}</span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReview(attempts[0])}
          className="h-9 w-full gap-2 rounded-lg border-enc-line-strong bg-enc-sheet text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink sm:w-auto"
        >
          <Eye className="h-4 w-4 shrink-0 text-enc-ink-3" />
          {attempts[0].feedback_json ? "Review last feedback" : "Legacy attempt"}
        </Button>

        {attempts.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="h-9 w-full gap-1.5 rounded-lg text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink sm:w-auto"
          >
            {showAll ? "Hide history" : "View all attempts"}
            {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {showAll && (
        <div className="mt-2 grid w-full animate-in grid-cols-1 gap-2.5 fade-in slide-in-from-top-4 duration-300 sm:grid-cols-2">
          {attempts.slice(1).map((attempt) => (
            <button
              type="button"
              key={attempt.id}
              onClick={() => onReview(attempt)}
              className="group flex items-center justify-between rounded-xl border border-enc-line bg-enc-sheet p-3.5 text-left shadow-enc-sheet transition-colors hover:border-enc-line-strong hover:bg-enc-console"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-[0.06em] text-enc-ink-3 uppercase">{formatDate(attempt.created_at)}</span>
                  {!attempt.feedback_json && <StatusPill>Legacy</StatusPill>}
                </div>
                <span className="mt-0.5 block font-mono text-[17px] font-medium text-enc-ink tabular-nums">Score {attempt.score}</span>
              </div>
              <Eye className="h-4 w-4 shrink-0 text-enc-ink-3 group-hover:text-enc-ink-2" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
