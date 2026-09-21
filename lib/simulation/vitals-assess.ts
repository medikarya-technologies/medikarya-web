// =========================
// lib/simulation/vitals-assess.ts
// =========================
// Interprets the bedside vitals: the abnormality badges (TACHY, HYPO, HYPOXIC…)
// and the "why this matters" explanations.
//
// The badges ARE the assist. A real monitor shows numbers and raises alarms; it
// does not label them. So the rail shows plain numbers by default, and these
// badges appear only when the student spends `highlight_abnormal` (and the
// explanations only for `explain_abnormal`). Monitor ALARMS — the case's
// `state_thresholds` — are not assists and are always shown.
//
// Adult thresholds follow the plan: TACHY ≥100 · BRADY ≤60 · HYPO ≤90/60 ·
// HYPOXIC ≤94% · FEBRILE ≥38.5 °C. Values that cross them by a wide margin
// escalate from amber to red. For a child the heart-rate, respiratory-rate and
// blood-pressure limits move with age: a heart rate of 130 is ordinary in a
// two-year-old and must not be badged TACHY.

import type { PatientSnapshot } from "./patient-state";
import type { SimulationCaseConfig } from "./case-schema";

export type VitalKey = "hr" | "bp" | "spo2" | "rr" | "temperature";
export type VitalSeverity = "normal" | "warning" | "critical";

export interface VitalAssessment {
    key: VitalKey;
    label: string;
    display: string;
    unit: string;
    /** Badge text, or null when the value is unremarkable. */
    badge: string | null;
    direction: "up" | "down" | null;
    severity: VitalSeverity;
    /** Generic explanation; a case can override it via `vital_explanations`. */
    explanation: string;
}

// ── Age-banded limits ───────────────────────────────────────────────────────

export interface VitalLimits {
    band: "adult" | "neonate" | "infant" | "toddler" | "preschool" | "school_age";
    hrLow: number;
    hrHigh: number;
    rrLow: number;
    rrHigh: number;
    /** Systolic pressure below this is hypotension for the age. */
    sbpLow: number;
}

const ADULT_LIMITS: VitalLimits = { band: "adult", hrLow: 60, hrHigh: 100, rrLow: 12, rrHigh: 20, sbpLow: 90 };

/**
 * Awake, at-rest reference limits by age in years (PALS / standard paediatric
 * charts). From 12 years the adult limits apply, so an adult case is unchanged.
 */
export function vitalLimitsForAge(ageYears?: number): VitalLimits {
    if (ageYears === undefined || !Number.isFinite(ageYears) || ageYears < 0 || ageYears >= 12) return ADULT_LIMITS;
    if (ageYears < 1 / 12) return { band: "neonate", hrLow: 100, hrHigh: 180, rrLow: 30, rrHigh: 60, sbpLow: 60 };
    if (ageYears < 1) return { band: "infant", hrLow: 100, hrHigh: 160, rrLow: 30, rrHigh: 53, sbpLow: 70 };
    if (ageYears < 3) return { band: "toddler", hrLow: 98, hrHigh: 140, rrLow: 22, rrHigh: 37, sbpLow: 70 + 2 * Math.floor(ageYears) };
    if (ageYears < 6) return { band: "preschool", hrLow: 80, hrHigh: 120, rrLow: 20, rrHigh: 28, sbpLow: 70 + 2 * Math.floor(ageYears) };
    return { band: "school_age", hrLow: 75, hrHigh: 118, rrLow: 18, rrHigh: 25, sbpLow: 70 + 2 * Math.floor(ageYears) };
}

// ── Explanations ────────────────────────────────────────────────────────────
// Deliberately case-neutral: these apply whatever the presentation. A case with
// something specific to say about a vital overrides it via `vital_explanations`.

