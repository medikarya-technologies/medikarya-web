import dynamic from "next/dynamic"
import type { Metadata } from "next"
import { Navbar } from "@/components/flowai/navbar"
import { Hero } from "@/components/flowai/hero"
import { MarqueeStrip } from "@/components/flowai/marquee-strip"

// Section lineup — 8 chapters below the hero.
// Removed: TheoryTransition, PatientReveal, Workflow, SocialProof, FeaturesBento, FAQ,
//          WhatItIsSection (folded into StorySection as its 2nd moment).
// StorySection: two numbered "moments" (rounds.co's own 01/02 device), real short copy beside one real,
// compact UI fragment each — not a decorative illustration (removed: pulse-figure.tsx tried that and the
// dots rendered oversized/scattered, and it was never actually what the reference page was showing anyway).
// DebriefSection picks the SAME numbered sequence back up as 03/04 (Moment now shared, components/flowai/
// moment.tsx) after DeteriorationSection's dark, un-numbered interruption — 03 is the debrief panel, 04 is a
// real ReinforcementCard (a real question from lib/simulation/reinforcement.ts's own authored bank), so the
// loop the earlier Story section only opens (history, investigate) now visibly closes as part of the same
// visual system, not a differently-styled section that happens to follow it.
// Reordered this round: Video now sits right after Debrief (04 Reinforce), then PilotProofSection, then
// ReviewsSection, then Pricing — was Pilot -> Reviews -> Video -> Pricing before. Both Pilot and Reviews were
// also rebuilt this round ("they look too artificial... no feel of themselves") away from generic centered-
// testimonial/card-grid templates toward the same real-artifact language the rest of the page uses; see each
// file's own comment.
// Tone sequence re-derived a 6th time for the reorder: Hero(Sheet) -> Story(Tinted) -> Deterioration(Dark) ->
// Debrief(Tinted) -> Video(Sheet, unchanged) -> Pilot(now Tinted, was Sheet) -> Reviews(now Sheet, was Tinted)
// -> Pricing(Dark) -> FinalCTA(Tinted) -> Footer(Console). Zero adjacent repeats.
// MarqueeStrip: a thin, non-lazy, non-"use client" auto-scrolling seam — not a content chapter, so it's outside
// the Light/Tinted/Dark/Console rotation entirely and doesn't need re-deriving that sequence itself. Placed
// twice: right after Hero (previews the page's own real narrative beats before Story tells them), and now
// between Reviews and Pricing (was between Reviews and Video) — the breathing pause right before the decision
// point, an even more natural spot than before. Each instance gets different real content.
// getCases() no longer called — FeaturesBento (the only consumer) is removed.

const JOURNEY_ITEMS = ["History", "Investigate", "Deteriorate", "Debrief", "Reinforce"]
const SKILL_ITEMS = ["History taking", "Investigations", "Clinical reasoning", "Diagnosis", "Management", "Nothing here is staged"]

const StorySection = dynamic(() => import("@/components/flowai/sections/story-section"), {
  loading: () => <div className="h-[650px] w-full bg-brand-50" />,
})
const DeteriorationSection = dynamic(() => import("@/components/flowai/sections/deterioration-section"), {
  loading: () => <div className="h-[720px] w-full bg-brand-950" />,
})
const DebriefSection = dynamic(() => import("@/components/flowai/sections/debrief-section"), {
  loading: () => <div className="h-[730px] w-full bg-brand-50" />,
})
const PilotProofSection = dynamic(() => import("@/components/flowai/sections/pilot-proof-section"), {
  loading: () => <div className="h-[520px] w-full bg-brand-50" />,
})
const ReviewsSection = dynamic(() => import("@/components/flowai/sections/reviews-section"), {
  loading: () => <div className="h-[560px] w-full bg-enc-sheet" />,
})
const DashboardPreview = dynamic(() => import("@/components/flowai/dashboard-preview").then((mod) => mod.DashboardPreview), {
  loading: () => <div className="h-[560px] w-full bg-enc-sheet" />,
})
const PricingSection = dynamic(() => import("@/components/flowai/sections/pricing-section"), {
  loading: () => <div className="h-[720px] w-full bg-brand-950" />,
})
const FinalCtaSection = dynamic(() => import("@/components/flowai/sections/final-cta-section"), {
  loading: () => <div className="h-[420px] w-full bg-brand-50" />,
})
const Footer = dynamic(() => import("@/components/flowai/footer").then((mod) => mod.Footer), {
  loading: () => <div className="h-[320px] w-full bg-enc-console" />,
})

export const metadata: Metadata = {
  title: "MediKarya — AI Patient Simulation for Medical Students",
  description: "Practice clinical reasoning with AI-powered virtual patients. Order diagnostics, take a history, and see exactly where your reasoning held up.",
  alternates: {
    canonical: "https://www.medikarya.in/",
  },
  keywords: [
    "AI patient simulation",
    "clinical reasoning for medical students",
    "virtual patient cases MBBS",
    "medical student simulation India",
    "OSCE preparation AI",
    "diagnostic reasoning practice",
    "AI clinical training platform",
    "MediKarya",
  ],
  openGraph: {
    title: "MediKarya — AI Patient Simulation for Medical Students",
    description: "Practice clinical reasoning with AI-powered virtual patients. Order diagnostics, take a history, and see exactly where your reasoning held up.",
    url: "https://www.medikarya.in/",
    type: "website",
    images: [
      {
        url: "https://www.medikarya.in/og-image.png",
        width: 1200,
        height: 630,
        alt: "MediKarya — practise clinical decisions before they become real",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MediKarya — AI Patient Simulation for Medical Students",
    description: "Practice clinical reasoning with AI-powered virtual patients. Order diagnostics, take a history, and see exactly where your reasoning held up.",
    images: ["https://www.medikarya.in/og-image.png"],
  },
}

export default function Page() {
  return (
    <main className="min-h-dvh bg-enc-desk">
      <Navbar />
      <Hero />
      <MarqueeStrip items={JOURNEY_ITEMS} />

      <StorySection />
      <DeteriorationSection />
      <DebriefSection />
      <DashboardPreview />
      <PilotProofSection />
      <ReviewsSection />
      <MarqueeStrip items={SKILL_ITEMS} />
      <PricingSection />
      <FinalCtaSection />
      <Footer />
    </main>
  )
}
