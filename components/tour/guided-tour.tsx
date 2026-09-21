"use client"

// A guided tour: dims the screen, lights up one control at a time and says what it is for.
//
// Steps name the control they are about with a `data-tour="..."` attribute on it, so the tour does not know
// the layout: a phone and a desktop each have their own copy of some controls, so the first one that is really
// on screen is used, and a step whose control is not there at all (no left rail on a phone, no Intervene button
// in a case without treatments) is left out. The tour is a walkthrough, not a lesson to click through: while it
// is up the page behind it cannot be used. Escape skips it; the arrow keys move; focus stays on the card.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { placeCard, type Box } from "@/lib/tour/place"

export interface TourStep {
  id: string
  /** The `data-tour` name of the control this step is about. */
  target: string
  title: string
  body: ReactNode
}

export type TourEnd = "done" | "skipped"

const PAD = 6
const MARGIN = 12
const CARD_MAX = 360

/** The first element with this tour name that is really on screen. */
function findTarget(name: string): HTMLElement | null {
  const found = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`))
  return (
    found.find((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }) ?? null
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(query.matches)
    const on = () => setReduce(query.matches)
    query.addEventListener("change", on)
    return () => query.removeEventListener("change", on)
  }, [])
  return reduce
}

export function GuidedTour({ steps, open, onClose }: { steps: readonly TourStep[]; open: boolean; onClose: (how: TourEnd) => void }) {
  const id = useId()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const reduceMotion = usePrefersReducedMotion()

  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Which of the steps apply on this screen, worked out when the tour opens.
  const [live, setLive] = useState<TourStep[] | null>(null)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [view, setView] = useState({ w: 0, h: 0 })
  const [card, setCard] = useState({ w: CARD_MAX, h: 200 })
  const cardRef = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!open || !mounted) {
      setLive(null)
      return
    }
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const applicable = steps.filter((s) => findTarget(s.target))
    setLive(applicable)
    setIndex(0)
    // Nothing on this screen to point at: end it, so a stopped clock is never left waiting on a tour nobody can see.
    if (applicable.length === 0) closeRef.current("skipped")
  }, [open, mounted, steps])

  const step = live?.[index]

  const measure = useCallback(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    setView((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    const el = step ? findTarget(step.target) : null
    if (!el) {
      setBox(null)
      return
    }
    const r = el.getBoundingClientRect()
    const next: Box = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 }
    setBox((prev) => (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next))
  }, [step])

  useLayoutEffect(() => {
    if (!open || !step) return
    findTarget(step.target)?.scrollIntoView({ block: "nearest", inline: "nearest" })
    measure()
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    // A layout that settles late (a font, the chat loading) is followed too.
    const timer = window.setInterval(measure, 250)
    return () => {
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
      window.clearInterval(timer)
    }
  }, [open, step, measure])

  // The card's own size decides where it can go.
  useLayoutEffect(() => {
    const el = cardRef.current
    if (el) setCard((prev) => (prev.w === el.offsetWidth && prev.h === el.offsetHeight ? prev : { w: el.offsetWidth, h: el.offsetHeight }))
  })

  const last = !!live && index === live.length - 1
  const next = useCallback(() => {
    if (!live) return
    if (index >= live.length - 1) closeRef.current("done")
    else setIndex(index + 1)
  }, [live, index])
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const skip = useCallback(() => closeRef.current("skipped"), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        skip()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        next()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        back()
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open, next, back, skip])

  // Focus goes to the card on every step, and back to where it was when the tour ends.
  useEffect(() => {
    if (open && step) primary.current?.focus({ preventScroll: true })
  }, [open, step])
  useEffect(() => {
    if (!open) return
    return () => {
      const back = returnFocus.current
      if (back && document.contains(back)) back.focus({ preventScroll: true })
    }
  }, [open])

  const keepFocusInside = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab") return
    const items = Array.from(cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])
    if (items.length === 0) return
    const first = items[0]
    const end = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      end.focus()
    } else if (!e.shiftKey && document.activeElement === end) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!mounted || !open || !live || live.length === 0 || !step) return null

  const width = Math.min(CARD_MAX, Math.max(240, view.w - MARGIN * 2))
  const placed = box && view.w > 0 ? placeCard(box, { w: width, h: card.h }, view, { margin: MARGIN }) : { top: Math.max(MARGIN, (view.h - card.h) / 2), left: Math.max(MARGIN, (view.w - width) / 2) }
  const glide = reduceMotion ? undefined : "top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease"

  return createPortal(
    <div
      className="fixed inset-0 z-[200]"
      role="presentation"
      onMouseDown={(e) => {
        // The page behind is off limits while the tour is up: a click on it goes back to the card.
        e.preventDefault()
        primary.current?.focus({ preventScroll: true })
      }}
    >
      {box ? (
        <div aria-hidden className="pointer-events-none fixed rounded-[10px] ring-2 ring-brand-300" style={{ top: box.y, left: box.x, width: box.w, height: box.h, boxShadow: "0 0 0 100vmax rgba(9, 13, 26, 0.62)", transition: glide }} />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-[rgba(9,13,26,0.62)]" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        onKeyDown={keepFocusInside}
        onMouseDown={(e) => e.stopPropagation()}
        className="fixed rounded-xl border border-enc-line-strong bg-enc-sheet p-4 text-enc-ink shadow-2xl"
        style={{ top: placed.top, left: placed.left, width, transition: glide }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.09em] text-enc-ink-3 uppercase">
            Step {index + 1} of {live.length}
          </p>
          <button type="button" onClick={skip} aria-label="Skip the tour" className="-m-1 rounded-md p-1 text-enc-ink-3 outline-none hover:bg-enc-console hover:text-enc-ink focus-visible:ring-2 focus-visible:ring-brand-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 id={`${id}-title`} className="mt-2 text-[16px] leading-snug font-semibold">
          {step.title}
        </h2>
        <div id={`${id}-body`} aria-live="polite" className="mt-1.5 text-[13.5px] leading-relaxed text-enc-ink-2">
          {step.body}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {live.map((s, i) => (
              <span key={s.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-brand-600" : "w-1.5 bg-enc-line-strong")} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {index === 0 ? (
              <Button type="button" variant="ghost" onClick={skip} className="h-9 rounded-lg px-3 text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink">
                Skip tour
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={back} className="h-9 rounded-lg px-3 text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink">
                Back
              </Button>
            )}
            <Button ref={primary} type="button" onClick={next} className="h-9 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-none hover:bg-brand-700">
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
