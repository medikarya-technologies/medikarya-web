"use client"

// "Your training": four numbers, each on a card of its own with its own icon and colour so they can be told
// apart at a glance, and below them the ledger the numbers come from. (It used to be one green slab holding
// all of it: every number looked like every other, and green bars on green could not be read.)
//
//   Total XP     the one green card, and how it has grown, attempt by attempt
//   Cases done   how many of the library, as a bar of segments
//   Streak       the days, and which of the last seven you were here
//   Average      the mean score, and how the latest attempt compares
//
// The ledger is XP case by case: the patient's face, a bar for what the best attempt paid (green 90 and over,
// amber 70 to 89, red under 70, on a white sheet where those colours can be read) inside a dashed outline for what
// the case could pay. Every column is the way back into that case. Colour is used to say something: green
// belongs to XP alone here, each other card has its own, and the bars mean how an attempt went.

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ClipboardCheck, Flame, Gauge, Zap, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  cumulative,
  ledgerLabel,
  scoreTrend,
  sparkline,
  summarise,
  weekActivity,
  xpLedger,
  type DashboardStats,
  type LedgerEntry,
  type LibraryCase,
  type ProgressMap,
  type ScoreBand,
} from "@/lib/library/case-library"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { Paper } from "@/components/cases/encounter-ui"

// ── A trend line ────────────────────────────────────────────────────────────

/** A line and the soft area under it, stretched to the space it is given; a dashed baseline until there are two points. */
function Trace({ values, min, max, label }: { values: number[]; min?: number; max?: number; label: string }) {
  const W = 100
  const H = 32
  const points = sparkline(values, W, H, { min, max, pad: 3 })
  if (points.length < 2) return <div className="h-full w-full border-b border-dashed border-current opacity-30" aria-hidden />
  const line = points.map((p) => p.join(",")).join(" ")
  const first = points[0]
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={label}>
      <polygon points={`${first[0]},${H} ${line} ${last[0]},${H}`} fill="currentColor" opacity={0.15} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ── A card ──────────────────────────────────────────────────────────────────

type Tone = "xp" | "cases" | "streak" | "score"

const CHIP: Record<Tone, string> = {
  xp: "bg-white/10 text-enc-grow-a",
  cases: "bg-brand-50 text-brand-700",
  streak: "bg-enc-warn-soft text-enc-warn",
  score: "bg-accent-50 text-accent-700",
}

/** The same four rows on every card (what it is, the number, a picture of it, one line about it), so they line up. */
function Card({ tone, icon: Icon, label, value, unit, visual, note }: { tone: Tone; icon: LucideIcon; label: string; value: string; unit?: string; visual: ReactNode; note: ReactNode }) {
  const hero = tone === "xp"
  return (
    <div className={cn("flex min-w-0 flex-col rounded-xl p-4", hero ? "bg-enc-grow text-enc-grow-ink shadow-[inset_0_0_0_1px_var(--color-enc-grow-line)]" : "border border-enc-line bg-enc-sheet shadow-enc-sheet")}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", CHIP[tone])} aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <span className={cn("truncate text-[13px] font-medium", hero ? "text-enc-grow-dim" : "text-enc-ink-2")}>{label}</span>
      </div>
      <p className={cn("mt-3 flex flex-wrap items-baseline gap-x-1.5 font-mono text-[28px] leading-none font-medium tabular-nums @2xl:text-[30px]", hero ? "text-enc-grow-ink" : "text-enc-ink")}>
        {value}
        {unit && <span className={cn("text-[13px] font-normal", hero ? "text-enc-grow-dim" : "text-enc-ink-3")}>{unit}</span>}
      </p>
      <div className="mt-3.5 flex h-8 items-center">{visual}</div>
      <p className={cn("mt-2.5 min-h-4 text-[12px] leading-tight", hero ? "text-enc-grow-dim" : "text-enc-ink-3")}>{note}</p>
    </div>
  )
}

/** How many of the cases are done: one segment per case (a plain bar when there are too many for that). */
function Segments({ done, total }: { done: number; total: number }) {
  if (total <= 0) return <div className="h-2 w-full rounded-full bg-enc-line" />
  if (total > 20) {
    return (
      <div className="h-2 w-full overflow-hidden rounded-full bg-enc-line">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    )
  }
  return (
    <div className="flex w-full gap-[3px]" role="img" aria-label={`${done} of ${total} cases tried`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-2 flex-1 rounded-full", i < done ? "bg-brand-600" : "bg-enc-line")} />
      ))}
    </div>
  )
}

