// =========================
// lib/simulation/live-plan.ts
// =========================
// A LIVE PLAN: what turns an ordinary case (a patient who stays as they arrived) into a live one (a patient who
// gets worse until the right things are done). It is written in a clinician's terms, not the engine's:
//
//   the untreated course   "at 6 minutes: HR 142, BP 84/50, drowsy; the nurse says ..."
//   the treatments         what is on the tray, what each does, which are essential and by when, which do harm
//   what stops it          the treatments that, once all given, end the deterioration
//   the recovery           where the patient settles afterwards
//
// A resident writes one in the Case Studio, or the AI drafts one from the case (lib/studio/live-draft.ts). Either
// way a senior clinician signs it off before students meet it. Nothing here is written by a model into the engine's
// own rules: `compileLivePlan` turns the plan into those rules the same way every time, so what the clinician read
// and approved in the report is exactly what runs.
//
// Pure: no I/O, no UI. Tested in __tests__/live-plan.test.ts.

import type {
    ActionConsequence,
    Consciousness,
    CustomInterventionDef,
    EventRule,
    PhysiologicalChanges,
    RhythmType,
    RuleCondition,
    SimulationCaseConfig,
    StabilityLevel,
} from "./case-schema";
import { CONSCIOUSNESS_LEVELS, RHYTHM_TYPES, STABILITY_LEVELS } from "./case-schema";
import type { ClinicalEvent } from "./encounter-events";
import { INTERVENTIONS, type InterventionGroup } from "./intervention-catalog";
import { PatientState } from "./patient-state";

// ── The plan ────────────────────────────────────────────────────────────────

/** Vital signs. In a stage or the recovery they are the values on the monitor; in a treatment's `effect` they are changes (+/-). */
export interface LiveVitals {
    hr?: number;
    sbp?: number;
    dbp?: number;
    spo2?: number;
    rr?: number;
    temp?: number;
}

/** One step of the untreated course. */
export interface LiveStage {
    id: string;
    /** What a clinician would call it: "Compensated shock". */
    name: string;
    /** Minutes after arrival at which an untreated patient reaches it. */
    at_minutes: number;
    /** The monitor at this point, untreated. A vital left out stays as it was. */
    vitals: LiveVitals;
    rhythm?: RhythmType;
    consciousness?: Consciousness;
    stability?: StabilityLevel;
    /** What the nurse tells the student when it happens. */
    nurse_says: string;
}

export type TreatmentRole = "essential" | "supportive" | "harmful";

export interface LiveTreatment {
    /** An id from the shared tray (intervention-catalog.ts), or the case's own. */
    id: string;
    label: string;
    /** Dose, route or setting, as shown under the label on the tray. */
    detail: string;
    group: InterventionGroup;
    /** essential: must be given, in time. supportive: reasonable, not required. harmful: makes this patient worse. */
    role: TreatmentRole;
    /** For an essential treatment: minutes after arrival by which it should have been given. */
    within_minutes?: number;
    /** What it does to the monitor, as changes: { sbp: 10, hr: -8 }. */
    effect?: LiveVitals;
    rhythm?: RhythmType;
    consciousness?: Consciousness;
    /** What the student sees when they give it. */
    says: string;
    /** For the debrief: why it matters, or why it harms. */
    why?: string;

    // ── Repeat doses. All optional: a treatment without them is given once, exactly as before.
    /** How many doses may be given (2 to 10). Absent: one. */
    max_doses?: number;
    /** Minutes that must pass after a dose before the next one counts. An earlier attempt is refused and has no effect. */
    min_interval_minutes?: number;
    /** What each dose does to the monitor, in order; the last entry repeats. Absent: `effect` for every dose. */
    effect_per_dose?: LiveVitals[];
    /** What the student sees for each dose, in order; the last entry repeats. Absent: `says` for every dose. */
    says_per_dose?: string[];
    /** For an essential treatment: how many valid doses the student must give. Absent: one. */
    doses_required?: number;
    /** A required later dose is on time if given within this many minutes of the one before it. */
    repeat_within_minutes?: number;
    /** When a further dose is indicated. "not_stabilised": only while the patient is still deteriorating. */
    repeat_only_while?: "not_stabilised";
}

export interface LiveRecovery {
    /** Minutes after the last stabilising treatment at which the patient settles. */
    after_minutes: number;
    /** The monitor once settled. */
    vitals: LiveVitals;
    rhythm?: RhythmType;
    consciousness?: Consciousness;
    nurse_says: string;
}

/** A senior clinician's decision on the plan (lib/review/links.ts). The name is here only if they agreed to be named. */
export interface LiveSignOff {
    decision: "approved" | "changes_requested";
    decided_at: string;
    show_name: boolean;
    reviewer_name?: string;
    reviewer_designation?: string;
    reviewer_department?: string;
    reviewer_institution?: string;
    comments?: string;
}

export interface LivePlan {
    version: 1;
    /** Who wrote it: the AI from the case, or the case's author in the Case Studio. */
    origin: "ai" | "author";
    /** proposed: only admins play it live. approved: students do. */
    status: "proposed" | "approved";
    /** One or two sentences: what happens to this patient if nothing is done. */
    summary: string;
    /** Where the encounter happens: "Emergency department, resuscitation bay". */
    setting?: string;
    /** Minutes by which the decisive treatment should have been given (shown to the student as the window). */
    critical_window_minutes: number;
    /** The encounter ends here. */
    time_limit_minutes: number;
    arrival?: {
        consciousness?: Consciousness;
        stability?: StabilityLevel;
        /** Only for vitals the case itself does not record: a monitor in a live case cannot show "—". */
        vitals?: LiveVitals;
    };
    /** The untreated course, in order. */
    stages: LiveStage[];
    /** Everything on the tray for this patient. Nothing else is offered, so nothing unreviewed can be given. */
    treatments: LiveTreatment[];
    /** Treatment ids. Once ALL have been given the patient stops deteriorating and goes on to recover. */
    stabilised_by: string[];
    recovery: LiveRecovery;
    /** What the numbers rest on: one line each ("Stage timings: untreated hypovolaemic shock in a 12 kg child ..."). */
    basis?: string[];
    drafted_at?: string;
    sign_off?: LiveSignOff;
    /** When the MediKarya team switched it on without a clinician's sign-off. A changed plan has to be switched on again. */
    team_checked_at?: string;
}

