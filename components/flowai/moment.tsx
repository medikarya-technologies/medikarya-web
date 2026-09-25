"use client"

// Shared "numbered moment" device (rounds.co's own 01/02/03/04 pattern — a plain structural convention, not a
// copyrightable asset) — extracted from story-section.tsx once debrief-section.tsx needed the identical layout
// for moments 03/04, continuing the same numbered sequence rather than starting a new, differently-styled
// heading pattern for the second half of the page. Real reuse (two call sites), not speculative genericising.
//
// accentClassName lets each moment take a different colour instead of every number/label defaulting to the
// same brand-600 blue — alternates blue / the logo's real green across the 4 moments (01 blue, 02 green, 03
// blue, 04 green), so the sequence reads as a deliberate rhythm rather than either one flat colour or an
// unrelated rainbow.

import { cn } from "@/lib/utils"

export function Moment({
  n,
  label,
  title,
  text,
  reverse,
  visible,
  delay,
  accentClassName = "text-brand-600",
  children,
}: {
  n: string
  label: string
  title: string
  text: string
  reverse: boolean
  visible: boolean
  delay: number
  accentClassName?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-10 transition-all duration-700 ease-out sm:grid-cols-2 sm:gap-16",
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      <div className={reverse ? "sm:order-2" : ""}>
        <p className={cn("text-[12.5px] font-bold tracking-widest uppercase", accentClassName)}>
          {n} · {label}
        </p>
        <h3 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">{title}</h3>
        <p className="mt-4 max-w-sm text-[15.5px] leading-relaxed text-enc-ink-2">{text}</p>
      </div>
      <div className={cn("mx-auto w-full", reverse ? "sm:order-1" : "flex sm:justify-end")}>{children}</div>
    </div>
  )
}
