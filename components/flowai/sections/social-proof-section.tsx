"use client"

// Redesigned per feedback: the photos were "another generic centered section with three cards" — same size,
// same grid, same rhythm as everything else on the page. This keeps the real photos and the honest caption
// (still no names/quotes — only the institution was confirmed) but gives them an asymmetric, editorial
// composition instead: one large photo carrying the section, two smaller ones offset beside it.

import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"

export default function SocialProofSection() {
  const { ref, isVisible } = useScrollAnimation(0.2)

  return (
    <section className="bg-brand-50 py-20 sm:py-28" ref={ref}>
      <div className="mx-auto max-w-6xl px-4">
        <div className={cn("mx-auto max-w-2xl text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
          <h2 className="text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">Built around real medical students.</h2>
          <p className="mt-4 text-lg leading-relaxed text-enc-ink-2">Piloted at Maulana Azad Medical College, Delhi.</p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          <div
            className={cn("overflow-hidden rounded-2xl border border-enc-line-strong shadow-enc-sheet transition-all duration-500 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
          >
            <img src="/pilot/mamc-3.jpg" alt="A pilot session in progress at the whiteboard" loading="lazy" decoding="async" className="block aspect-4/3 h-full w-full object-cover sm:aspect-auto" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-1 sm:grid-rows-2">
            <div
              className={cn("overflow-hidden rounded-2xl border border-enc-line-strong shadow-enc-sheet transition-all duration-500 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
              style={{ transitionDelay: isVisible ? "90ms" : "0ms" }}
            >
              <img src="/pilot/mamc-1.jpg" alt="A student working through a case on a tablet during the pilot session" loading="lazy" decoding="async" className="block aspect-4/3 h-full w-full object-cover object-top" />
            </div>
            <div
              className={cn("overflow-hidden rounded-2xl border border-enc-line-strong shadow-enc-sheet transition-all duration-500 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
              style={{ transitionDelay: isVisible ? "160ms" : "0ms" }}
            >
              <img src="/pilot/mamc-4.jpg" alt="Students working through cases together during the pilot" loading="lazy" decoding="async" className="block aspect-4/3 h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