export function isLivePlan(v: unknown): v is LivePlan {
    return !!v && typeof v === "object" && (v as LivePlan).version === 1 && Array.isArray((v as LivePlan).stages) && Array.isArray((v as LivePlan).treatments);
}

/** Students get the live version once it is approved; an admin (play-testing) gets it as soon as it is proposed. */
export function livePlanApplies(plan: unknown, viewerIsAdmin: boolean): plan is LivePlan {
    return isLivePlan(plan) && (plan.status === "approved" || viewerIsAdmin);
}

// ── Reading a plan ──────────────────────────────────────────────────────────

const TRAY = new Map(INTERVENTIONS.map((i) => [i.id, i]));
export const isSharedTreatment = (id: string) => TRAY.has(id);

/**
 * Fills in what a plan may leave to the shared tray: a treatment taken from it carries the tray's own label, dose and
 * group (so a model cannot reword a dose), and everything is trimmed. Unknown keys are dropped. Call before checking.
 */
export function normaliseLivePlan(input: unknown, origin: LivePlan["origin"]): LivePlan {
    const p = (input && typeof input === "object" ? input : {}) as Record<string, any>;
    const text = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    const slug = (v: unknown) => text(v, 60).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const oneOf = <T extends string>(v: unknown, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);
    const vitals = (v: unknown): LiveVitals => {
        const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
        const out: LiveVitals = {};
        for (const k of ["hr", "sbp", "dbp", "spo2", "rr", "temp"] as const) {
            const n = num(o[k]);
            if (n !== undefined) out[k] = k === "temp" ? Math.round(n * 10) / 10 : Math.round(n);
        }
        return out;
    };

    // Repeat-dose fields are kept only when present, so a plan that does not use them reads exactly as before.
    const repeatFields = (t: any, role: TreatmentRole): Partial<LiveTreatment> => {
        const out: Partial<LiveTreatment> = {};
        if (num(t?.max_doses) !== undefined) out.max_doses = Math.round(num(t.max_doses) as number);
        if (num(t?.min_interval_minutes) !== undefined) out.min_interval_minutes = num(t.min_interval_minutes);
        if (Array.isArray(t?.effect_per_dose) && t.effect_per_dose.length > 0) out.effect_per_dose = t.effect_per_dose.map(vitals);
        if (Array.isArray(t?.says_per_dose) && t.says_per_dose.length > 0) out.says_per_dose = t.says_per_dose.map((s: unknown) => text(s));
        if (role === "essential" && num(t?.doses_required) !== undefined) out.doses_required = Math.round(num(t.doses_required) as number);
        if (role === "essential" && num(t?.repeat_within_minutes) !== undefined) out.repeat_within_minutes = num(t.repeat_within_minutes);
        if (oneOf(t?.repeat_only_while, ["not_stabilised"] as const)) out.repeat_only_while = "not_stabilised";
        return out;
    };

    const stages: LiveStage[] = (Array.isArray(p.stages) ? p.stages : []).map((s: any, i: number) => ({
        id: slug(s?.id) || slug(s?.name) || `stage_${i + 1}`,
        name: text(s?.name, 80),
        at_minutes: num(s?.at_minutes) ?? NaN,
        vitals: vitals(s?.vitals),
        ...(oneOf(s?.rhythm, RHYTHM_TYPES) ? { rhythm: oneOf(s?.rhythm, RHYTHM_TYPES) } : {}),
        ...(oneOf(s?.consciousness, CONSCIOUSNESS_LEVELS) ? { consciousness: oneOf(s?.consciousness, CONSCIOUSNESS_LEVELS) } : {}),
        ...(oneOf(s?.stability, STABILITY_LEVELS) ? { stability: oneOf(s?.stability, STABILITY_LEVELS) } : {}),
        nurse_says: text(s?.nurse_says),
    }));

    const treatments: LiveTreatment[] = (Array.isArray(p.treatments) ? p.treatments : []).map((t: any) => {
        const id = slug(t?.id);
        const shared = TRAY.get(id);
        const role = oneOf(t?.role, ["essential", "supportive", "harmful"] as const) ?? "supportive";
        const effect = vitals(t?.effect);
        return {
            id,
            label: shared?.label ?? text(t?.label, 80),
            detail: shared?.detail ?? text(t?.detail, 140),
            group: shared?.group ?? oneOf(t?.group, ["airway", "circulation", "medications", "cardiac_procedures", "other"] as const) ?? "other",
            role,
            ...(role === "essential" && num(t?.within_minutes) !== undefined ? { within_minutes: num(t?.within_minutes) } : {}),
            ...(Object.keys(effect).length > 0 ? { effect } : {}),
            ...(oneOf(t?.rhythm, RHYTHM_TYPES) ? { rhythm: oneOf(t?.rhythm, RHYTHM_TYPES) } : {}),
            ...(oneOf(t?.consciousness, CONSCIOUSNESS_LEVELS) ? { consciousness: oneOf(t?.consciousness, CONSCIOUSNESS_LEVELS) } : {}),
            says: text(t?.says),
            ...(text(t?.why) ? { why: text(t?.why) } : {}),
            ...repeatFields(t, role),
        };
    });

    const arrivalVitals = vitals(p.arrival?.vitals);
    const arrival = {
        ...(oneOf(p.arrival?.consciousness, CONSCIOUSNESS_LEVELS) ? { consciousness: oneOf(p.arrival?.consciousness, CONSCIOUSNESS_LEVELS) } : {}),
        ...(oneOf(p.arrival?.stability, STABILITY_LEVELS) ? { stability: oneOf(p.arrival?.stability, STABILITY_LEVELS) } : {}),
        ...(Object.keys(arrivalVitals).length > 0 ? { vitals: arrivalVitals } : {}),
    };

    return {
        version: 1,
        origin,
        status: "proposed",
        summary: text(p.summary, 500),
        ...(text(p.setting, 80) ? { setting: text(p.setting, 80) } : {}),
        critical_window_minutes: num(p.critical_window_minutes) ?? NaN,
        time_limit_minutes: num(p.time_limit_minutes) ?? NaN,
        ...(Object.keys(arrival).length > 0 ? { arrival } : {}),
        stages,
        treatments,
        stabilised_by: (Array.isArray(p.stabilised_by) ? p.stabilised_by : []).map(slug).filter(Boolean),
        recovery: {
            after_minutes: num(p.recovery?.after_minutes) ?? NaN,
            vitals: vitals(p.recovery?.vitals),
            ...(oneOf(p.recovery?.rhythm, RHYTHM_TYPES) ? { rhythm: oneOf(p.recovery?.rhythm, RHYTHM_TYPES) } : {}),
            ...(oneOf(p.recovery?.consciousness, CONSCIOUSNESS_LEVELS) ? { consciousness: oneOf(p.recovery?.consciousness, CONSCIOUSNESS_LEVELS) } : {}),
            nurse_says: text(p.recovery?.nurse_says),
        },
        ...(Array.isArray(p.basis) ? { basis: p.basis.map((b: unknown) => text(b, 400)).filter(Boolean).slice(0, 20) } : {}),
    };
}

