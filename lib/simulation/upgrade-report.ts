// =========================
// lib/simulation/upgrade-report.ts
// =========================
// "If I add this case JSON, what will the student get?" A plain-language readout of what the
// bedside encounter will do with a case, and, when it will NOT run at the bedside, why not. It is
// printed by scripts/migrate-cases.ts next to each case, so a case that quietly falls back to the
// old three-step flow is noticed when it is added, not when a student opens it.
//
// Pure: it runs the same upgrade the app runs, then describes the result.

import { describeLook, resolveLook } from "./appearance";
import { isSimulationCase } from "./case-schema";
import { canUpgrade, readVitals, upgradeLegacyCase, type UpgradeOverlay } from "./legacy-adapter";
import { personaFor } from "./persona";

export interface UpgradeReport {
    /** Will this case open in the bedside encounter? */
    bedside: boolean;
    headline: string;
    /** One line per thing worth knowing, most important first. */
    notes: string[];
}

type Json = Record<string, any>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export function upgradeReport(legacy: unknown, overlay: UpgradeOverlay = {}): UpgradeReport {
    if (!isObj(legacy)) return { bedside: false, headline: "Not a case (expected a JSON object).", notes: [] };
    if (isSimulationCase(legacy)) return { bedside: true, headline: "Runs at the bedside: an authored simulation case (its own physiology, treatments and scoring).", notes: [] };
    if (legacy.experience === "classic") return { bedside: false, headline: 'Opens in the classic three-step flow: the case says "experience": "classic".', notes: [] };

    if (!canUpgrade(legacy)) {
        const why: string[] = [];
        if (readVitals(legacy.patient?.vitalSigns) === null) why.push("patient.vitalSigns.heartRate has no value: the monitor needs at least a heart rate.");
        if (!Array.isArray(legacy.tests) || !legacy.tests.some((t: unknown) => isObj(t) && typeof t.id === "string" && t.id)) why.push("tests[] has no test with an id: there is nothing for the student to order.");
        return { bedside: false, headline: "Will open in the OLD classic three-step flow, without the monitor, clock, examination or portrait.", notes: why };
    }

    const up = upgradeLegacyCase(legacy, overlay) as Json;
    const notes: string[] = [];

    const init = up.initial_state ?? {};
    const unmeasured: string[] = init.unmeasured ?? [];
    notes.push(`Monitor: ${String(init.rhythm).replace(/_/g, " ")} at ${init.rate} bpm.${unmeasured.length ? ` Not recorded in the case, so shown as "—": ${unmeasured.join(", ")}.` : ""}`);

    // "With results" means the case wrote a result for the test; the rest say so plainly when ordered.
    const written = (Array.isArray(legacy.tests) ? legacy.tests : []).filter((t: unknown) => isObj(t) && typeof t.id === "string" && t.id);
    const withResults = written.filter((t: Json) => (typeof t.result === "string" && t.result.trim() !== "") || (isObj(t.result) && Object.keys(t.result).length > 0)).length;
    const missing = written.length - withResults;
    notes.push(`Investigations: ${written.length} to order, ${withResults} with a result written in the case.${missing > 0 ? ` The other ${missing} will say "No findings were recorded for this case." when ordered.` : ""}`);

    const exam: unknown[] = up.examination ?? [];
    notes.push(exam.length > 0 ? `Examination: ${exam.length} manoeuvres, in the case's own words.` : "Examination: no Examine tab, because patient_facts has no *_examination sections.");

    const patient = legacy.patient ?? {};
    const persona = personaFor({ age: patient.age, gender: patient.gender, seed: typeof legacy.id === "string" ? legacy.id : patient.name, spec: up.appearance });
    const look = resolveLook(up.appearance, { time: 0, flags: {}, flagSetAt: {}, state: "presenting", physiology: { hr: 80, sbp: 120, dbp: 80, map: 93, spo2: 98, rr: 16, temperature: 36.8, rhythm: "sinus", consciousness: "alert" }, alarms: [] });
    const seen = describeLook(look);
    notes.push(seen ? `First look: "${seen}"` : 'First look: nothing found in the examination findings, so a calm face. Add an "appearance" block to say how they look.');

    const wears = [persona.attire.garment.replace(/_/g, " "), persona.attire.head === "pallu" ? "with the saree over the head" : null].filter(Boolean).join(" ");
    notes.push(`Portrait: ${persona.figure.replace(/_/g, " ")}, ${typeof persona.age === "number" ? `${persona.age} y` : "age not given"}, ${persona.female ? "female" : "male"}, in a ${wears}${persona.glasses ? ", glasses" : ""}${persona.moustache !== "none" ? `, ${persona.moustache} moustache` : ""} (chosen from the age, sex and case id; "appearance.attire" and "appearance.accessories" override).`);

    notes.push("No treatment tray and no deterioration: the patient stays as presented. Scoring: the classic evaluator from evaluation_config.");
    return { bedside: true, headline: "Runs in the bedside encounter (live monitor, clock, examination, investigations, portrait, scoring).", notes };
}