/** The last seven days, today on the right: a dot for each day you were here. */
function Week({ days }: { days: boolean[] | null }) {
  const done = days?.filter(Boolean).length ?? 0
  return (
    <span className="flex w-full items-center justify-between" role="img" aria-label={days ? `Active on ${done} of the last 7 days` : "Last 7 days"}>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={cn("h-2.5 w-2.5 rounded-full", days?.[i] ? "bg-enc-warn" : "bg-enc-line", i === 6 && "ring-2 ring-enc-warn/30 ring-offset-2 ring-offset-enc-sheet")} />
      ))}
    </span>
  )
}

// ── The ledger ──────────────────────────────────────────────────────────────

const BAND_FILL: Record<ScoreBand, string> = { ok: "bg-enc-ok", warn: "bg-enc-warn", crit: "bg-enc-crit" }
const BAND_TEXT: Record<ScoreBand, string> = { ok: "text-enc-ok", warn: "text-enc-warn", crit: "text-enc-crit" }
const BAR_AREA = 76

function Column({ entry, scale, index, count }: { entry: LedgerEntry; scale: number; index: number; count: number }) {
  const ceiling = Math.max(6, Math.round((entry.max / scale) * BAR_AREA))
  const fill = entry.earned > 0 ? Math.max(4, Math.round((entry.earned / scale) * BAR_AREA)) : 0
  const label = ledgerLabel(entry)
  // The note that opens on hover stays inside the card: the first columns open to the right, the last to the left.
  const place = index < 2 ? "left-0" : index >= count - 2 ? "right-0" : "left-1/2 -translate-x-1/2"

  return (
    <Link href={`/dashboard/cases/${entry.id}`} aria-label={label} className="group relative flex min-w-0 flex-col items-center gap-2 rounded-md pt-1 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
      <div className="relative w-full max-w-[30px] sm:max-w-[34px]" style={{ height: BAR_AREA }}>
        {/* what the case is worth */}
        <div className="absolute inset-x-0 bottom-0 rounded-[3px] border border-dashed border-enc-line-strong transition-colors group-hover:border-enc-ink-3" style={{ height: ceiling }} />
        {/* what it has paid */}
        {fill > 0 && entry.band && <div className={cn("absolute inset-x-[1px] bottom-[1px] rounded-[2px]", BAND_FILL[entry.band])} style={{ height: Math.min(fill, ceiling - 2) }} />}
        {entry.earned > 0 && entry.band && (
          <span className={cn("absolute inset-x-0 text-center font-mono text-[10.5px] leading-none font-medium tabular-nums", BAND_TEXT[entry.band])} style={{ bottom: Math.min(fill, ceiling - 2) + 4 }}>
            {entry.earned}
          </span>
        )}
      </div>
      <PatientAvatar age={entry.patient?.age} gender={entry.patient?.gender} seed={entry.id} className={cn("h-6 w-6 sm:h-7 sm:w-7", entry.attempts === 0 && "opacity-45 grayscale-[0.4] transition-opacity group-hover:opacity-100")} />
      <span role="tooltip" className={cn("pointer-events-none absolute bottom-full z-10 mb-1 hidden w-[210px] rounded-md bg-enc-fill px-2.5 py-2 text-left text-[12px] leading-snug font-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block", place)}>
        {label}
      </span>
    </Link>
  )
}

/** What a colour in the ledger means, so nobody has to guess. */
function Key({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", swatch)} aria-hidden />
      {children}
    </span>
  )
}

