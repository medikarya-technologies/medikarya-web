// Shared frame for a real product screenshot used inside a Moment (components/flowai/moment.tsx) — used in both
// story-section.tsx (01/02) and debrief-section.tsx (03/04) once all four moments switched from hand-built
// mock cards to real captured screenshots, so the frame needed to be identical in both files, not a lookalike
// copy. Same border/radius/shadow language `pilot-proof-section.tsx`'s photos already use, for one consistent
// "this is a real thing" visual vocabulary across the page rather than a second one invented for this.
//
// `caption` is optional — used on debrief-section.tsx's two images specifically, to anchor a real result to a
// specific moment ("a real attempt", not a floating example) the way this session's Reviews section already
// anchors each quote to its own real submission time instead of one repeated stock caption.

export function Screenshot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="w-full max-w-sm">
      <div className="overflow-hidden rounded-2xl border border-enc-line-strong shadow-enc-lift">
        <img src={src} alt={alt} className="w-full" loading="lazy" decoding="async" />
      </div>
      {caption && <p className="mt-2.5 text-[12px] text-enc-ink-3">{caption}</p>}
    </div>
  )
}
