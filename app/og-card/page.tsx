import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { TelemetryMonitor } from "@/components/cases/telemetry-monitor"

// Not a real page — a fixed 1200x630 composition captured with headless Chrome to produce
// public/og-image.png (see project-landing-page-redesign.md memory for the capture command).
// Never linked from anywhere in the app; noindex as a safety net regardless.
//
// Same device the OLD og-image.png used (logo -> headline -> subhead -> CTA pill -> product visual
// bleeding off the bottom edge) but every piece of content is real and current instead of the old
// file's fabrications: real hero.tsx headline/subhead copy verbatim, the real free case
// (viral-gastroenteritis) instead of an invented "Sarah Chen" with invented vitals, the real
// PatientAvatar + TelemetryMonitor + a real paraphrased exchange instead of a static mockup, and the
// real "Try a case free" pill colour (brand-600) instead of the banned teal.

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const FREE_CASE = { id: "viral-gastroenteritis", age: 2, gender: "male", label: "2 yrs · Paediatrics" }

const EXCHANGE: Array<{ from: "patient" | "student"; text: string }> = [
  { from: "student", text: "How long has he been vomiting?" },
  { from: "patient", text: "Since yesterday afternoon — no blood, just everything he's eaten." },
]

function Bubble({ from, text }: { from: "patient" | "student"; text: string }) {
  const isStudent = from === "student"
  return (
    <div className={isStudent ? "flex justify-end" : "flex justify-start"}>
      <p
        className={
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug " +
          (isStudent
            ? "rounded-br-md border border-brand-200 bg-brand-50 text-enc-ink"
            : "rounded-bl-md border border-enc-line bg-enc-desk text-enc-ink")
        }
      >
        {text}
      </p>
    </div>
  )
}

export default function OgCardPage() {
  return (
    <div className="relative h-[630px] w-[1200px] overflow-hidden bg-enc-sheet">
      {/* Next.js's dev-mode indicator is a fixed-position overlay outside this page's own DOM tree —
          harmless in production (it doesn't exist there), but would otherwise land in a headless capture. */}
      <style>{`nextjs-portal { display: none !important; }`}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(60% 55% at 50% 0%, oklch(0.95 0.02 240 / 0.55) 0%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-2 px-14 pt-10">
        <div className="flex h-8 w-8 items-center justify-center">
          <img src="/medikarya.svg" alt="" className="h-full w-full object-contain" />
        </div>
        <span className="text-lg font-semibold text-enc-ink">MediKarya</span>
      </div>

      {/* Headline + subhead + CTA pill */}
      <div className="relative z-10 mx-auto mt-6 max-w-3xl text-center">
        <h1 className="text-[46px] leading-[1.08] font-extrabold tracking-tight text-enc-ink">
          Practise clinical decisions <span className="text-brand-600">before they become real.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[18px] leading-snug text-enc-ink-2">
          Talk to a live patient and decide what to do next.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-brand-600/25">
          Try a case free
          <ArrowRight className="h-4 w-4" />
          <span className="ml-1 font-normal text-white/80">no signup needed</span>
        </div>
      </div>

      {/* Real product panel, bleeding off the bottom edge */}
      <div className="absolute left-1/2 top-[335px] z-10 w-[620px] -translate-x-1/2">
        <div className="overflow-hidden rounded-t-[1.5rem] border border-b-0 border-enc-line-strong bg-enc-sheet shadow-2xl shadow-slate-900/15">
          <div className="flex items-center gap-2.5 border-b border-enc-line-strong bg-enc-console px-5 py-3.5">
            <PatientAvatar age={FREE_CASE.age} gender={FREE_CASE.gender} seed={FREE_CASE.id} className="h-9 w-9" />
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold leading-none text-enc-ink">{FREE_CASE.label}</p>
              <p className="mt-1 text-[11.5px] text-enc-ink-3">Chief complaint: vomiting and loose stools</p>
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-widest text-enc-ok uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-enc-ok" />
              Live
            </span>
          </div>

          <div className="border-b border-enc-line bg-enc-desk px-5 py-3.5">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold tracking-widest text-enc-ink-3 uppercase">
              <span>Lead II</span>
              <span>25 mm/s</span>
            </div>
            <TelemetryMonitor rhythm="sinus_normal" rate={104} className="h-16 w-full" />
          </div>

          <div className="space-y-3 p-5">
            {EXCHANGE.map((m, i) => (
              <Bubble key={i} {...m} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
