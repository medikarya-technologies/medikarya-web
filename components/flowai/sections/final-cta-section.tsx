"use client"

// Final CTA — simplified dramatically per brief:
// 1. Eyebrow removed
// 2. Headline: "Practise the decision before the stakes are real."
// 3. Subline removed
// 4. Secondary button ("See the simulator") removed — visitor already saw it
// 5. Teal glow blob (accent-500/20) removed — brief bans teal on marketing page
// 6. Single CTA: "Try a case free"
//
// Recoloured light/tinted (brand-50), not dark: this sat directly under pricing-section.tsx, which is also
// brand-950 — two identical dark bands back to back with nothing to separate them, the same "no boundary,
// hard to tell what's starting from where" problem flagged elsewhere on this pass. Grid texture kept (same
// motif/recipe as how-it-works and the video section used earlier — brand-300 lines read fine on either a
// light or dark base), so the page still closes on a version of its own signature rather than a plain box.

import Link from "next/link"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"

export default function FinalCtaSection() {
  const { ref, isVisible } = useScrollAnimation(0.2)

  return (
    <section className="relative overflow-hidden bg-brand-50 py-24 sm:py-32" ref={ref}>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to right, var(--brand-300) 1px, transparent 1px), linear-gradient(to bottom, var(--brand-300) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.4,
          maskImage: "radial-gradient(ellipse 80% 100% at 50% 40%, black 45%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 100% at 50% 40%, black 45%, transparent 100%)",
        }}
      />

      <div className={cn("relative mx-auto max-w-2xl px-4 text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
        <h2 className="text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl lg:text-5xl">
          Practise the decision<br className="hidden sm:block" /> before the stakes are real.
        </h2>

        <div className="mt-10">
          <Button
            asChild
            size="lg"
            className="group h-auto rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
          >
            <Link href="/try" className="flex items-center gap-2">
              <Play className="h-4 w-4 fill-current" />
              Try a case free
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
