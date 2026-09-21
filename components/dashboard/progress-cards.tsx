"use client"

// The cards of the Progress page. Each answers one question a student asks of their record, and is built to sit
// beside another card:
//
//   Where you lose marks    which parts of a case score lowest, weakest first
//   Missed most often       the red flags and key points that keep slipping past, each a way to try again
//   Strength by specialty   how each specialty is going, each row a way into its cases
//   Milestones              real things done, with a bar for how far each unfinished one has got
//
// A card says what it means first (one sentence in a tinted strip), then shows the rows that sentence comes from,
// so it can be read in one look. Everything is worked out in lib/library (skills.ts, milestones.ts,
// case-library.ts) and tested there; these only draw it.

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Check, Compass, Flame, LifeBuoy, Medal, Sparkles, Target, TrendingDown, Trophy, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { scoreBand, type ScoreBand, type SpecialtyStrength } from "@/lib/library/case-library"
import { specialtyHref } from "@/lib/library/library-url"
import { relativeDay } from "@/lib/library/relative-day"
import type { Milestone, MilestoneId } from "@/lib/library/milestones"
import type { SkillProfile } from "@/lib/library/skills"
import { Eyebrow, Paper, PaperHeader } from "@/components/cases/encounter-ui"
import { ScoreValue } from "./dashboard-ui"
import { specialtyIcon } from "./specialty-icon"

// ── Shared pieces ───────────────────────────────────────────────────────────

const BAR: Record<ScoreBand, string> = { ok: "bg-enc-ok", warn: "bg-enc-warn", crit: "bg-enc-crit" }

/** A track with a filled part: how much of 100 a score is, in the colour of how it went. */
function Meter({ value, band }: { value: number | null; band?: ScoreBand }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-enc-console" aria-hidden>
      {value !== null && band && <div className={cn("h-full rounded-full", BAR[band])} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />}
    </div>
  )
}

function Percent({ value }: { value: number }) {
  return (
    <span className="text-right text-[13px]">
      <ScoreValue score={value} />
      <span className="text-[11px] text-enc-ink-3">%</span>
    </span>
  )
}

type Tone = "neutral" | ScoreBand

const STRIP: Record<Tone, string> = { neutral: "bg-enc-console", ok: "bg-enc-ok-soft", warn: "bg-enc-warn-soft", crit: "bg-enc-crit-soft" }
const STRIP_ICON: Record<Tone, string> = { neutral: "text-enc-ink-3", ok: "text-enc-ok", warn: "text-enc-warn", crit: "text-enc-crit" }

/** What the card means, said once before the rows it is made of. */
function Takeaway({ tone, icon: Icon, children }: { tone: Tone; icon: LucideIcon; children: ReactNode }) {
  return (
    <p className={cn("mx-4 mt-4 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px] leading-snug text-enc-ink", STRIP[tone])}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STRIP_ICON[tone])} strokeWidth={1.9} aria-hidden />
      <span>{children}</span>
    </p>
  )
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// ── Where you lose marks ────────────────────────────────────────────────────

/** Which parts of a case score lowest, weakest first, and what help costs. */
export function SkillsCard({ profile }: { profile: SkillProfile }) {
  const weakest = profile.skills[0]
  return (
    <Paper className="overflow-hidden">
      <PaperHeader title="Where you lose marks" description={`Your average on each part of a case, from ${count(profile.attempts, "attempt", "attempts")}.`} />
      {weakest && profile.skills.length > 1 && (
        <Takeaway tone={scoreBand(weakest.average)} icon={TrendingDown}>
          Your weakest part is <strong className="font-semibold">{weakest.label.toLowerCase()}</strong>, at {weakest.average}%.
        </Takeaway>
      )}
      <ul className="px-4 py-3">
        {profile.skills.map((s) => (
          <li key={s.id} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_2.75rem] items-center gap-3 py-2" title={`Scored in ${count(s.attempts, "attempt", "attempts")}`}>
            <span className="truncate text-[13.5px] text-enc-ink">
              {s.label}
              <span className="sr-only">, scored in {count(s.attempts, "attempt", "attempts")}</span>
            </span>
            <Meter value={s.average} band={scoreBand(s.average)} />
            <Percent value={s.average} />
          </li>
        ))}
      </ul>
      {profile.helpCost && (
        <p className="flex items-center gap-2 border-t border-enc-line bg-enc-desk px-4 py-2.5 text-[12.5px] text-enc-ink-2">
          <LifeBuoy className="h-3.5 w-3.5 shrink-0 text-enc-ink-3" strokeWidth={1.9} aria-hidden />
          <span>
            Hints and other help cost you about <span className="font-medium text-enc-ink tabular-nums">{profile.helpCost.average}</span> points a case.
          </span>
        </p>
      )}
    </Paper>
  )
}

// ── Missed most often ───────────────────────────────────────────────────────

