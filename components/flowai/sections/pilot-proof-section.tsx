"use client"

// Rebuilt this round — "they look too artificial and dont really have any feel of themselves." The previous
// version (centered eyebrow/heading/paragraph, a neat equal-width photo strip, a boxed "IN THEIR OWN WORDS"
// pull-quote) is a recognisable, generic testimonial-page template — the exact category of thing this whole
// project has spent many rounds replacing elsewhere on the page (real product UI instead of decorative mockups,
// real screenshots instead of stock-feeling layouts). The content was always real; the PRESENTATION was the
// generic part. Fixed by dropping the centered/symmetric template for the same asymmetric, slightly-imperfect
// language the rest of the page already uses: a loose, overlapping, slightly-rotated photo cluster (like actual
// snapshots someone dropped on a desk, not a product carousel) beside the copy, and the quote as a plain
// left-accent note instead of a big centered pull-quote with a decorative divider either side of it.
//
// Now positioned after dashboard-preview.tsx (the video) instead of before it, and before reviews-section.tsx —
// per this round's explicit reorder. Background flipped enc-sheet -> brand-50 (tinted) since its neighbours
// changed; see app/page.tsx's own comment for the full re-derived sequence.
//
// Photos: "put images of both of us in front" — mamc-3 and mamc-4 are the two founders, each mid-session at the
// same whiteboard (confirmed by actually reading both files: different build/shirt/glasses, not one person
// twice). Both now sit at the top z-layer with no overlap ON EITHER OF THEM; mamc-5 (students) is the only one
// that tucks behind, and only over its own face-free zone (the empty tiered seating across the top third of
// that photo — checked in the actual file before placing anything over it), never over a face in any photo.
//
// "they look very random... think of smg like either making them closer": the previous layout satisfied
// "don't overlap a founder's photo" by spacing all three photos apart with real gaps between them, which
// solved the occlusion problem but reintroduced a different one — three photos with visible empty background
// between them reads as scattered, not as one cluster. Pulled tight this round: smaller container, larger
// photos relative to it, small deliberate overlaps at the specific safe corners identified above instead of
// clear air between every pair.
// Centering: same `mx-auto` + symmetric bounding-box approach as last round, recomputed for the new tighter
// positions.
// Quote and intro copy unchanged — same real May 2026 MAMC survey response.

import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"
import { Eyebrow } from "@/components/cases/encounter-ui"
import { Quote } from "lucide-react"

const PHOTOS = [
  { file: "mamc-5.jpg", rotate: "-rotate-4", z: "z-20", pos: "left-0 top-[6%]" },
  { file: "mamc-3.jpg", rotate: "rotate-3", z: "z-10", pos: "left-[38%] top-0" },
  { file: "mamc-4.jpg", rotate: "-rotate-2", z: "z-15", pos: "left-[16%] top-[42%]" },
]

export default function PilotProofSection() {
  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <section className="bg-brand-50 py-20 sm:py-28" ref={ref}>
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid items-center gap-16 sm:grid-cols-2 sm:gap-14">
          {/* Photo cluster — close, slightly overlapping, slightly rotated, not a uniform strip */}
          <div
            className={cn("relative mx-auto h-[240px] w-full max-w-[300px] transition-all duration-700 ease-out sm:h-[300px]", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
          >
            {PHOTOS.map((p) => (
              <div key={p.file} className={cn("absolute w-[54%] overflow-hidden rounded-xl border-4 border-enc-sheet shadow-enc-lift", p.rotate, p.z, p.pos)}>
                <img src={`/pilot/${p.file}`} alt="4th-year MBBS students working through a case at Maulana Azad Medical College" className="aspect-[4/3] w-full object-cover" loading="lazy" decoding="async" />
              </div>
            ))}
          </div>

          {/* Copy + quote */}
          <div
            className={cn("transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
            style={{ transitionDelay: isVisible ? "120ms" : "0ms" }}
          >
            <Eyebrow className="text-brand-600">The pilot</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">Tested with real students, not just us.</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-enc-ink-2">
              In May 2026, a batch of 4th-year MBBS students at Maulana Azad Medical College worked cases on their own phones and tablets — the same interface shown throughout this page.
            </p>

            <div className="mt-6 flex gap-3 border-l-2 border-brand-300 pl-4">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" strokeWidth={2} />
              <div>
                <p className="text-[15px] leading-relaxed text-enc-ink italic">Interactive software and reasoning what I did wrong and right really makes sense.</p>
                <p className="mt-2 text-[12.5px] text-enc-ink-3">4th-year MBBS student, MAMC pilot</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
