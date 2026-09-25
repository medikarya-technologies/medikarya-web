"use client"

// Rebuilt this round — "they look too artificial and dont really have any feel of themselves." The previous
// version was a grid of 4 near-identical white cards, each repeating the exact same generic attribution
// ("4th-year MBBS student, MAMC pilot") with the exact same placeholder icon — real quotes, but the repeated,
// interchangeable card shell is what read as manufactured/stock. Rebuilt as one real-looking artifact instead
// of four generic ones: a single panel styled like the rest of this page's actual product UI (the same header-
// bar treatment debrief-section.tsx's own panel uses), listing each response as a compact row. What used to be
// identical attribution text on every card is now each response's own real submission TIME (22/05/2026, from
// the same Google-Forms pilot survey pasted earlier this session) — a genuine, distinct, checkable data point
// per row instead of the same sentence stamped four times, which is what actually makes four responses read as
// four different people rather than a template repeated four times.
//
// Now positioned after pilot-proof-section.tsx (post-reorder) instead of before dashboard-preview.tsx.
// Background flipped brand-50 -> enc-sheet since its neighbours changed; see app/page.tsx's own comment for the
// full re-derived sequence.
//
// Content unchanged from the previous version: same 4 real quotes (of 9 raw survey responses; 5 were left out —
// 4 too short to stand alone, 1 reading as a hedge out of context, both explained in this file's git history),
// same honest star mapping (Very good -> 5, Good -> 4, straight from each response's own "How was your overall
// experience?" answer). "4 of 9 shown" is stated outright rather than implying these are the only responses.

import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"
import { Eyebrow } from "@/components/cases/encounter-ui"
import { Star } from "lucide-react"

const REVIEWS = [
  { stars: 5, quote: "Simulation strategy for clinical experience.", time: "13:32" },
  { stars: 5, quote: "Feedback at the end.", time: "13:33" },
  { stars: 5, quote: "Simulation of a real life case scenario and simultaneously correcting the mistake.", time: "13:35" },
  { stars: 4, quote: "I liked the tests for diagnosis part of the app, it was clear and to the point.", time: "13:37" },
]

function Stars({ count }: { count: number }) {
  return (
    <div className="flex shrink-0 gap-0.5">
      {Array.from({ length: 5 }).map((_, i) =>
        i < count ? (
          <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        ) : (
          <Star key={i} className="h-3.5 w-3.5 fill-none text-enc-line-strong" strokeWidth={1.5} />
        )
      )}
    </div>
  )
}

export default function ReviewsSection() {
  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <section className="bg-enc-sheet py-20 sm:py-28" ref={ref}>
      <div className="mx-auto max-w-3xl px-4">
        <div className={cn("mx-auto max-w-xl text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
          <Eyebrow className="text-brand-600">Reviews</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">What the pilot batch said.</h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-enc-ink-2">Real answers from the same MAMC pilot survey, not selected for being positive — this is what came back.</p>
        </div>

        <div
          className={cn(
            "mt-10 overflow-hidden rounded-2xl border border-enc-line-strong bg-enc-sheet shadow-enc-lift transition-all duration-700 ease-out",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
          style={{ transitionDelay: isVisible ? "100ms" : "0ms" }}
        >
          <div className="flex items-center justify-between border-b border-enc-line bg-enc-console px-5 py-3">
            <span className="text-[11px] font-semibold tracking-widest text-enc-ink-3 uppercase">Pilot feedback · MAMC, 4th year</span>
            <span className="text-[10.5px] text-enc-ink-3">4 of 9 shown</span>
          </div>

          <ul>
            {REVIEWS.map((r, i) => (
              <li key={r.quote} className={cn("flex items-start gap-4 px-5 py-4", i !== REVIEWS.length - 1 && "border-b border-enc-line")}>
                <Stars count={r.stars} />
                <p className="flex-1 text-[14px] leading-relaxed text-enc-ink">{r.quote}</p>
                <span className="shrink-0 font-mono text-[11px] text-enc-ink-3">{r.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