// ── Checking a plan ─────────────────────────────────────────────────────────

export interface LivePlanCheck {
    /** The plan cannot run, or would run wrongly. */
    errors: string[];
    /** Worth a clinician's eye. */
    warnings: string[];
}

/** What a monitor can show: anything outside is a typing mistake, not physiology. */
const RANGE: Record<keyof LiveVitals, [number, number]> = { hr: [20, 240], sbp: [40, 260], dbp: [20, 160], spo2: [50, 100], rr: [4, 70], temp: [32, 42] };
/** The most one treatment may move a vital in one go. */
const MAX_EFFECT: Record<keyof LiveVitals, number> = { hr: 80, sbp: 80, dbp: 60, spo2: 30, rr: 30, temp: 3 };
const VITAL_NAME: Record<keyof LiveVitals, string> = { hr: "heart rate", sbp: "systolic BP", dbp: "diastolic BP", spo2: "SpO₂", rr: "respiratory rate", temp: "temperature" };
const ID = /^[a-z][a-z0-9_]{1,59}$/;

function checkAbsolute(v: LiveVitals, where: string, errors: string[]): void {
    for (const k of Object.keys(v) as Array<keyof LiveVitals>) {
        const n = v[k] as number;
        const [lo, hi] = RANGE[k];
        if (n < lo || n > hi) errors.push(`${where}: ${VITAL_NAME[k]} ${n} is outside what a monitor can show (${lo}–${hi}).`);
    }
    if (v.sbp !== undefined && v.dbp !== undefined && v.dbp >= v.sbp) errors.push(`${where}: diastolic BP (${v.dbp}) must be below systolic (${v.sbp}).`);
    if ((v.sbp === undefined) !== (v.dbp === undefined)) errors.push(`${where}: give both systolic and diastolic BP, or neither.`);
}

/** Tray items that only watch the patient. They may be essential, but they never stop a deterioration. */
const MONITORING_ONLY = new Set(["continuous_monitoring"]);

/** The repeat-dose fields of one treatment, when it uses them. */
function checkRepeat(t: LiveTreatment, where: string, timeLimit: number, errors: string[]): void {
    const max = t.max_doses ?? 1;
    const repeats = t.max_doses !== undefined;
    if (repeats && (!Number.isInteger(t.max_doses) || max < 1 || max > 10)) errors.push(`${where}: max_doses must be a whole number from 1 to 10.`);
    const needsRepeat = (field: string) => errors.push(`${where}: ${field} only makes sense when max_doses is 2 or more.`);
    if (t.min_interval_minutes !== undefined) {
        if (max < 2) needsRepeat("min_interval_minutes");
        else if (t.min_interval_minutes < 0 || t.min_interval_minutes >= timeLimit) errors.push(`${where}: min_interval_minutes must be from 0 to less than the encounter (${timeLimit} min).`);
    }
    if (t.effect_per_dose !== undefined) {
        if (max < 2) needsRepeat("effect_per_dose");
        if (t.effect_per_dose.length > max) errors.push(`${where}: effect_per_dose lists ${t.effect_per_dose.length} doses but max_doses is ${max}.`);
        t.effect_per_dose.forEach((e, i) => {
            for (const k of Object.keys(e) as Array<keyof LiveVitals>) {
                if (Math.abs(e[k] as number) > MAX_EFFECT[k]) errors.push(`${where}: dose ${i + 1} changes ${VITAL_NAME[k]} by ${e[k]}, more than one dose can do (±${MAX_EFFECT[k]}).`);
            }
            if ((e.sbp === undefined) !== (e.dbp === undefined)) errors.push(`${where}: dose ${i + 1} effect needs both sbp and dbp, or neither.`);
        });
    }
    if (t.says_per_dose !== undefined) {
        if (max < 2) needsRepeat("says_per_dose");
        if (t.says_per_dose.length > max) errors.push(`${where}: says_per_dose lists ${t.says_per_dose.length} doses but max_doses is ${max}.`);
        if (t.says_per_dose.some((s) => s.length < 10)) errors.push(`${where}: each says_per_dose entry is what the student sees; write a sentence.`);
    }
    if (t.repeat_only_while !== undefined && max < 2) needsRepeat("repeat_only_while");
    if (t.doses_required !== undefined) {
        if (t.role !== "essential") errors.push(`${where}: doses_required is for essential treatments.`);
        else if (!Number.isInteger(t.doses_required) || t.doses_required < 1 || t.doses_required > max) errors.push(`${where}: doses_required must be a whole number from 1 to max_doses (${max}).`);
        else if (t.doses_required > 1) {
            const earliestLast = (t.within_minutes ?? 0) + (t.doses_required - 1) * (t.min_interval_minutes ?? 0);
            if (Number.isFinite(timeLimit) && earliestLast >= timeLimit) errors.push(`${where}: ${t.doses_required} doses ${t.min_interval_minutes ?? 0} min apart cannot all be given before the encounter ends (${timeLimit} min).`);
        }
    }
    if (t.repeat_within_minutes !== undefined) {
        if ((t.doses_required ?? 1) < 2) errors.push(`${where}: repeat_within_minutes only makes sense when doses_required is 2 or more.`);
        else if (t.repeat_within_minutes < (t.min_interval_minutes ?? 0)) errors.push(`${where}: repeat_within_minutes (${t.repeat_within_minutes}) is shorter than min_interval_minutes (${t.min_interval_minutes}): no dose could be on time.`);
    }
}