const GENERIC_EXPLANATIONS: Record<string, string> = {
    TACHY:
        "Heart rate above the normal range for this patient's age. Common drivers are pain, fever, anxiety, dehydration, blood loss, anaemia, hypoxia, arrhythmia and drugs. Read it together with the blood pressure and the story: a fast rate with a low pressure suggests the body is compensating for something.",
    BRADY:
        "Heart rate below the normal range for this patient's age. Consider heart block, drugs (beta-blockers, calcium-channel blockers, digoxin), raised vagal tone, hypothyroidism and raised intracranial pressure. Symptomatic bradycardia with hypotension needs urgent treatment.",
    HYPO:
        "Blood pressure is low for this patient's age. It may reflect volume loss, sepsis, reduced cardiac output or drugs. It changes which treatments are safe and how urgently the cause must be found.",
    HYPERTENSIVE:
        "Blood pressure is markedly raised. Consider pain and anxiety, but also renal disease, endocrine causes, drugs and hypertensive emergency.",
    HYPOXIC:
        "Oxygen saturation of 94% or less. Causes include pneumonia, pulmonary oedema or embolism, airway or neuromuscular problems and shunt. Look for the cause rather than treating the number alone.",
    "HIGH RR":
        "Respiratory rate above the normal range for this patient's age. Often reflects pain or anxiety, but is also an early sign of hypoxia, acidosis, sepsis, fever and pulmonary or cardiac disease, and a strong predictor of deterioration.",
    "LOW RR":
        "Respiratory rate below the normal range for this patient's age. Consider opioids, sedation, raised intracranial pressure or exhaustion.",
    FEBRILE:
        "Temperature of 38.5 °C or above. Look for infection, inflammation and drug fever.",
    HYPOTHERMIC:
        "Temperature at or below 35.5 °C. Consider exposure, sepsis, hypothyroidism and drugs.",
};

const CASE_EXPLANATION_KEY: Record<VitalKey, string> = {
    hr: "hr",
    bp: "bp",
    spo2: "spo2",
    rr: "rr",
    temperature: "temperature",
};

type AssessConfig = Pick<SimulationCaseConfig, "vital_explanations" | "initial_state" | "patient">;

