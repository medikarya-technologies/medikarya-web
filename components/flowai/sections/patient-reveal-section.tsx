"use client"

// The first product reveal — one large immersive composition, not five smaller cards. Real screenshot
// (public/screens/case-briefing.png), given depth with a rotated colour panel behind it and an overlapping
// badge, instead of a plain centered rectangle the way this page used to present every screenshot.

import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"
import { Eyebrow } from "@/components/cases/encounter-ui"

export default function PatientRevealSection() {
  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <section className="bg-enc-sheet py-20 sm:py-28" ref={ref}>
      <div className="mx-auto max-w-5xl px-4">
        <div className={cn("mx-auto max-w-2xl text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
          <Eyebrow className="text-brand-600">The first move</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">Start with a patient, not a question.</h2>
          <p className="mt-4 text-lg leading-relaxed text-enc-ink-2">They won't hand you the diagnosis. You have to ask the right questions.</p>
        </div>

        <div className={cn("relative mx-auto mt-16 max-w-3xl transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")} style={{ transitionDelay: isVisible ? "150ms" : "0ms" }}>
          <div aria-hidden className="absolute inset-4 -z-10 rotate-2 rounded-[1.75rem] bg-brand-100 sm:inset-6" />
          <div className="overflow-hidden rounded-[1.5rem] border border-enc-line-strong shadow-2xl shadow-slate-900/15">
            <img src="/screens/case-briefing.png" alt="A real case briefing: the patient's identity, complaint and vitals on arrival — before any question is asked" loading="lazy" decoding="async" className="block w-full" />
          </div>
          <div className="absolute -bottom-4 -left-3 rounded-xl border border-enc-line-strong bg-enc-sheet px-3.5 py-2 shadow-lg sm:-left-6">
            <p className="text-[11px] font-semibold text-enc-ink">Real patient. Real chart.</p>
            <p className="text-[10.5px] text-enc-ink-3">Never the diagnosis, not even here.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