/**
 * Is this plan complete and sensible enough to run? `measured` is what the case itself records on arrival: a vital it
 * does not record must be given in `arrival.vitals`.
 */
export function checkLivePlan(plan: LivePlan, measured: LiveVitals = {}): LivePlanCheck {
    const errors: string[] = [];
    const warnings: string[] = [];
    const whole = (n: number) => Number.isFinite(n);

    if (plan.summary.length < 20) errors.push("summary: say in a sentence or two what happens to this patient if nothing is done.");

    // ── time
    if (!whole(plan.time_limit_minutes) || plan.time_limit_minutes < 6 || plan.time_limit_minutes > 45) errors.push("time_limit_minutes must be between 6 and 45.");
    if (!whole(plan.critical_window_minutes) || plan.critical_window_minutes < 2) errors.push("critical_window_minutes must be at least 2.");
    else if (whole(plan.time_limit_minutes) && plan.critical_window_minutes >= plan.time_limit_minutes) errors.push("critical_window_minutes must be shorter than time_limit_minutes.");

    // ── arrival
    const arrival: LiveVitals = { ...(plan.arrival?.vitals ?? {}), ...measured };
    for (const k of ["hr", "sbp", "dbp", "spo2", "rr"] as const) {
        if (arrival[k] === undefined) errors.push(`arrival.vitals.${k}: the case does not record the ${VITAL_NAME[k]} on arrival, so the plan has to give it.`);
    }
    if (plan.arrival?.vitals) checkAbsolute(plan.arrival.vitals, "arrival.vitals", errors);
    for (const k of Object.keys(plan.arrival?.vitals ?? {}) as Array<keyof LiveVitals>) {
        if (measured[k] !== undefined && measured[k] !== plan.arrival!.vitals![k]) warnings.push(`arrival.vitals.${k} is ignored: the case records ${measured[k]} on arrival.`);
    }

    // ── the untreated course
    if (plan.stages.length < 2) errors.push("stages: describe at least two steps of the untreated course.");
    if (plan.stages.length > 6) errors.push("stages: at most six steps.");
    const stageIds = new Set<string>();
    let last = 0;
    plan.stages.forEach((s, i) => {
        const where = `stages[${i}]${s.name ? ` (${s.name})` : ""}`;
        if (!ID.test(s.id)) errors.push(`${where}: id must be lower-case letters, digits and underscores.`);
        if (stageIds.has(s.id)) errors.push(`${where}: the id "${s.id}" is used twice.`);
        stageIds.add(s.id);
        if (!s.name) errors.push(`${where}: needs a name.`);
        if (!whole(s.at_minutes) || s.at_minutes <= last) errors.push(`${where}: at_minutes must be later than the step before it (${last}).`);
        else last = s.at_minutes;
        if (whole(plan.time_limit_minutes) && s.at_minutes >= plan.time_limit_minutes) errors.push(`${where}: happens at ${s.at_minutes} min, after the encounter ends (${plan.time_limit_minutes} min).`);
        if (Object.keys(s.vitals).length === 0 && !s.rhythm && !s.consciousness) errors.push(`${where}: nothing changes. Give the vitals, rhythm or consciousness at this point.`);
        checkAbsolute(s.vitals, where, errors);
        if (s.nurse_says.length < 10) errors.push(`${where}: nurse_says is what tells the student it happened; write a sentence.`);
    });
    if (arrival.temp === undefined && (plan.stages.some((s) => s.vitals.temp !== undefined) || plan.recovery.vitals.temp !== undefined)) {
        errors.push("arrival.vitals.temp: the plan changes the temperature, but the case does not record it on arrival. Give it here.");
    }
    if (plan.stages[0] && whole(plan.stages[0].at_minutes) && plan.stages[0].at_minutes < 2) warnings.push("The first step comes before 2 minutes: a student has barely met the patient.");

    // ── treatments
    const ids = new Set<string>();
    const essential = plan.treatments.filter((t) => t.role === "essential");
    plan.treatments.forEach((t, i) => {
        const where = `treatments[${i}]${t.label ? ` (${t.label})` : ""}`;
        if (!ID.test(t.id)) errors.push(`${where}: id must be lower-case letters, digits and underscores.`);
        if (ids.has(t.id)) errors.push(`${where}: "${t.id}" is listed twice.`);
        ids.add(t.id);
        if (stageIds.has(t.id)) errors.push(`${where}: "${t.id}" is also the id of a stage.`);
        if (!t.label) errors.push(`${where}: needs a label.`);
        if (!isSharedTreatment(t.id) && !t.detail) errors.push(`${where}: needs the dose and route (detail), since it is not on the shared tray.`);
        if (t.says.length < 10) errors.push(`${where}: says is what the student sees when they give it; write a sentence.`);
        if (t.role === "essential") {
            if (t.within_minutes === undefined || t.within_minutes <= 0) errors.push(`${where}: an essential treatment needs within_minutes.`);
            else if (whole(plan.time_limit_minutes) && t.within_minutes > plan.time_limit_minutes) errors.push(`${where}: within_minutes (${t.within_minutes}) is after the encounter ends.`);
        }
        if (t.role === "harmful" && !t.why) warnings.push(`${where}: say why it harms this patient (why), for the debrief.`);
        for (const k of Object.keys(t.effect ?? {}) as Array<keyof LiveVitals>) {
            const n = t.effect![k] as number;
            if (Math.abs(n) > MAX_EFFECT[k]) errors.push(`${where}: a change of ${n} in ${VITAL_NAME[k]} is more than one treatment can do (±${MAX_EFFECT[k]}). effect is a change, not a target.`);
        }
        if ((t.effect?.sbp === undefined) !== (t.effect?.dbp === undefined)) errors.push(`${where}: effect needs both sbp and dbp, or neither.`);
        checkRepeat(t, where, plan.time_limit_minutes, errors);
    });
    if (essential.length === 0) errors.push("treatments: at least one must be essential.");
    if (plan.treatments.length - essential.length < 2) warnings.push("Fewer than two treatments are not essential: the tray gives the answer away. Add reasonable-but-unnecessary or harmful options.");
    if (plan.treatments.length > 14) warnings.push("More than 14 treatments: a long tray is slow to use under time pressure.");

    // ── what stops it
    if (plan.stabilised_by.length === 0) errors.push("stabilised_by: name the treatments that stop the deterioration.");
    for (const id of plan.stabilised_by) {
        const t = plan.treatments.find((x) => x.id === id);
        if (!t) errors.push(`stabilised_by: "${id}" is not one of the treatments.`);
        else if (t.role !== "essential") errors.push(`stabilised_by: "${id}" stops the deterioration, so it has to be essential.`);
        if (MONITORING_ONLY.has(id)) errors.push(`stabilised_by: "${id}" watches the patient but does not treat; keep it essential if it must be done, but it cannot be what stops the deterioration.`);
    }

    // ── recovery
    const r = plan.recovery;
    if (!whole(r.after_minutes) || r.after_minutes < 1 || r.after_minutes > 15) errors.push("recovery.after_minutes must be between 1 and 15.");
    for (const k of ["hr", "sbp", "dbp", "spo2", "rr"] as const) {
        if (r.vitals[k] === undefined) errors.push(`recovery.vitals.${k}: say where the ${VITAL_NAME[k]} settles.`);
    }
    checkAbsolute(r.vitals, "recovery.vitals", errors);
    if (r.nurse_says.length < 10) errors.push("recovery.nurse_says: write the sentence the nurse says when the patient settles.");

    return { errors, warnings };
}

