// =========================
// lib/simulation/live-vitals.ts
// =========================
// What a bedside monitor shows: the patient's true values, with the small natural
// variation a real sensor has. HR, SpO₂ and RR wander by a beat or a point;
// blood pressure is a cuff reading, taken now and then, that differs a little each
// time.
//
// DISPLAY ONLY. The patient's state (and so every alarm, badge, rule and score) is
// unchanged by this. To keep the two honest, the variation is bounded and can
// never carry a reading across a threshold the engine or the abnormality badges
// use: a reading that is normal in the state is normal on the screen, and a
// reading that is HYPOXIC in the state is never shown as 95%.
//
// Pure and deterministic: the same case, second and reading always give the same
// numbers, so it is testable and a refresh doesn't reshuffle the monitor.

import type { RhythmType, RuleCondition, SimulationCaseConfig, StateThreshold } from "./case-schema";
import { vitalLimitsForAge, type VitalLimits } from "./vitals-assess";

export type LiveKey = "hr" | "spo2" | "rr" | "sbp" | "dbp";

/** A cuff cycles about every three minutes. It is also taken straight away when the patient changes. */
export const NIBP_CYCLE_SECONDS = 180;

// ── Deterministic noise ─────────────────────────────────────────────────────

/** 32-bit FNV-1a. */
export function hashSeed(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** Smooth, bounded [-1, 1] drift over time: a few sines whose periods don't line up. */
export function drift(seed: string, channel: string, t: number, periods: readonly number[]): number {
    const h = hashSeed(`${seed}|${channel}`);
    let sum = 0;
    let norm = 0;
    periods.forEach((period, i) => {
        const phase = (((h >>> (i * 5)) & 31) / 31) * Math.PI * 2;
        const weight = 1 / (i + 1);
        sum += weight * Math.sin((Math.PI * 2 * t) / period + phase);
        norm += weight;
    });
    return norm === 0 ? 0 : sum / norm;
}

/** An independent value in [-1, 1] for one (seed, key): used once per cuff reading. */
export function unitNoise(seed: string, key: string): number {
    return ((hashSeed(`${seed}|${key}`) % 2001) / 1000) - 1;
}

// ── Thresholds a reading must not cross ─────────────────────────────────────
// Each boundary `b` means "a value >= b is on the upper side". They mirror the
// abnormality badges (vitals-assess.ts) and the case's own monitor alarms.

export interface BoundaryContext {
    limits: VitalLimits;
    thresholds?: readonly StateThreshold[];
}

function alarmBoundaries(parameters: readonly string[], thresholds: readonly StateThreshold[] | undefined): number[] {
    const out: number[] = [];
    for (const t of thresholds ?? []) {
        if (!parameters.includes(t.parameter)) continue;
        if (typeof t.lt === "number") out.push(t.lt);
        if (typeof t.lte === "number") out.push(t.lte + 1);
        if (typeof t.gt === "number") out.push(t.gt + 1);
        if (typeof t.gte === "number") out.push(t.gte);
    }
    return out;
}

export function boundariesFor(key: LiveKey, { limits, thresholds }: BoundaryContext): number[] {
    const paediatric = limits.band !== "adult";
    switch (key) {
        case "hr":
            return [
                ...(paediatric
                    ? [limits.hrLow, limits.hrHigh + 1, Math.ceil(limits.hrHigh * 1.25), Math.floor(limits.hrLow * 0.75) + 1]
                    : [46, 61, 100, 130]),
                ...alarmBoundaries(["hr", "rate", "heart_rate"], thresholds),
            ];
        case "spo2":
            return [95, 91, ...alarmBoundaries(["spo2"], thresholds)];
        case "rr":
            return [
                ...(paediatric
                    ? [limits.rrLow, limits.rrHigh + 1, Math.ceil(limits.rrHigh * 1.4), Math.ceil(limits.rrLow * 0.7)]
                    : [8, 12, 21, 28]),
                ...alarmBoundaries(["rr"], thresholds),
            ];
        case "sbp":
            return [
                ...(paediatric ? [limits.sbpLow, limits.sbpLow + 10] : [91, 100, 180]),
                ...alarmBoundaries(["sbp", "systolic"], thresholds),
            ];
        case "dbp":
            return [61, 110, ...alarmBoundaries(["dbp", "diastolic"], thresholds)];
    }
}

/** Keep `candidate` on the same side of every boundary as `base`. */
export function stayOnSide(base: number, candidate: number, boundaries: readonly number[]): number {
    let v = candidate;
    for (const b of boundaries) {
        if (base < b && v >= b) v = Math.ceil(b) - 1;
        else if (base >= b && v < b) v = Math.ceil(b);
    }
    return v;
}

// ── The readings ────────────────────────────────────────────────────────────

export interface LiveBase {
    rate: number;
    systolic: number;
    diastolic: number;
    spo2: number;
    rr: number;
    rhythm: RhythmType;
}

export interface LiveReading {
    hr: number;
    spo2: number;
    rr: number;
}

export interface LiveOptions {
    /** Keeps two cases from wobbling in step. */
    seed: string;
    age?: number;
    thresholds?: readonly StateThreshold[];
    /** Boundaries of values worked out from the others (pulse pressure, mean pressure) that a decision may rest on. */
    derived?: DerivedBoundaries;
    /**
     * Seconds at which the student reassessed. A reassessment is an exact reading: the monitor shows the patient's true
     * values at that second (and holds them for EXACT_HOLD_SECONDS), so what the reassessment reports and what the
     * monitor shows are the same numbers at the same time. Between reassessments the natural variation resumes.
     */
    exactAt?: readonly number[];
}

/** Boundaries, in the same sense as the others: a value at or above `b` is on the upper side. */
export interface DerivedBoundaries {
    pp?: readonly number[];
    map?: readonly number[];
}

/** How long the monitor holds the exact values a reassessment took. */
export const EXACT_HOLD_SECONDS = 10;

/** Whether second `t` falls in the hold that follows a reassessment. */
export function isExactAt(t: number, exactAt: readonly number[] | undefined): boolean {
    return !!exactAt?.some((rt) => t >= rt && t < rt + EXACT_HOLD_SECONDS);
}

const round = (n: number) => Math.round(n);

/** Continuous channels at simulation second `t`. */
export function liveReading(base: LiveBase, t: number, { seed, age, thresholds, exactAt }: LiveOptions): LiveReading {
    // A reassessment is an exact reading.
    if (isExactAt(t, exactAt)) return { hr: base.rate, spo2: base.spo2, rr: base.rr };
    const ctx: BoundaryContext = { limits: vitalLimitsForAge(age), thresholds };

    // A fibrillating ventricle has no rate; an irregular rhythm reads less steadily than a regular one.
    const hrAmp = base.rhythm === "afib" || base.rhythm === "sinus_node_disease" ? Math.max(2, base.rate * 0.05) : Math.min(3, Math.max(1, base.rate * 0.018));
    const hr = base.rhythm === "vf" ? base.rate : round(base.rate + hrAmp * drift(seed, "hr", t, [7.3, 3.1, 1.7]));
    const spo2 = round(Math.min(100, base.spo2 + 1.2 * drift(seed, "spo2", t, [11.7, 5.3, 2.3])));
    const rr = round(base.rr + 1.4 * drift(seed, "rr", t, [13.1, 6.7]));

    return {
        hr: stayOnSide(base.rate, hr, boundariesFor("hr", ctx)),
        spo2: Math.min(100, stayOnSide(base.spo2, spo2, boundariesFor("spo2", ctx))),
        rr: Math.max(1, stayOnSide(base.rr, rr, boundariesFor("rr", ctx))),
    };
}

/** Mean arterial pressure, as the abnormality badges compute it. */
const map = (sys: number, dia: number) => (sys + 2 * dia) / 3;

/**
 * One cuff reading, taken at `measuredAt`. Systolic and diastolic vary by a few
 * mmHg from one cycle to the next; the reading never changes which side of a
 * threshold (including mean pressure 65) the patient is on.
 */
export function nibpReading(
    base: Pick<LiveBase, "systolic" | "diastolic">,
    measuredAt: number,
    { seed, age, thresholds, derived, exactAt }: LiveOptions
): { systolic: number; diastolic: number } {
    // A cuff taken at a reassessment is the exact pressure.
    if (isExactAt(measuredAt, exactAt)) return { systolic: base.systolic, diastolic: base.diastolic };
    const ctx: BoundaryContext = { limits: vitalLimitsForAge(age), thresholds };
    let systolic = stayOnSide(base.systolic, round(base.systolic + 2.5 * unitNoise(seed, `sbp@${measuredAt}`)), boundariesFor("sbp", ctx));
    let diastolic = stayOnSide(base.diastolic, round(base.diastolic + 1.6 * unitNoise(seed, `dbp@${measuredAt}`)), boundariesFor("dbp", ctx));
    // Mean pressure is a function of both: if the pair would cross 65, take the true pair.
    const crosses = (boundaries: readonly number[], trueValue: number, shown: number) => boundaries.some((b) => trueValue >= b !== shown >= b);
    const truePp = base.systolic - base.diastolic;
    if (
        map(base.systolic, base.diastolic) >= 65 !== map(systolic, diastolic) >= 65 ||
        // Pulse pressure and mean pressure are worked out from both numbers, so a decision that rests on either (a plan's
        // "pulse pressure 20 or less") must be on the same side on the screen as it is in the patient.
        crosses(derived?.pp ?? [], truePp, systolic - diastolic) ||
        crosses(derived?.map ?? [], map(base.systolic, base.diastolic), map(systolic, diastolic))
    ) {
        systolic = base.systolic;
        diastolic = base.diastolic;
    }
    return { systolic, diastolic };
}

/**
 * When the cuff last cycled. It cycles on the clock, and straight away when the
 * patient's pressure changes (a nurse re-cycles the cuff on a deterioration), so
 * the pressure on the screen is never stale against what the case just did.
 */
export function nextMeasurementTime(
    previous: { measuredAt: number; base: { systolic: number; diastolic: number } } | null,
    now: number,
    truePressure: { systolic: number; diastolic: number },
    exactAt?: readonly number[]
): number {
    // A reassessment takes a pressure straight away: the cuff reading is that second's.
    const reassessed = (exactAt ?? []).filter((rt) => rt <= now && (previous === null || rt > previous.measuredAt));
    if (reassessed.length > 0) return Math.max(...reassessed);
    if (previous === null) return Math.floor(now / NIBP_CYCLE_SECONDS) * NIBP_CYCLE_SECONDS;
    if (previous.base.systolic !== truePressure.systolic || previous.base.diastolic !== truePressure.diastolic) return now;
    return now - previous.measuredAt >= NIBP_CYCLE_SECONDS ? now : previous.measuredAt;
}

// ── What the monitor must never misreport ───────────────────────────────────

const PARAMETER_GROUP: Record<string, "hr" | "spo2" | "rr" | "sbp" | "dbp" | "map" | "pp"> = {
    hr: "hr", rate: "hr", heart_rate: "hr", spo2: "spo2", rr: "rr", sbp: "sbp", systolic: "sbp", dbp: "dbp", diastolic: "dbp", map: "map", pulse_pressure: "pp", pp: "pp",
};

/**
 * Every threshold on a vital that the case's own rules and tray guards decide by (a live plan's "systolic under 90",
 * "pulse pressure 20 or less"), so the monitor's natural variation can never put a number on the wrong side of one.
 * The case's alarm thresholds are included. Pulse and mean pressure are returned apart because they come from two readings.
 */
export function monitorBoundaries(config: Pick<SimulationCaseConfig, "state_thresholds" | "event_rules" | "action_consequences">): { thresholds: StateThreshold[]; derived: Required<DerivedBoundaries> } {
    const thresholds: StateThreshold[] = [...(config.state_thresholds ?? [])];
    const pp: number[] = [];
    const mapB: number[] = [];
    const visit = (c: RuleCondition | undefined): void => {
        if (!c) return;
        if ("all" in c) return c.all.forEach(visit);
        if ("any" in c) return c.any.forEach(visit);
        if ("not" in c) return visit(c.not);
        if (!("parameter" in c)) return;
        const group = PARAMETER_GROUP[c.parameter as string];
        if (!group) return;
        const bounds: number[] = [];
        if (typeof c.lt === "number") bounds.push(c.lt);
        if (typeof c.lte === "number") bounds.push(c.lte + 1);
        if (typeof c.gt === "number") bounds.push(c.gt + 1);
        if (typeof c.gte === "number") bounds.push(c.gte);
        if (group === "pp") pp.push(...bounds);
        else if (group === "map") mapB.push(...bounds);
        else for (const lt of bounds) thresholds.push({ parameter: group, trigger: "decision", lt });
    };
    for (const r of config.event_rules ?? []) visit(r.when);
    for (const a of config.action_consequences ?? []) visit(a.when);
    return { thresholds, derived: { pp, map: mapB } };
}
