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
    FluidInfusionDef,
    ReassessmentReport,
    EventRule,
    PhysiologicalChanges,
    RhythmType,
    RuleCondition,
    SimulationCaseConfig,
    StabilityLevel,
} from "./case-schema";
import { CONSCIOUSNESS_LEVELS, REPORT_VITALS, RHYTHM_TYPES, STABILITY_LEVELS } from "./case-schema";
import type { ClinicalEvent } from "./encounter-events";
import { INTERVENTIONS, type InterventionGroup } from "./intervention-catalog";
import { evaluateCondition } from "./conditions";
import { PatientState } from "./patient-state";
import { FLUID_STOP, fluidAction, fluidCompletedFlag, fluidLevelFlag, fluidSchedule, fluidStopAction, fluidStoppedFlag, parseFluidAction } from "./fluid-infusion";

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
    /** Findings that appear (true) or go (false) at this step. */
    findings?: Record<string, boolean>;
}

// ── State: conditions on the patient ───────────────────────────────────────
// What a plan can ask about the patient, in a clinician's terms. Compiled to the engine's own conditions
// (compileCondition), so a plan never writes engine rules itself.

/** `pp` is the pulse pressure: systolic minus diastolic, worked out wherever it is asked about. */
export type LiveVitalName = keyof LiveVitals | "map" | "pp";

export type LiveCondition =
    /** A vital sign against a threshold: below (<), above (>), at_most (≤), at_least (≥). Every comparator given must hold. */
    | { vital: LiveVitalName; below?: number; above?: number; at_most?: number; at_least?: number }
    /** A named finding the plan tracks (see LivePlan.findings): present or not. */
    | { finding: string; is: boolean }
    /** The untreated course has reached this step. */
    | { stage_reached: string }
    /** A treatment has been validly given; for a dose-by-dose one, at least `doses` doses. */
    | { given: string; doses?: number }
    /** At least this many minutes since a treatment (or one of its doses) was validly given. */
    | { minutes_since_given: string; dose?: number; at_least: number }
    | { stabilised: boolean }
    | { all: LiveCondition[] }
    | { any: LiveCondition[] }
    | { not: LiveCondition }
    /** Something that could not be read as a condition. The check reports it, so the plan never runs. */
    | { invalid: string };

/** A clinical finding the plan tracks explicitly, such as "still fitting" or "chest still wet", so that a decision can rest on it. */
export interface LiveFinding {
    id: string;
    /** What a clinician would call it: "Still fitting". */
    label: string;
    /** Present on arrival. */
    present: boolean;
}

/** A treatment's response in a particular state. The first response that applies replaces the treatment's usual effect. */
export interface LiveResponse {
    /** Only for this dose of a dose-by-dose treatment. Absent: any dose. */
    dose?: number;
    /** Only while this holds, at the moment it is given. Absent: always (for that dose). */
    when?: LiveCondition;
    effect?: LiveVitals;
    rhythm?: RhythmType;
    consciousness?: Consciousness;
    says: string;
    /** Findings that appear (true) or go (false) when it is given in this state. */
    findings?: Record<string, boolean>;
}

/** Another complete set of treatments that also stops the deterioration, such as a rescue path for a late student. */
export interface LiveStabilisationPath {
    name: string;
    treatments: string[];
    /** Only works while this holds. Absent: always. */
    when?: LiveCondition;
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
    /**
     * When a further dose is indicated. "not_stabilised": only while the patient is still deteriorating. A condition:
     * only while it holds, and a required further dose is required only if it holds when that dose falls due.
     */
    repeat_only_while?: "not_stabilised" | LiveCondition;
    /** What the student is told when a further dose is refused as not indicated (a condition gate only). */
    not_indicated_says?: string;

    // ── State. All optional: a treatment without them behaves exactly as before.
    /** Responses that depend on the patient's state; the first that applies replaces `effect` and `says`. */
    responses?: LiveResponse[];
    /** On the tray only once this has held (and from then on). Before that it cannot be given. */
    available_when?: LiveCondition;
    /** For an essential treatment: required only once this has held, and `within_minutes` counts from that moment. */
    required_when?: LiveCondition;

    // ── Phase 3. All optional.
    /**
     * Given over minutes rather than all at once: `effect` is spread evenly, minute by minute, over `over_minutes`,
     * each minute's share acting only while `while` holds (an infusion titrated to an end point). It stops acting once
     * the patient is stabilised; the recovery takes over from there.
     *
     * LIMITATION: the total effect and the duration are fixed by the plan. The student cannot stop the infusion, step it
     * down or change its rate, and continuing it does no harm in the engine (no fluid overload, no rebound when it
     * ends). Cases whose teaching is fluid adjusted by response and stopped on reassessment (dengue, DKA, septic shock)
     * are not adequately represented by this and must not be published on it: they use `fluid` instead.
     */
    infusion?: { over_minutes: number; while?: LiveCondition };
    /**
     * What has to be true before it can be given, in order (IV access for an IV drug; two benzodiazepine doses before a
     * second-line drug). An attempt before then is refused with that requirement's words, and has no effect.
     */
    requires?: LiveRequirement[];
    /** A further dose needs a reassessment (the plan's `reassessment`) since the dose before it. */
    reassess_before_repeat?: boolean;

    // ── Rate-controlled fluid (S2 of docs/live-plan-fluid-engine-spec.md). Optional.
    /**
     * An IV infusion run at a rate the student chooses from the plan's ladder, stepped down one rate at a time and
     * stopped by them (fluid-infusion.ts). It is started once: no repeat doses and no `infusion`; its effect is set per
     * rate. The patient's response is still the plan's own per-rate table, not a model of circulating volume (S3).
     */
    fluid?: LiveFluid;
}

/** One rate on a fluid's ladder. */
export interface LiveFluidLevel {
    id: string;
    /** As the clinician writes it: "7 to 10 mL/kg/h". */
    label: string;
    /** The pump rate, whole mL per hour (the plan works it out from the patient's weight). */
    ml_per_h: number;
    /** How long it should run at this rate before the next step down (the guideline's "for 1 to 2 hours"). Absent: no step is expected from it. */
    hold_minutes?: { at_least: number; at_most: number };
    /** What running at this rate does to the monitor, as changes: at once when the rate begins, or spread over `over_minutes` while `while` holds and he is not yet stabilised. */
    effect?: LiveVitals;
    over_minutes?: number;
    while?: LiveCondition;
    /** What the student sees when it is stepped down to this rate. */
    says?: string;
    /** Still running at this rate `after_minutes` after it began, while `when` holds: too much fluid. It changes the monitor, the nurse says so, and it counts as harm. */
    overload?: { after_minutes: number; when?: LiveCondition; effect: LiveVitals; nurse_says: string; why?: string };
}

export interface LiveFluid {
    /** The ladder, highest rate first. */
    levels: LiveFluidLevel[];
    /** The volume it is set to give, mL; it finishes itself once that has run in. Absent: it runs until stopped. */
    volume_ml?: number;
    /** The right rate to start at, by the patient's state when it is started: the first whose `when` holds (or has none). Absent: the first rate. */
    start?: Array<{ level: string; when?: LiveCondition }>;
    /** When stopping it is right, in minutes after it was started. Absent: stopping is not scored. */
    stop?: { at_least: number; at_most: number };
    /** What the student sees when they stop it. */
    stop_says?: string;
    /** What the nurse says when the volume has run in. */
    completed_says?: string;
}

/** A bedside reassessment the student can do at any time: each check reports what it finds right now. */
export interface LiveReassessment {
    /** On the tray: "Reassess: chest, pulse and BP". */
    label: string;
    detail: string;
    checks: Array<{ when: LiveCondition; says: string; otherwise?: string }>;
    /**
     * Optional. The readings recorded in a REASSESSED event each time it is done: named vitals, consciousness, and the
     * plan's own findings (by id). The engine reads them from the patient; the student only asks. Absent: the
     * reassessment is the fixed sentences in `checks` alone, exactly as before.
     */
    report?: { vitals?: LiveVitalName[]; consciousness?: boolean; findings?: string[] };
}

/** The tray id of the plan's reassessment. */
export const REASSESS_ID = "reassess_patient";

export interface LiveRequirement {
    when: LiveCondition;
    /** Why it cannot be given yet, as the student is told: "there is no IV access yet." */
    says: string;
}

export interface LiveRecovery {
    /** Minutes after the last stabilising treatment at which the patient settles. */
    after_minutes: number;
    /** The monitor once settled. */
    vitals: LiveVitals;
    rhythm?: RhythmType;
    consciousness?: Consciousness;
    nurse_says: string;
    /** Findings that appear (true) or go (false) once settled. */
    findings?: Record<string, boolean>;
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
    /** stabilised_by works only while this holds (for example, until a later step is reached). Absent: always. */
    stabilised_by_while?: LiveCondition;
    /** Other complete sets of treatments that also stop the deterioration. */
    or_stabilised_by?: LiveStabilisationPath[];
    /**
     * Clinical end points that must also hold before the patient counts as stabilised, whichever path was taken (for
     * example oxygenation and blood pressure). Absent: a complete path is enough.
     */
    end_points?: LiveCondition;
    /** A bedside reassessment on the tray, reporting explicit findings (Phase 3). */
    reassessment?: LiveReassessment;
    /** Findings the plan tracks, so treatments, doses and paths can depend on them. */
    findings?: LiveFinding[];
    recovery: LiveRecovery;
    /** What the numbers rest on: one line each ("Stage timings: untreated hypovolaemic shock in a 12 kg child ..."). */
    basis?: string[];
    drafted_at?: string;
    sign_off?: LiveSignOff;
    /** When the MediKarya team switched it on without a clinician's sign-off. A changed plan has to be switched on again. */
    team_checked_at?: string;
    /**
     * Things that must be settled before students may get this case live (a clinical question, a missing scenario).
     * While any is open the plan cannot be switched on, and students never get it live even if it is marked approved.
     * They belong to the case, not the draft: a changed plan keeps them (carryReleaseBlockers).
     */
    release_blockers?: ReleaseBlocker[];
}

export interface ReleaseBlocker {
    id: string;
    /** What has to be done, and who has to do it. */
    text: string;
    raised_at: string;
    /** Set when it is settled; the blocker is kept as a record. */
    cleared_at?: string;
    cleared_by?: string;
    /** How it was settled. */
    resolution?: string;
}

/**
 * Whether students get a plan's live version: switched on (approved) and nothing open blocking its release. Takes the
 * two fields alone, so the library's list (which reads only these columns) uses the same rule as the case itself.
 */
export function liveForStudents(status: unknown, blockers: unknown): boolean {
    return status === "approved" && !(Array.isArray(blockers) && blockers.some(isOpenBlocker));
}

/** Open unless marked cleared. Anything that cannot be read as a blocker counts as open: it blocks, it never lets through. */
const isOpenBlocker = (b: unknown): boolean => !b || typeof b !== "object" || !(b as ReleaseBlocker).cleared_at;

/** The blockers still open on a plan (one that cannot be read is listed as such, so it can be seen and fixed). */
export const openReleaseBlockers = (plan: unknown): ReleaseBlocker[] =>
    isLivePlan(plan)
        ? (plan.release_blockers ?? [])
              .filter(isOpenBlocker)
              .map((b) => (b && typeof b === "object" ? b : { id: "unreadable", text: "A release blocker on this plan could not be read; fix it in the case's data.", raised_at: "" }))
        : [];

