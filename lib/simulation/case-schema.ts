// =========================
// lib/simulation/case-schema.ts
// =========================
// TypeScript shape of the simulation block of a case JSON.
//
// The engine is generic; the case owns all clinical meaning. Everything a
// simulated encounter needs — initial physiology, named flags, what each
// action does, when the patient deteriorates, which assists are allowed, how
// the encounter is scored — is authored here as data.
//
// These keys sit at the TOP LEVEL of the case JSON, next to the existing
// `patient`, `patient_facts`, `tests` and `evaluation_config` keys, so a
// simulation case is still a valid legacy case.

import type { TestCategory, TestKind } from "../clinical-catalog";
import type { AppearanceSpec } from "./appearance";
import type { AssistType } from "./encounter-events";

// ── Vocabulary ──────────────────────────────────────────────────────────────

export const RHYTHM_TYPES = [
    "sinus_normal",
    "sinus_tachycardia",
    "sinus_bradycardia",
    "afib",
    "flutter",
    "complete_heart_block",
    "pvc_occasional",
    "pvc_frequent",
    "pvc_bigeminy",
    "vt_sustained",
    "vf",
] as const;
export type RhythmType = (typeof RHYTHM_TYPES)[number];

export const CONSCIOUSNESS_LEVELS = ["alert", "anxious", "drowsy", "altered", "unresponsive"] as const;
export type Consciousness = (typeof CONSCIOUSNESS_LEVELS)[number];

export const STABILITY_LEVELS = ["stable", "unstable", "critical", "arrest"] as const;
export type StabilityLevel = (typeof STABILITY_LEVELS)[number];

export const ASSIST_MODES = ["beginner", "intermediate", "advanced", "assessment"] as const;
export type AssistMode = (typeof ASSIST_MODES)[number];

export const PHYSIOLOGICAL_PARAMETERS = [
    "hr",
    "rate",
    "heart_rate",
    "sbp",
    "systolic",
    "dbp",
    "diastolic",
    "map",
    "spo2",
    "rr",
    "temperature",
    "temp",
    "rhythm",
    "consciousness",
] as const;
export type PhysiologicalParameter = (typeof PHYSIOLOGICAL_PARAMETERS)[number];

// ── Conditions ──────────────────────────────────────────────────────────────
// One small grammar shared by event rules, action-consequence guards, exam
// finding variants, hints and (with extra leaves) scoring predicates.
//
//   TRIGGER 1  time            { time_elapsed_gte_minutes: 15 }
//   TRIGGER 2  action / state  { flag: "reperfusion_strategy_initiated", is: false }
//   TRIGGER 3  physiology      { parameter: "spo2", lt: 85 }
//
// plus named-state checks, named alarms, "flag has been set for N minutes" and
// all / any / not composition.

interface NumericComparators {
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
}

export type ParameterCondition = {
    parameter: PhysiologicalParameter;
    eq?: number | string;
    neq?: number | string;
    in?: Array<number | string>;
} & NumericComparators;

export type ConditionLeaf =
    | { time_elapsed_gte_minutes: number }
    | { time_elapsed_lt_minutes: number }
    | { flag: string; is: boolean }
    | { state: string }
    | { alarm: string }
    | { minutes_since_flag: { flag: string; gte: number } }
    | ParameterCondition;

export type RuleCondition =
    | ConditionLeaf
    | { all: RuleCondition[] }
    | { any: RuleCondition[] }
    | { not: RuleCondition };

// ── Physiology changes ──────────────────────────────────────────────────────
// Deltas are strings like "+8", "-3" or "-14/-8" (systolic/diastolic) so a case
// author can read them at a glance. Plain numbers are accepted too.

export interface PhysiologicalChanges {
    hr_delta?: string | number;
    /** Absolute heart rate — used when the rhythm itself dictates the rate (VT, brady-escape). */
    hr_set?: number;
    bp_delta?: string;
    spo2_delta?: string | number;
    rr_delta?: string | number;
    temp_delta?: string | number;
    rhythm?: RhythmType;
    consciousness?: Consciousness;
    stability?: StabilityLevel;
}

