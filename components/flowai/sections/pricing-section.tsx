"use client"

// Pricing section — modified from original:
// 1. Eyebrow ("Pricing") removed — heading alone is enough
// 2. All accent-* (teal/cyan) replaced with brand-* blue
// 3. Annual toggle save chip → brand color
// 4. Background kept as brand-950 (the brief's own dark pricing section)
// 5. Cards rebuilt as dark glass (bg-white/[0.04] + border-white/10) instead of opaque white —
//    opaque white cards on a navy section is the single most common SaaS pricing pattern there is,
//    and read as "cheap" on exactly that account. Same glass-card language deterioration-section.tsx
//    already uses for its before/after panels, so the two dark sections now share one visual system
//    instead of pricing looking like a different, more generic page bolted onto it.
//
// Monthly/annual toggle real client state. Annual math:
// ₹199×12=₹2,388 vs ₹1,999 saves ~16.3%
// ₹399×12=₹4,788 vs ₹3,999 saves ~16.5%

import { useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"

type Period = "monthly" | "annual"

const TIERS = [
  {
    name: "Free",
    tagline: "A simple way to experience MediKarya.",
    monthly: 0,
    annual: 0,
    features: ["One real case", "No account needed"],
    cta: { label: "Try a case free", href: "/try" },
    highlight: false,
  },
  {
    name: "Basic",
    tagline: "For regular clinical reasoning practice.",
    monthly: 199,
    annual: 1999,
    features: ["Beginner & Intermediate cases", "AI patient conversations", "Diagnosis, management & debrief", "Progress tracking"],
    cta: { label: "Get Basic", href: "/login" },
    highlight: false,
  },
  {
    name: "Pro",
    tagline: "For deeper simulation and advanced clinical scenarios.",
    monthly: 399,
    annual: 3999,
    features: ["Everything in Basic", "Advanced cases with deteriorating patients", "Real-time vitals & telemetry", "Advanced performance analytics"],
    cta: { label: "Get Pro", href: "/login" },
    highlight: true,
  },
] as const

export default function PricingSection() {
  const { ref, isVisible } = useScrollAnimation(0.15)
  const [period, setPeriod] = useState<Period>("monthly")
  const annual = period === "annual"

  return (
    <section id="pricing" className="relative overflow-hidden bg-brand-950 py-20 sm:py-28" ref={ref}>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to right, var(--brand-300) 1px, transparent 1px), linear-gradient(to bottom, var(--brand-300) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.1,
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 45%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 45%, transparent 100%)",
        }}
      />

      {/* No Eyebrow — heading alone */}
      <div className={cn("relative mx-auto max-w-2xl px-4 text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Choose how you want to train.</h2>
        <p className="mt-4 text-lg leading-relaxed text-white/60">Start free. Upgrade when you're ready for deeper simulation.</p>

        {/* Toggle */}
        <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
                period === p ? "bg-white text-brand-950" : "text-white/70 hover:text-white"
              )}
            >
              {p === "monthly" ? "Monthly" : "Annual"}
              {p === "annual" && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", period === p ? "bg-brand-600 text-white" : "bg-brand-600/20 text-brand-400")}>
                  Save ~16%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-10 grid max-w-5xl gap-5 px-4 sm:grid-cols-3">
        {TIERS.map((tier, i) => {
          const price = annual ? tier.annual : tier.monthly
          return (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6 backdrop-blur-sm transition-all duration-500 ease-out",
                tier.highlight ? "border-brand-400/40 bg-white/[0.06] shadow-lg shadow-brand-500/10" : "border-white/10 bg-white/[0.03]",
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
              style={{ transitionDelay: isVisible ? `${i * 90}ms` : "0ms" }}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                  Full simulation
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{tier.name}</h3>
              <p className="mt-1 text-sm text-white/60">{tier.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-white">
                  {price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}`}
                </span>
                {price > 0 && <span className="text-sm text-white/45">{annual ? "/yr" : "/mo"}</span>}
              </div>
              <p className="mt-1 text-[12.5px] text-white/45">
                {price === 0 ? "No payment required" : annual ? `~₹${Math.round(price / 12).toLocaleString("en-IN")}/mo, billed yearly` : "Billed monthly"}
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-enc-ok" strokeWidth={2.2} />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={cn(
                  "mt-6 h-auto w-full rounded-full py-2.5 text-sm font-semibold",
                  tier.highlight ? "bg-brand-500 text-white hover:bg-brand-400" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                )}
              >
                <Link href={tier.cta.href}>{tier.cta.label}</Link>
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