export function assessVitals(
    p: Pick<PatientSnapshot, "rate" | "systolic" | "diastolic" | "map" | "spo2" | "rr" | "temperature" | "rhythm">,
    config?: Partial<AssessConfig>
): VitalAssessment[] {
    const limits = vitalLimitsForAge(config?.patient?.age);
    const paediatric = limits.band !== "adult";
    const unmeasured = new Set<VitalKey>(config?.initial_state?.unmeasured ?? []);

    const explanationFor = (key: VitalKey, badge: string | null): string =>
        config?.vital_explanations?.[CASE_EXPLANATION_KEY[key]] ??
        (badge ? GENERIC_EXPLANATIONS[badge] : "Within the expected range.") ??
        "";

    // Heart rate
    let hrBadge: string | null = null;
    let hrDir: "up" | "down" | null = null;
    let hrSev: VitalSeverity = "normal";
    if (p.rhythm === "vf") {
        hrBadge = null;
    } else if (paediatric) {
        if (p.rate > limits.hrHigh) {
            hrBadge = "TACHY"; hrDir = "up"; hrSev = p.rate >= limits.hrHigh * 1.25 ? "critical" : "warning";
        } else if (p.rate < limits.hrLow) {
            hrBadge = "BRADY"; hrDir = "down"; hrSev = p.rate <= limits.hrLow * 0.75 ? "critical" : "warning";
        }
    } else if (p.rate >= 100) {
        hrBadge = "TACHY"; hrDir = "up"; hrSev = p.rate >= 130 ? "critical" : "warning";
    } else if (p.rate <= 60) {
        hrBadge = "BRADY"; hrDir = "down"; hrSev = p.rate <= 45 ? "critical" : "warning";
    }

    // Blood pressure
    let bpBadge: string | null = null;
    let bpDir: "up" | "down" | null = null;
    let bpSev: VitalSeverity = "normal";
    if (paediatric) {
        if (p.systolic < limits.sbpLow) {
            bpBadge = "HYPO"; bpDir = "down"; bpSev = "critical";
        } else if (p.systolic < limits.sbpLow + 10) {
            bpBadge = "HYPO"; bpDir = "down"; bpSev = "warning";
        }
    } else if (p.systolic <= 90 || p.diastolic <= 60 || p.map < 65) {
        bpBadge = "HYPO"; bpDir = "down"; bpSev = "critical";
    } else if (p.systolic < 100) {
        bpBadge = "HYPO"; bpDir = "down"; bpSev = "warning";
    } else if (p.systolic >= 180 || p.diastolic >= 110) {
        bpBadge = "HYPERTENSIVE"; bpDir = "up"; bpSev = "critical";
    }

    // SpO₂
    let spo2Badge: string | null = null;
    let spo2Sev: VitalSeverity = "normal";
    if (p.spo2 <= 94) {
        spo2Badge = "HYPOXIC";
        spo2Sev = p.spo2 <= 90 ? "critical" : "warning";
    }

    // Respiratory rate
    let rrBadge: string | null = null;
    let rrDir: "up" | "down" | null = null;
    let rrSev: VitalSeverity = "normal";
    if (p.rr > limits.rrHigh) {
        rrBadge = "HIGH RR"; rrDir = "up"; rrSev = p.rr >= (paediatric ? limits.rrHigh * 1.4 : 28) ? "critical" : "warning";
    } else if (p.rr < limits.rrLow) {
        rrBadge = "LOW RR"; rrDir = "down"; rrSev = p.rr < (paediatric ? limits.rrLow * 0.7 : 8) ? "critical" : "warning";
    }

    // Temperature
    let tBadge: string | null = null;
    let tDir: "up" | "down" | null = null;
    let tSev: VitalSeverity = "normal";
    if (p.temperature >= 38.5) {
        tBadge = "FEBRILE"; tDir = "up"; tSev = p.temperature >= 40 ? "critical" : "warning";
    } else if (p.temperature <= 35.5) {
        tBadge = "HYPOTHERMIC"; tDir = "down"; tSev = "warning";
    }

    const rows: VitalAssessment[] = [
        { key: "hr", label: "HR", display: p.rhythm === "vf" ? "—" : String(p.rate), unit: "bpm", badge: hrBadge, direction: hrDir, severity: hrSev, explanation: explanationFor("hr", hrBadge) },
        { key: "bp", label: "BP", display: `${p.systolic}/${p.diastolic}`, unit: "mmHg", badge: bpBadge, direction: bpDir, severity: bpSev, explanation: explanationFor("bp", bpBadge) },
        { key: "spo2", label: "SpO₂", display: String(p.spo2), unit: "%", badge: spo2Badge, direction: spo2Badge ? "down" : null, severity: spo2Sev, explanation: explanationFor("spo2", spo2Badge) },
        { key: "rr", label: "RR", display: String(p.rr), unit: "/min", badge: rrBadge, direction: rrDir, severity: rrSev, explanation: explanationFor("rr", rrBadge) },
        { key: "temperature", label: "Temp", display: p.temperature.toFixed(1), unit: "°C", badge: tBadge, direction: tDir, severity: tSev, explanation: explanationFor("temperature", tBadge) },
    ];

    // A vital the case never measured is shown as not measured, never as an invented number.
    return rows.map((row) =>
        unmeasured.has(row.key)
            ? { ...row, display: "—", badge: null, direction: null, severity: "normal", explanation: "Not measured in this case." }
            : row
    );
}

/** Human labels for the case's monitor alarms. Unknown alarms fall back to their own name. */
export const ALARM_LABELS: Record<string, string> = {
    critical_hypoxia: "CRITICAL HYPOXIA",
    shock_state: "SHOCK — MAP < 65",
    cardiac_arrest_risk: "LETHAL RHYTHM",
};

export function alarmLabel(name: string): string {
    return ALARM_LABELS[name] ?? name.replace(/_/g, " ").toUpperCase();
}