/** The red flags and key points that keep slipping past, most often first, each a way back into a case where it did. */
export function MissedCard({ profile }: { profile: SkillProfile }) {
  return (
    <Paper className="overflow-hidden">
      <PaperHeader title="Missed most often" description="Red flags and key points that slipped past you, most often first." />
      {/* two columns once there is room; -mb-px hides the last row's rule under the card's own edge */}
      <ul className="-mb-px grid @xl:grid-cols-2">
        {profile.gaps.map((g) => (
          <li key={g.key} className="flex items-center gap-3 border-b border-enc-line px-4 py-3">
            <span className="min-w-8 rounded-md bg-enc-console px-1.5 py-0.5 text-center font-mono text-[11.5px] text-enc-ink-2 tabular-nums" title={`Missed in ${count(g.count, "attempt", "attempts")}`}>
              ×{g.count}
            </span>
            <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-enc-ink">{g.label}</span>
            {g.cases[0] && (
              <Link href={`/dashboard/cases/${g.cases[0]}`} className="inline-flex shrink-0 items-center gap-1 rounded text-[12.5px] font-medium text-brand-700 outline-none hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-300">
                Try again <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Paper>
  )
}

// ── Strength by specialty ───────────────────────────────────────────────────

function SpecialtyRow({ row }: { row: SpecialtyStrength }) {
  const Icon = specialtyIcon(row.name)
  return (
    <li>
      <Link
        href={specialtyHref(row.name)}
        className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-enc-desk focus-visible:bg-enc-desk focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-enc-console text-enc-ink-2" aria-hidden>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 text-[13.5px] leading-snug font-medium text-enc-ink">
          {row.name}
          <span className="sr-only">
            , {row.average}%, {row.tried} of {row.total} cases tried
          </span>
        </span>
        <span className="flex items-center gap-2.5" aria-hidden>
          <span className="w-16">
            <Meter value={row.average} band={row.band ?? undefined} />
          </span>
          <span className="hidden w-7 text-right font-mono text-[11.5px] text-enc-ink-3 tabular-nums @sm:block" title={`${row.tried} of ${row.total} cases tried`}>
            {row.tried}/{row.total}
          </span>
          <span className="w-11">
            <Percent value={row.average as number} />
          </span>
        </span>
      </Link>
    </li>
  )
}

/** How each specialty is going: the ones tried as rows, strongest first; the rest as a wrap of links below. Each opens the library on that specialty. */
export function SpecialtyCard({ rows }: { rows: SpecialtyStrength[] }) {
  const started = rows.filter((r) => r.average !== null && r.band !== null)
  const waiting = rows.filter((r) => r.average === null)
  const strongest = started[0]
  const weakest = started.length > 1 ? started[started.length - 1] : undefined
  const compare = strongest && weakest && strongest.average !== weakest.average

  return (
    <Paper className="@container overflow-hidden">
      <PaperHeader title="Strength by specialty" description="Best score on each case, averaged. Rows open the library." />
      {compare && (
        <Takeaway tone="neutral" icon={Compass}>
          Strongest: <strong className="font-semibold">{strongest.name}</strong> ({strongest.average}%). Most room to grow: <strong className="font-semibold">{weakest.name}</strong> ({weakest.average}%).
        </Takeaway>
      )}
      <ul className="px-2 py-2">
        {started.map((row) => (
          <SpecialtyRow key={row.name} row={row} />
        ))}
      </ul>
      {waiting.length > 0 && (
        <div className="border-t border-enc-line px-4 py-3">
          <Eyebrow>Not started</Eyebrow>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {waiting.map((row) => {
              const Icon = specialtyIcon(row.name)
              return (
                <li key={row.name}>
                  <Link
                    href={specialtyHref(row.name)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-enc-line-strong px-2.5 py-1 text-[12.5px] text-enc-ink-2 outline-none transition-colors hover:bg-enc-desk hover:text-enc-ink focus-visible:ring-2 focus-visible:ring-brand-300"
                  >
                    <Icon className="h-3.5 w-3.5 text-enc-ink-3" strokeWidth={1.8} aria-hidden />
                    {row.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Paper>
  )
}

// ── Milestones ──────────────────────────────────────────────────────────────

const MILESTONE_ICON: Record<MilestoneId, LucideIcon> = { first_case: Sparkles, streak_3: Flame, streak_7: Flame, score_90: Target, specialty_complete: Medal, all_cases: Trophy }

function MilestoneRow({ m }: { m: Milestone }) {
  const Icon = MILESTONE_ICON[m.id] ?? Sparkles
  const filled = m.fraction === undefined ? undefined : Math.round(Math.max(0, Math.min(1, m.fraction)) * 100)
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", m.earned ? "bg-brand-50 text-brand-700" : "bg-enc-console text-enc-ink-3")} aria-hidden>
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className={cn("text-[14px] font-medium", m.earned ? "text-enc-ink" : "text-enc-ink-2")}>
            {m.title}
            <span className="sr-only">{m.earned ? " (reached)" : " (not yet)"}</span>
          </span>
          {m.earned && (
            <span className="flex shrink-0 items-center gap-1 text-[12px] text-enc-ink-3" suppressHydrationWarning>
              <Check className="h-3.5 w-3.5 text-brand-600" strokeWidth={2.4} aria-hidden />
              {m.earnedAt ? relativeDay(m.earnedAt) : ""}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-enc-ink-3">{m.earned ? m.detail : (m.progress ?? m.detail)}</p>
        {!m.earned && filled !== undefined && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-enc-line" aria-hidden>
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${filled === 0 ? 0 : Math.max(6, filled)}%` }} />
          </div>
        )}
      </div>
    </li>
  )
}

/** A few real things done, each worked out from the attempts (nothing here is handed out). */
export function MilestonesCard({ milestones }: { milestones: Milestone[] }) {
  const reached = milestones.filter((m) => m.earned).length
  return (
    <Paper className="overflow-hidden">
      <PaperHeader
        title="Milestones"
        description="Each one is something you have done."
        actions={
          <span className="font-mono text-[12px] text-enc-ink-3 tabular-nums" aria-label={`${reached} of ${milestones.length} reached`}>
            {reached} / {milestones.length}
          </span>
        }
      />
      <ul className="divide-y divide-enc-line">
        {milestones.map((m) => (
          <MilestoneRow key={m.id} m={m} />
        ))}
      </ul>
    </Paper>
  )
}
