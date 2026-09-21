"use client"

// The drawing inside a PatientAvatar. It is its own file so that it can be loaded after the page is up
// (see patient-avatar.tsx): the persona logic and the whole illustration come with it, and none of that
// is needed to show a list.

import { useMemo } from "react"
import type { ResolvedLook } from "@/lib/simulation/appearance"
import { personaFor } from "@/lib/simulation/persona"
import { PatientPortrait } from "./patient-portrait"

const CALM: ResolvedLook = { pallor: 0, jaundice: 0, cyanosis: 0, flushed: 0, sweating: 0, sunken_eyes: 0, expression: "calm" }

export default function PatientAvatarFace({ age, gender, seed }: { age?: number; gender?: string; seed: string }) {
  const persona = useMemo(() => personaFor({ age, gender, seed }), [age, gender, seed])
  return <PatientPortrait persona={persona} look={CALM} variant="face" animate={false} className="absolute inset-0 h-full w-full animate-in duration-300 fade-in" label="" />
}
