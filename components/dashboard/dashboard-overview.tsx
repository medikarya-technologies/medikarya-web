"use client"

// The dashboard home. Three things, in the order a student wants them:
//   1. how you are doing: the training section (four cards, one each for XP, cases, streak and score,
//      and below them XP case by case);
//   2. what you did last: recent attempts, each a way back into the case;
//   3. what to do next: one suggested case, chosen by lib/library/case-library.ts.
// A student with no attempts yet gets the four steps of a case in place of a table of nothing.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, FlaskConical, Hand, MessageSquare, Stethoscope } from "lucide-react"
import { cn } from "@/lib/utils"
import { difficultyLevel, greetingFor, NO_STATS, relativeDay, suggestNext, summarise, xpLabel, type DashboardStats, type LibraryCase, type ProgressMap } from "@/lib/library/case-library"
import { formatClock } from "@/lib/simulation/encounter-events"
import { mostRecent, type InProgress } from "@/lib/simulation/resume"
import { Button } from "@/components/ui/button"
import { Eyebrow, Paper, PaperHeader } from "@/components/cases/encounter-ui"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { useInProgress } from "@/components/cases/use-in-progress"
import { DifficultyMeter, LivePill, PageContainer, PageHeader, PRIMARY_BUTTON } from "./dashboard-ui"
import { RecentAttempts } from "./recent-attempts"
import { specialtyIcon } from "./specialty-icon"
import { TrainingPanel } from "./training-panel"
import { useDisplayName } from "./use-display-name"

interface Props {
  initialStats?: DashboardStats
  /** The library, for the suggestion and for who each attempt was about. */
  cases?: LibraryCase[]
  progress?: ProgressMap
  /** Shown instead of the signed-in user's name (the dev preview). */
  userName?: string
}

// ── For someone who has not started ─────────────────────────────────────────

const STEPS = [
  { icon: MessageSquare, title: "History", text: "Ask the patient what brought them in. Every answer goes on your record." },
  { icon: Hand, title: "Examine", text: "Look for what the patient cannot tell you." },
  { icon: FlaskConical, title: "Investigate", text: "Order tests. Results come back on a running clock, as they would on the ward." },
  { icon: Stethoscope, title: "Diagnose", text: "Commit to a diagnosis and a plan, then see how your reasoning compares." },
]

function FirstCase() {
  return (
    <Paper>
      <PaperHeader title="How a case works" description="Four steps, in the order you would take them at the bedside." />
      <ol className="divide-y divide-enc-line">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-4 px-4 py-4 sm:px-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-enc-console text-enc-ink-2">
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-medium text-enc-ink">
                <span className="mr-2 font-mono text-[12px] text-enc-ink-3">{i + 1}</span>
                {title}
              </p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-enc-ink-2">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Paper>
  )
}

// ── What to do next ─────────────────────────────────────────────────────────

function Suggested({ next, progress }: { next?: LibraryCase; progress: ProgressMap }) {
  if (!next) {
    return (
      <Paper className="h-fit p-5">
        <Eyebrow>Suggested next</Eyebrow>
        <p className="mt-2 text-[15px] font-medium text-enc-ink">You are all caught up.</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-enc-ink-2">Every case in the library is done at 90 or above. New cases appear here as they are added.</p>
      </Paper>
    )
  }
  const Icon = specialtyIcon(next.category)
  const tried = progress[next.id]
  return (
    <Paper className="h-fit p-5">
      <Eyebrow>Suggested next</Eyebrow>
      <div className="mt-3 flex items-start gap-3.5">
        <PatientAvatar age={next.patient?.age} gender={next.patient?.gender} seed={next.id} className="h-14 w-14 shrink-0" />
        <h2 className="min-w-0 pt-0.5 text-[16px] leading-snug font-semibold text-enc-ink">{next.displayTitle || next.title}</h2>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-enc-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
          {next.category}
        </span>
        <span aria-hidden>·</span>
        <DifficultyMeter level={difficultyLevel(next.difficulty)} />
        <span aria-hidden>·</span>
        <span className="font-mono tabular-nums">{next.estimatedTime} min</span>
        {next.live && (
          <>
            <span aria-hidden>·</span>
            <LivePill />
          </>
        )}
      </p>
      <p className="mt-3 border-t border-enc-line pt-3 text-[13px] text-enc-ink-2">{tried ? `Your best so far is ${tried.best}. This is where you have the most to gain.` : `Not tried yet. Worth up to ${xpLabel(next)}.`}</p>
      <Button asChild className={cn(PRIMARY_BUTTON, "mt-4 w-full")}>
        <Link href={`/dashboard/cases/${next.id}`}>{tried ? "Try again" : "Start case"}</Link>
      </Button>
    </Paper>
  )
}