// ── Core simulation blocks ──────────────────────────────────────────────────

export interface ClinicalConstraints {
    /** Soft ordering budget (investigations + interventions) that feeds the Efficiency domain. Omit for no budget. */
    recommended_actions?: number;
    /** The window in which the time-critical decision should be made. Omit for a case with no such decision. */
    critical_window_minutes?: number;
    /** The encounter ends here; the student must commit to an assessment. Omit for the default (25 minutes). */
    hard_time_limit_minutes?: number;
    /**
     * No pressure clock. The encounter still shows elapsed time, but keeps only a
     * 3-hour safety cap instead of a limit the student is racing.
     */
    untimed?: boolean;
    /** Simulation seconds per real second. Defaults to 1. */
    time_scale?: number;
}

export interface AssistConfig {
    mode: AssistMode;
    /** Allowlist. When omitted the preset for `mode` applies. `[]` means nothing is allowed. */
    allowed?: AssistType[];
    /** Denylist. Wins over `allowed`. */
    disabled?: AssistType[];
    costs?: Partial<Record<AssistType, { independent_penalty: number }>>;
}

export interface InitialState {
    /** Named trajectory state the encounter starts in. */
    state?: string;
    rhythm: RhythmType;
    rate: number;
    systolic?: number;
    diastolic?: number;
    spo2?: number;
    rr?: number;
    temperature?: number;
    consciousness?: Consciousness;
    stability: StabilityLevel;
    /** Vitals the case never measured. The monitor shows "—" for them rather than an invented number. */
    unmeasured?: Array<"hr" | "bp" | "spo2" | "rr" | "temperature">;
    /** Every named flag must be declared here. Undeclared flags are a validation error. */
    flags: Record<string, boolean>;
}

export interface ActionConsequence {
    /** Action key: an intervention id, `<testId>_ordered`, `<manoeuvre>_performed`, or a derived/system action. */
    action: string;
    /** Only applies when this holds at the moment of the action. All guards are evaluated before any consequence is applied. */
    when?: RuleCondition;
    sets?: Record<string, boolean>;
    physiological_changes?: PhysiologicalChanges;
    /** Feedback shown to the student when the action is taken. */
    trajectory_note?: string;
    /** Marks a clinically unsafe action. Scored as a safety issue. */
    safety_penalty?: boolean;
}

export interface EventRule {
    id: string;
    when: RuleCondition;
    /** Named trajectory state entered when the rule fires. */
    transition: string;
    physiological_changes?: PhysiologicalChanges;
    /** Nurse alert text. `null` = silent transition. Supports {hr} {bp} {sbp} {dbp} {map} {spo2} {rr} {rhythm} placeholders. */
    narrative?: string | null;
    /** Flags set when the rule fires. */
    sets?: Record<string, boolean>;
    /** System actions emitted when the rule fires (routed through `action_consequences`). */
    emits?: string | string[];
}

export interface StateThreshold {
    parameter: PhysiologicalParameter;
    /** Name of the alarm that is active while the threshold is crossed. */
    trigger: string;
    eq?: number | string;
    neq?: number | string;
    in?: Array<number | string>;
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
}

// ── Recognition (scorer-side flags) ─────────────────────────────────────────
// "The patient IS having a STEMI" (physiology) is not the same fact as "the
// student recognised a STEMI" (scoring). Recognition rules turn what the
// student wrote into a derived action key, which then flows through
// `action_consequences` like any other action.

export interface RecognitionRule {
    id: string;
    /** Derived action key emitted on a match. */
    action: string;
    sources: Array<"interpretation" | "differential" | "diagnosis">;
    /** Restrict `interpretation` matches to one investigation. */
    testId?: string;
    /** Match when ANY of these phrases appears (negation-aware, case-insensitive). */
    any_of: string[];
    /** ...and ALL of these also appear. */
    all_of?: string[];
}

