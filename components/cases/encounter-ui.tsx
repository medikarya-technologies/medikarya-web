"use client"

// The small vocabulary the bedside encounter is drawn from. Everything on that
// screen is built from these, so the zones differ by SURFACE and PURPOSE, never by
// a one-off colour or radius. Tokens live in app/globals.css (`--color-enc-*`).
//
//   Eyebrow      the tiny uppercase name of a zone ("BEDSIDE MONITOR")
//   Paper        a white sheet lying on the desk: the content of a tab
//   PaperHeader  the title strip of a sheet
//   StatusPill   pending / ready / critical: the only coloured chips on the screen
//   Timestamp    a clock time, in the monospace face the monitor uses

import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-semibold tracking-[0.09em] text-enc-ink-3 uppercase", className)}>{children}</p>
}

export function Paper({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-xl border border-enc-line bg-enc-sheet shadow-enc-sheet", className)} {...rest}>
      {children}
    </section>
  )
}

export function PaperHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3 border-b border-enc-line px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] leading-tight font-semibold text-enc-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-enc-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export type Tone = "neutral" | "ok" | "warn" | "crit" | "accent"

const TONES: Record<Tone, string> = {
  neutral: "bg-enc-console text-enc-ink-2",
  ok: "bg-enc-ok-soft text-enc-ok",
  warn: "bg-enc-warn-soft text-enc-warn",
  crit: "bg-enc-crit-soft text-enc-crit",
  accent: "bg-brand-50 text-brand-700",
}

export function StatusPill({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-semibold tabular-nums", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function Timestamp({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[11px] tabular-nums text-enc-ink-3", className)}>{children}</span>
}
