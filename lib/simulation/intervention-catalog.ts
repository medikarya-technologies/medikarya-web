// =========================
// lib/simulation/intervention-catalog.ts
// =========================
// The emergency tray. Generic and shared by every case: the ids here are the
// action keys a case's `action_consequences` are written against. What each
// action DOES to a particular patient is the case's business — the tray only
// says what is on offer.

import type { SimulationCaseConfig } from "./case-schema";

export type InterventionGroup = "airway" | "circulation" | "medications" | "cardiac_procedures";

export interface InterventionDef {
    id: string;
    label: string;
    /** Dose / route / setting shown under the label. */
    detail: string;
    group: InterventionGroup;
}

export const INTERVENTION_GROUPS: ReadonlyArray<{ id: InterventionGroup; label: string }> = [
    { id: "airway", label: "Airway & Breathing" },
    { id: "circulation", label: "Circulation" },
    { id: "medications", label: "Emergency Medications" },
    { id: "cardiac_procedures", label: "Cardiac Procedures" },
];

export const INTERVENTIONS: readonly InterventionDef[] = [
    // ── Airway & Breathing ────────────────────────────────────────────────
    { id: "oxygen_supplemental", label: "Supplemental oxygen", detail: "Nasal cannula or mask, titrate SpO₂ to 94–98%", group: "airway" },
    { id: "high_flow_oxygen", label: "High-flow oxygen", detail: "15 L/min via non-rebreather mask", group: "airway" },
    { id: "niv_cpap", label: "CPAP / non-invasive ventilation", detail: "CPAP 5–10 cmH₂O via tight-fitting mask", group: "airway" },
    { id: "bag_valve_mask", label: "Bag-valve-mask ventilation", detail: "Assisted ventilation with 100% oxygen", group: "airway" },
    { id: "intubation_rsi", label: "Endotracheal intubation (RSI)", detail: "Rapid sequence induction and intubation", group: "airway" },

    // ── Circulation ───────────────────────────────────────────────────────
    { id: "iv_access", label: "IV access ×2", detail: "Two large-bore (18G) cannulae", group: "circulation" },
    { id: "continuous_monitoring", label: "Continuous monitoring", detail: "ECG, SpO₂ and NIBP q5 min", group: "circulation" },
    { id: "fluid_bolus_250ml", label: "IV fluid bolus", detail: "250 mL crystalloid over 15 minutes", group: "circulation" },
    { id: "norepinephrine_infusion", label: "Norepinephrine infusion", detail: "Start 0.05–0.1 µg/kg/min, titrate to MAP ≥ 65 mmHg", group: "circulation" },
    { id: "cpr_start", label: "Start CPR", detail: "High-quality compressions, 30:2", group: "circulation" },

    // ── Emergency Medications ─────────────────────────────────────────────
    { id: "aspirin_300mg", label: "Aspirin 300 mg", detail: "Chewed, non-enteric-coated", group: "medications" },
    { id: "p2y12_loading", label: "P2Y12 inhibitor loading", detail: "Ticagrelor 180 mg orally (clopidogrel 300 mg if lysis)", group: "medications" },
    { id: "heparin_ufh_bolus", label: "Unfractionated heparin", detail: "Weight-adjusted IV bolus", group: "medications" },
    { id: "gtn_sublingual", label: "GTN sublingual", detail: "0.4 mg SL, may repeat every 5 min", group: "medications" },
    { id: "morphine_iv", label: "Morphine IV", detail: "2–4 mg IV, titrated to pain", group: "medications" },
    { id: "metoprolol_iv", label: "Metoprolol IV", detail: "5 mg IV over 2 minutes", group: "medications" },
    { id: "atorvastatin_80mg", label: "Atorvastatin 80 mg", detail: "High-intensity statin, oral", group: "medications" },
    { id: "furosemide_iv", label: "Furosemide IV", detail: "40 mg IV", group: "medications" },
    { id: "amiodarone_300mg", label: "Amiodarone IV", detail: "300 mg IV over 10–20 minutes", group: "medications" },
    { id: "adrenaline_1mg", label: "Adrenaline 1 mg IV", detail: "Cardiac-arrest dose, repeat every 3–5 min", group: "medications" },
    { id: "ondansetron_4mg", label: "Ondansetron IV", detail: "4 mg IV for nausea", group: "medications" },

    // ── Cardiac Procedures ────────────────────────────────────────────────
    { id: "activate_cath_lab", label: "Activate cath lab (STEMI pathway)", detail: "Call the interventional team now", group: "cardiac_procedures" },
    { id: "primary_pci_initiated", label: "Proceed to primary PCI", detail: "To the cath lab: angiography ± stenting", group: "cardiac_procedures" },
    { id: "fibrinolysis_given", label: "Fibrinolysis", detail: "Tenecteplase, weight-adjusted IV bolus", group: "cardiac_procedures" },
    { id: "synchronised_cardioversion", label: "Synchronised cardioversion", detail: "Sedate, then synchronised shock 120–200 J biphasic", group: "cardiac_procedures" },
    { id: "defibrillation", label: "Defibrillation (unsynchronised)", detail: "200 J biphasic", group: "cardiac_procedures" },
    { id: "transcutaneous_pacing", label: "Transcutaneous pacing", detail: "Pads on, rate 70, increase current to capture", group: "cardiac_procedures" },
];

const BY_ID: ReadonlyMap<string, InterventionDef> = new Map(INTERVENTIONS.map((i) => [i.id, i]));

export function getIntervention(id: string): InterventionDef | undefined {
    return BY_ID.get(id);
}

export const INTERVENTION_IDS: readonly string[] = INTERVENTIONS.map((i) => i.id);

/**
 * The tray for a case: the whole tray when the case doesn't say, the subset it
 * offers, or nothing at all (`[]`) for a case with no bedside treatments to give.
 */
export function interventionsForCase(
    config: Pick<SimulationCaseConfig, "available_interventions">
): InterventionDef[] {
    const offered = config.available_interventions;
    if (offered === undefined) return [...INTERVENTIONS];
    return INTERVENTIONS.filter((i) => offered.includes(i.id));
}
