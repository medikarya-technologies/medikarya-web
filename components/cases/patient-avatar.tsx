"use client"

// A patient's face, small and still, for lists: the case library, recent attempts, the XP ledger. It is the
// same person the bedside draws (same persona, seeded by the case id), with a calm expression, so a list of
// cases shows who is waiting without saying what is wrong with them: no pallor, no yellow eyes, no sweat.
//
// The face is drawn on the client, just after the page is up. A list of ten patients is ten small
// illustrations (about 4 KB of markup each) plus the code that draws them; sent with the page, rendered on
// the server and hydrated, that was most of what made the library heavy. Until the drawing arrives the
// avatar is a plain circle of the same size, so nothing on the page moves.
//
// (Deferred with React.lazy once the page has mounted, not with next/dynamic and ssr:false: that makes the
// server abandon each avatar with an error, and in development React writes a full stack trace into the page
// for every one of them.)

import { lazy, memo, Suspense, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const Face = lazy(() => import("./patient-avatar-face"))

export const PatientAvatar = memo(function PatientAvatar({ age, gender, seed, className }: { age?: number; gender?: string; seed: string; className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <span aria-hidden className={cn("relative block shrink-0 overflow-hidden rounded-full bg-enc-console ring-1 ring-enc-line-strong", className)}>
      {mounted && (
        <Suspense fallback={null}>
          <Face age={age} gender={gender} seed={seed} />
        </Suspense>
      )}
    </span>
  )
})
