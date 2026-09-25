"use client"

// The demo video, without the "holographic theatre" wrapper (glass reflections, a mix-blend aurora glow, a
// floor reflection, a mouse-tracked spotlight) that dressed up a plain YouTube embed as something more than it
// is. Two things brought back after the first pass read as too plain: a restrained dot-grid texture (the same
// idea the old page had, kept to one static, low-opacity layer instead of stacking three effects), and a real
// picture behind the play button. The picture is not hotlinked to YouTube's own CDN any more — that thumbnail is
// real (i.ytimg.com/vi/<id>/hqdefault.jpg, confirmed with curl), but a hotlinked youtube.com/ytimg.com image is
// exactly the kind of third-party request ad blockers routinely strip, which is likely why it rendered as a flat
// slate-900 fallback for the user testing this in their own browser. public/demo-thumbnail.jpg is that same real
// frame, downloaded once and served from this origin, so no blocker can single it out.
//
// Re-added after being cut in the user's own consolidation pass — "watch the whole thing end to end" right
// after the numbered moments close (debrief-section.tsx's 03/04), before the real-artifact proof section
// (pilot-proof-section.tsx) and pricing. Background has flipped between plain enc-sheet and tinted brand-50
// several times now as sections get reordered/inserted around it — currently enc-sheet again, since its
// neighbours (debrief-section.tsx, tinted; pilot-proof-section.tsx, now also tinted) are both Tinted. Re-check
// this file's own background against its actual current neighbours before trusting the comment history alone.

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"
import { Play } from "lucide-react"
import { Eyebrow } from "@/components/cases/encounter-ui"

const VIDEO_ID = "k_K8HfMhAIw"

export function DashboardPreview() {
  const [isPlaying, setIsPlaying] = useState(false)
  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <section id="video-demo" className="relative overflow-hidden bg-enc-sheet py-20 sm:py-28" ref={ref}>
      {/* A quiet texture, not a light show: one line grid, tinted brand-blue the way the old page's was (its own
          grid was plain grey, but sat under a blue-tinted glow that read, together, as "blue lines"), faded top
          and bottom, no motion. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "linear-gradient(to right, var(--brand-300) 1px, transparent 1px), linear-gradient(to bottom, var(--brand-300) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
        }}
      />

      <div className={cn("relative mx-auto max-w-3xl px-4 text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
        <Eyebrow className="text-brand-600">Two minutes</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">Watch a case, start to finish</h2>
        <p className="mt-4 text-lg leading-relaxed text-enc-ink-2">History, examination, tests and a diagnosis — the real interface, not a walkthrough of slides.</p>
      </div>

      <div className={cn("relative mx-auto mt-12 max-w-4xl px-4 transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")} style={{ transitionDelay: isVisible ? "120ms" : "0ms" }}>
        {/* One soft, still glow behind the frame — depth without a mouse-tracked spotlight. */}
        <div aria-hidden className="absolute inset-x-10 -inset-y-6 -z-10 rounded-[3rem] bg-brand-400/20 opacity-60 blur-3xl" />

        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          disabled={isPlaying}
          aria-label="Play the demo video"
          className="group relative block aspect-video w-full overflow-hidden rounded-[1.75rem] border border-enc-line bg-slate-900 shadow-xl shadow-slate-900/10"
        >
          {isPlaying ? (
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`}
              title="MediKarya — interactive clinical case walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              <img src="/demo-thumbnail.jpg" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-slate-900/25 transition-colors group-hover:bg-slate-900/15" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110">
                  <Play className="ml-0.5 h-6 w-6 fill-brand-600 text-brand-600" />
                </span>
              </span>
            </>
          )}
        </button>
      </div>
    </section>
  )
}
