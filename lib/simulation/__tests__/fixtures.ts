// Compact STEMI configuration used by the engine unit tests.
//
// It mirrors the plan's case JSON so the engine tests exercise the real rule
// shapes, but it is deliberately independent of data/cases/simulation/*.json:
// re-authoring the real case must not break the engine's unit tests.

import type { SimulationCaseConfig } from "../case-schema";

export function makeStemiConfig(overrides: Partial<SimulationCaseConfig> = {}): SimulationCaseConfig {
    const config: SimulationCaseConfig = {
        id: "fixture-stemi",
        clinical_constraints: {
            recommended_actions: 10,
            critical_window_minutes: 15,
            hard_time_limit_minutes: 25,
        },
        assist_config: {
            mode: "intermediate",
            allowed: [
                "highlight_abnormal",
                "explain_abnormal",
                "ecg_interpretation_hint",
                "radiology_impression",
                "socratic_hint",
            ],
            disabled: ["reveal_diagnosis", "management_guidance"],
            costs: {
                highlight_abnormal: { independent_penalty: 1 },
                explain_abnormal: { independent_penalty: 2 },
                ecg_interpretation_hint: { independent_penalty: 3 },
                radiology_impression: { independent_penalty: 3 },
                socratic_hint: { independent_penalty: 3 },
                diagnostic_hint: { independent_penalty: 5 },
                management_guidance: { independent_penalty: 7 },
            },
        },
        initial_state: {
            state: "acute_presentation",
            rhythm: "sinus_tachycardia",
            rate: 112,
            systolic: 94,
            diastolic: 62,
            spo2: 91,
            rr: 24,
            stability: "unstable",
            flags: {
                ongoing_ischemia: true,
                ecg_obtained: false,
                stemi_recognized_by_student: false,
                aspirin_given: false,
                antiplatelet_therapy_started: false,
                cath_lab_activated: false,
                reperfusion_strategy_initiated: false,
                pci_started: false,
                fibrinolysis_given: false,
                reperfusion_achieved: false,
                continuous_monitoring: false,
                iv_access_obtained: false,
                shock_assessment_done: false,
                immediate_deterioration: false,
            },
        },
        action_consequences: [
            {
                action: "aspirin_300mg",
                sets: { aspirin_given: true, antiplatelet_therapy_started: true },
                trajectory_note: "Antiplatelet therapy started — does NOT initiate reperfusion.",
            },
            { action: "ecg_12_lead_ordered", sets: { ecg_obtained: true } },
            { action: "stemi_recognized_by_student", sets: { stemi_recognized_by_student: true } },
            {
                action: "activate_cath_lab",
                sets: { cath_lab_activated: true, reperfusion_strategy_initiated: true },
                trajectory_note: "Cath lab activated — the reperfusion pathway is under way.",
            },
            {
                action: "primary_pci_initiated",
                when: { flag: "cath_lab_activated", is: true },
                sets: { pci_started: true, reperfusion_strategy_initiated: true },
                trajectory_note: "Patient to the cath lab for primary PCI.",
            },
            {
                action: "primary_pci_initiated",
                when: { flag: "cath_lab_activated", is: false },
                trajectory_note: "The cath lab has not been activated — PCI cannot start yet.",
            },
            {
                action: "fibrinolysis_given",
                sets: { fibrinolysis_given: true, reperfusion_strategy_initiated: true },
                trajectory_note: "Fibrinolysis given.",
            },
            {
                action: "reperfusion_achieved",
                sets: { reperfusion_achieved: true, ongoing_ischemia: false },
            },
            {
                action: "metoprolol_iv",
                when: { any: [{ parameter: "sbp", lt: 100 }, { state: "cardiogenic_shock" }] },
                sets: { immediate_deterioration: true },
                safety_penalty: true,
                trajectory_note: "IV beta-blocker in a low-output state.",
            },
            { action: "peripheral_perfusion_performed", sets: { shock_assessment_done: true } },
        ],
        event_rules: [
            {
                id: "early_ischemic_progression",
                when: {
                    all: [
                        { time_elapsed_gte_minutes: 8 },
                        { flag: "ongoing_ischemia", is: true },
                        { flag: "ecg_obtained", is: false },
                    ],
                },
                transition: "increasing_ischemia",
                physiological_changes: { hr_delta: "+8", rhythm: "pvc_occasional" },
                narrative: null,
            },
            {
                id: "critical_window_no_reperfusion",
                when: {
                    all: [
                        { time_elapsed_gte_minutes: 15 },
                        { flag: "reperfusion_strategy_initiated", is: false },
                        { flag: "ongoing_ischemia", is: true },
                    ],
                },
                transition: "worsening_ischemia",
                physiological_changes: {
                    hr_delta: "+10",
                    bp_delta: "-14/-8",
                    spo2_delta: "-3",
                    rhythm: "pvc_frequent",
                },
                narrative:
                    "The nurse says the pain is worsening and the patient looks greyer. BP {bp}, HR {hr}, {rhythm} on the monitor.",
            },
            {
                id: "major_deterioration",
                when: {
                    all: [
                        { time_elapsed_gte_minutes: 20 },
                        { flag: "reperfusion_strategy_initiated", is: false },
                        { state: "worsening_ischemia" },
                    ],
                },
                transition: "cardiogenic_shock",
                physiological_changes: {
                    hr_set: 178,
                    bp_delta: "-30/-20",
                    spo2_delta: "-5",
                    rhythm: "vt_sustained",
                    consciousness: "altered",
                    stability: "critical",
                },
                narrative: "Patient acutely deteriorating. BP {bp}. {rhythm} on the monitor. Call for the crash team.",
            },
            {
                id: "beta_blocker_crash",
                when: {
                    all: [
                        { flag: "immediate_deterioration", is: true },
                        { not: { state: "cardiogenic_shock" } },
                    ],
                },
                transition: "cardiogenic_shock",
                physiological_changes: {
                    hr_set: 176,
                    bp_delta: "-28/-18",
                    rhythm: "vt_sustained",
                    consciousness: "altered",
                    stability: "critical",
                },
                narrative: "Shortly after the beta-blocker, BP falls to {bp} and the monitor shows {rhythm}.",
            },
            {
                id: "pci_reperfusion",
                when: {
                    all: [
                        { minutes_since_flag: { flag: "pci_started", gte: 6 } },
                        { flag: "ongoing_ischemia", is: true },
                    ],
                },
                transition: "reperfused",
                emits: "reperfusion_achieved",
                physiological_changes: {
                    hr_set: 84,
                    bp_delta: "+22/+12",
                    spo2_delta: "+5",
                    rhythm: "sinus_normal",
                    stability: "stable",
                },
                narrative: "Flow restored in the LAD. Pain easing; BP {bp}, HR {hr}.",
            },
        ],
        state_thresholds: [
            { parameter: "spo2", lt: 85, trigger: "critical_hypoxia" },
            { parameter: "map", lt: 65, trigger: "shock_state" },
            { parameter: "rhythm", eq: "vt_sustained", trigger: "cardiac_arrest_risk" },
        ],
        recognition_rules: [
            {
                id: "recognise_stemi",
                action: "stemi_recognized_by_student",
                sources: ["interpretation", "diagnosis", "differential"],
                any_of: ["stemi", "st elevation", "st-elevation", "st segment elevation"],
            },
        ],
    };
    return { ...config, ...overrides };
}

const MIN = 60;
export const minutes = (m: number): number => m * MIN;
