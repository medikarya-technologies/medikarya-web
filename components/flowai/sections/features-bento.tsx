"use client"

// Three real things, not a bento grid of invented mockups. The old version showed a Dicebear cartoon avatar that
// looks nothing like a patient in the app, a fabricated "92% / Grade A" report stamp with an "Empathy" score the
// app has never measured, and a case-library card listing "Gastroenterology: Colitis" — a specialty and a
// condition that are not in the library. Replaced with: the actual patient illustrations, the actual scored
// parts of a case (lib/library/skills.ts, coloured by the app's real score bands — green 90+, amber 70-89, red
// under 70, case-library.ts's scoreBand), and the actual specialties in the library today (passed in from the
// server, so this never goes stale the way that fabricated copy did). Cards are Paper (encounter-ui.tsx), not a
// hand-rolled lookalike, so the radius and shadow match every sheet in the app exactly.

import Link from "next/link"
import { Compass, Library, MessagesSquare, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { scoreBand, type ScoreBand } from "@/lib/library/case-library"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { Eyebrow, Paper } from "@/components/cases/encounter-ui"
import { specialtyIcon } from "@/components/dashboard/specialty-icon"
import { useScrollAnimation } from "@/lib/scroll-animation"
import type { GlimpseCase } from "../case-glimpse"

// The parts a case actually scores (lib/library/skills.ts SKILL_ORDER), weakest-looking first purely for the
// illustration — a real distribution would come from a real student's real attempts, which this is not.
const SKILL_EXAMPLE = [
  { label: "Management", value: 46 },
  { label: "Clinical reasoning", value: 58 },
  { label: "History taking", value: 71 },
  { label: "Investigations", value: 77 },
  { label: "Diagnosis", value: 84 },
]

const BAND: Record<ScoreBand, string> = { ok: "bg-enc-ok", warn: "bg-enc-warn", crit: "bg-enc-crit" }
const BAND_TEXT: Record<ScoreBand, string> = { ok: "text-enc-ok", warn: "text-enc-warn", crit: "text-enc-crit" }

function Faces({ cases }: { cases: GlimpseCase[] }) {
  return (
    <div className="flex -space-x-3">
      {cases.map((c) => (
        <PatientAvatar key={c.id} age={c.patientAge} gender={c.patientGender} seed={c.id} className="h-11 w-11 ring-2 ring-enc-sheet" />
      ))}
    </div>
  )
}

function Card({ visible, delay, className, children }: { visible: boolean; delay: number; className?: string; children: React.ReactNode }) {
  return (
    <Paper className={cn("p-7 transition-all duration-500 ease-out sm:p-8", visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0", className)} style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}>
      {children}
    </Paper>
  )
}

export default function FeaturesBento({ cases = [], specialties = [] }: { cases?: GlimpseCase[]; specialties?: readonly string[] }) {
  const { ref, isVisible } = useScrollAnimation(0.15)
  const freeCase = cases[0]

  return (
    <section id="features" className="bg-enc-desk py-20 sm:py-28" ref={ref}>
      <div className="mx-auto max-w-6xl px-4">
        <div className={cn("mx-auto max-w-2xl text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
          <Eyebrow className="text-brand-600">One ecosystem</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">Everything happens inside the case.</h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <Card visible={isVisible} delay={0} className="md:col-span-2">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
                    <MessagesSquare className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="text-lg font-bold text-enc-ink">A patient who answers what you asked</h3>
                </div>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-enc-ink-2">
                  No multiple choice. Ask a vague question and get a vague answer, same as a real patient — the case only gives up what it should, and never the diagnosis by name.
                </p>
                {cases.length > 0 && (
                  <div className="mt-5 flex items-center gap-4">
                    <Faces cases={cases} />
                    <span className="text-xs text-enc-ink-3">{cases.length} of the cases in the library today</span>
                  </div>
                )}
              </div>
              {freeCase && (
                <div className="w-full shrink-0 rounded-lg border border-enc-line bg-enc-desk p-4 sm:w-72">
                  <p className="text-[10px] font-semibold tracking-widest text-enc-ink-3 uppercase">This case, free</p>
                  <p className="mt-1.5 text-[13.5px] leading-snug font-semibold text-enc-ink">{freeCase.displayTitle}</p>
                  <Link href="/try" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-800">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Try it now, no account
                  </Link>
                </div>
              )}
            </div>
          </Card>

          <Card visible={isVisible} delay={90}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-enc-warn/25 bg-enc-warn-soft text-enc-warn">
                <Compass className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h3 className="text-lg font-bold text-enc-ink">See where the marks went</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-enc-ink-2">Every attempt is broken down by the part of the case it came from, weakest first — not a single grade at the end.</p>
            <p className="mt-5 mb-2 text-[10px] font-semibold tracking-widest text-enc-ink-3 uppercase">Example</p>
            <div className="space-y-2.5">
              {SKILL_EXAMPLE.map((s) => {
                const band = scoreBand(s.value)
                return (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[12.5px] text-enc-ink-2">{s.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-enc-console">
                      <div className={cn("h-full rounded-full", BAND[band])} style={{ width: `${s.value}%` }} />
                    </div>
                    <span className={cn("w-8 shrink-0 text-right font-mono text-[11.5px] tabular-nums", BAND_TEXT[band])}>{s.value}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card visible={isVisible} delay={160}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-enc-ok/25 bg-enc-ok-soft text-enc-ok">
                <Library className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h3 className="text-lg font-bold text-enc-ink">The library, as it stands</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-enc-ink-2">Real clinical cases across the specialties below. It's growing — this is what's there today, not a roadmap.</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {specialties.map((name) => {
                const Icon = specialtyIcon(name)
                return (
                  <li key={name} className="inline-flex items-center gap-1.5 rounded-full border border-enc-line-strong bg-enc-sheet px-3 py-1.5 text-[12.5px] font-medium text-enc-ink-2">
                    <Icon className="h-3.5 w-3.5 text-enc-ink-3" strokeWidth={1.8} />
                    {name}
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  )
}
