"use client"

// The small vocabulary the dashboard is drawn from, on the same surfaces as the bedside encounter
// (tokens `--color-enc-*` in app/globals.css): a desk for the page, white sheets for content, one green card
// for XP, and one accent (the brand blue) for what the student does. Apart from that card, green, amber and red
// mean a result and nothing else.

import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { scoreBand, type DifficultyLevel, DIFFICULTY_LABEL } from "@/lib/library/case-library"
import { Eyebrow } from "@/components/cases/encounter-ui"

/**
 * The page's column, centred, and as wide as a big screen allows up to 1536 px. (It used to stop at 1120 px, which left
 * about 130 px of bare desk on each side of the content on a 1536 px screen. Pages whose content is narrow by nature
 * arrange themselves in columns instead: see profile.tsx.)
 */
export function PageContainer({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-[1536px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10", className)} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.015em] text-enc-ink sm:text-[30px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-enc-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

// The two buttons. The brand blue is for the one thing the student does next. (Defined in button-styles.ts so server components can use them too.)
export { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./button-styles"

/** A page that has nothing to show, or could not: an icon, what happened in plain words, and what to do next. */
export function StatePanel({ icon, title, children, actions, reference }: { icon: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode; reference?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-enc-console text-enc-ink-2" aria-hidden>
        {icon}
      </span>
      <h1 className="mt-5 text-[20px] leading-snug font-semibold text-enc-ink">{title}</h1>
      {children && <div className="mt-2 text-[14.5px] leading-relaxed text-enc-ink-2">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      {reference && <p className="mt-6 font-mono text-[11.5px] text-enc-ink-3">Reference {reference}</p>}
    </div>
  )
}

/** Three dots: how hard a case is. Not a colour, because difficulty is not a status. */
export function DifficultyMeter({ level, label = true }: { level: DifficultyLevel; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Difficulty: ${DIFFICULTY_LABEL[level]}`}>
      <span className="inline-flex items-center gap-[3px]" role="img" aria-label={`Difficulty: ${DIFFICULTY_LABEL[level]}`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= level ? "bg-enc-ink-2" : "bg-enc-line-strong")} />
        ))}
      </span>
      {label && <span>{DIFFICULTY_LABEL[level]}</span>}
    </span>
  )
}

/** An authored live simulation: a patient who changes, treatments to give. */
export function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] leading-4 font-semibold text-brand-700">
      <span className="enc-live-dot h-1.5 w-1.5 rounded-full bg-brand-600" />
      Live simulation
    </span>
  )
}

const BAND_TEXT = { ok: "text-enc-ok", warn: "text-enc-warn", crit: "text-enc-crit" } as const

/** A score in the monitor's monospace face, in the colour of how it went. */
export function ScoreValue({ score, className }: { score: number; className?: string }) {
  return <span className={cn("font-mono font-medium tabular-nums", BAND_TEXT[scoreBand(score)], className)}>{score}</span>
}
