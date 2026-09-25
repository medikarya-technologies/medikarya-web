// Thin auto-scrolling strip — a rhythm/breathing-space seam between chapters, not a content section (no
// heading, no claim of its own, purely decorative — hence aria-hidden and a plain <div>, not <section>). Used
// twice (Hero->Story, and Reviews->Video), each with different real content, via an `items` prop.
//
// Reuses .animate-marquee, already defined in app/globals.css ("Marquee animation for testimonials") but never
// actually wired to a live component before this project used it.
//
// FIXED this round — "all the texts went somewhere": the first version applied .animate-marquee to a single
// wrapper containing exactly 2 copies of the content, translating it by -100% of THAT WRAPPER's own width (i.e.
// by the full width of both copies combined). That looks like a seamless loop on paper (content is periodic, so
// the frame at the end matches the frame at the start) but is NOT the same thing as staying full during the
// transition — moving a 2-copy block by its own full width means the ENTIRE block has scrolled past by the end
// of every cycle, so the strip actually goes fully blank for a moment before each reset. The animation now goes
// on EACH copy independently instead of on a shared wrapper: 4 identical <Strip> siblings, each individually
// carrying .animate-marquee (so each one moves by -100% of its OWN single-copy width, not the combined row).
// With N siblings moving in lockstep this way, the combined visible content is always (N-1) copies wide at the
// narrowest point in the cycle — using 4 keeps that comfortably wider than any real viewport for both of this
// strip's real word lists, where 2 copies would visibly run out on a wide monitor.
//
// Separator was "✦" ("looks kinda cheap"), then a plain "·"; now a small Stethoscope glyph ("something
// clinical") — the same lucide icon debrief-section.tsx's own skill rows already use, not a new one picked for
// this strip alone.
//
// Colour: brand-600 blue -> the logo's real green -> brand-900 navy (briefly tried brand-950, the exact shade
// deterioration-section.tsx/pricing-section.tsx use). Green was the single largest, boldest use of that colour
// anywhere on the page (otherwise just the logo), so it ended up competing with blue as "the app's second
// colour" instead of reading as part of the same system. brand-950 fixed that but broke something else, checked
// by computed style rather than assumed: the second placement sits directly before pricing-section.tsx, and
// `getComputedStyle` on both returned the IDENTICAL background value — the marquee became visually
// indistinguishable from the section it's supposed to be a breathing pause BEFORE, undermining its one job.
// brand-900 is one step lighter in the same navy family (oklch L 0.20 vs 0.12) — still clearly "the page's dark
// colour," but a real, measurable step away from the exact shade of either dark section it sits near, so it
// reads as its own beat rather than as the top edge of whichever dark section follows it.
//
// motion-reduce:animate-none respects prefers-reduced-motion, same discipline lib/scroll-animation.tsx already
// applies to its own scroll-triggered fades.
//
// Stethoscope icon recoloured white/50 -> the logo's real green (#4b8f74): a small nod to green rather than the
// text itself, after deciding full green text would both hurt legibility on moving text (lower contrast than
// white against brand-900) and re-introduce a version of the "green is oversized here" problem this file's own
// colour history is already about — one icon, twice per item, is a hint, not a second full-strength use of it.

import { Stethoscope } from "lucide-react"

function Strip({ items }: { items: string[] }) {
  return (
    <span className="flex shrink-0 animate-marquee items-center motion-reduce:animate-none">
      {items.map((item) => (
        <span key={item} className="flex shrink-0 items-center gap-6 pr-6">
          <span className="text-sm font-semibold tracking-wide whitespace-nowrap text-white/90 uppercase">{item}</span>
          <Stethoscope className="h-3.5 w-3.5 text-[#4b8f74]" strokeWidth={2} aria-hidden />
        </span>
      ))}
    </span>
  )
}

export function MarqueeStrip({ items }: { items: string[] }) {
  return (
    <div className="overflow-hidden border-y border-white/10 bg-brand-900 py-3.5" aria-hidden>
      <div className="flex">
        <Strip items={items} />
        <Strip items={items} />
        <Strip items={items} />
        <Strip items={items} />
      </div>
    </div>
  )
}