// ── Where you left off ──────────────────────────────────────────────────────

/** A case started on this device and not finished: the clock waits, so it can be picked up as it was. */
function ResumeCard({ one, c }: { one: InProgress; c: LibraryCase }) {
  const when = one.savedAt ? relativeDay(new Date(one.savedAt).toISOString()) : ""
  return (
    <Paper className="h-fit p-5">
      <Eyebrow>Continue</Eyebrow>
      <div className="mt-3 flex items-start gap-3.5">
        <PatientAvatar age={c.patient?.age} gender={c.patient?.gender} seed={c.id} className="h-14 w-14 shrink-0" />
        <h2 className="min-w-0 pt-0.5 text-[16px] leading-snug font-semibold text-enc-ink">{c.displayTitle || c.title}</h2>
      </div>
      <p className="mt-3 border-t border-enc-line pt-3 text-[13px] leading-relaxed text-enc-ink-2" suppressHydrationWarning>
        You are <span className="font-mono tabular-nums">{formatClock(one.elapsedSeconds)}</span> into this encounter{when ? `, left ${when}` : ""}. It is saved on this device and the clock waits for you.
      </p>
      <Button asChild className={cn(PRIMARY_BUTTON, "mt-4 w-full")}>
        <Link href={`/dashboard/cases/${c.id}`}>Resume case</Link>
      </Button>
    </Paper>
  )
}

// ── The page ────────────────────────────────────────────────────────────────

export function DashboardOverview({ initialStats, cases = [], progress = {}, userName }: Props) {
  const stats = initialStats ?? NO_STATS
  const me = useDisplayName(userName)

  // The greeting and the date depend on the visitor's clock, so they are filled in after the page loads.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])
  const greeting = now ? greetingFor(now.getHours()) : "Welcome back"
  const today = now ? now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "Dashboard"

  const summary = summarise(cases, progress)
  const byId = new Map(cases.map((c) => [c.id, c]))
  const inProgress = useInProgress(useMemo(() => cases.map((c) => c.id), [cases]))
  const resume = mostRecent(inProgress)
  const resumeCase = resume ? byId.get(resume.caseId) : undefined
  // The case being resumed is not also suggested.
  const next = suggestNext(resumeCase ? cases.filter((c) => c.id !== resumeCase.id) : cases, progress)
  const started = stats.recentCases.length > 0

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span suppressHydrationWarning>{today}</span>}
        title={<span suppressHydrationWarning>{me.firstName ? `${greeting}, ${me.firstName}` : greeting}</span>}
        description={started ? `You have tried ${summary.attempted} of ${summary.total} cases. Pick up where you left off, or start something new.` : "Pick a patient and work the case up from the first question to the diagnosis."}
        actions={
          <Button asChild className={PRIMARY_BUTTON}>
            <Link href="/dashboard/cases">
              <Stethoscope className="h-4 w-4" strokeWidth={1.9} />
              Open case library
            </Link>
          </Button>
        }
      />

      <TrainingPanel
        stats={stats}
        cases={cases}
        progress={progress}
        className="mt-8"
        action={
          <Link href="/dashboard/progress" className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-brand-700 outline-none hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-300">
            Full progress <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {started ? <RecentAttempts attempts={stats.recentCases} byId={byId} /> : <FirstCase />}
        <div className="space-y-6">
          {resume && resumeCase && <ResumeCard one={resume} c={resumeCase} />}
          <Suggested next={next} progress={progress} />
        </div>
      </div>
    </PageContainer>
  )
}
