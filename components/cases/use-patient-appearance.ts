"use client"

// How the patient looks RIGHT NOW: who they are (age, clothes, hair: fixed for the encounter), how
// they are (the look, resolved from the case's appearance against the live patient state, so a
// deterioration changes the face as well as the numbers), and the one-line observation.

import { useMemo } from "react"
import { describeLook, resolveLook, type ResolvedLook } from "@/lib/simulation/appearance"
import { personaSeed } from "@/lib/simulation/arrival"
import { personaFor, type Persona } from "@/lib/simulation/persona"
import { snapshotContext } from "@/lib/simulation/patient-state"
import { useClinicalEvents } from "./clinical-event-manager"

export interface PatientAppearance {
  persona: Persona
  look: ResolvedLook
  /** What the student reads: "Face is very pale and yellow." Empty when there is nothing to remark on. */
  observation: string
}

export function usePatientAppearance(): PatientAppearance {
  const { config, caseData, patient, now } = useClinicalEvents()
  const age: number | undefined = caseData.patient?.age
  const gender: string | undefined = caseData.patient?.gender
  const seed = personaSeed(caseData)

  // Who they are does not change during the encounter.
  const persona = useMemo(
    () => personaFor({ age, gender, seed, spec: config.appearance }),
    [age, gender, seed, config.appearance]
  )

  // Time only matters to a variant that waits on the clock: re-resolve every few seconds, not every tick.
  const bucket = Math.floor(now / 5)

  return useMemo(() => {
    const look = resolveLook(config.appearance, snapshotContext(patient, now))
    return { persona, look, observation: describeLook(look) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.appearance, patient, bucket, persona])
}