// ── Examination ─────────────────────────────────────────────────────────────

export type ExamRegion = "general" | "cardiovascular" | "respiratory" | "abdomen" | "neuro" | "extremities";

export interface ExamManoeuvreDef {
    id: string;
    label: string;
    region: ExamRegion;
    findings: string;
    /** First matching variant wins; otherwise `findings`. Lets findings track the patient's state. */
    findings_by_state?: Array<{ when: RuleCondition; findings: string }>;
}

// ── Investigations (case layer over the master catalog) ────────────────────

/** `abnormal` is for a finding that is off its reference without being higher or lower ("Present", "Trace"). */
export type ValueStatus = "normal" | "low" | "high" | "critical" | "abnormal";

export interface CaseResultValue {
    value: number | string;
    status?: ValueStatus;
    /** Why this value matters. Revealed by the explain-abnormal assist. */
    note?: string;
}

export type LeadName =
    | "I" | "II" | "III"
    | "aVR" | "aVL" | "aVF"
    | "V1" | "V2" | "V3" | "V4" | "V5" | "V6";

/**
 * Per-lead beat morphology, in mV. `p`, `r`, `t` are signed as drawn (positive =
 * up); `q` and `s` are DEPTHS of the downward deflections. Any field omitted
 * falls back to the normal template for that lead.
 */
export interface LeadMorphology {
    p?: number;
    q?: number;
    r?: number;
    s?: number;
    /** A QS complex: one broad negative deflection of this depth that replaces q/r/s (lost R wave). */
    qs?: number;
    /** ST-segment shift relative to the baseline (+ elevation, − depression). */
    st?: number;
    t?: number;
}

export interface Ecg12LeadSpec {
    /** Omit to follow the patient's live rhythm when the ECG is recorded. */
    rhythm?: RhythmType;
    /** Omit to follow the patient's live heart rate when the ECG is recorded. */
    rate?: number;
    pr_ms?: number;
    qrs_ms?: number;
    qt_ms?: number;
    axis_deg?: number;
    /** Per-lead overrides layered over the normal template. */
    leads?: Partial<Record<LeadName, LeadMorphology>>;
}

export interface ImagingReport {
    technique?: string;
    /** Objective description. Visible with the study. */
    findings: string;
    /** The radiologist's conclusion. Collapsed until revealed (or the debrief). */
    impression: string;
}

/** One authored result line, for tests whose parameters the master catalog doesn't define. */
export interface ResultRow {
    parameter: string;
    value: number | string;
    unit?: string;
    reference_range?: string;
    status?: ValueStatus;
    note?: string;
}

/** A test the case defines itself: not in the master catalog, or not orderable from it in this case. */
export interface CustomTestDef {
    id: string;
    name: string;
    category: TestCategory;
    kind: TestKind;
    /** Sim minutes until the result is available. Falls back to 30. */
    turnaround_minutes?: number;
    specimen?: string;
}

interface CaseInvestigationResultBody {
    summary?: string;
    /** Catalog parameter key → result. */
    values?: Record<string, CaseResultValue>;
    /** Authored result lines. When present they replace the catalog's parameter table entirely. */
    rows?: ResultRow[];
    /** Single-parameter shorthand: applies to the test's first catalog parameter. */
    value?: number | string;
    status?: ValueStatus;
    note?: string;
    /** Sim minutes until the result is available. Falls back to the catalog turnaround. */
    turnaround_minutes?: number;
    /** Expert interpretation. Hidden behind an assist during the case; shown to everyone in the debrief. */
    interpretation?: string;
    critical_findings?: string[];
    /** Action key emitted when the student interprets this result (evidence acknowledged). */
    state_consequence?: string;
    ecg?: Ecg12LeadSpec;
    image_url?: string;
    report?: ImagingReport;
    /** Guided nudge shown by the hint-level assist. */
    hint?: string;
}

