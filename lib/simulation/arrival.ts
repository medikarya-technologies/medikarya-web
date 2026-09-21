// The patient as first seen, before an encounter exists: the portrait's figure and look, the
// one-line observation, and the breathing rate to draw. It is the same resolution the bedside
// rail makes for its first frame (the case's appearance against the patient at minute zero), so the
// briefing screen and the bedside can never show two different people.
//
// Pure and provider-free: the briefing screen is shown before any clinical event manager is mounted.

import { describeLook, resolveLook, type ResolvedLook } from "./appearance";
import { isSimulationCase } from "./case-schema";
import { PatientState, snapshotContext } from "./patient-state";
import { personaFor, type Persona } from "./persona";

export interface Arrival {
    /** Who they are: age, clothes, hair. The same persona the bedside draws. */
    persona: Persona;
    look: ResolvedLook;
    /** "Face is very pale and yellow." Empty when there is nothing to remark on. */
    observation: string;
    /** Breaths per minute, for the portrait's breathing. */
    rr: number;
}

const DEFAULT_RR = 16;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** What makes this patient look like themselves and not like the next case: the case id, else the name. */
export function personaSeed(caseData: any): string {
    const id = caseData?.id;
    if (typeof id === "string" && id) return id;
    const name = caseData?.patient?.name;
    return typeof name === "string" ? name : "";
}

export function appearanceAtArrival(caseData: any): Arrival {
    const spec = caseData?.appearance;
    const patient = caseData?.patient;

    // A case that was never upgraded has no patient state to fold; it still gets a face, with
    // whatever appearance it carries resolved as if no condition held.
    let ctxSource: ReturnType<PatientState["snapshot"]> | null = null;
    if (isSimulationCase(caseData)) {
        try {
            ctxSource = PatientState.initial(caseData).snapshot();
        } catch {
            ctxSource = null;
        }
    }

    const look = ctxSource
        ? resolveLook(spec, snapshotContext(ctxSource, 0))
        : resolveLook(spec, {
              time: 0,
              flags: {},
              flagSetAt: {},
              state: "baseline",
              physiology: { hr: 80, sbp: 120, dbp: 80, map: 93, spo2: 98, rr: DEFAULT_RR, temperature: 36.8, rhythm: "sinus", consciousness: "alert" },
              alarms: [],
          });

    const recorded = patient?.vitalSigns?.respiratoryRate?.value;
    const rr = ctxSource && finite(ctxSource.rr) ? ctxSource.rr : finite(recorded) ? recorded : DEFAULT_RR;

    return {
        persona: personaFor({ age: patient?.age, gender: patient?.gender, seed: personaSeed(caseData), spec }),
        look,
        observation: describeLook(look),
        rr,
    };
}
