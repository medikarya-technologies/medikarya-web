"use client"

// One case in the library, as a card: the patient's face at the top (calm, so nothing is given away), then the
// anonymised title, what kind of case it is, and a short description; at the foot, what the student has done
// with it on the left and the way in on the right. The library lays these out two across on a wide screen and one
// across on a narrow one (practice-cases.tsx). The whole card is the way in: the title carries the link, stretched
// over the card, so the save button in the corner can be a real button and not a button inside a link.
//
// A case the student's plan does not include is drawn locked: faded, a lock over the patient, the plan that opens it
// in the corner, and a click anywhere opens the upgrade dialog (components/plans/upgrade-dialog.tsx) instead of the case.
//
// (Not shown, on purpose: the case's tags, which can name the diagnosis, and a made-up XP figure. The XP is what a
// perfect score earns, from the case itself.)

import { memo } from "react"
import Link from "next/link"
import { Bookmark, BookmarkCheck, Clock, Lock, Play, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/clarity"
import { difficultyLevel, relativeDay, xpLabel, type CaseProgress, type LibraryCase } from "@/lib/library/case-library"
import { formatClock } from "@/lib/simulation/encounter-events"
import type { InProgress } from "@/lib/simulation/resume"
import { PLAN_NAME, type Plan } from "@/lib/plans/limits"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { useUpgrade } from "@/components/plans/upgrade-dialog"
import { Eyebrow, StatusPill } from "@/components/cases/encounter-ui"
import { DifficultyMeter, LivePill, ScoreValue } from "./dashboard-ui"
import { specialtyIcon } from "./specialty-icon"
import { specialtyTone } from "./specialty-tone"

// The card's button. It is drawn as a button but is not one: a click anywhere on the card lands on the title's link.
// pointer-events-none lets a click on it fall through to that link. (Hover changes the colour, never a filter: a
// filter lifts the element above the link's overlay, and the click then stops at the button and goes nowhere.)
const BUTTON = "pointer-events-none inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition"
const PRIMARY = cn(BUTTON, "bg-brand-600 text-white group-hover:bg-brand-700")
const SECONDARY = cn(BUTTON, "border border-enc-line-strong bg-enc-sheet text-enc-ink-2 group-hover:bg-enc-console group-hover:text-enc-ink")

/** What the student has done here (left), and the way in (right). */
function Footer({ c, progress, inProgress, locked }: { c: LibraryCase; progress?: CaseProgress; inProgress?: InProgress; locked?: Plan | null }) {
  // Not in the student's plan (even if it was started on a plan that has since lapsed). Past results stay visible.
  if (locked) {
    return (
      <>
        <div className="min-w-0">
          {progress && progress.attempts > 0 ? (
            <div className="mt-1 flex items-baseline gap-1.5 text-[12px] text-enc-ink-3">
              <Eyebrow className="tracking-[0.09em]">Best</Eyebrow>
              <ScoreValue score={progress.best} className="text-[14px] leading-none" />
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-enc-ink-3">Included in {PLAN_NAME[locked]}</p>
          )}
        </div>
        <span className={PRIMARY}>
          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
          Unlock
        </span>
      </>
    )
  }

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
  /** The plan this case needs, when the student's plan does not include it. */
  locked?: Plan | null
}

export const CaseRow = memo(function CaseRow({ c, progress, inProgress, isNew, saved = false, onToggleSaved, locked }: CaseRowProps) {
  const Icon = specialtyIcon(c.category)
  const tone = specialtyTone(c.category)
  const level = difficultyLevel(c.difficulty)
  const title = c.displayTitle || c.title
  const summary = c.displayDescription || ""
  const openUpgrade = useUpgrade()
  // Whatever is on top of the card: the link into the case, or (locked) the button that opens the upgrade dialog.
  const stretched = "rounded-sm text-center outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-brand-300 focus-visible:after:ring-inset"

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-enc-line bg-enc-sheet p-4 pt-5 shadow-enc-sheet transition-[border-color,box-shadow,transform] sm:p-5 sm:pt-6 focus-within:border-enc-line-strong hover:-translate-y-0.5 hover:border-enc-line-strong hover:shadow-enc-lift">
      {/* the specialty's colour, as one quiet cue (the strip and the label's icon), so cases tell themselves apart
          at a glance without the page turning into a paint box (specialty-tone.ts) */}
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", tone.band, locked && "opacity-40")} />
      {locked ? (
        <span className="absolute top-4 left-4">
          <StatusPill tone="accent" icon={<Lock className="h-3 w-3" strokeWidth={2.2} />}>{PLAN_NAME[locked]}</StatusPill>
        </span>
      ) : (
        isNew && (
          <span className="absolute top-4 left-4">
            <StatusPill tone="accent">New</StatusPill>
          </span>
        )
      )}

      <div className="relative mx-auto">
        <PatientAvatar age={c.patient?.age} gender={c.patient?.gender} seed={c.id} className={cn("h-16 w-16 sm:h-20 sm:w-20", locked && "opacity-40 grayscale")} />
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-enc-ink text-enc-sheet shadow-md ring-4 ring-enc-sheet transition-transform group-hover:scale-110">
              <Lock className="h-4 w-4" strokeWidth={2.2} />
            </span>
          </span>
        )}
      </div>

      <h3 className={cn("mt-3.5 line-clamp-3 text-center text-[16px] leading-snug font-semibold text-balance sm:text-[17px]", locked ? "text-enc-ink-2" : "text-enc-ink")}>
        {locked ? (
          <button
            type="button"
            onClick={() =>
              openUpgrade({
                source: "locked_card",
                highlight: locked,
                reason: c.live ? "Live emergency cases are part of the Intern and Resident plans." : `This case is part of the ${PLAN_NAME[locked]} plan.`,
              })
            }
            className={stretched}
          >
            {title}
          </button>
        ) : (
          <Link href={`/dashboard/cases/${c.id}`} onClick={() => trackEvent("Case_Started")} className={stretched}>
            {title}
          </Link>
        )}
      </h3>

      {/* no dots between these: on a narrow card they wrap, and a dot left at the end of a line looks like a mistake */}
      <p className={cn("mt-2.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-[12.5px] text-enc-ink-3", locked && "opacity-60")}>
        <span className="inline-flex items-center gap-1.5 font-medium text-enc-ink-2">
          <Icon className={cn("h-3.5 w-3.5", tone.text)} strokeWidth={2} />
          {c.category}
        </span>
        <DifficultyMeter level={level} />
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
          <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
          {c.estimatedTime} min
        </span>
        {c.live && <LivePill />}
      </p>

      {summary && <p className={cn("mt-3 line-clamp-2 text-center text-[13.5px] leading-relaxed text-enc-ink-2", locked && "opacity-60")}>{summary}</p>}

      {/* the foot sits at the bottom of every card, so the buttons line up across a row */}
      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-enc-line pt-4">
          <Footer c={c} progress={progress} inProgress={inProgress} locked={locked} />
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