// ── Compiling a plan into the engine's rules ────────────────────────────────

const STABILISED = "live_stabilised";
const given = (treatmentId: string) => `given_${treatmentId}`;
/** The flag set by a valid dose. Dose 1 keeps the single-dose flag, so everything that reads it is unchanged. */
export const doseFlag = (treatmentId: string, dose: number) => (dose === 1 ? given(treatmentId) : `given_${treatmentId}_dose${dose}`);
/** A treatment that uses the repeat-dose fields at all; every other treatment compiles exactly as before. */
export const isRepeatable = (t: LiveTreatment) => (t.max_doses ?? 1) >= 2;
/** The flag that means a treatment has done its part in stopping the deterioration: its last required dose. */
const stabilisingFlag = (t: LiveTreatment | undefined, id: string) => (t && isRepeatable(t) ? doseFlag(id, Math.max(1, t.doses_required ?? 1)) : given(id));

/** Every refusal starts with this, so the tray can tell a refused dose from a given one. */
export const REFUSED_PREFIX = "Not given:";
/** Why a further dose was refused, in the words the student sees. */
export const REFUSED = {
    too_soon: (t: LiveTreatment) => `Not given: too soon for another dose. Wait at least ${t.min_interval_minutes} minutes after the last dose, reassess, then give it if it is still needed.`,
    not_indicated: () => "Not given: another dose is not indicated now, because the patient has stopped deteriorating.",
    limit: (t: LiveTreatment) => `Not given: all ${t.max_doses} doses have already been given.`,
} as const;
export type RefusalReason = keyof typeof REFUSED;

/** The engine's consequences for one dose-by-dose treatment: a valid dose, a refused one, and the limit. */
function repeatConsequences(t: LiveTreatment): ActionConsequence[] {
    const max = t.max_doses ?? 1;
    const effectFor = (n: number) => (t.effect_per_dose ? t.effect_per_dose[Math.min(n, t.effect_per_dose.length) - 1] : t.effect);
    const saysFor = (n: number) => (t.says_per_dose ? t.says_per_dose[Math.min(n, t.says_per_dose.length) - 1] : t.says);
    const out: ActionConsequence[] = [];
    for (let n = 1; n <= max; n++) {
        const due: RuleCondition[] = [{ flag: doseFlag(t.id, n), is: false }];
        if (n > 1) due.unshift({ flag: doseFlag(t.id, n - 1), is: true });
        const intervalOk: RuleCondition | null = n > 1 && (t.min_interval_minutes ?? 0) > 0 ? { minutes_since_flag: { flag: doseFlag(t.id, n - 1), gte: t.min_interval_minutes as number } } : null;
        const indicated: RuleCondition | null = n > 1 && t.repeat_only_while === "not_stabilised" ? { flag: STABILISED, is: false } : null;
        const valid = [...due, ...(intervalOk ? [intervalOk] : []), ...(indicated ? [indicated] : [])];
        out.push({
            action: t.id,
            when: { all: valid },
            sets: { [doseFlag(t.id, n)]: true },
            physiological_changes: { ...effectOf(effectFor(n)), ...(t.rhythm ? { rhythm: t.rhythm } : {}), ...(t.consciousness ? { consciousness: t.consciousness } : {}) },
            trajectory_note: saysFor(n),
            ...(t.role === "harmful" ? { safety_penalty: true } : {}),
        });
        // Refusals, most basic reason first; each is exclusive of the valid dose and of the others.
        if (intervalOk) out.push({ action: t.id, when: { all: [...due, { not: intervalOk }] }, trajectory_note: REFUSED.too_soon(t) });
        if (indicated) out.push({ action: t.id, when: { all: [...due, ...(intervalOk ? [intervalOk] : []), { flag: STABILISED, is: true }] }, trajectory_note: REFUSED.not_indicated() });
    }
    out.push({ action: t.id, when: { flag: doseFlag(t.id, max), is: true }, trajectory_note: REFUSED.limit(t) });
    return out;
}
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));

