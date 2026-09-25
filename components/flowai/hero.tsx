"use client"

// Fifth hero. Brief: headline "Practise clinical decisions before they become real."
// Left-aligned text, no eyebrow pill, no blue gradient background, quiet off-white.
// Simulator panel: real free case (viral-gastroenteritis, 2M Pediatrics).
// NO numeric vitals — this case has no verified vitals block per the existing code comments.
// Panel shows: patient header, real animating ECG (TelemetryMonitor, sinus_normal, rate 104),
// real paraphrased chat exchange, and a looping typing indicator so the patient feels alive.
// Proof line replaces the social-proof photo section: one quiet text line.
//
// CTAs are now auth-aware, matching navbar.tsx's own already-existing logged-in/out split (that one resolves
// server-side via Clerk's `auth()`; this file is "use client" for the typing indicator's interval, so it reads
// the client hook `useAuth()` instead — same signed-in fact, different Clerk API for a client component).
// Signed in: one button, "Go to dashboard" — "try a case free" doesn't make sense once you already have cases,
// and neither does an invitation to log in. Signed out (also the default during Clerk's brief client-side load,
// which is the majority case for a marketing-page visitor anyway, so no loading-state flash handling needed):
// "Try a case free" unchanged, "See how it works" replaced with "Log in" per this round's explicit ask — the
// anchor-scroll link was judged less useful on this page than a direct path for a returning visitor who doesn't
// need convincing. "No signup needed to try a case." made explicit in its own small line rather than folded into
// the button label, so the button itself stays short.

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, LayoutDashboard, Play } from "lucide-react"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PatientAvatar } from "@/components/cases/patient-avatar"
import { TelemetryMonitor } from "@/components/cases/telemetry-monitor"

const FREE_CASE = { id: "viral-gastroenteritis", age: 2, gender: "male", label: "2 yrs · Paediatrics" }

const EXCHANGE: Array<{ from: "patient" | "student"; text: string }> = [
  { from: "student", text: "How long has he been vomiting?" },
  { from: "patient", text: "Since yesterday afternoon — no blood, just everything he's eaten." },
  { from: "student", text: "Any loose stools as well?" },
]

// Three-dot typing indicator — cycles continuously so the patient always feels mid-thought.
function TypingIndicator() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 450)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-enc-line bg-enc-desk px-4 py-2.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-enc-ink-3 transition-opacity duration-200",
              step === i ? "opacity-100" : "opacity-30"
            )}
          />
        ))}
      </div>
    </div>
  )
}

function Bubble({ from, text }: { from: "patient" | "student"; text: string }) {
  const isStudent = from === "student"
  return (
    <div className={cn("flex", isStudent ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug",
          isStudent
            ? "rounded-br-md border border-brand-200 bg-brand-50 text-enc-ink"
            : "rounded-bl-md border border-enc-line bg-enc-desk text-enc-ink"
        )}
      >
        {text}
      </p>
    </div>
  )
}

export function Hero() {
  const { isSignedIn } = useAuth()

  return (
    <section className="relative overflow-hidden bg-enc-sheet px-4 py-16 sm:py-20 md:py-28 lg:py-32">
      {/* Quiet background — no blue gradient, just a very faint off-white tone at the top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "linear-gradient(180deg, oklch(0.975 0.003 250) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-16">
        {/* LEFT: headline + CTAs + proof */}
        <div className="max-w-xl">
          <h1 className="text-balance text-4xl leading-[1.06] font-extrabold tracking-tight text-enc-ink sm:text-5xl lg:text-[3.25rem]">
            Practise clinical decisions{" "}
            <span className="text-brand-600">before they become real.</span>
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-lg leading-relaxed text-enc-ink-2">
            Talk to a live patient, work through the case, and decide what to do next — before the stakes are real.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {isSignedIn ? (
              <Button
                asChild
                size="lg"
                className="group h-auto rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
              >
                <Link href="/dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Go to dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  size="lg"
                  className="group h-auto rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
                >
                  <Link href="/try" className="flex items-center gap-2">
                    <Play className="h-4 w-4 fill-current" />
                    Try a case free
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="group h-auto rounded-full border-enc-line-strong px-7 py-3.5 text-base font-medium text-enc-ink-2 hover:bg-enc-desk"
                >
                  <Link href="/login" className="flex items-center gap-2">
                    Log in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          {!isSignedIn && <p className="mt-3 text-[12.5px] text-enc-ink-3">No signup needed to try a case.</p>}

          {/* Quiet proof line — replaces photo gallery */}
          <p className="mt-4 text-[13px] text-enc-ink-3">
            Piloted at{" "}
            <span className="font-medium text-enc-ink-2">Maulana Azad Medical College, Delhi</span>
          </p>
        </div>

        {/* RIGHT: live simulator panel */}
        <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
          <div className="overflow-hidden rounded-[1.5rem] border border-enc-line-strong bg-enc-sheet shadow-2xl shadow-slate-900/12">
            {/* Patient header */}
            <div className="flex items-center gap-2.5 border-b border-enc-line-strong bg-enc-console px-4 py-3">
              <PatientAvatar age={FREE_CASE.age} gender={FREE_CASE.gender} seed={FREE_CASE.id} className="h-8 w-8" />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-enc-ink leading-none">{FREE_CASE.label}</p>
                <p className="mt-0.5 text-[11px] text-enc-ink-3">Chief complaint: vomiting and loose stools</p>
              </div>
              <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-widest text-enc-ok uppercase">
                <span className="enc-live-dot h-1.5 w-1.5 rounded-full bg-enc-ok" />
                Live
              </span>
            </div>

            {/* ECG strip — real TelemetryMonitor */}
            <div className="border-b border-enc-line bg-enc-desk px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold tracking-widest text-enc-ink-3 uppercase">
                <span>Lead II</span>
                <span>25 mm/s</span>
              </div>
              <TelemetryMonitor rhythm="sinus_normal" rate={104} className="h-14 w-full" />
            </div>

            {/* Chat exchange + live typing */}
            <div className="space-y-2.5 p-4">
              {EXCHANGE.map((m, i) => (
                <Bubble key={i} {...m} />
              ))}
              <TypingIndicator />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
