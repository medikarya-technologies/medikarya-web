"use client"

// One case in the library, as a card: the patient's face at the top (calm, so nothing is given away), then the
// anonymised title, what kind of case it is, and a short description; at the foot, what the student has done
// with it on the left and the way in on the right. The library lays these out two across on a wide screen and one
// across on a narrow one (practice-cases.tsx). The whole card is the way in: the title carries the link, stretched
// over the card, so the save button in the corner can be a real button and not a button inside a link.
//
// (Not shown, on purpose: the case's tags, which can name the diagnosis, and a made-up XP figure. The XP is what a
// perfect score earns, from the case itself.)

import { memo } from "react"
import Link from "next/link"
import { Bookmark, BookmarkCheck, Clock, Play, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/clarity"
import { difficultyLevel, relativeDay, xpLabel, type CaseProgress, type LibraryCase } from "@/lib/library/case-library"
import { formatClock } from "@/lib/simulation/encounter-events"
import type { InProgress } from "@/lib/simulation/resume"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { Eyebrow, StatusPill } from "@/components/cases/encounter-ui"
import { DifficultyMeter, LivePill, ScoreValue } from "./dashboard-ui"
import { specialtyIcon } from "./specialty-icon"

// The card's button. It is drawn as a button but is not one: a click anywhere on the card lands on the title's link.
const BUTTON = "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition"
const PRIMARY = cn(BUTTON, "bg-brand-600 text-white group-hover:brightness-95")
const SECONDARY = cn(BUTTON, "border border-enc-line-strong bg-enc-sheet text-enc-ink-2 group-hover:bg-enc-console group-hover:text-enc-ink")

/** What the student has done here (left), and the way in (right). */
function Footer({ c, progress, inProgress }: { c: LibraryCase; progress?: CaseProgress; inProgress?: InProgress }) {
  if (inProgress) {
    const when = inProgress.savedAt ? relativeDay(new Date(inProgress.savedAt).toISOString()) : ""
    return (
      <>
        <div className="min-w-0">
          <StatusPill tone="accent">In progress</StatusPill>
          <p className="mt-1 text-[12px] text-enc-ink-3" suppressHydrationWarning>
            <span className="font-mono tabular-nums">{formatClock(inProgress.elapsedSeconds)}</span> in{when ? ` · ${when}` : ""}
          </p>
        </div>
        <span className={PRIMARY}>
          <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
          Resume
        </span>
      </>
    )
  }

  if (!progress || progress.attempts <= 0) {
    return (
      <>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-enc-ink-2">Not started</p>
          <p className="mt-0.5 font-mono text-[12px] text-enc-ink-3 tabular-nums" title="What a perfect score earns; your score is a percentage of it">
            up to {xpLabel(c)}
          </p>
        </div>
        <span className={PRIMARY}>
          <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
          Start case
        </span>
      </>
    )
  }

  const when = relativeDay(progress.last)
  return (
    <>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <Eyebrow className="tracking-[0.09em]">Best</Eyebrow>
          <ScoreValue score={progress.best} className="text-[20px] leading-none" />
        </div>
        <p className="mt-1 text-[12px] text-enc-ink-3" suppressHydrationWarning>
          {progress.attempts} {progress.attempts === 1 ? "attempt" : "attempts"}
          {when ? ` · ${when}` : ""}
        </p>
      </div>
      <span className={SECONDARY}>
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
        Try again
      </span>
    </>
  )
}

interface CaseRowProps {
  c: LibraryCase
  progress?: CaseProgress
  inProgress?: InProgress
  /** Added recently and not tried yet. */
  isNew?: boolean
  saved?: boolean
  onToggleSaved?: (id: string) => void
}

export const CaseRow = memo(function CaseRow({ c, progress, inProgress, isNew, saved = false, onToggleSaved }: CaseRowProps) {
  const Icon = specialtyIcon(c.category)
  const level = difficultyLevel(c.difficulty)
  const title = c.displayTitle || c.title
  const summary = c.displayDescription || ""

  return (
    <li className="group relative flex flex-col rounded-xl border border-enc-line bg-enc-sheet p-4 shadow-enc-sheet transition-[border-color,box-shadow] sm:p-5 focus-within:border-enc-line-strong hover:border-enc-line-strong hover:shadow-enc-lift">
      {isNew && (
        <span className="absolute top-4 left-4">
          <StatusPill tone="accent">New</StatusPill>
        </span>
      )}

      <PatientAvatar age={c.patient?.age} gender={c.patient?.gender} seed={c.id} className="mx-auto h-16 w-16 sm:h-20 sm:w-20" />

      <h3 className="mt-3.5 line-clamp-3 text-center text-[16px] leading-snug font-semibold text-balance text-enc-ink sm:text-[17px]">
        <Link
          href={`/dashboard/cases/${c.id}`}
          onClick={() => trackEvent("Case_Started")}
          className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-brand-300 focus-visible:after:ring-inset"
        >
          {title}
        </Link>
      </h3>

      {/* no dots between these: on a narrow card they wrap, and a dot left at the end of a line looks like a mistake */}
      <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-[12.5px] text-enc-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
          {c.category}
        </span>
        <DifficultyMeter level={level} />
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
          <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
          {c.estimatedTime} min
        </span>
        {c.live && <LivePill />}
      </p>

      {summary && <p className="mt-3 line-clamp-2 text-center sm:line-clamp-3 text-[13.5px] leading-relaxed text-enc-ink-2">{summary}</p>}

      {/* the foot sits at the bottom of every card, so the buttons line up across a row */}
      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-enc-line pt-4">
          <Footer c={c} progress={progress} inProgress={inProgress} />
        </div>
      </div>

      {onToggleSaved && (
        <button
          type="button"
          onClick={() => onToggleSaved(c.id)}
          aria-pressed={saved}
          aria-label={saved ? `Remove "${title}" from saved cases` : `Save "${title}" for later`}
          title={saved ? "Saved. Click to remove." : "Save for later"}
          className={cn(
            "absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-300",
            saved ? "text-brand-700 hover:bg-brand-50" : "text-enc-ink-3 hover:bg-enc-console hover:text-enc-ink"
          )}
        >
          {saved ? <BookmarkCheck className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.9} />}
        </button>
      )}
    </li>
  )
})