function deltas(from: LiveVitals, to: LiveVitals): PhysiologicalChanges {
    const out: PhysiologicalChanges = {};
    const d = (k: keyof LiveVitals) => (to[k] !== undefined && from[k] !== undefined ? (to[k] as number) - (from[k] as number) : 0);
    if (d("hr")) out.hr_delta = signed(d("hr"));
    if (d("sbp") || d("dbp")) out.bp_delta = `${signed(d("sbp"))}/${signed(d("dbp"))}`;
    if (d("spo2")) out.spo2_delta = signed(d("spo2"));
    if (d("rr")) out.rr_delta = signed(d("rr"));
    if (d("temp")) out.temp_delta = signed(Math.round(d("temp") * 10) / 10);
    return out;
}

function effectOf(e: LiveVitals | undefined): PhysiologicalChanges {
    return e ? deltas({ hr: 0, sbp: 0, dbp: 0, spo2: 0, rr: 0, temp: 0 }, { hr: e.hr ?? 0, sbp: e.sbp ?? 0, dbp: e.dbp ?? 0, spo2: e.spo2 ?? 0, rr: e.rr ?? 0, temp: e.temp ?? 0 }) : {};
}

/** The vitals a case (already on the bedside engine) records on arrival. */
export function measuredOnArrival(base: Pick<SimulationCaseConfig, "initial_state">): LiveVitals {
    const i = base.initial_state;
    const unmeasured = new Set(i.unmeasured ?? []);
    return {
        ...(unmeasured.has("hr") ? {} : { hr: i.rate }),
        ...(unmeasured.has("bp") || i.systolic === undefined || i.diastolic === undefined ? {} : { sbp: i.systolic, dbp: i.diastolic }),
        ...(unmeasured.has("spo2") || i.spo2 === undefined ? {} : { spo2: i.spo2 }),
        ...(unmeasured.has("rr") || i.rr === undefined ? {} : { rr: i.rr }),
        ...(unmeasured.has("temperature") || i.temperature === undefined ? {} : { temp: i.temperature }),
    };
}

/**
 * The case as a live one. `base` is the case already on the bedside engine (an ordinary case after
 * legacy-adapter.ts): its patient, examination, tests and scoring are kept, and the plan adds the clock, the tray,
 * the deterioration and the recovery. Call `checkLivePlan` first; a plan with errors is not compiled by the app.
 */
export function compileLivePlan<T extends SimulationCaseConfig>(base: T, plan: LivePlan): T {
    const measured = measuredOnArrival(base);
    const arrival: LiveVitals = { ...(plan.arrival?.vitals ?? {}), ...measured };

    const flags: Record<string, boolean> = { ...base.initial_state.flags, [STABILISED]: false };
    for (const t of plan.treatments) {
        flags[given(t.id)] = false;
        if (isRepeatable(t)) for (let n = 2; n <= (t.max_doses as number); n++) flags[doseFlag(t.id, n)] = false;
    }

    // ── the untreated course: each step moves the monitor by the difference from the step before, so whatever a
    //    treatment has already improved stays improved.
    const stageRules: EventRule[] = [];
    let untreated = arrival;
    for (const s of plan.stages) {
        const after = { ...untreated, ...s.vitals };
        stageRules.push({
            id: `live_stage_${s.id}`,
            when: { all: [{ time_elapsed_gte_minutes: s.at_minutes }, { flag: STABILISED, is: false }] },
            transition: s.id,
            physiological_changes: {
                ...deltas(untreated, after),
                ...(s.rhythm ? { rhythm: s.rhythm } : {}),
                ...(s.consciousness ? { consciousness: s.consciousness } : {}),
                ...(s.stability ? { stability: s.stability } : {}),
            },
            narrative: s.nurse_says,
        });
        untreated = after;
    }

    const r = plan.recovery;
    const rules: EventRule[] = [
        // First, so that at the instant the last stabilising treatment goes in, it wins over a step that is also due.
        {
            id: "live_stabilised",
            when: { all: [{ flag: STABILISED, is: false }, ...plan.stabilised_by.map((id) => ({ flag: stabilisingFlag(plan.treatments.find((t) => t.id === id), id), is: true }))] },
            transition: "stabilised",
            sets: { [STABILISED]: true },
            narrative: null,
        },
        {
            id: "live_recovery",
            when: { minutes_since_flag: { flag: STABILISED, gte: r.after_minutes } },
            transition: "recovering",
            physiological_changes: {
                ...(r.vitals.hr !== undefined ? { hr_set: r.vitals.hr } : {}),
                ...(r.vitals.sbp !== undefined && r.vitals.dbp !== undefined ? { bp_set: `${r.vitals.sbp}/${r.vitals.dbp}` } : {}),
                ...(r.vitals.spo2 !== undefined ? { spo2_set: r.vitals.spo2 } : {}),
                ...(r.vitals.rr !== undefined ? { rr_set: r.vitals.rr } : {}),
                ...(r.vitals.temp !== undefined ? { temp_set: r.vitals.temp } : {}),
                ...(r.rhythm ? { rhythm: r.rhythm } : {}),
                consciousness: r.consciousness ?? "alert",
                stability: "stable",
            },
            narrative: r.nurse_says,
        },
        ...stageRules,
    ];

    // ── the tray: a treatment acts once; giving it again changes nothing. A treatment with repeat doses acts once per
    //    valid dose instead (repeatConsequences).
    const consequences: ActionConsequence[] = plan.treatments.flatMap((t) => isRepeatable(t) ? repeatConsequences(t) : [
        {
            action: t.id,
            when: { flag: given(t.id), is: false },
            sets: { [given(t.id)]: true },
            physiological_changes: {
                ...effectOf(t.effect),
                ...(t.rhythm ? { rhythm: t.rhythm } : {}),
                ...(t.consciousness ? { consciousness: t.consciousness } : {}),
            },
            trajectory_note: t.says,
            ...(t.role === "harmful" ? { safety_penalty: true } : {}),
        },
        { action: t.id, when: { flag: given(t.id), is: true }, trajectory_note: "Already given. No further change." },
    ]);

    const own: CustomInterventionDef[] = plan.treatments.filter((t) => !isSharedTreatment(t.id)).map((t) => ({ id: t.id, label: t.label, detail: t.detail, group: t.group }));
    const stillUnmeasured = (base.initial_state.unmeasured ?? []).filter((u) => {
        const key = u === "bp" ? "sbp" : u === "temperature" ? "temp" : u;
        return arrival[key as keyof LiveVitals] === undefined;
    });

    return {
        ...base,
        ...(plan.setting ? { setting: plan.setting } : {}),
        clinical_constraints: { critical_window_minutes: plan.critical_window_minutes, hard_time_limit_minutes: plan.time_limit_minutes, time_scale: 1 },
        initial_state: {
            ...base.initial_state,
            rate: arrival.hr ?? base.initial_state.rate,
            ...(arrival.sbp !== undefined && arrival.dbp !== undefined ? { systolic: arrival.sbp, diastolic: arrival.dbp } : {}),
            ...(arrival.spo2 !== undefined ? { spo2: arrival.spo2 } : {}),
            ...(arrival.rr !== undefined ? { rr: arrival.rr } : {}),
            ...(arrival.temp !== undefined ? { temperature: arrival.temp } : {}),
            ...(plan.arrival?.consciousness ? { consciousness: plan.arrival.consciousness } : {}),
            ...(plan.arrival?.stability ? { stability: plan.arrival.stability } : {}),
            unmeasured: stillUnmeasured,
            flags,
        },
        event_rules: [...rules, ...base.event_rules],
        action_consequences: [...consequences, ...base.action_consequences],
        available_interventions: plan.treatments.filter((t) => isSharedTreatment(t.id)).map((t) => t.id),
        custom_interventions: own,
    };
}

