"use client"

// Deterioration section — modified from original:
// 1. Headline → "And the patient doesn't wait for you."
// 2. Eyebrow removed — headline alone is stronger
// 3. INTERVENE button added below the AFTER panel (visual, disabled — not wired to an action)
// 4. All accent-* (teal) colors replaced with brand-* or neutral white/grey
// 5. Real patient data and real TelemetryMonitor preserved exactly as before
//
// The data here is from an actual run of acute-anterior-stemi.json in /sim-preview:
// the vitals, appearance values and nurse alert copy are verbatim from that run.

import Link from "next/link"
import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"
import { PatientPortraitStyled } from "@/components/cases/patient-portrait-styled"
import { TelemetryMonitor } from "@/components/cases/telemetry-monitor"
import type { ResolvedLook } from "@/lib/simulation/appearance"

const PATIENT = { age: 58, gender: "male", seed: "acute-anterior-stemi" }

const BASELINE_LOOK: ResolvedLook = { pallor: 2, jaundice: 0, cyanosis: 0, flushed: 0, sweating: 3, sunken_eyes: 0, expression: "pain" }
const CRISIS_LOOK: ResolvedLook = { pallor: 3, jaundice: 0, cyanosis: 1, flushed: 0, sweating: 3, sunken_eyes: 0, expression: "drowsy" }

function Vitals({ hr, bp, spo2, rr, crit }: { hr: number; bp: string; spo2: number; rr: number; crit: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg bg-white/10 text-center">
      {[
        { l: "HR", v: hr, c: crit ? "text-enc-crit" : "text-enc-ok" },
        { l: "SpO₂", v: spo2, c: crit ? "text-enc-crit" : "text-enc-spo2" },
        { l: "BP", v: bp, c: "text-white" },
        { l: "RR", v: rr, c: "text-enc-warn" },
      ].map((x) => (
        <div key={x.l} className="bg-brand-950 px-2 py-3">
          <p className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">{x.l}</p>
          <p className={cn("font-mono text-lg font-bold tabular-nums", x.c)}>{x.v}</p>
        </div>
      ))}
    </div>
  )
}

export default function DeteriorationSection() {
  const { ref, isVisible } = useScrollAnimation(0.2)

  return (
    <section className="relative overflow-hidden bg-brand-950 py-20 sm:py-28" ref={ref}>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to right, var(--brand-300) 1px, transparent 1px), linear-gradient(to bottom, var(--brand-300) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.08,
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 45%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 45%, transparent 100%)",
        }}
      />

      {/* No Eyebrow — headline alone is the hook */}
      <div className={cn("relative mx-auto max-w-2xl px-4 text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">And the patient doesn't wait for you.</h2>
        <p className="mt-4 text-lg leading-relaxed text-white/60">Delay the right decision, and the case changes underneath you. This is a real run of a real case — nothing here is staged.</p>
      </div>

      <div
        className={cn("relative mx-auto mt-14 grid max-w-4xl items-center gap-4 px-4 sm:grid-cols-[1fr_auto_1fr] transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
        style={{ transitionDelay: isVisible ? "120ms" : "0ms" }}
      >
        {/* BEFORE */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <PatientPortraitStyled age={PATIENT.age} gender={PATIENT.gender} seed={PATIENT.seed} look={BASELINE_LOOK} variant="face" className="h-11 w-11 rounded-full ring-1 ring-white/15" label="Patient on arrival" />
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-white/40 uppercase">On arrival — 00:00</p>
              <p className="text-sm text-white/80">Anxious, pale, sweating, clutching his chest.</p>
            </div>
          </div>
          <div className="p-4">
            <TelemetryMonitor rhythm="sinus_tachycardia" rate={112} alarming={false} className="h-16 w-full" />
          </div>
          <Vitals hr={112} bp="94/62" spo2={91} rr={24} crit={false} />
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-2 py-2 text-white/50 sm:flex-col sm:py-0">
          <Clock3 className="h-4 w-4" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold tracking-widest uppercase">20 min pass</span>
          <ArrowRight className="hidden h-4 w-4 sm:block" strokeWidth={1.8} />
        </div>

        {/* AFTER */}
        <div className="overflow-hidden rounded-2xl border border-enc-crit/40 bg-white/[0.03] shadow-lg shadow-enc-crit/10">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <PatientPortraitStyled age={PATIENT.age} gender={PATIENT.gender} seed={PATIENT.seed} look={CRISIS_LOOK} variant="face" className="h-11 w-11 rounded-full ring-1 ring-enc-crit/50" label="Patient in cardiogenic shock" />
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-enc-crit uppercase">Untreated — 20:00</p>
              <p className="text-sm text-white/80">Grey, drowsy, drenched in sweat. Barely rousable.</p>
            </div>
          </div>
          <div className="p-4">
            <TelemetryMonitor rhythm="vt_sustained" rate={180} alarming className="h-16 w-full" />
          </div>
          <Vitals hr={180} bp="66/44" spo2={83} rr={24} crit />
          <div className="flex items-start gap-2 border-t border-enc-crit/30 bg-enc-crit/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-enc-crit" strokeWidth={2} />
            <p className="text-[12.5px] leading-snug text-white/85">
              <span className="font-semibold text-white">Nurse alert.</span> Patient acutely deteriorating. VT on the monitor. Call for the crash team.
            </p>
          </div>

          {/* INTERVENE button — visual only, represents the in-app action */}
          <div className="border-t border-white/10 px-4 py-3">
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-brand-500/40 bg-brand-600/15 py-2.5 text-sm font-bold tracking-wide text-brand-300 transition-colors hover:bg-brand-600/20 disabled:cursor-default"
            >
              INTERVENE
            </button>
          </div>
        </div>
      </div>

      <p
        className={cn("relative mx-auto mt-8 max-w-md text-center text-[13px] text-white/50 transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
        style={{ transitionDelay: isVisible ? "220ms" : "0ms" }}
      >
        Deteriorating cases like this one are part of{" "}
        <Link href="#pricing" className="font-semibold text-brand-400 hover:text-brand-300">
          Pro
        </Link>
        .
      </p>
    </section>
  )
}