/** A new or changed plan keeps the case's release blockers: they are cleared on purpose, never by redrafting. */
export function carryReleaseBlockers(next: LivePlan, previous: unknown): LivePlan {
    const kept = isLivePlan(previous) ? (previous.release_blockers ?? []) : [];
    const own = next.release_blockers ?? [];
    const merged = [...kept, ...own.filter((b) => !kept.some((k) => k.id === b.id))];
    return merged.length > 0 ? { ...next, release_blockers: merged } : next;
}

export function isLivePlan(v: unknown): v is LivePlan {
    return !!v && typeof v === "object" && (v as LivePlan).version === 1 && Array.isArray((v as LivePlan).stages) && Array.isArray((v as LivePlan).treatments);
}

/**
 * Students get the live version once it is approved and nothing blocks its release; an admin (play-testing) gets it
 * as soon as it is proposed.
 */
export function livePlanApplies(plan: unknown, viewerIsAdmin: boolean): plan is LivePlan {
    return isLivePlan(plan) && (viewerIsAdmin || liveForStudents(plan.status, plan.release_blockers));
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

    // A condition is read strictly: anything that is not one becomes { invalid }, which the check reports, rather than
    // being dropped (a dropped gate would let a dose through).
    const condition = (v: unknown, depth = 0): LiveCondition => {
        const o = (v && typeof v === "object" && !Array.isArray(v) ? v : null) as Record<string, any> | null;
        const bad = { invalid: JSON.stringify(v ?? null).slice(0, 120) };
        if (!o || depth > 8) return bad;
        const keys = Object.keys(o);
        const only = (...allowed: string[]) => keys.every((k) => allowed.includes(k));
        if ("all" in o || "any" in o) {
            const k = "all" in o ? "all" : "any";
            if (!only(k) || !Array.isArray(o[k]) || o[k].length === 0) return bad;
            return { [k]: o[k].map((c: unknown) => condition(c, depth + 1)) } as LiveCondition;
        }
        if ("not" in o) return only("not") ? { not: condition(o.not, depth + 1) } : bad;
        if ("vital" in o) {
            if (!only("vital", "below", "above", "at_most", "at_least") || !["hr", "sbp", "dbp", "map", "pp", "spo2", "rr", "temp"].includes(o.vital)) return bad;
            const out: Record<string, unknown> = { vital: o.vital };
            for (const k of ["below", "above", "at_most", "at_least"]) {
                if (k in o) {
                    if (num(o[k]) === undefined) return bad;
                    out[k] = o[k];
                }
            }
            return Object.keys(out).length > 1 ? (out as LiveCondition) : bad;
        }
        if ("finding" in o) return only("finding", "is") && typeof o.is === "boolean" && slug(o.finding) ? { finding: slug(o.finding), is: o.is } : bad;
        if ("stage_reached" in o) return only("stage_reached") && slug(o.stage_reached) ? { stage_reached: slug(o.stage_reached) } : bad;
        if ("given" in o) {
            if (!only("given", "doses") || !slug(o.given) || ("doses" in o && num(o.doses) === undefined)) return bad;
            return { given: slug(o.given), ...("doses" in o ? { doses: o.doses } : {}) };
        }
        if ("minutes_since_given" in o) {
            if (!only("minutes_since_given", "dose", "at_least") || !slug(o.minutes_since_given) || num(o.at_least) === undefined || ("dose" in o && num(o.dose) === undefined)) return bad;
            return { minutes_since_given: slug(o.minutes_since_given), ...("dose" in o ? { dose: o.dose } : {}), at_least: o.at_least };
        }
        if ("stabilised" in o) return only("stabilised") && typeof o.stabilised === "boolean" ? { stabilised: o.stabilised } : bad;
        return bad;
    };
    // The readings a reassessment records. Read strictly: a name that is not a reading is dropped here, and the check reports a report with nothing in it.
    const readReport = (r: any): NonNullable<LiveReassessment["report"]> => {
        const vitalsOut = (Array.isArray(r?.vitals) ? r.vitals : []).filter((v: unknown): v is LiveVitalName => typeof v === "string" && (REPORT_VITALS as readonly string[]).includes(v));
        const findingsOut = (Array.isArray(r?.findings) ? r.findings : []).map(slug).filter(Boolean);
        return {
            ...(vitalsOut.length > 0 ? { vitals: [...new Set<LiveVitalName>(vitalsOut)] } : {}),
            ...(r?.consciousness === true ? { consciousness: true } : {}),
            ...(findingsOut.length > 0 ? { findings: [...new Set<string>(findingsOut)] } : {}),
        };
    };
    const findingSets = (v: unknown): Record<string, boolean> | undefined => {
        if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
        const out: Record<string, boolean> = {};
        for (const [k, b] of Object.entries(v as Record<string, unknown>)) if (typeof b === "boolean" && slug(k)) out[slug(k)] = b;
        return Object.keys(out).length > 0 ? out : undefined;
    };
    const withFindings = (v: unknown) => (findingSets(v) ? { findings: findingSets(v) } : {});

    // State fields are kept only when present, so a plan that does not use them reads exactly as before.
    const stateFields = (t: any): Partial<LiveTreatment> => {
        const out: Partial<LiveTreatment> = {};
        if (Array.isArray(t?.responses) && t.responses.length > 0) {
            out.responses = t.responses.map((r: any) => {
                const effect = vitals(r?.effect);
                return {
                    ...(num(r?.dose) !== undefined ? { dose: Math.round(num(r.dose) as number) } : {}),
                    ...(r?.when !== undefined ? { when: condition(r.when) } : {}),
                    ...(Object.keys(effect).length > 0 ? { effect } : {}),
                    ...(oneOf(r?.rhythm, RHYTHM_TYPES) ? { rhythm: oneOf(r?.rhythm, RHYTHM_TYPES) } : {}),
                    ...(oneOf(r?.consciousness, CONSCIOUSNESS_LEVELS) ? { consciousness: oneOf(r?.consciousness, CONSCIOUSNESS_LEVELS) } : {}),
                    says: text(r?.says),
                    ...withFindings(r?.findings),
                };
            });
        }
        if (t?.available_when !== undefined) out.available_when = condition(t.available_when);
        // Kept on any role, so the check can refuse it on one that is not essential rather than it vanishing.
        if (t?.required_when !== undefined) out.required_when = condition(t.required_when);
        if (t?.repeat_only_while && typeof t.repeat_only_while === "object") out.repeat_only_while = condition(t.repeat_only_while);
        if (text(t?.not_indicated_says)) out.not_indicated_says = text(t.not_indicated_says);
        if (t?.reassess_before_repeat === true) out.reassess_before_repeat = true;
        if (Array.isArray(t?.requires) && t.requires.length > 0) out.requires = t.requires.map((r: any) => ({ when: condition(r?.when), says: text(r?.says) }));
        if (t?.infusion && typeof t.infusion === "object") {
            out.infusion = { over_minutes: num(t.infusion.over_minutes) ?? NaN, ...(t.infusion.while !== undefined ? { while: condition(t.infusion.while) } : {}) };
        }
        if (t?.fluid && typeof t.fluid === "object") out.fluid = readFluid(t.fluid);
        return out;
    };

    // A fluid's ladder. Numbers that are not numbers become NaN, which the check reports, rather than being dropped.
    const minutesWindow = (w: any) => ({ at_least: num(w?.at_least) ?? NaN, at_most: num(w?.at_most) ?? NaN });
    const readFluid = (f: any): LiveFluid => ({
        levels: (Array.isArray(f.levels) ? f.levels : []).map((l: any, i: number) => {
            const effect = vitals(l?.effect);
            const o = l?.overload;
            return {
                id: slug(l?.id) || `rate_${i + 1}`,
                label: text(l?.label, 80),
                ml_per_h: num(l?.ml_per_h) ?? NaN,
                ...(l?.hold_minutes !== undefined ? { hold_minutes: minutesWindow(l.hold_minutes) } : {}),
                ...(Object.keys(effect).length > 0 ? { effect } : {}),
                ...(l?.over_minutes !== undefined ? { over_minutes: num(l.over_minutes) ?? NaN } : {}),
                ...(l?.while !== undefined ? { while: condition(l.while) } : {}),
                ...(text(l?.says) ? { says: text(l.says) } : {}),
                ...(o && typeof o === "object"
                    ? {
                          overload: {
                              after_minutes: num(o.after_minutes) ?? NaN,
                              ...(o.when !== undefined ? { when: condition(o.when) } : {}),
                              effect: vitals(o.effect),
                              nurse_says: text(o.nurse_says),
                              ...(text(o.why) ? { why: text(o.why) } : {}),
                          },
                      }
                    : {}),
            };
        }),
        ...(f.volume_ml !== undefined ? { volume_ml: num(f.volume_ml) ?? NaN } : {}),
        ...(Array.isArray(f.start) && f.start.length > 0
            ? { start: f.start.map((r: any) => ({ level: slug(r?.level), ...(r?.when !== undefined ? { when: condition(r.when) } : {}) })) }
            : {}),
        ...(f.stop !== undefined ? { stop: minutesWindow(f.stop) } : {}),
        ...(text(f.stop_says) ? { stop_says: text(f.stop_says) } : {}),
        ...(text(f.completed_says) ? { completed_says: text(f.completed_says) } : {}),
    });

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
        ...withFindings(s?.findings),
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
            ...stateFields(t),
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
        ...(p.stabilised_by_while !== undefined ? { stabilised_by_while: condition(p.stabilised_by_while) } : {}),
        ...(p.end_points !== undefined ? { end_points: condition(p.end_points) } : {}),
        ...(p.reassessment && typeof p.reassessment === "object"
            ? {
                  reassessment: {
                      label: text(p.reassessment.label, 80),
                      detail: text(p.reassessment.detail, 140),
                      checks: (Array.isArray(p.reassessment.checks) ? p.reassessment.checks : []).map((c: any) => ({
                          when: condition(c?.when),
                          says: text(c?.says),
                          ...(text(c?.otherwise) ? { otherwise: text(c.otherwise) } : {}),
                      })),
                      ...(p.reassessment.report && typeof p.reassessment.report === "object" ? { report: readReport(p.reassessment.report) } : {}),
                  },
              }
            : {}),
        ...(Array.isArray(p.or_stabilised_by) && p.or_stabilised_by.length > 0
            ? {
                  or_stabilised_by: p.or_stabilised_by.map((path: any) => ({
                      name: text(path?.name, 80),
                      treatments: (Array.isArray(path?.treatments) ? path.treatments : []).map(slug).filter(Boolean),
                      ...(path?.when !== undefined ? { when: condition(path.when) } : {}),
                  })),
              }
            : {}),
        ...(Array.isArray(p.findings) && p.findings.length > 0
            ? { findings: p.findings.map((f: any) => ({ id: slug(f?.id), label: text(f?.label, 80), present: f?.present === true })) }
            : {}),
        recovery: {
            after_minutes: num(p.recovery?.after_minutes) ?? NaN,
            vitals: vitals(p.recovery?.vitals),
            ...(oneOf(p.recovery?.rhythm, RHYTHM_TYPES) ? { rhythm: oneOf(p.recovery?.rhythm, RHYTHM_TYPES) } : {}),
            ...(oneOf(p.recovery?.consciousness, CONSCIOUSNESS_LEVELS) ? { consciousness: oneOf(p.recovery?.consciousness, CONSCIOUSNESS_LEVELS) } : {}),
            nurse_says: text(p.recovery?.nurse_says),
            ...withFindings(p.recovery?.findings),
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
/** Pulse pressure the monitor can show: the diastolic is held at least 10 below the systolic, and the systolic reaches 260. */
const PULSE_PRESSURE_RANGE: [number, number] = [10, 245];
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

/** What a condition may refer to: the plan's own stages, treatments and findings. */
interface ConditionScope {
    stages: Set<string>;
    treatments: Map<string, LiveTreatment>;
    findings: Set<string>;
}

/** A condition must refer only to things the plan has, with numbers that make sense. */
function checkCondition(c: LiveCondition, where: string, scope: ConditionScope, errors: string[]): void {
    if ("invalid" in c) return void errors.push(`${where}: could not read this condition (${c.invalid}).`);
    if ("all" in c) return c.all.forEach((x, i) => checkCondition(x, `${where}.all[${i}]`, scope, errors));
    if ("any" in c) return c.any.forEach((x, i) => checkCondition(x, `${where}.any[${i}]`, scope, errors));
    if ("not" in c) return checkCondition(c.not, `${where}.not`, scope, errors);
    if ("vital" in c) {
        const [lo, hi] = c.vital === "pp" ? PULSE_PRESSURE_RANGE : RANGE[c.vital === "map" ? "sbp" : c.vital];
        for (const k of ["below", "above", "at_most", "at_least"] as const) {
            const n = c[k];
            if (n !== undefined && (n < lo || n > hi)) errors.push(`${where}: ${c.vital} ${k} ${n} is outside what a monitor can show (${lo}–${hi}).`);
        }
        return;
    }
    if ("finding" in c) {
        if (!scope.findings.has(c.finding)) errors.push(`${where}: "${c.finding}" is not one of the plan's findings.`);
        return;
    }
    if ("stage_reached" in c) {
        if (!scope.stages.has(c.stage_reached)) errors.push(`${where}: "${c.stage_reached}" is not one of the stages.`);
        return;
    }
    if ("given" in c || "minutes_since_given" in c) {
        const id = "given" in c ? c.given : c.minutes_since_given;
        const dose = "given" in c ? c.doses : c.dose;
        const t = scope.treatments.get(id);
        if (!t) errors.push(`${where}: "${id}" is not one of the treatments.`);
        else if (dose !== undefined && (!Number.isInteger(dose) || dose < 1 || dose > (t.max_doses ?? 1))) errors.push(`${where}: "${id}" can be given ${t.max_doses ?? 1} time(s), so dose ${dose} cannot happen.`);
        if ("minutes_since_given" in c && !(c.at_least > 0)) errors.push(`${where}: at_least must be more than 0 minutes.`);
    }
}

function checkFindingSets(sets: Record<string, boolean> | undefined, where: string, scope: ConditionScope, errors: string[]): void {
    for (const id of Object.keys(sets ?? {})) if (!scope.findings.has(id)) errors.push(`${where}: "${id}" is not one of the plan's findings.`);
}

/** The state fields of one treatment, when it uses them. */
function checkState(t: LiveTreatment, where: string, plan: LivePlan, scope: ConditionScope, errors: string[], warnings: string[]): void {
    const max = t.max_doses ?? 1;
    (t.responses ?? []).forEach((r, i) => {
        const w = `${where}: responses[${i}]`;
        if (r.dose !== undefined && (!Number.isInteger(r.dose) || r.dose < 1 || r.dose > max)) errors.push(`${w}: dose ${r.dose} cannot happen (max_doses is ${max}).`);
        if (r.when) checkCondition(r.when, `${w}.when`, scope, errors);
        if (r.says.length < 10) errors.push(`${w}: says is what the student sees; write a sentence.`);
        for (const k of Object.keys(r.effect ?? {}) as Array<keyof LiveVitals>) {
            if (Math.abs(r.effect![k] as number) > MAX_EFFECT[k]) errors.push(`${w}: changes ${VITAL_NAME[k]} by ${r.effect![k]}, more than one treatment can do (±${MAX_EFFECT[k]}).`);
        }
        if ((r.effect?.sbp === undefined) !== (r.effect?.dbp === undefined)) errors.push(`${w}: effect needs both sbp and dbp, or neither.`);
        checkFindingSets(r.findings, `${w}.findings`, scope, errors);
        const earlierCatchAll = (t.responses ?? []).slice(0, i).some((e) => !e.when && (e.dose === undefined || e.dose === r.dose));
        if (earlierCatchAll) warnings.push(`${w}: an earlier response always applies first, so this one never does.`);
    });
    const gate = t.repeat_only_while;
    if (gate && gate !== "not_stabilised") checkCondition(gate, `${where}: repeat_only_while`, scope, errors);
    if (t.not_indicated_says !== undefined && (!gate || gate === "not_stabilised")) errors.push(`${where}: not_indicated_says only goes with a repeat_only_while condition.`);
    if (t.available_when) checkCondition(t.available_when, `${where}: available_when`, scope, errors);
    (t.requires ?? []).forEach((r, i) => {
        checkCondition(r.when, `${where}: requires[${i}].when`, scope, errors);
        if (r.says.length < 10) errors.push(`${where}: requires[${i}].says is what the student is told; write a sentence.`);
        if (JSON.stringify(r.when).includes(`"${t.id}"`)) errors.push(`${where}: requires[${i}] depends on the treatment itself, so it could never be met.`);
    });
    if (t.reassess_before_repeat) {
        if (!plan.reassessment) errors.push(`${where}: reassess_before_repeat needs the plan's reassessment.`);
        if (!isRepeatable(t)) errors.push(`${where}: reassess_before_repeat only makes sense when max_doses is 2 or more.`);
    }
    if (t.infusion) {
        const n = t.infusion.over_minutes;
        if (!Number.isInteger(n) || n < 1 || n >= plan.time_limit_minutes) errors.push(`${where}: infusion.over_minutes must be a whole number of minutes, from 1 to less than the encounter (${plan.time_limit_minutes} min).`);
        if (t.infusion.while) checkCondition(t.infusion.while, `${where}: infusion.while`, scope, errors);
        if (!t.effect) errors.push(`${where}: an infusion needs an effect to spread over its minutes.`);
        if (isRepeatable(t)) errors.push(`${where}: an infusion is started once; it cannot also have repeat doses.`);
        if ((t.responses ?? []).some((r) => r.effect)) errors.push(`${where}: an infusion's effect is spread over its minutes, so its responses can change what is said and found, not the effect.`);
    }
    if (t.fluid) checkFluid(t, t.fluid, where, plan, scope, errors, warnings);
    if (t.required_when) {
        checkCondition(t.required_when, `${where}: required_when`, scope, errors);
        if (t.role !== "essential") errors.push(`${where}: required_when is for essential treatments.`);
        // Otherwise it could be given before it is needed and then never again when it is.
        if (!t.available_when) errors.push(`${where}: a treatment that is only sometimes required needs available_when too, so it cannot be given before it is needed.`);
        if ((t.doses_required ?? 1) > 1) errors.push(`${where}: a treatment that is only sometimes required can require only one dose.`);
        if (plan.stabilised_by.includes(t.id)) errors.push(`${where}: a treatment that is only sometimes required cannot be in stabilised_by (the usual path); put it in an or_stabilised_by path.`);
    }
}

/** The longest encounter: a plan with a fluid ladder runs on into the ward hours, which the student moves through by waiting. */
export const WARD_LIMIT_MINUTES = 48 * 60;
/** The most minutes one rate's effect may be spread over (each minute is a rule). */
const MAX_SPREAD_MINUTES = 120;

/** A change to the monitor that one step can make: within the per-treatment limits, with both pressures or neither. */
function checkEffect(e: LiveVitals | undefined, where: string, errors: string[]): void {
    for (const k of Object.keys(e ?? {}) as Array<keyof LiveVitals>) {
        if (Math.abs(e![k] as number) > MAX_EFFECT[k]) errors.push(`${where}: changes ${VITAL_NAME[k]} by ${e![k]}, more than one treatment can do (±${MAX_EFFECT[k]}).`);
    }
    if ((e?.sbp === undefined) !== (e?.dbp === undefined)) errors.push(`${where}: needs both sbp and dbp, or neither.`);
}

/** A fluid's ladder: rates from the highest down, whole numbers, windows inside the encounter, and nothing it cannot be combined with. */
function checkFluid(t: LiveTreatment, f: LiveFluid, where: string, plan: LivePlan, scope: ConditionScope, errors: string[], warnings: string[]): void {
    const w = `${where}: fluid`;
    const limit = plan.time_limit_minutes;
    const minutes = (n: number) => Number.isInteger(n) && n >= 1 && (!Number.isFinite(limit) || n < limit);
    const badWindow = (x: { at_least: number; at_most: number }) => !minutes(x.at_least) || !minutes(x.at_most) || x.at_most < x.at_least;
    if (f.levels.length < 1 || f.levels.length > 8) errors.push(`${w}: give from 1 to 8 rates.`);
    const ids = new Set<string>();
    f.levels.forEach((l, i) => {
        const lw = `${w}.levels[${i}]${l.label ? ` (${l.label})` : ""}`;
        if (!ID.test(l.id) || l.id === FLUID_STOP) errors.push(`${lw}: id must be lower-case letters, digits and underscores, and not "${FLUID_STOP}".`);
        if (ids.has(l.id)) errors.push(`${lw}: the id "${l.id}" is used twice.`);
        ids.add(l.id);
        if (!l.label) errors.push(`${lw}: needs a label, the rate as a clinician writes it.`);
        if (!Number.isInteger(l.ml_per_h) || l.ml_per_h < 1 || l.ml_per_h > 10000) errors.push(`${lw}: ml_per_h must be a whole number of mL per hour, from 1 to 10000.`);
        else if (i > 0 && !(l.ml_per_h < f.levels[i - 1].ml_per_h)) errors.push(`${lw}: the rates go from the highest down, so this one must be lower than the one before it.`);
        if (l.hold_minutes) {
            if (badWindow(l.hold_minutes)) errors.push(`${lw}: hold_minutes needs whole minutes from 1, at_most no less than at_least, both within the encounter (${limit} min).`);
        } else if (i < f.levels.length - 1) warnings.push(`${lw}: no hold_minutes, so when it is stepped down is not scored.`);
        checkEffect(l.effect, `${lw}.effect`, errors);
        if (l.over_minutes !== undefined) {
            if (!Number.isInteger(l.over_minutes) || l.over_minutes < 1 || l.over_minutes > MAX_SPREAD_MINUTES || !minutes(l.over_minutes)) errors.push(`${lw}: over_minutes must be a whole number from 1 to ${MAX_SPREAD_MINUTES}, within the encounter.`);
            if (!l.effect) errors.push(`${lw}: over_minutes spreads this rate's effect, so it needs an effect.`);
        }
        if (l.while) {
            checkCondition(l.while, `${lw}.while`, scope, errors);
            if (l.over_minutes === undefined) errors.push(`${lw}: while only goes with over_minutes (an effect given at once has nothing to stop).`);
        }
        if (l.says !== undefined && l.says.length < 10) errors.push(`${lw}: says is what the student sees when the rate comes down to this; write a sentence.`);
        const o = l.overload;
        if (o) {
            if (!minutes(o.after_minutes)) errors.push(`${lw}: overload.after_minutes must be a whole number of minutes from 1, within the encounter (${limit} min).`);
            else if (l.hold_minutes && o.after_minutes < l.hold_minutes.at_least) errors.push(`${lw}: overload comes before the rate's own hold time (${l.hold_minutes.at_least} min) is up.`);
            if (o.when) checkCondition(o.when, `${lw}.overload.when`, scope, errors);
            if (Object.keys(o.effect).length === 0) errors.push(`${lw}: overload needs an effect on the monitor.`);
            checkEffect(o.effect, `${lw}.overload.effect`, errors);
            if (o.nurse_says.length < 10) errors.push(`${lw}: overload.nurse_says is what tells the student it happened; write a sentence.`);
        }
    });
    if (f.volume_ml !== undefined && (!Number.isInteger(f.volume_ml) || f.volume_ml < 1 || f.volume_ml > 10000)) errors.push(`${w}: volume_ml must be a whole number of mL, from 1 to 10000.`);
    (f.start ?? []).forEach((r, i) => {
        if (!ids.has(r.level)) errors.push(`${w}.start[${i}]: "${r.level}" is not one of its rates.`);
        if (r.when) checkCondition(r.when, `${w}.start[${i}].when`, scope, errors);
        else if (i < (f.start as unknown[]).length - 1) warnings.push(`${w}.start[${i}] has no condition, so the ones after it never apply.`);
    });
    if (f.stop && badWindow(f.stop)) errors.push(`${w}: stop needs whole minutes from 1, at_most no less than at_least, both within the encounter (${limit} min).`);
    if (f.stop_says !== undefined && f.stop_says.length < 10) errors.push(`${w}: stop_says is what the student sees when they stop it; write a sentence.`);
    if (f.completed_says !== undefined) {
        if (f.volume_ml === undefined) errors.push(`${w}: completed_says only goes with volume_ml (a fluid without one never finishes by itself).`);
        else if (f.completed_says.length < 10) errors.push(`${w}: completed_says is what the nurse says when it has run in; write a sentence.`);
    }
    if (isRepeatable(t)) errors.push(`${w}: a fluid is started once and then stepped down; it cannot also have repeat doses.`);
    if (t.infusion) errors.push(`${w}: give the rate ladder or infusion, not both.`);
    if (t.effect) errors.push(`${w}: a fluid's effect is set per rate (levels[].effect), not on the treatment.`);
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
    // A plan with a fluid ladder may run on for its hours on the ward; every other plan is one bedside session.
    const ward = plan.treatments.some((t) => t.fluid);
    if (!whole(plan.time_limit_minutes) || plan.time_limit_minutes < 6 || plan.time_limit_minutes > (ward ? WARD_LIMIT_MINUTES : 45)) {
        errors.push(ward ? `time_limit_minutes must be between 6 and ${WARD_LIMIT_MINUTES} (48 hours) for a plan with a fluid ladder.` : "time_limit_minutes must be between 6 and 45.");
    }
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

    // ── findings, and what conditions may refer to
    const findingIds = new Set<string>();
    (plan.findings ?? []).forEach((f, i) => {
        const where = `findings[${i}]${f.label ? ` (${f.label})` : ""}`;
        if (!ID.test(f.id)) errors.push(`${where}: id must be lower-case letters, digits and underscores.`);
        if (findingIds.has(f.id)) errors.push(`${where}: the id "${f.id}" is used twice.`);
        findingIds.add(f.id);
        if (!f.label) errors.push(`${where}: needs a label.`);
    });
    const scope: ConditionScope = { stages: stageIds, treatments: new Map(plan.treatments.map((t) => [t.id, t])), findings: findingIds };
    plan.stages.forEach((s, i) => checkFindingSets(s.findings, `stages[${i}].findings`, scope, errors));
    checkFindingSets(plan.recovery.findings, "recovery.findings", scope, errors);

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
        checkState(t, where, plan, scope, errors, warnings);
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
    if (plan.end_points) checkCondition(plan.end_points, "end_points", scope, errors);
    if (plan.reassessment) {
        const r = plan.reassessment;
        if (!r.label) errors.push("reassessment: needs a label for the tray.");
        if (r.checks.length === 0) errors.push("reassessment: list what it checks.");
        r.checks.forEach((c, i) => {
            checkCondition(c.when, `reassessment.checks[${i}].when`, scope, errors);
            if (c.says.length < 5) errors.push(`reassessment.checks[${i}]: says is what the student finds; write it.`);
        });
        if (plan.treatments.some((t) => t.id === REASSESS_ID)) errors.push(`treatments: "${REASSESS_ID}" is the reassessment's own id.`);
        if (r.report) {
            const { vitals = [], consciousness = false, findings = [] } = r.report;
            if (vitals.length === 0 && !consciousness && findings.length === 0) errors.push("reassessment.report: name at least one vital, consciousness or finding to record, or leave the report out.");
            for (const f of findings) if (!scope.findings.has(f)) errors.push(`reassessment.report: "${f}" is not one of the plan's findings.`);
        }
    }
    // An infusion stops acting once the patient is stabilised. On a path without end points it would stabilise him the
    // moment it started, before any of its effect arrived.
    const onAPath = new Set([...plan.stabilised_by, ...(plan.or_stabilised_by ?? []).flatMap((p) => p.treatments)]);
    for (const t of plan.treatments) {
        if (t.fluid?.levels.some((l) => l.over_minutes !== undefined) && onAPath.has(t.id) && !plan.end_points) errors.push(`${t.id}: a fluid whose effect is spread over minutes and that stops the deterioration needs end_points, so the patient is stabilised when it has worked, not the moment it starts.`);
        if (t.infusion && onAPath.has(t.id) && !plan.end_points) errors.push(`${t.id}: an infusion that stops the deterioration needs end_points, so the patient is stabilised when it has worked, not the moment it starts.`);
    }
    if (plan.stabilised_by_while) {
        checkCondition(plan.stabilised_by_while, "stabilised_by_while", scope, errors);
        if (!plan.or_stabilised_by?.length) errors.push("stabilised_by_while: the usual path can stop working, so give another path (or_stabilised_by), or the patient could never be stabilised.");
    }
    (plan.or_stabilised_by ?? []).forEach((path, i) => {
        const where = `or_stabilised_by[${i}]${path.name ? ` (${path.name})` : ""}`;
        if (!path.name) errors.push(`${where}: needs a name.`);
        if (path.treatments.length === 0) errors.push(`${where}: name the treatments of this path.`);
        for (const id of path.treatments) {
            const t = plan.treatments.find((x) => x.id === id);
            if (!t) errors.push(`${where}: "${id}" is not one of the treatments.`);
            else if (t.role !== "essential") errors.push(`${where}: "${id}" stops the deterioration, so it has to be essential.`);
            if (MONITORING_ONLY.has(id)) errors.push(`${where}: "${id}" watches the patient but does not treat, so it cannot be what stops the deterioration.`);
        }
        if (path.when) checkCondition(path.when, `${where}.when`, scope, errors);
    });

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

// Flags behind the state features. Each exists only in a plan that uses the feature.
const findingFlag = (id: string) => `finding_${id}`;
const reachedFlag = (stageId: string) => `reached_${stageId}`;
/** Set once a treatment with available_when has become available. The tray shows it only then. */
export const availableFlag = (treatmentId: string) => `available_${treatmentId}`;
export const requiredFlag = (treatmentId: string) => `required_${treatmentId}`;
/** A further required dose fell due while its condition held: it is required. */
const indicatedFlag = (treatmentId: string, dose: number) => `indicated_${treatmentId}_dose${dose}`;
/** A further required dose fell due while its condition did not hold (or the dose before was not needed): it is not required. */
const notNeededFlag = (treatmentId: string, dose: number) => `notneeded_${treatmentId}_dose${dose}`;
/** A further dose was required, but the patient then reached the end point without it: it stopped being needed. */
const resolvedFlag = (treatmentId: string, dose: number) => `resolved_${treatmentId}_dose${dose}`;

/** The ids of the record-only rules a plan adds, which the timeline does not show (the patient's state does not change). */
const RECORD_ONLY_RULE = /^live_(available|required|indicated|notneeded|resolved|infusion)_/;
export const isRecordOnlyRule = (ruleId: string) => RECORD_ONLY_RULE.test(ruleId);

/** A treatment whose further doses depend on a condition on the patient, not just on the clock. */
export const isStateGated = (t: LiveTreatment): t is LiveTreatment & { repeat_only_while: LiveCondition } =>
    !!t.repeat_only_while && typeof t.repeat_only_while === "object";
/** A treatment that uses any state field; every other treatment compiles exactly as before. */
const usesState = (t: LiveTreatment) =>
    !!(t.responses?.length || t.available_when || t.required_when || isStateGated(t) || t.infusion || t.requires?.length || t.reassess_before_repeat || t.fluid);
/** Set by a reassessment, cleared by each valid dose of a treatment that needs one before its next dose. */
const reassessedFlag = (treatmentId: string) => `reassessed_${treatmentId}`;

/** A plan condition as the engine's own condition. Only call on a plan that passed the check. */
export function compileCondition(c: LiveCondition): RuleCondition {
    if ("all" in c) return { all: c.all.map(compileCondition) };
    if ("any" in c) return { any: c.any.map(compileCondition) };
    if ("not" in c) return { not: compileCondition(c.not) };
    if ("vital" in c) {
        const parameter = c.vital === "temp" ? "temperature" : c.vital;
        return {
            parameter,
            ...(c.below !== undefined ? { lt: c.below } : {}),
            ...(c.above !== undefined ? { gt: c.above } : {}),
            ...(c.at_most !== undefined ? { lte: c.at_most } : {}),
            ...(c.at_least !== undefined ? { gte: c.at_least } : {}),
        } as RuleCondition;
    }
    if ("finding" in c) return { flag: findingFlag(c.finding), is: c.is };
    if ("stage_reached" in c) return { flag: reachedFlag(c.stage_reached), is: true };
    if ("given" in c) return { flag: doseFlag(c.given, c.doses ?? 1), is: true };
    if ("minutes_since_given" in c) return { minutes_since_flag: { flag: doseFlag(c.minutes_since_given, c.dose ?? 1), gte: c.at_least } };
    if ("stabilised" in c) return { flag: STABILISED, is: c.stabilised };
    throw new Error(`A live plan condition that could not be read reached the compiler: ${c.invalid}`);
}

/** Every condition a plan contains, for finding which stages it refers to. */
function planConditions(plan: LivePlan): LiveCondition[] {
    const out: LiveCondition[] = [];
    for (const t of plan.treatments) {
        for (const r of t.responses ?? []) if (r.when) out.push(r.when);
        if (t.available_when) out.push(t.available_when);
        if (t.required_when) out.push(t.required_when);
        if (isStateGated(t)) out.push(t.repeat_only_while);
        if (t.infusion?.while) out.push(t.infusion.while);
        for (const l of t.fluid?.levels ?? []) {
            if (l.while) out.push(l.while);
            if (l.overload?.when) out.push(l.overload.when);
        }
        for (const r of t.fluid?.start ?? []) if (r.when) out.push(r.when);
    }
    if (plan.stabilised_by_while) out.push(plan.stabilised_by_while);
    if (plan.end_points) out.push(plan.end_points);
    for (const path of plan.or_stabilised_by ?? []) if (path.when) out.push(path.when);
    return out;
}

function stagesReferenced(conditions: LiveCondition[]): Set<string> {
    const out = new Set<string>();
    const walk = (c: LiveCondition): void => {
        if ("all" in c) c.all.forEach(walk);
        else if ("any" in c) c.any.forEach(walk);
        else if ("not" in c) walk(c.not);
        else if ("stage_reached" in c) out.add(c.stage_reached);
    };
    conditions.forEach(walk);
    return out;
}

const findingSets = (f: Record<string, boolean> | undefined) => Object.fromEntries(Object.entries(f ?? {}).map(([id, v]) => [findingFlag(id), v]));

/**
 * What it takes for one treatment to have done its part in stopping the deterioration. For a state-gated one: the
 * first dose, and the patient no longer meeting the condition for another dose (the seizure has stopped, the
 * atropine end points are reached). Giving the required number of doses is not enough on its own.
 */
function stabilisingConditions(t: LiveTreatment | undefined, id: string): RuleCondition[] {
    if (!t || !isStateGated(t)) return [{ flag: stabilisingFlag(t, id), is: true }];
    return [{ flag: doseFlag(id, 1), is: true }, { not: compileCondition(t.repeat_only_while) }];
}

/** A rule that only records something: it sets a flag the moment its condition first holds, and the patient's state is unchanged. */
const latch = (id: string, when: RuleCondition, flag: string): EventRule => ({ id, when, transition: "unchanged", keeps_state: true, sets: { [flag]: true }, narrative: null });

/**
 * An infusion's effect, one share per minute after it was started. Each share acts in its own minute only, only while
 * the infusion's condition holds and the patient is not yet stabilised. Shares are whole numbers that add up exactly.
 */
/** An effect spread evenly over `n` minutes: the change in each minute (1 to n), whole numbers (tenths for temperature) that add up exactly. */
function minuteShares(total: LiveVitals, n: number): LiveVitals[] {
    const share = (k: keyof LiveVitals, m: number): number => {
        const tenths = k === "temp" ? 10 : 1;
        const v = (total[k] ?? 0) * tenths;
        return (Math.round((v * m) / n) - Math.round((v * (m - 1)) / n)) / tenths;
    };
    const keys = ["hr", "sbp", "dbp", "spo2", "rr", "temp"] as const;
    return Array.from({ length: n }, (_, i) => Object.fromEntries(keys.filter((k) => total[k] !== undefined).map((k) => [k, share(k, i + 1)])) as LiveVitals);
}
const isNoChange = (v: LiveVitals) => (["hr", "sbp", "dbp", "spo2", "rr", "temp"] as const).every((k) => !v[k]);

function infusionRules(t: LiveTreatment): EventRule[] {
    if (!t.infusion || !t.effect) return [];
    const n = t.infusion.over_minutes;
    const shares = minuteShares(t.effect, n);
    const out: EventRule[] = [];
    for (let m = 1; m <= n; m++) {
        const minute = shares[m - 1];
        if (isNoChange(minute)) continue;
        out.push({
            id: `live_infusion_${t.id}_${m}`,
            when: {
                all: [
                    { minutes_since_flag: { flag: given(t.id), gte: m } },
                    { not: { minutes_since_flag: { flag: given(t.id), gte: m + 1 } } },
                    { flag: STABILISED, is: false },
                    ...(t.infusion.while ? [compileCondition(t.infusion.while)] : []),
                ],
            },
            transition: "unchanged",
            keeps_state: true,
            physiological_changes: effectOf(minute),
            narrative: null,
        });
    }
    return out;
}

// ── Rate-controlled fluid ───────────────────────────────────────────────────

/** Set when a rate was kept running long enough to overload the patient. */
const overloadFlag = (treatmentId: string, level: string) => `fluid_${treatmentId}_overload_${level}`;
/** The engine's description of a fluid: for the tray, and for the condition that knows when its volume is in. */
const fluidDef = (f: LiveFluid): FluidInfusionDef => ({
    levels: f.levels.map((l) => ({ id: l.id, label: l.label, ml_per_h: l.ml_per_h })),
    ...(f.volume_ml !== undefined ? { volume_ml: f.volume_ml } : {}),
});
/** Stopped, or finished by itself. */
const fluidEnded = (t: LiveTreatment): RuleCondition => ({
    any: [{ flag: fluidStoppedFlag(t.id), is: true }, ...(t.fluid?.volume_ml !== undefined ? [{ flag: fluidCompletedFlag(t.id), is: true }] : [])],
});
/** Running at the ladder's rate i: it reached that rate, has gone no lower, and has not ended. */
function runningAt(t: LiveTreatment, i: number): RuleCondition {
    const levels = (t.fluid as LiveFluid).levels;
    return { all: [{ flag: fluidLevelFlag(t.id, levels[i].id), is: true }, ...levels.slice(i + 1).map((l) => ({ flag: fluidLevelFlag(t.id, l.id), is: false })), { not: fluidEnded(t) }] };
}

/** How a student who gives a fluid as planned starts it: at the rate its unconditional start names, else the first. */
export function fluidStartAction(t: LiveTreatment): string {
    const f = t.fluid as LiveFluid;
    return fluidAction(t.id, f.start?.find((r) => !r.when)?.level ?? f.levels[0].id);
}

/**
 * What a fluid does over time: each rate's effect spread minute by minute while it runs at that rate (and only before
 * stabilisation, as an infusion), the overload of a rate kept on too long, and finishing once its volume is in.
 */
function fluidRules(t: LiveTreatment): EventRule[] {
    const f = t.fluid;
    if (!f) return [];
    const out: EventRule[] = [];
    f.levels.forEach((l, i) => {
        const flag = fluidLevelFlag(t.id, l.id);
        if (l.over_minutes !== undefined && l.effect) {
            const shares = minuteShares(l.effect, l.over_minutes);
            for (let m = 1; m <= l.over_minutes; m++) {
                if (isNoChange(shares[m - 1])) continue;
                out.push({
                    id: `live_infusion_${t.id}__${l.id}_${m}`,
                    when: {
                        all: [
                            { minutes_since_flag: { flag, gte: m } },
                            { not: { minutes_since_flag: { flag, gte: m + 1 } } },
                            runningAt(t, i),
                            { flag: STABILISED, is: false },
                            ...(l.while ? [compileCondition(l.while)] : []),
                        ],
                    },
                    transition: "unchanged",
                    keeps_state: true,
                    physiological_changes: effectOf(shares[m - 1]),
                    narrative: null,
                });
            }
        }
        if (l.overload) {
            out.push({
                id: `live_fluid_${t.id}_overload_${l.id}`,
                when: { all: [{ minutes_since_flag: { flag, gte: l.overload.after_minutes } }, runningAt(t, i), ...(l.overload.when ? [compileCondition(l.overload.when)] : [])] },
                transition: "unchanged",
                keeps_state: true,
                physiological_changes: effectOf(l.overload.effect),
                narrative: l.overload.nurse_says,
                sets: { [overloadFlag(t.id, l.id)]: true },
            });
        }
    });
    if (f.volume_ml !== undefined) {
        out.push({
            id: `live_fluid_${t.id}_completed`,
            when: { all: [{ flag: given(t.id), is: true }, { not: fluidEnded(t) }, { fluid_delivered: { ...fluidSchedule(t.id, fluidDef(f)), gte_ml: f.volume_ml } }] },
            transition: "unchanged",
            keeps_state: true,
            sets: { [fluidCompletedFlag(t.id)]: true },
            narrative: f.completed_says ?? `The infusion has finished: all ${f.volume_ml} mL has run in.`,
        });
    }
    return out;
}

/**
 * A fluid on the tray. "<id>@<rate>" starts it at that rate (behind the treatment's own prerequisites and availability,
 * with its responses), or once it runs steps it down to that rate, one rate at a time; "<id>@stop" stops it. Anything
 * else is refused and changes nothing.
 */
function fluidConsequences(t: LiveTreatment, plan: LivePlan): ActionConsequence[] {
    const f = t.fluid as LiveFluid;
    const started: RuleCondition = { flag: given(t.id), is: true };
    const stopped: RuleCondition = { flag: fluidStoppedFlag(t.id), is: true };
    const completed: RuleCondition | null = f.volume_ml !== undefined ? { flag: fluidCompletedFlag(t.id), is: true } : null;
    const ended = (action: string): ActionConsequence[] => [
        { action, when: { all: [started, stopped] }, trajectory_note: REFUSED.fluid("the infusion has been stopped.") },
        ...(completed ? [{ action, when: { all: [started, completed] }, trajectory_note: REFUSED.fluid("the infusion has finished.") }] : []),
    ];
    const effectAtOnce = (l: LiveFluidLevel) => (l.over_minutes === undefined && l.effect ? { physiological_changes: effectOf(l.effect) } : {});
    // The treatment itself has no plain "Give": a fluid is started at a rate.
    const out: ActionConsequence[] = [{ action: t.id, trajectory_note: REFUSED.fluid("choose the rate to start it at.") }];
    f.levels.forEach((l, i) => {
        const action = fluidAction(t.id, l.id);
        const usual = {
            changes: { ...(l.over_minutes === undefined ? effectOf(l.effect) : {}), ...(t.rhythm ? { rhythm: t.rhythm } : {}), ...(t.consciousness ? { consciousness: t.consciousness } : {}) },
            says: t.says,
        };
        const start = doseVariants(t, 1, [{ flag: given(t.id), is: false }], usual).map((c) => ({
            ...c,
            sets: { ...c.sets, [fluidLevelFlag(t.id, l.id)]: true },
            trajectory_note: `Started at ${l.label}. ${c.trajectory_note}`,
        }));
        const running: ActionConsequence[] = f.levels.map((cur, j) => {
            const when: RuleCondition = { all: [started, runningAt(t, j)] };
            if (j === i - 1) return { action, when, sets: { [fluidLevelFlag(t.id, l.id)]: true }, ...effectAtOnce(l), trajectory_note: l.says ?? `The rate is reduced to ${l.label}.` };
            const says =
                j === i
                    ? `it is already running at ${cur.label}.`
                    : j > i
                      ? `it is running at ${cur.label}, below this rate: the rate only comes down, one step at a time.`
                      : `the rate comes down one step at a time: it is running at ${cur.label}, so the next step is ${f.levels[j + 1].label}.`;
            return { action, when, trajectory_note: REFUSED.fluid(says) };
        });
        out.push(...stateConsequences(t, plan, [...start, ...running, ...ended(action)]).map((c) => ({ ...c, action })));
    });
    const stop = fluidStopAction(t.id);
    out.push(
        { action: stop, when: { flag: given(t.id), is: false }, trajectory_note: REFUSED.fluid("it is not running.") },
        { action: stop, when: { all: [started, { not: fluidEnded(t) }] }, sets: { [fluidStoppedFlag(t.id)]: true }, trajectory_note: f.stop_says ?? "The infusion is stopped." },
        ...ended(stop),
    );
    return out;
}

/** The rules a treatment's state fields need: its infusion's shares, and the record-only rules (available, required, doses falling due). */
function stateRules(t: LiveTreatment): EventRule[] {
    const out: EventRule[] = [...infusionRules(t), ...fluidRules(t)];
    if (t.available_when) out.push(latch(`live_available_${t.id}`, compileCondition(t.available_when), availableFlag(t.id)));
    if (t.required_when) out.push(latch(`live_required_${t.id}`, compileCondition(t.required_when), requiredFlag(t.id)));
    if (isStateGated(t)) {
        const gate = compileCondition(t.repeat_only_while);
        for (let n = 2; n <= Math.max(1, t.doses_required ?? 1); n++) {
            const due: RuleCondition =
                (t.min_interval_minutes ?? 0) > 0 ? { minutes_since_flag: { flag: doseFlag(t.id, n - 1), gte: t.min_interval_minutes as number } } : { flag: doseFlag(t.id, n - 1), is: true };
            // Indicated the first moment the dose is due and the condition holds: at the due point, or later if the
            // patient worsens again after it was found not needed.
            out.push(latch(`live_indicated_${t.id}_${n}`, { all: [due, gate] }, indicatedFlag(t.id, n)));
            const notNeeded: RuleCondition = { all: [due, { not: gate }, { flag: indicatedFlag(t.id, n), is: false }, { flag: doseFlag(t.id, n), is: false }] };
            out.push(latch(`live_notneeded_${t.id}_${n}`, n > 2 ? { any: [notNeeded, { flag: notNeededFlag(t.id, n - 1), is: true }] } : notNeeded, notNeededFlag(t.id, n)));
            // Indicated, not given, and then the patient reached the end point anyway (another treatment did it).
            out.push(latch(`live_resolved_${t.id}_${n}`, { all: [{ flag: indicatedFlag(t.id, n), is: true }, { not: gate }, { flag: doseFlag(t.id, n), is: false }] }, resolvedFlag(t.id, n)));
        }
    }
    return out;
}

/**
 * The consequences of one valid dose. With no responses: the treatment's usual effect, exactly as before. With
 * responses: the first that applies in the patient's current state, else the usual effect.
 */
function doseVariants(t: LiveTreatment, n: number, valid: RuleCondition[], usual: { changes: PhysiologicalChanges; says: string }): ActionConsequence[] {
    const harm = t.role === "harmful" ? { safety_penalty: true } : {};
    const sets = { [doseFlag(t.id, n)]: true };
    const responses = (t.responses ?? []).filter((r) => r.dose === undefined || r.dose === n);
    if (responses.length === 0) return [{ action: t.id, when: { all: valid }, sets, physiological_changes: usual.changes, trajectory_note: usual.says, ...harm }];
    const out: ActionConsequence[] = [];
    const earlier: RuleCondition[] = [];
    for (const r of responses) {
        const cond = r.when ? compileCondition(r.when) : null;
        out.push({
            action: t.id,
            when: { all: [...valid, ...earlier.map((c) => ({ not: c })), ...(cond ? [cond] : [])] },
            sets: { ...sets, ...findingSets(r.findings) },
            physiological_changes: { ...effectOf(r.effect), ...(r.rhythm ? { rhythm: r.rhythm } : {}), ...(r.consciousness ? { consciousness: r.consciousness } : {}) },
            trajectory_note: r.says,
            ...harm,
        });
        if (!cond) return out; // it always applies, so nothing after it can
        earlier.push(cond);
    }
    out.push({ action: t.id, when: { all: [...valid, ...earlier.map((c) => ({ not: c }))] }, sets, physiological_changes: usual.changes, trajectory_note: usual.says, ...harm });
    return out;
}

/** Everything a treatment that uses state fields does on the tray. */
function stateConsequences(t: LiveTreatment, plan: LivePlan, own?: ActionConsequence[]): ActionConsequence[] {
    // An infusion's effect arrives minute by minute (infusionRules); starting it changes only rhythm or consciousness.
    const usual = { changes: { ...(t.infusion ? {} : effectOf(t.effect)), ...(t.rhythm ? { rhythm: t.rhythm } : {}), ...(t.consciousness ? { consciousness: t.consciousness } : {}) }, says: t.says };
    // `own`: what the treatment does once its gates are open, when it is not the usual one dose or repeat doses (a fluid's rates).
    const base =
        own ??
        (isRepeatable(t)
            ? repeatConsequences(t, plan.reassessment?.label)
            : [...doseVariants(t, 1, [{ flag: given(t.id), is: false }], usual), { action: t.id, when: { flag: given(t.id), is: true }, trajectory_note: "Already given. No further change." }]);
    const guard = (open: RuleCondition, cs: ActionConsequence[]) => cs.map((c) => ({ ...c, when: c.when ? { all: [open, c.when] } : open }));
    // Requirements in order: the first one not met is the reason given; once all are met, everything as usual.
    let guarded = base;
    const reqs = (t.requires ?? []).map((r) => ({ cond: compileCondition(r.when), says: r.says }));
    if (reqs.length > 0) {
        // Once every dose is in, the student hears "already given" or "all doses given", never a missing prerequisite.
        const done: RuleCondition = { flag: doseFlag(t.id, t.max_doses ?? 1), is: true };
        const refusals: ActionConsequence[] = reqs.map((r, i) => ({ action: t.id, when: { all: [{ not: done }, ...reqs.slice(0, i).map((x) => x.cond), { not: r.cond }] }, trajectory_note: REFUSED.needs_first(r.says) }));
        guarded = [...refusals, ...guard({ any: [done, { all: reqs.map((r) => r.cond) }] }, base)];
    }
    if (!t.available_when) return guarded;
    // Not yet available: refused, with no effect. Once available, everything as usual.
    const open: RuleCondition = { flag: availableFlag(t.id), is: true };
    return [{ action: t.id, when: { flag: availableFlag(t.id), is: false }, trajectory_note: REFUSED.unavailable() }, ...guard(open, guarded)];
}

/** Every refusal starts with this, so the tray can tell a refused dose from a given one. */
export const REFUSED_PREFIX = "Not given:";
/** A plan's own words for a refusal, with the prefix the tray relies on. */
const refusal = (says: string) => (says.startsWith(REFUSED_PREFIX) ? says : `${REFUSED_PREFIX} ${says}`);
/** Why a further dose was refused, in the words the student sees. */
export const REFUSED = {
    too_soon: (t: LiveTreatment) => `Not given: too soon for another dose. Wait at least ${t.min_interval_minutes} minutes after the last dose, reassess, then give it if it is still needed.`,
    not_indicated: () => "Not given: another dose is not indicated now, because the patient has stopped deteriorating.",
    limit: (t: LiveTreatment) => `Not given: all ${t.max_doses} doses have already been given.`,
    unavailable: () => "Not given: not indicated at the moment.",
    not_reassessed: (label: string) => `Not given: reassess first (${label}) to see whether another dose is needed.`,
    needs_first: (says: string) => refusal(says),
    /** A fluid's rate could not be set like that (not running, already at that rate, more than one step, stopped). */
    fluid: (says: string) => refusal(says),
} as const;
export type RefusalReason = keyof typeof REFUSED;

/** The engine's consequences for one dose-by-dose treatment: a valid dose, a refused one, and the limit. */
function repeatConsequences(t: LiveTreatment, reassessLabel = ""): ActionConsequence[] {
    const max = t.max_doses ?? 1;
    const effectFor = (n: number) => (t.effect_per_dose ? t.effect_per_dose[Math.min(n, t.effect_per_dose.length) - 1] : t.effect);
    const saysFor = (n: number) => (t.says_per_dose ? t.says_per_dose[Math.min(n, t.says_per_dose.length) - 1] : t.says);
    const out: ActionConsequence[] = [];
    for (let n = 1; n <= max; n++) {
        const due: RuleCondition[] = [{ flag: doseFlag(t.id, n), is: false }];
        if (n > 1) due.unshift({ flag: doseFlag(t.id, n - 1), is: true });
        const intervalOk: RuleCondition | null = n > 1 && (t.min_interval_minutes ?? 0) > 0 ? { minutes_since_flag: { flag: doseFlag(t.id, n - 1), gte: t.min_interval_minutes as number } } : null;
        const gate = isStateGated(t) ? compileCondition(t.repeat_only_while) : null;
        const indicated: RuleCondition | null = n === 1 ? null : gate ?? (t.repeat_only_while === "not_stabilised" ? { flag: STABILISED, is: false } : null);
        // A further dose that needs a reassessment since the dose before it.
        const reassessed: RuleCondition | null = n > 1 && t.reassess_before_repeat ? { flag: reassessedFlag(t.id), is: true } : null;
        const valid = [...due, ...(intervalOk ? [intervalOk] : []), ...(reassessed ? [reassessed] : []), ...(indicated ? [indicated] : [])];
        const usual = { changes: { ...effectOf(effectFor(n)), ...(t.rhythm ? { rhythm: t.rhythm } : {}), ...(t.consciousness ? { consciousness: t.consciousness } : {}) }, says: saysFor(n) };
        out.push(...doseVariants(t, n, valid, usual));
        // Refusals, most basic reason first; each is exclusive of the valid dose and of the others.
        if (intervalOk) out.push({ action: t.id, when: { all: [...due, { not: intervalOk }] }, trajectory_note: REFUSED.too_soon(t) });
        if (reassessed) out.push({ action: t.id, when: { all: [...due, ...(intervalOk ? [intervalOk] : []), { flag: reassessedFlag(t.id), is: false }] }, trajectory_note: REFUSED.not_reassessed(reassessLabel) });
        if (indicated) {
            const notNow = gate ? { not: gate } : { flag: STABILISED, is: true };
            const said = gate && t.not_indicated_says ? refusal(t.not_indicated_says) : REFUSED.not_indicated();
            out.push({ action: t.id, when: { all: [...due, ...(intervalOk ? [intervalOk] : []), ...(reassessed ? [reassessed] : []), notNow] }, trajectory_note: said });
        }
    }
    out.push({ action: t.id, when: { flag: doseFlag(t.id, max), is: true }, trajectory_note: REFUSED.limit(t) });
    // Each valid dose uses up the reassessment: the next one needs a fresh one.
    if (!t.reassess_before_repeat) return out;
    return out.map((c) => (c.sets && Object.entries(c.sets).some(([f, v]) => v && f.startsWith(given(t.id))) ? { ...c, sets: { ...c.sets, [reassessedFlag(t.id)]: false } } : c));
}

/** The reassessment on the tray: what each check finds right now, in order; it changes nothing but what it records. */
function reassessmentConsequences(plan: LivePlan): ActionConsequence[] {
    const r = plan.reassessment;
    if (!r) return [];
    const needing = plan.treatments.filter((t) => t.reassess_before_repeat);
    return [
        { action: REASSESS_ID, sets: Object.fromEntries(needing.map((t) => [reassessedFlag(t.id), true])), trajectory_note: "Reassessment:" },
        ...r.checks.flatMap((c) => {
            const cond = compileCondition(c.when);
            return [
                { action: REASSESS_ID, when: cond, trajectory_note: c.says },
                ...(c.otherwise ? [{ action: REASSESS_ID, when: { not: cond }, trajectory_note: c.otherwise }] : []),
            ];
        }),
    ];
}
/** The engine's form of a plan's reassessment report: findings carry the flag the engine reads and the label to show. */
function compileReport(plan: LivePlan): ReassessmentReport {
    const r = plan.reassessment?.report ?? {};
    return {
        ...(r.vitals?.length ? { vitals: r.vitals } : {}),
        ...(r.consciousness ? { consciousness: true } : {}),
        ...(r.findings?.length ? { findings: r.findings.map((id) => ({ id, flag: findingFlag(id), label: plan.findings?.find((f) => f.id === id)?.label ?? id })) } : {}),
    };
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
        if (t.available_when) flags[availableFlag(t.id)] = false;
        if (t.required_when) flags[requiredFlag(t.id)] = false;
        if (t.reassess_before_repeat) flags[reassessedFlag(t.id)] = false;
        if (isStateGated(t)) for (let n = 2; n <= Math.max(1, t.doses_required ?? 1); n++) Object.assign(flags, { [indicatedFlag(t.id, n)]: false, [notNeededFlag(t.id, n)]: false, [resolvedFlag(t.id, n)]: false });
        if (t.fluid) {
            for (const l of t.fluid.levels) {
                flags[fluidLevelFlag(t.id, l.id)] = false;
                if (l.overload) flags[overloadFlag(t.id, l.id)] = false;
            }
            flags[fluidStoppedFlag(t.id)] = false;
            if (t.fluid.volume_ml !== undefined) flags[fluidCompletedFlag(t.id)] = false;
        }
    }
    for (const f of plan.findings ?? []) flags[findingFlag(f.id)] = f.present;
    const referenced = stagesReferenced(planConditions(plan));
    for (const id of referenced) flags[reachedFlag(id)] = false;

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
            // Only in a plan whose conditions or findings need them, so every other plan compiles exactly as before.
            ...(referenced.has(s.id) || s.findings ? { sets: { ...(referenced.has(s.id) ? { [reachedFlag(s.id)]: true } : {}), ...findingSets(s.findings) } } : {}),
        });
        untreated = after;
    }

    const r = plan.recovery;
    const find = (id: string) => plan.treatments.find((t) => t.id === id);
    const usual = plan.stabilised_by.flatMap((id) => stabilisingConditions(find(id), id));
    const alternatives = plan.or_stabilised_by ?? [];
    // Only a plan with another path, or a usual path that can stop working, needs the longer form.
    const endPoints: RuleCondition[] = plan.end_points ? [compileCondition(plan.end_points)] : [];
    const stops: RuleCondition =
        alternatives.length === 0 && !plan.stabilised_by_while
            ? { all: [{ flag: STABILISED, is: false }, ...usual, ...endPoints] }
            : {
                  all: [
                      { flag: STABILISED, is: false },
                      ...endPoints,
                      {
                          any: [
                              { all: [...usual, ...(plan.stabilised_by_while ? [compileCondition(plan.stabilised_by_while)] : [])] },
                              ...alternatives.map((path) => ({ all: [...path.treatments.flatMap((id) => stabilisingConditions(find(id), id)), ...(path.when ? [compileCondition(path.when)] : [])] })),
                          ],
                      },
                  ],
              };
    const rules: EventRule[] = [
        // First, so that at the instant the last stabilising treatment goes in, it wins over a step that is also due.
        {
            id: "live_stabilised",
            when: stops,
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
            ...(r.findings ? { sets: findingSets(r.findings) } : {}),
        },
        // Record-only rules (a treatment becoming available or required, a further dose falling due) before the
        // untreated steps, so a decision at an instant is made on the patient as they were at that instant.
        ...plan.treatments.flatMap(stateRules),
        ...stageRules,
    ];

    // ── the tray: a treatment acts once; giving it again changes nothing. A treatment with repeat doses acts once per
    //    valid dose instead (repeatConsequences).
    const consequences: ActionConsequence[] = [...reassessmentConsequences(plan), ...plan.treatments.flatMap((t) => t.fluid ? fluidConsequences(t, plan) : usesState(t) ? stateConsequences(t, plan) : isRepeatable(t) ? repeatConsequences(t) : [
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
    ])];

    const own: CustomInterventionDef[] = [
        // A fluid is always the case's own entry, so the tray can show its rates.
        ...plan.treatments.filter((t) => !isSharedTreatment(t.id) || t.fluid).map((t) => ({ id: t.id, label: t.label, detail: t.detail, group: t.group, ...(t.fluid ? { fluid: fluidDef(t.fluid) } : {}) })),
        ...(plan.reassessment ? [{ id: REASSESS_ID, label: plan.reassessment.label, detail: plan.reassessment.detail, group: "other" as const, ...(plan.reassessment.report ? { report: compileReport(plan) } : {}) }] : []),
    ];
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

