"use client"

// What you did last: your latest attempts, each a way back into the case and its feedback. Shown on the dashboard
// home and on the Progress page's Activity tab.

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { relativeDay, type LibraryCase, type RecentAttempt } from "@/lib/library/case-library"
import { Paper, PaperHeader } from "@/components/cases/encounter-ui"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { ScoreValue } from "./dashboard-ui"

function Attempt({ a, patient }: { a: RecentAttempt; patient?: LibraryCase }) {
  const when = relativeDay(a.createdAt)
  const body = (
    <>
      {patient ? <PatientAvatar age={patient.patient?.age} gender={patient.patient?.gender} seed={patient.id} className="h-11 w-11 shrink-0" /> : <span className="h-11 w-11 shrink-0 rounded-full bg-enc-console" />}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[14.5px] leading-snug font-medium text-enc-ink">{a.title}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-enc-ink-3" suppressHydrationWarning>
          {[a.timeTaken, when].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-baseline gap-4">
        <span className="hidden font-mono text-[12.5px] text-enc-ink-2 tabular-nums sm:inline">+{a.xpEarned} XP</span>
        <span className="w-10 text-right">
          <ScoreValue score={a.score} className="text-[20px] leading-none" />
          <span className="text-[12px] text-enc-ink-3">%</span>
        </span>
      </div>
    </>
  )
  const row = "flex items-center gap-3.5 px-4 py-3 sm:px-5"
  return (
    <li className="border-b border-enc-line last:border-b-0">
      {a.caseId ? (
        <Link href={`/dashboard/cases/${a.caseId}`} className={cn(row, "outline-none transition-colors hover:bg-enc-desk focus-visible:bg-enc-desk focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-inset")}>
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  )
}

export function RecentAttempts({ attempts, byId }: { attempts: RecentAttempt[]; byId: Map<string, LibraryCase> }) {
  return (
    <Paper className="overflow-hidden">
      <PaperHeader
        title="Recent attempts"
        description="Your last five. Open one to review your feedback."
        actions={
          <Link href="/dashboard/cases" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
            Library <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <ul>
        {attempts.map((a) => (
          <Attempt key={a.id} a={a} patient={a.caseId ? byId.get(a.caseId) : undefined} />
        ))}
      </ul>
    </Paper>
  )
}
