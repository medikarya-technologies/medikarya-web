"use client"

// "New at the bedside": a short card on the dashboard home that tells students what changed, until they dismiss it.
// Remembered per browser; bump NOTICE when there is something new to say, and everyone sees the card again.

import { useEffect, useState } from "react"
import { BookOpen, Clock, FastForward, HeartPulse, X } from "lucide-react"
import { Eyebrow, Paper } from "@/components/cases/encounter-ui"

const NOTICE = "mk_whats_new_2026_10"

export function WhatsNew({ liveCount }: { liveCount: number }) {
  // Read after mount: the server does not know what this browser has dismissed.
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      setShow(localStorage.getItem(NOTICE) !== "seen")
    } catch {
      setShow(true)
    }
  }, [])
  if (!show) return null

  const dismiss = () => {
    setShow(false)
    try {
      localStorage.setItem(NOTICE, "seen")
    } catch {
      /* storage blocked: the card simply comes back next time */
    }
  }

  const items = [
    ...(liveCount > 1 ? [{ icon: HeartPulse, title: `${liveCount} live emergencies`, text: "The patient changes minute by minute, with what you do and what you leave undone." }] : []),
    { icon: Clock, title: "Wait and watch", text: "Move the clock on from under it. It stops the moment the nurse calls, and tells you what changed." },
    { icon: FastForward, title: "Skip to result", text: "Jump ahead to a test's result instead of waiting. Some cases use real lab times, as on the ward." },
    { icon: BookOpen, title: "Guidelines named", text: "Live cases end with the guidelines they follow, listed in your debrief." },
  ]

  return (
    <Paper className="h-fit p-5">
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>New at the bedside</Eyebrow>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mt-1 -mr-1 rounded p-1 text-enc-ink-3 outline-none hover:text-enc-ink focus-visible:ring-2 focus-visible:ring-brand-300">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-3">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={1.9} />
            <p className="text-[13px] leading-snug text-enc-ink-2">
              <span className="font-medium text-enc-ink">{title}.</span> {text}
            </p>
          </li>
        ))}
      </ul>
    </Paper>
  )
}
