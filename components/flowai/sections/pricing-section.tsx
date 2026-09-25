"use client"

import { useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"

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
//
// Tier names follow the real Indian medical-training ladder (Student → Intern → Resident)
// instead of generic Free/Basic/Pro — the audience already knows exactly what each word means,
// and upgrading reads as advancing rather than just paying more. "sub" is the small secondary
// label next to each name so a first-time visitor still gets the familiar Free/Basic/Pro anchor
// without the card needing two separate headings.
//
// Daily case-count and live-case limits are new: difficulty (Beginner/Intermediate/Advanced)
// still controls WHAT you can access; the daily numbers are a separate fair-use ceiling, not a
// content gate — sized from real Gemini API cost per attempt (~₹0.20–0.25 for a live/simulation
// case, ~₹0.45–0.55 for a classic one), so even a user who maxes out every day for a month stays
// a small fraction of the tier's price. The Student tier's one-time STEMI attempt (not daily) is
// deliberate: it costs about 20 paise per person and is the single most impressive thing in the
// product, worth letting a free visitor feel once before any paywall.

type Period = "monthly" | "annual"

const TIERS = [
  {
    name: "Student",
    sub: "Free",
    tagline: "A simple way to experience MediKarya.",
    monthly: 0,
    annual: 0,
    features: ["2 cases a day, Beginner difficulty", "One live emergency case, on us — try it once", "No account needed"],
    cta: { label: "Try a case free", href: "/try" },
    highlight: false,
  },
  {
    name: "Intern",
    sub: "Basic",
    tagline: "For regular clinical reasoning practice.",
    monthly: 199,
    annual: 1999,
    features: ["Beginner & Intermediate cases, 15 a day", "5 live emergency cases a day", "AI patient conversations", "Diagnosis, management & debrief", "Progress tracking"],
    cta: { label: "Become an Intern", href: "/login" },
    highlight: false,
  },
  {
    name: "Resident",
    sub: "Pro",
    tagline: "For deeper simulation and advanced clinical scenarios.",
    monthly: 399,
    annual: 3999,
    features: ["Everything in Intern", "All cases, including Advanced — unlimited a day", "10 live emergency cases a day", "Real-time vitals & telemetry", "Advanced performance analytics"],
    cta: { label: "Become a Resident", href: "/login" },
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
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">{tier.sub}</span>
              </div>
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
