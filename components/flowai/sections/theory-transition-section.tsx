"use client"

// A short human beat, not a section: no card, no icon grid, no screenshot — the brief was explicit that this
// shouldn't look like a standard three-card "problem section" the way problems-section.tsx used to (deleted
// 2026-09-22). Just three lines of type, building to the pivot, with a small THEORY → CASE → PATIENT marker
// standing in for the "small interaction" the brief asked for instead of a fabricated illustration.

import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"

export default function TheoryTransitionSection() {
  const { ref, isVisible } = useScrollAnimation(0.4)

  return (
    <section className="bg-accent-50 py-16 sm:py-24">
      <div className={cn("mx-auto max-w-2xl px-4 text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")} ref={ref}>
        <div className="mb-6 flex items-center justify-center gap-2 text-[11px] font-bold tracking-[0.2em] text-accent-700 uppercase">
          <span>Theory</span>
          <span className="text-accent-400">→</span>
          <span>Case</span>
          <span className="text-accent-400">→</span>
          <span className="text-enc-ink">Patient</span>
        </div>
        <p className="text-2xl leading-snug font-medium text-enc-ink-3 sm:text-3xl">
          You've read the case. You've memorised the differential.
        </p>
        <p className="mt-3 text-2xl leading-snug font-bold text-enc-ink sm:text-3xl">But what happens when the patient is actually in front of you?</p>
      </div>
    </section>
  )
}