// ── Applying a plan to a case ───────────────────────────────────────────────

/** A case that is running as a live one because of its plan (rather than one written as a live case, like the STEMI). */
export function isLivePlanCase(config: unknown): config is SimulationCaseConfig & { live_plan: LivePlan } {
    const c = config as (SimulationCaseConfig & { live_plan?: unknown }) | null;
    return !!c && Array.isArray(c.event_rules) && c.event_rules.some((r) => r.id === "live_stabilised") && isLivePlan(c.live_plan);
}

/**
 * The case as this viewer should get it. `base` is an ordinary case already on the bedside engine, carrying its plan
 * (if it has one) as `live_plan`. Students get the live version only once the plan is approved; an admin gets it as
 * soon as it is proposed, to play-test it. A plan that does not pass the check is never run: the case stays as it was.
 */
export function withLivePlan<T extends SimulationCaseConfig>(base: T, viewerIsAdmin: boolean): T {
    const plan = (base as T & { live_plan?: unknown }).live_plan;
    if (!livePlanApplies(plan, viewerIsAdmin) || isLivePlanCase(base)) return base;
    // Only an ordinary case (no rules of its own): a case written as a live one keeps its own physiology.
    if (base.scoring_mode !== "classic" || base.event_rules.length > 0) return base;
    if (checkLivePlan(plan, measuredOnArrival(base)).errors.length > 0) return base;
    return compileLivePlan(base, plan);
}

/** Does this case have a plan that only an admin would currently see run? */
export function hasProposedLivePlan(caseData: unknown): boolean {
    const plan = (caseData as { live_plan?: unknown } | null)?.live_plan;
    return isLivePlan(plan) && plan.status === "proposed";
}

// ── Scoring what was done at the bedside ────────────────────────────────────
// The ordinary scoring (history, investigations, diagnosis, written plan) knows nothing about the tray or the clock.
// This scores what a live case adds: were the essential treatments given, and in time; was anything harmful given.

export interface BedsideItem {
    id: string;
    label: string;
    status: "on_time" | "late" | "missed";
    /** When it was given (minutes after arrival), if it was. */
    at_minutes: number | null;
    within_minutes: number;
    why?: string;
    /** For a treatment that needs several doses: each required dose, when it was validly given, and how it scored. */
    doses?: Array<{ dose: number; at_minutes: number | null; status: "on_time" | "late" | "missed" }>;
}

/** A further dose the engine refused (too soon, not indicated, or over the limit). It had no effect and did not count. */
export interface RefusedDose {
    id: string;
    label: string;
    at_minutes: number;
    reason: RefusalReason;
    said: string;
}

export interface BedsideScore {
    /** 0–100. */
    score: number;
    items: BedsideItem[];
    harmful: Array<{ id: string; label: string; at_minutes: number; why?: string }>;
    /** Further doses the engine refused. Present only when there were any. */
    refused?: RefusedDose[];
    outcome: {
        stabilised: boolean;
        recovered: boolean;
        /** The furthest step of the untreated course the patient reached, if any. */
        worst_stage: string | null;
    };
}

/** Points off for each different harmful treatment given. */
export const HARMFUL_TREATMENT_PENALTY = 15;
/** How much of the final score is the bedside, in a live case; the rest is the ordinary scoring. */
export const BEDSIDE_SHARE = 0.4;

