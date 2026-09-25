"use client"

import { useMemo } from "react"
import type { ResolvedLook } from "@/lib/simulation/appearance"
import { personaFor } from "@/lib/simulation/persona"
import { PatientPortrait } from "./patient-portrait"

export default function PatientPortraitStyledFace({
  age,
  gender,
  seed,
  look,
  variant,
  label,
}: {
  age?: number
  gender?: string
  seed: string
  look: ResolvedLook
  variant: "bust" | "face"
  label?: string
}) {
  const persona = useMemo(() => personaFor({ age, gender, seed }), [age, gender, seed])
  return <PatientPortrait persona={persona} look={look} variant={variant} animate className="absolute inset-0 h-full w-full animate-in duration-300 fade-in" label={label ?? ""} />
}
