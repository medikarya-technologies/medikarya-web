"use client"

// Shared frame for a real product screenshot used inside a Moment (components/flowai/moment.tsx) — used in both
// story-section.tsx (01/02) and debrief-section.tsx (03/04) once all four moments switched from hand-built
// mock cards to real captured screenshots, so the frame needed to be identical in both files, not a lookalike
// copy. Same border/radius/shadow language `pilot-proof-section.tsx`'s photos already use, for one consistent
// "this is a real thing" visual vocabulary across the page rather than a second one invented for this.
//
// `caption` is optional — used on debrief-section.tsx's two images specifically, to anchor a real result to a
// specific moment ("a real attempt", not a floating example) the way this session's Reviews section already
// anchors each quote to its own real submission time instead of one repeated stock caption.

//
// Larger since 2026-10-31 ("the images are a bit too small"): the images are captured at twice the size they are shown,
// the frame takes the wider column of the Moment, and a click opens the screenshot at full size. On a phone (no hover)
// the enlarge mark is always shown, since that is where the image is smallest.

import { useState } from "react"
import { Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export function Screenshot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <figure className="w-full max-w-[640px]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge: ${alt}`}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-enc-line-strong bg-enc-sheet shadow-enc-lift outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
      >
        <img src={src} alt={alt} className="w-full" loading="lazy" decoding="async" />
        <span className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-enc-fill/75 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100" aria-hidden>
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>
      {caption && <figcaption className="mt-2.5 text-[12.5px] text-enc-ink-3">{caption}</figcaption>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[min(1200px,94vw)] max-w-none overflow-auto rounded-2xl border-0 bg-enc-sheet p-2 sm:max-w-none sm:p-3">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img src={src} alt={alt} className="w-full rounded-xl" />
          {caption && <p className="pb-1 text-center text-[13px] text-enc-ink-3">{caption}</p>}
        </DialogContent>
      </Dialog>
    </figure>
  )
}