export function scoreBedside(config: SimulationCaseConfig, plan: LivePlan, events: readonly ClinicalEvent[]): BedsideScore {
    const firstGiven = new Map<string, number>();
    for (const e of events) {
        if (e.type === "INTERVENTION_GIVEN" && !firstGiven.has(e.action)) firstGiven.set(e.action, e.timestamp / 60);
    }
    const minutes = (id: string) => (firstGiven.has(id) ? Math.round((firstGiven.get(id) as number) * 10) / 10 : null);
    const final = PatientState.fromEvents(config, events);
    const credit = new Map<string, number>();

    const items: BedsideItem[] = plan.treatments
        .filter((t) => t.role === "essential")
        .map((t) => {
            const within = t.within_minutes ?? plan.critical_window_minutes;
            if (isRepeatable(t)) return scoreDoses(t, within, final.flagSetAt, credit);
            const at = minutes(t.id);
            const item: BedsideItem = { id: t.id, label: t.label, status: at === null ? "missed" : at <= within ? "on_time" : "late", at_minutes: at, within_minutes: within, ...(t.why ? { why: t.why } : {}) };
            credit.set(t.id, item.status === "on_time" ? 1 : item.status === "late" ? 0.5 : 0);
            return item;
        });
    const harmful = plan.treatments
        .filter((t) => t.role === "harmful" && firstGiven.has(t.id))
        .map((t) => ({ id: t.id, label: t.label, at_minutes: minutes(t.id) as number, ...(t.why ? { why: t.why } : {}) }));

    const total = items.reduce((sum, i) => sum + (credit.get(i.id) ?? 0), 0);
    const raw = items.length > 0 ? (100 * total) / items.length : 100;
    const score = Math.max(0, Math.min(100, Math.round(raw - HARMFUL_TREATMENT_PENALTY * harmful.length)));

    const reached = [...plan.stages].reverse().find((s) => final.firedRules.has(`live_stage_${s.id}`));
    const refused = refusedDoses(config, plan, events);
    return {
        score,
        items,
        harmful,
        outcome: { stabilised: final.flags[STABILISED] === true, recovered: final.firedRules.has("live_recovery"), worst_stage: reached?.name ?? null },
        // Only when there is something to report, so a plan without repeat doses scores to exactly the same shape.
        ...(refused.length > 0 ? { refused } : {}),
    };
}

const toMinutes = (seconds: number) => Math.round((seconds / 60) * 10) / 10;

/**
 * A dose-by-dose essential treatment. Only valid doses count (the engine sets a dose's flag only when it is given at
 * a permitted time), so a refused attempt can never stand in for a dose. The first dose is on time within the plan's
 * window; a later required dose is on time within repeat_within_minutes of the dose before it. Each required dose is
 * worth an equal share: on time 1, late 0.5, missed 0.
 */
function scoreDoses(t: LiveTreatment, within: number, flagSetAt: Readonly<Record<string, number>>, credit: Map<string, number>): BedsideItem {
    const required = Math.max(1, t.doses_required ?? 1);
    const doses: NonNullable<BedsideItem["doses"]> = [];
    let previous: number | null = null;
    for (let n = 1; n <= required; n++) {
        const setAt = flagSetAt[doseFlag(t.id, n)];
        const at = setAt === undefined ? null : toMinutes(setAt);
        let status: "on_time" | "late" | "missed";
        if (at === null) status = "missed";
        else if (n === 1) status = at <= within ? "on_time" : "late";
        else status = t.repeat_within_minutes === undefined || previous === null || at - previous <= t.repeat_within_minutes ? "on_time" : "late";
        doses.push({ dose: n, at_minutes: at, status });
        previous = at;
    }
    credit.set(t.id, doses.reduce((sum, d) => sum + (d.status === "on_time" ? 1 : d.status === "late" ? 0.5 : 0), 0) / required);
    const status = doses.every((d) => d.status === "on_time") ? "on_time" : doses.every((d) => d.status === "missed") ? "missed" : "late";
    return { id: t.id, label: t.label, status, at_minutes: doses[0].at_minutes, within_minutes: within, ...(t.why ? { why: t.why } : {}), ...(required > 1 ? { doses } : {}) };
}

/** Every attempt at a further dose that the engine refused, with the reason, in the order they happened. */
function refusedDoses(config: SimulationCaseConfig, plan: LivePlan, events: readonly ClinicalEvent[]): RefusedDose[] {
    const byId = new Map(plan.treatments.filter(isRepeatable).map((t) => [t.id, t]));
    if (byId.size === 0) return [];
    const count = (state: PatientState, t: LiveTreatment) => {
        let n = 0;
        while (n < (t.max_doses as number) && state.flags[doseFlag(t.id, n + 1)] === true) n++;
        return n;
    };
    const out: RefusedDose[] = [];
    events.forEach((e, i) => {
        if (e.type !== "INTERVENTION_GIVEN") return;
        const t = byId.get(e.action);
        if (!t) return;
        // The state just before and just after this attempt, from the log itself.
        const before = PatientState.fromEvents(config, events.slice(0, i));
        const after = PatientState.fromEvents(config, events.slice(0, i + 1));
        const had = count(before, t);
        if (count(after, t) > had) return;
        const sinceLast = had > 0 ? e.timestamp - (before.flagSetAt[doseFlag(t.id, had)] ?? e.timestamp) : Infinity;
        const reason: RefusalReason =
            had >= (t.max_doses as number) ? "limit" : sinceLast < (t.min_interval_minutes ?? 0) * 60 ? "too_soon" : "not_indicated";
        out.push({ id: t.id, label: t.label, at_minutes: toMinutes(e.timestamp), reason, said: e.consequence });
    });
    return out;
}

/** The final score of a live case: the ordinary score and the bedside score, in fixed shares. */
export function blendLiveScore(consultationScore: number, bedsideScore: number): number {
    return Math.round((1 - BEDSIDE_SHARE) * consultationScore + BEDSIDE_SHARE * bedsideScore);
}
