"use client"

// Like PatientAvatar (patient-avatar.tsx), but for the one place outside the real encounter that needs a
// patient NOT drawn calm: the landing page's deterioration showcase. Same lazy-after-mount safety (PatientPortrait
// is never asked to render on the server — see patient-avatar.tsx's own note on why), same persona system, but
// the caller supplies the ResolvedLook instead of it being hard-coded to CALM.

import { lazy, Suspense, useEffect, useState } from "react"
import type { ResolvedLook } from "@/lib/simulation/appearance"
import { cn } from "@/lib/utils"

const Face = lazy(() => import("./patient-portrait-styled-face"))

export function PatientPortraitStyled({
  age,
  gender,
  seed,
  look,
  variant = "bust",
  className,
  label,
}: {
  age?: number
  gender?: string
  seed: string
  look: ResolvedLook
  variant?: "bust" | "face"
  className?: string
  label?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <span aria-hidden={!label} className={cn("relative block shrink-0 overflow-hidden bg-enc-console", className)}>
      {mounted && (
        <Suspense fallback={null}>
          <Face age={age} gender={gender} seed={seed} look={look} variant={variant} label={label} />
        </Suspense>
      )}
    </span>
  )
}