function Ledger({ ledger }: { ledger: LedgerEntry[] }) {
  const scale = Math.max(50, ...ledger.map((e) => e.max))
  const earned = ledger.reduce((n, e) => n + e.earned, 0)
  const worth = ledger.reduce((n, e) => n + e.max, 0)
  return (
    <Paper className="mt-3">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 sm:px-5">
        <h3 className="text-[15px] leading-tight font-semibold text-enc-ink">XP by case</h3>
        <span className="font-mono text-[12.5px] text-enc-ink-3 tabular-nums">
          <span className="text-enc-ink">{earned.toLocaleString("en-US")}</span> of {worth.toLocaleString("en-US")} XP
        </span>
      </div>
      <div className="px-4 pt-4 pb-3.5 sm:px-5">
        <div className="grid auto-cols-fr grid-flow-col gap-1 sm:gap-2">
          {ledger.map((entry, i) => (
            <Column key={entry.id} entry={entry} scale={scale} index={i} count={ledger.length} />
          ))}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-enc-line pt-3 text-[12px] text-enc-ink-3">
          <Key swatch="bg-enc-ok">90 and over</Key>
          <Key swatch="bg-enc-warn">70 to 89</Key>
          <Key swatch="bg-enc-crit">under 70</Key>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[2px] border border-dashed border-enc-line-strong" aria-hidden />
            what the case is worth
          </span>
        </p>
      </div>
    </Paper>
  )
}

// ── The panel ───────────────────────────────────────────────────────────────

export function TrainingPanel({ stats, cases, progress, className, action }: { stats: DashboardStats; cases: LibraryCase[]; progress: ProgressMap; className?: string; /** A link or button for the right of the heading. */ action?: ReactNode }) {
  const summary = summarise(cases, progress)
  const ledger = xpLedger(cases, progress)
  const scores = stats.history.map((h) => h.score)
  const trend = scoreTrend(scores)
  const waiting = Math.max(0, summary.total - summary.attempted)
  const latest = stats.history[stats.history.length - 1]

  // "The last seven days" is the visitor's calendar, which the server cannot know: filled in after the page loads.
  const [week, setWeek] = useState<boolean[] | null>(null)
  useEffect(() => setWeek(weekActivity(stats.history.map((h) => h.at))), [stats.history])

  return (
    <section aria-label="Your training" className={cn("@container", className)}>
      <div className="flex items-baseline justify-between gap-3 px-0.5 pb-3">
        <h2 className="text-[15px] leading-tight font-semibold text-enc-ink">Your training</h2>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[12px] text-enc-ink-3 tabular-nums">
            {stats.attempts} {stats.attempts === 1 ? "attempt" : "attempts"}
          </span>
          {action}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Card
          tone="xp"
          icon={Zap}
          label="Total XP"
          value={stats.totalXP.toLocaleString("en-US")}
          unit="xp"
          visual={
            <div className="h-full w-full text-enc-grow-a">
              <Trace values={cumulative(stats.history.map((h) => h.xp))} min={0} label="XP over your attempts" />
            </div>
          }
          note={latest ? `+${latest.xp} from your last case` : "Earned by finishing cases"}
        />
        <Card
          tone="cases"
          icon={ClipboardCheck}
          label="Cases done"
          value={String(summary.attempted)}
          unit={summary.total > 0 ? `of ${summary.total}` : undefined}
          visual={<Segments done={summary.attempted} total={summary.total} />}
          note={summary.total === 0 ? undefined : waiting === 0 ? "Every case tried" : `${waiting} to go`}
        />
        <Card
          tone="streak"
          icon={Flame}
          label="Streak"
          value={String(stats.streakDays)}
          unit={stats.streakDays === 1 ? "day" : "days"}
          visual={<Week days={week} />}
          note={week ? `${week.filter(Boolean).length} of the last 7 days` : "Last 7 days"}
        />
        <Card
          tone="score"
          icon={Gauge}
          label="Average score"
          value={stats.averageScore == null ? "—" : String(stats.averageScore)}
          unit={stats.averageScore == null ? undefined : "%"}
          visual={
            <div className="h-full w-full text-accent-600">
              <Trace values={scores} min={0} max={100} label="Your scores, attempt by attempt" />
            </div>
          }
          note={
            trend ? (
              <>
                latest {trend.latest}%{" "}
                {trend.delta !== 0 && (
                  <span className={trend.delta > 0 ? "text-enc-ok" : "text-enc-crit"}>
                    {trend.delta > 0 ? "▲" : "▼"} {Math.abs(trend.delta)}
                  </span>
                )}
              </>
            ) : scores.length === 1 ? (
              `latest ${scores[0]}%`
            ) : (
              "After your first case"
            )
          }
        />
      </div>

      {ledger.length > 0 && <Ledger ledger={ledger} />}
    </section>
  )
}