export interface CaseInvestigationResult extends CaseInvestigationResultBody {
    /** First matching variant overrides the base. Lets a repeat ECG or serial troponin follow the patient's state. */
    variants?: Array<CaseInvestigationResultBody & { when: RuleCondition }>;
}

// ── Hints ───────────────────────────────────────────────────────────────────

export interface SocraticHint {
    id: string;
    when: RuleCondition;
    hint: string;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export type ScoringDomain =
    | "clinical_reasoning"
    | "investigation_accuracy"
    | "management"
    | "efficiency";

export const SCORING_DOMAINS: readonly ScoringDomain[] = [
    "clinical_reasoning",
    "investigation_accuracy",
    "management",
    "efficiency",
];

type IdOrIds = string | string[];

/** Encounter-level predicates. Evaluated by the scorer against the full event log and final patient state. */
export type EncounterPredicateLeaf =
    | { ordered: IdOrIds; within_minutes?: number; within_actions?: number }
    | { gave: IdOrIds; within_minutes?: number }
    | { performed: IdOrIds }
    | { asked_about: string[] }
    | { interpretation_mentions: { testId?: string; any_of: string[] } }
    | { reasoning_mentions: string[] }
    | { diagnosis_matches: string[] }
    | { differential_slot: { slot: 1 | 2 | 3; matches: string[] } }
    | { differential_contains: string[] }
    | { plan_mentions: string[] }
    | { revealed: IdOrIds }
    | { rule_fired: string }
    | { budgeted_actions_lte: number | "recommended" };

export type ScoringPredicate =
    | ConditionLeaf
    | EncounterPredicateLeaf
    | { all: ScoringPredicate[] }
    | { any: ScoringPredicate[] }
    | { not: ScoringPredicate };

export interface RubricGraded {
    /** Time of the first event satisfying this (ordered / gave / performed, optionally any/all combined). */
    measure: ScoringPredicate;
    full_within_minutes: number;
    zero_after_minutes: number;
}

export interface RubricItem {
    id: string;
    label: string;
    domain: ScoringDomain;
    weight: number;
    /** Unmet critical items are surfaced first under "You missed". */
    critical?: boolean;
    met_when?: ScoringPredicate;
    /** Partial credit path, e.g. wrote it in the plan but never enacted it. */
    partial_when?: ScoringPredicate;
    partial_credit?: number;
    graded?: RubricGraded;
    did_well?: string;
    missed?: string;
    knowledge_gap?: string;
}

export interface RubricPenalty {
    id: string;
    label: string;
    domain: ScoringDomain;
    /** Points off the domain score (0–100 scale). */
    points: number;
    when: ScoringPredicate;
    /** With an `ordered`/`gave` id list: charge `points` for each distinct id that matched. */
    per_match?: boolean;
    max_points?: number;
    critical?: boolean;
    knowledge_gap?: string;
}

export interface Misconception {
    id: string;
    title: string;
    when: ScoringPredicate;
    /** "YOUR REASONING ERROR" */
    error: string;
    /** "WHY IT MATTERED" */
    why_it_mattered: string;
    knowledge_gap: string;
    /** Higher wins when several are detected. */
    priority: number;
}

export interface ExpertImpression {
    testId: string;
    title: string;
    text: string;
}

export interface ScoringRubric {
    weights: Record<ScoringDomain, number>;
    diagnosis: { ground_truth: string; accepted: string[] };
    items: RubricItem[];
    penalties?: RubricPenalty[];
    misconceptions?: Misconception[];
    /** Points off the management domain for each safety-flagged intervention. Default 15. */
    safety_penalty_points?: number;
    /** Expert reads that every student sees in the debrief, whether or not they used the assist. */
    expert_impressions?: ExpertImpression[];
    key_learning_points?: string[];
}

// ── Reinforcement ───────────────────────────────────────────────────────────

export interface ReinforcementQuestion {
    id: string;
    stem: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    category?: string;
    difficulty?: "recall" | "application" | "vignette" | "trap" | "integration";
}

export interface ReinforcementGap {
    title: string;
    summary: string;
    questions: ReinforcementQuestion[];
}

/** Keyed by knowledge-gap id. */
export type ReinforcementMap = Record<string, ReinforcementGap>;

// ── The case ────────────────────────────────────────────────────────────────

export interface SimulationCaseConfig {
    id: string;
    clinical_constraints: ClinicalConstraints;
    assist_config: AssistConfig;
    initial_state: InitialState;
    action_consequences: ActionConsequence[];
    event_rules: EventRule[];
    state_thresholds?: StateThreshold[];
    recognition_rules?: RecognitionRule[];
    examination?: ExamManoeuvreDef[];
    /** How the patient looks (pallor, yellow eyes, sweat, expression), optionally changing with their state. */
    appearance?: AppearanceSpec;
    /** Tests this case defines itself, looked up before the master catalog. */
    custom_tests?: CustomTestDef[];
    /**
     * "catalog" (default): the order menu is the whole master catalog, plus `custom_tests`.
     * "case_only": the menu offers only `custom_tests`. For cases whose own results are
     * complete, where a catalog default ("normal") could contradict the disease.
     */
    order_menu?: "catalog" | "case_only";
    /**
     * "rubric" (default): scored by the DualScorer against `scoring_rubric`.
     * "classic": scored by the classic evaluator against `evaluation_config`; the
     * assist costs still produce the Independent score.
     */
    scoring_mode?: "rubric" | "classic";
    /** Keyed by test id: master-catalog ids, or the ids of `custom_tests`. */
    investigation_results?: Record<string, CaseInvestigationResult>;
    socratic_hints?: SocraticHint[];
    /** Overrides for the generic vital-sign explanations, keyed hr | bp | spo2 | rr | temperature. */
    vital_explanations?: Record<string, string>;
    scoring_rubric?: ScoringRubric;
    reinforcement?: ReinforcementMap;
    learning_objectives?: string[];
    /** Interventions offered in the emergency tray. Omitted = the full tray; `[]` = no tray. */
    available_interventions?: string[];
    /** Legacy patient block — used as the vitals source when `initial_state` omits a value. */
    patient?: {
        name?: string;
        age?: number;
        gender?: string;
        vitalSigns?: {
            bloodPressure?: { systolic?: number; diastolic?: number };
            heartRate?: { value?: number };
            respiratoryRate?: { value?: number };
            temperature?: { value?: number };
            oxygenSaturation?: { value?: number };
        };
    };
}

/** A case is a simulation case when it carries the simulation core. */
export function isSimulationCase(caseData: unknown): caseData is SimulationCaseConfig {
    if (!caseData || typeof caseData !== "object") return false;
    const c = caseData as Record<string, unknown>;
    return (
        !!c.initial_state &&
        typeof c.initial_state === "object" &&
        Array.isArray(c.event_rules) &&
        Array.isArray(c.action_consequences)
    );
}

export const DEFAULT_CLINICAL_CONSTRAINTS = {
    recommended_actions: 10,
    critical_window_minutes: 15,
    hard_time_limit_minutes: 25,
    time_scale: 1,
} satisfies ClinicalConstraints;

/** The safety cap of an untimed encounter. */
export const UNTIMED_LIMIT_MINUTES = 180;

/** Seconds at which the encounter is force-ended. */
export function hardLimitSeconds(config: Pick<SimulationCaseConfig, "clinical_constraints">): number {
    if (config.clinical_constraints?.untimed) return UNTIMED_LIMIT_MINUTES * 60;
    const minutes = config.clinical_constraints?.hard_time_limit_minutes;
    return (Number.isFinite(minutes) && (minutes as number) > 0
        ? (minutes as number)
        : DEFAULT_CLINICAL_CONSTRAINTS.hard_time_limit_minutes) * 60;
}
