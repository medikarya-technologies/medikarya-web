// =========================
// lib/simulation/reassessment.ts
// =========================
// What a reassessment finds. Pure: it reads the patient the engine holds and nothing else, so the browser and the
// server's replay get the same answer from the same log. A student never supplies a reading; they only ask.

import type { ReassessmentReport, SimulationCaseConfig } from "./case-schema";
import type { ReassessmentFindings } from "./encounter-events";
import type { PatientState } from "./patient-state";

/** The report a tray action carries, if giving it is a reassessment. */
export function reportFor(config: Pick<SimulationCaseConfig, "custom_interventions">, action: string): ReassessmentReport | undefined {
    return config.custom_interventions?.find((i) => i.id === action)?.report;
}

/** The readings the report asks for, taken from the patient as they are now. Only what was asked for is included. */
export function deriveFindings(report: ReassessmentReport, patient: PatientState): ReassessmentFindings {
    const readings = {
        hr: patient.rate,
        sbp: patient.systolic,
        dbp: patient.diastolic,
        pp: patient.systolic - patient.diastolic,
        map: patient.map,
        spo2: patient.spo2,
        rr: patient.rr,
        temp: patient.temperature,
    } as const;
    const out: ReassessmentFindings = {};
    if (report.vitals?.length) {
        out.vitals = {};
        for (const v of report.vitals) out.vitals[v] = readings[v];
    }
    if (report.consciousness) out.consciousness = patient.consciousness;
    if (report.findings?.length) out.findings = report.findings.map((f) => ({ id: f.id, label: f.label, present: patient.flags[f.flag] === true }));
    return out;
}

/** The readings as short lines for the tray and the timeline: "BP 84/76, pulse pressure 8", "HR 134", "Cold hands: present". */
export function describeFindings(f: ReassessmentFindings): string[] {
    const v = f.vitals ?? {};
    const out: string[] = [];
    if (v.sbp !== undefined && v.dbp !== undefined) out.push(`BP ${v.sbp}/${v.dbp}${v.pp !== undefined ? `, pulse pressure ${v.pp}` : ""}${v.map !== undefined ? `, MAP ${v.map}` : ""}`);
    else {
        if (v.sbp !== undefined) out.push(`Systolic BP ${v.sbp}`);
        if (v.dbp !== undefined) out.push(`Diastolic BP ${v.dbp}`);
        if (v.pp !== undefined) out.push(`Pulse pressure ${v.pp}`);
        if (v.map !== undefined) out.push(`MAP ${v.map}`);
    }
    if (v.hr !== undefined) out.push(`HR ${v.hr}`);
    if (v.rr !== undefined) out.push(`RR ${v.rr}`);
    if (v.spo2 !== undefined) out.push(`SpO₂ ${v.spo2}%`);
    if (v.temp !== undefined) out.push(`Temp ${v.temp.toFixed(1)} °C`);
    if (f.consciousness) out.push(`Consciousness: ${f.consciousness.replace(/_/g, " ")}`);
    for (const x of f.findings ?? []) out.push(`${x.label}: ${x.present ? "present" : "absent"}`);
    return out;
}