/** Does this case have a plan that only an admin would currently see run: one still proposed, or one an open release blocker keeps from students? */
export function hasProposedLivePlan(caseData: unknown): boolean {
    const plan = (caseData as { live_plan?: unknown } | null)?.live_plan;
    return isLivePlan(plan) && (plan.status === "proposed" || openReleaseBlockers(plan).length > 0);
}

// ── Scoring what was done at the bedside ────────────────────────────────────
// The ordinary scoring (history, investigations, diagnosis, written plan) knows nothing about the tray or the clock.
// This scores what a live case adds: were the essential treatments given, and in time; was anything harmful given.

/**
 * not_needed: only sometimes required, and this patient never needed it. not_due: it became required so near the end
 * that its window was still open when the encounter ended. Neither scores nor costs.
 */
export type BedsideStatus = "on_time" | "late" | "missed" | "not_needed" | "not_due";

export interface BedsideItem {
    id: string;
    label: string;
    status: BedsideStatus;
    /** When it was given (minutes after arrival), if it was. */
    at_minutes: number | null;
    within_minutes: number;
    why?: string;
    /** For a treatment that needs several doses: each required dose, when it was validly given, and how it scored. */
    doses?: Array<{ dose: number; at_minutes: number | null; status: BedsideStatus }>;
    /** For a treatment that is only sometimes required: when it became required. Its window counts from here. */
    required_at_minutes?: number;
    /** For a fluid's rate item: the starting rate, how long each rate ran before the next step, and the stop. */
    fluid_steps?: FluidStep[];
}

/** early: stepped down (or stopped) before the rate's time was up. wrong: started at a rate the patient's state did not call for. */
export type FluidStepStatus = "on_time" | "early" | "late" | "missed" | "not_due" | "wrong";

export interface FluidStep {
    label: string;
    /** When the step was taken (minutes after arrival), if it was. */
    at_minutes: number | null;
    status: FluidStepStatus;
    /** For a wrong starting rate: the right one. */
    expected?: string;
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
        /** In a plan with other paths: the one that stabilised the patient (the usual one is "usual"). */
        path?: string;
    };
}

/** Points off for each different harmful treatment given. */
export const HARMFUL_TREATMENT_PENALTY = 15;
/** How much of the final score is the bedside, in a live case; the rest is the ordinary scoring. */
export const BEDSIDE_SHARE = 0.4;

/**
 * `endMinutes`: when the encounter ended. By default the last event in the log, which on the server is the student's
 * submission; never later than the plan's time limit. Only a window still open at the end depends on it.
 */
export function scoreBedside(config: SimulationCaseConfig, plan: LivePlan, events: readonly ClinicalEvent[], endMinutes?: number): BedsideScore {
    const lastEvent = events.reduce((m, e) => Math.max(m, e.timestamp), 0) / 60;
    const end = Math.min(plan.time_limit_minutes, endMinutes ?? lastEvent);
    const firstGiven = new Map<string, number>();
    for (const e of events) {
        if (e.type === "INTERVENTION_GIVEN" && !firstGiven.has(e.action)) firstGiven.set(e.action, e.timestamp / 60);
    }
    const minutes = (id: string) => (firstGiven.has(id) ? Math.round((firstGiven.get(id) as number) * 10) / 10 : null);
    const final = PatientState.fromEvents(config, events);
    const credit = new Map<string, number>();
    // A treatment that uses state fields can be refused (not yet available), so when it was given is when the engine
    // accepted it, not when it was first tried. Every other treatment is read from the log exactly as before.
    const givenAt = (t: LiveTreatment) => {
        if (!usesState(t)) return minutes(t.id);
        const setAt = final.flagSetAt[given(t.id)];
        return setAt === undefined ? null : toMinutes(setAt);
    };

    const scoreOne = (t: LiveTreatment): BedsideItem => {
        const within = t.within_minutes ?? plan.critical_window_minutes;
        if (t.required_when) return scoreWhenRequired(t, within, givenAt(t), final.flagSetAt, end, credit);
        if (isRepeatable(t)) return scoreDoses(t, within, final, end, credit);
        const at = givenAt(t);
        const item: BedsideItem = { id: t.id, label: t.label, status: at === null ? "missed" : at <= within ? "on_time" : "late", at_minutes: at, within_minutes: within, ...(t.why ? { why: t.why } : {}) };
        credit.set(t.id, item.status === "on_time" ? 1 : item.status === "late" ? 0.5 : 0);
        return item;
    };
    // A fluid that was started is also scored on how its rate was adjusted, as an item of its own.
    const items: BedsideItem[] = plan.treatments
        .filter((t) => t.role === "essential")
        .flatMap((t) => {
            const item = scoreOne(t);
            const rate = t.fluid ? scoreFluidRate(config, plan, t, events, final, end, credit) : null;
            return rate ? [item, rate] : [item];
        });
    const harmful = [
        ...plan.treatments
            .filter((t) => t.role === "harmful" && givenAt(t) !== null)
            .map((t) => ({ id: t.id, label: t.label, at_minutes: givenAt(t) as number, ...(t.why ? { why: t.why } : {}) })),
        // A rate kept on until it overloaded the patient is harm, whoever's treatment it was.
        ...plan.treatments.flatMap((t) =>
            (t.fluid?.levels ?? [])
                .filter((l) => l.overload && final.flagSetAt[overloadFlag(t.id, l.id)] !== undefined)
                .map((l) => ({ id: `${t.id}:overload_${l.id}`, label: `Fluid overload: ${t.label} kept at ${l.label}`, at_minutes: toMinutes(final.flagSetAt[overloadFlag(t.id, l.id)]), ...(l.overload?.why ? { why: l.overload.why } : {}) }))
        ),
    ];

    // A treatment this patient never needed is left out altogether: no credit, and nothing lost.
    const counted = items.filter((i) => credit.has(i.id));
    const total = counted.reduce((sum, i) => sum + (credit.get(i.id) as number), 0);
    const raw = counted.length > 0 ? (100 * total) / counted.length : 100;
    const score = Math.max(0, Math.min(100, Math.round(raw - HARMFUL_TREATMENT_PENALTY * harmful.length)));

    const reached = [...plan.stages].reverse().find((s) => final.firedRules.has(`live_stage_${s.id}`));
    const refused = refusedDoses(config, plan, events);
    return {
        score,
        items,
        harmful,
        outcome: {
            stabilised: final.flags[STABILISED] === true,
            recovered: final.firedRules.has("live_recovery"),
            worst_stage: reached?.name ?? null,
            ...(plan.or_stabilised_by?.length ? stabilisingPath(config, plan, events) : {}),
        },
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
function scoreDoses(t: LiveTreatment, within: number, final: PatientState, end: number, credit: Map<string, number>): BedsideItem {
    const required = Math.max(1, t.doses_required ?? 1);
    const gated = isStateGated(t);
    const at = (flag: string) => (final.flagSetAt[flag] === undefined ? null : toMinutes(final.flagSetAt[flag]));
    // After a state-gated dose becomes indicated, the student has as long as the plan allows after the interval.
    const grace = t.repeat_within_minutes === undefined ? Infinity : t.repeat_within_minutes - (t.min_interval_minutes ?? 0);
    const doses: NonNullable<BedsideItem["doses"]> = [];
    let previous: number | null = null;
    for (let n = 1; n <= required; n++) {
        const given = at(doseFlag(t.id, n));
        let status: BedsideStatus;
        if (n === 1) status = given === null ? "missed" : given <= within ? "on_time" : "late";
        else if (!gated) {
            status = given === null ? "missed" : t.repeat_within_minutes === undefined || previous === null || given - previous <= t.repeat_within_minutes ? "on_time" : "late";
        } else {
            // A state-gated further dose: required from the moment it was indicated, and only while the patient needed it.
            const indicated = at(indicatedFlag(t.id, n));
            const deadline = indicated === null ? null : indicated + grace;
            if (given !== null) {
                const inTime = (previous !== null && t.repeat_within_minutes !== undefined && given - previous <= t.repeat_within_minutes) || (deadline !== null && given <= deadline) || t.repeat_within_minutes === undefined;
                status = inTime ? "on_time" : "late";
            } else if (indicated === null) status = final.flags[notNeededFlag(t.id, n)] === true ? "not_needed" : "not_due";
            else {
                const resolved = at(resolvedFlag(t.id, n));
                status = resolved !== null && resolved <= (deadline as number) ? "not_needed" : (deadline as number) > end ? "not_due" : "missed";
            }
        }
        doses.push({ dose: n, at_minutes: given, status });
        previous = given;
    }
    const needed = doses.filter((d) => d.status !== "not_needed" && d.status !== "not_due");
    credit.set(t.id, needed.reduce((sum, d) => sum + (d.status === "on_time" ? 1 : d.status === "late" ? 0.5 : 0), 0) / needed.length);
    const status = needed.every((d) => d.status === "on_time") ? "on_time" : needed.every((d) => d.status === "missed") ? "missed" : "late";
    return { id: t.id, label: t.label, status, at_minutes: doses[0].at_minutes, within_minutes: within, ...(t.why ? { why: t.why } : {}), ...(required > 1 ? { doses } : {}) };
}

/**
 * A treatment that is only sometimes required. Never required: not_needed, whether or not it was given. Required: on
 * time if given within its window of the moment it became required (or before, once it was available), late after;
 * not given with its window still open when the encounter ended: not_due.
 */
function scoreWhenRequired(t: LiveTreatment, within: number, at: number | null, flagSetAt: Readonly<Record<string, number>>, end: number, credit: Map<string, number>): BedsideItem {
    const setAt = flagSetAt[requiredFlag(t.id)];
    const base = { id: t.id, label: t.label, at_minutes: at, within_minutes: within, ...(t.why ? { why: t.why } : {}) };
    if (setAt === undefined) return { ...base, status: "not_needed" };
    const from = toMinutes(setAt);
    if (at === null && from + within > end) return { ...base, status: "not_due", required_at_minutes: from };
    const status: BedsideStatus = at === null ? "missed" : at <= from + within ? "on_time" : "late";
    credit.set(t.id, status === "on_time" ? 1 : status === "late" ? 0.5 : 0);
    return { ...base, status, required_at_minutes: from };
}

const FLUID_CREDIT: Record<FluidStepStatus, number | null> = { on_time: 1, early: 0.5, late: 0.5, wrong: 0, missed: 0, not_due: null };

/** "1 to 2 h", "60 to 90 min", "1 h". */
function span(w: { at_least: number; at_most: number }): string {
    const hours = w.at_least % 60 === 0 && w.at_most % 60 === 0;
    const f = (n: number) => (hours ? String(n / 60) : String(n));
    return `${w.at_least === w.at_most ? f(w.at_least) : `${f(w.at_least)} to ${f(w.at_most)}`} ${hours ? "h" : "min"}`;
}

/** The rate a fluid should have been started at: its start rules, read on the patient as they were when it was started. */
function expectedStartLevel(config: SimulationCaseConfig, t: LiveTreatment, events: readonly ClinicalEvent[], startedAt: number): LiveFluidLevel {
    const f = t.fluid as LiveFluid;
    const i = events.findIndex((e) => e.type === "INTERVENTION_GIVEN" && e.timestamp === startedAt && parseFluidAction(e.action)?.id === t.id && !e.consequence.startsWith(REFUSED_PREFIX));
    const ctx = PatientState.fromEvents(config, events.slice(0, Math.max(0, i))).context(startedAt);
    const rule = f.start?.find((r) => !r.when || evaluateCondition(compileCondition(r.when), ctx));
    return f.levels.find((l) => l.id === rule?.level) ?? f.levels[0];
}

/**
 * How a fluid's rate was adjusted, once it was started: the starting rate against the plan's start rules, how long each
 * rate ran before the next step against its hold time, and the stop against the plan's stop window. On time 1, early or
 * late 0.5, the wrong starting rate or a rate kept past its time to the end 0; a step whose time was still open when the
 * encounter ended does not count. A fluid that never started has nothing to adjust (its own item is missed).
 */
function scoreFluidRate(config: SimulationCaseConfig, plan: LivePlan, t: LiveTreatment, events: readonly ClinicalEvent[], final: PatientState, end: number, credit: Map<string, number>): BedsideItem | null {
    const f = t.fluid as LiveFluid;
    const setAt = (flag: string): number | undefined => final.flagSetAt[flag];
    const startedAt = setAt(given(t.id));
    if (startedAt === undefined || !(f.start?.length || f.stop || f.levels.some((l) => l.hold_minutes))) return null;
    const runs = f.levels.flatMap((l) => (setAt(fluidLevelFlag(t.id, l.id)) === undefined ? [] : [{ l, at: setAt(fluidLevelFlag(t.id, l.id)) as number }]));
    const stoppedAt = setAt(fluidStoppedFlag(t.id));
    const finishedAt = f.volume_ml !== undefined ? setAt(fluidCompletedFlag(t.id)) : undefined;
    const endedAt = stoppedAt ?? finishedAt;
    const timed = (from: number, to: number | undefined, w: { at_least: number; at_most: number }): FluidStepStatus => {
        if (to === undefined) return end - from / 60 > w.at_most ? "missed" : "not_due";
        const ran = (to - from) / 60;
        return ran < w.at_least ? "early" : ran > w.at_most ? "late" : "on_time";
    };
    const steps: FluidStep[] = [];
    if (f.start?.length && runs[0]) {
        const expected = expectedStartLevel(config, t, events, startedAt);
        const first = runs[0].l;
        steps.push({ label: `Started at ${first.label}`, at_minutes: toMinutes(startedAt), status: expected.id === first.id ? "on_time" : "wrong", ...(expected.id !== first.id ? { expected: expected.label } : {}) });
    }
    runs.forEach((r, k) => {
        if (!r.l.hold_minutes) return;
        const exit = runs[k + 1]?.at ?? endedAt;
        steps.push({ label: `${r.l.label} for ${span(r.l.hold_minutes)}`, at_minutes: exit === undefined ? null : toMinutes(exit), status: timed(r.at, exit, r.l.hold_minutes) });
    });
    // A fluid that finished by itself needed no stopping.
    if (f.stop && finishedAt === undefined) {
        steps.push({ label: `Stopped ${span(f.stop)} after it was started`, at_minutes: stoppedAt === undefined ? null : toMinutes(stoppedAt), status: timed(startedAt, stoppedAt, f.stop) });
    }
    const counted = steps.filter((x) => FLUID_CREDIT[x.status] !== null);
    const item = { id: `${t.id}:rate`, label: `${t.label}: rate adjusted to the response`, at_minutes: toMinutes(startedAt), within_minutes: t.within_minutes ?? plan.critical_window_minutes, fluid_steps: steps };
    if (counted.length === 0) return { ...item, status: "not_due" };
    credit.set(item.id, counted.reduce((sum, x) => sum + (FLUID_CREDIT[x.status] as number), 0) / counted.length);
    const status: BedsideStatus = counted.every((x) => x.status === "on_time") ? "on_time" : counted.every((x) => x.status === "missed" || x.status === "wrong") ? "missed" : "late";
    return { ...item, status };
}

/** Which path stopped the deterioration: the conditions of each, on the patient just before it happened. */
function stabilisingPath(config: SimulationCaseConfig, plan: LivePlan, events: readonly ClinicalEvent[]): { path?: string } {
    const i = events.findIndex((e) => e.type === "STATE_TRANSITION" && e.trigger === "live_stabilised");
    if (i < 0) return {};
    const before = PatientState.fromEvents(config, events.slice(0, i));
    const ctx = before.context(events[i].timestamp);
    const find = (id: string) => plan.treatments.find((t) => t.id === id);
    const holds = (ids: string[], when?: LiveCondition) =>
        ids.flatMap((id) => stabilisingConditions(find(id), id)).every((c) => evaluateCondition(c, ctx)) && (!when || evaluateCondition(compileCondition(when), ctx));
    if (holds(plan.stabilised_by, plan.stabilised_by_while)) return { path: "usual" };
    const path = (plan.or_stabilised_by ?? []).find((p) => holds(p.treatments, p.when));
    return path ? { path: path.name } : {};
}

/** Every attempt the engine refused (a further dose too soon, not indicated or over the limit; a treatment not yet available), with the reason, in order. */
function refusedDoses(config: SimulationCaseConfig, plan: LivePlan, events: readonly ClinicalEvent[]): RefusedDose[] {
    const byId = new Map(plan.treatments.filter((t) => isRepeatable(t) || t.available_when || t.requires?.length || t.fluid).map((t) => [t.id, t]));
    if (byId.size === 0) return [];
    const count = (state: PatientState, t: LiveTreatment) => {
        let n = 0;
        while (n < (t.max_doses ?? 1) && state.flags[doseFlag(t.id, n + 1)] === true) n++;
        return n;
    };
    const out: RefusedDose[] = [];
    events.forEach((e, i) => {
        if (e.type !== "INTERVENTION_GIVEN") return;
        // A fluid's rates and its stop are its own actions.
        const asFluid = parseFluidAction(e.action);
        const t = byId.get(asFluid && byId.get(asFluid.id)?.fluid ? asFluid.id : e.action);
        // Only what the engine refused; "Already given" for a single-dose treatment is not a refusal.
        if (!t || !e.consequence.startsWith(REFUSED_PREFIX)) return;
        // The state just before and just after this attempt, from the log itself.
        const before = PatientState.fromEvents(config, events.slice(0, i));
        const after = PatientState.fromEvents(config, events.slice(0, i + 1));
        const had = count(before, t);
        if (count(after, t) > had) return;
        const sinceLast = had > 0 ? e.timestamp - (before.flagSetAt[doseFlag(t.id, had)] ?? e.timestamp) : Infinity;
        const unmet = (t.requires ?? []).some((r) => !evaluateCondition(compileCondition(r.when), before.context(e.timestamp)));
        const reason: RefusalReason =
            t.available_when && before.flags[availableFlag(t.id)] !== true
                ? "unavailable"
                : unmet && !(t.fluid && had > 0)
                  ? "needs_first"
                  : t.fluid
                    ? "fluid"
                    : had >= (t.max_doses ?? 1)
                      ? "limit"
                      : sinceLast < (t.min_interval_minutes ?? 0) * 60
                        ? "too_soon"
                        : t.reassess_before_repeat && before.flags[reassessedFlag(t.id)] !== true
                          ? "not_reassessed"
                          : "not_indicated";
        out.push({ id: t.id, label: t.label, at_minutes: toMinutes(e.timestamp), reason, said: e.consequence });
    });
    return out;
}

/** The final score of a live case: the ordinary score and the bedside score, in fixed shares. */
export function blendLiveScore(consultationScore: number, bedsideScore: number): number {
    return Math.round((1 - BEDSIDE_SHARE) * consultationScore + BEDSIDE_SHARE * bedsideScore);
}
