// =========================
// lib/simulation/conditions.ts
// =========================
// Evaluates the shared condition grammar (see case-schema.ts) against a
// snapshot of the patient at a moment in time. Pure and deterministic.

import type {
    ConditionLeaf,
    ParameterCondition,
    RuleCondition,
    StateThreshold,
} from "./case-schema";

export interface PhysiologySnapshot {
    hr: number;
    sbp: number;
    dbp: number;
    map: number;
    spo2: number;
    rr: number;
    temperature: number;
    rhythm: string;
    consciousness: string;
}

export interface ConditionContext {
    /** Seconds since the encounter began at which the condition is being evaluated. */
    time: number;
    flags: Readonly<Record<string, boolean>>;
    /** Seconds at which each currently-true flag most recently became true. */
    flagSetAt: Readonly<Record<string, number>>;
    state: string;
    physiology: PhysiologySnapshot;
    alarms: readonly string[];
}

// ── Parameter access ────────────────────────────────────────────────────────

const PARAMETER_KEYS: Record<string, keyof PhysiologySnapshot> = {
    hr: "hr",
    rate: "hr",
    heart_rate: "hr",
    sbp: "sbp",
    systolic: "sbp",
    dbp: "dbp",
    diastolic: "dbp",
    map: "map",
    spo2: "spo2",
    rr: "rr",
    temperature: "temperature",
    temp: "temperature",
    rhythm: "rhythm",
    consciousness: "consciousness",
};

export function resolveParameter(name: string): keyof PhysiologySnapshot | null {
    return PARAMETER_KEYS[name] ?? null;
}

/** MAP from systolic/diastolic, rounded to a whole mmHg. */
export function meanArterialPressure(systolic: number, diastolic: number): number {
    return Math.round((systolic + 2 * diastolic) / 3);
}

type ParameterTest = Omit<ParameterCondition, "parameter">;

/** Applies comparators to a value. Every comparator present must hold. */
export function testParameter(
    parameter: string,
    test: ParameterTest,
    physiology: PhysiologySnapshot
): boolean {
    const key = resolveParameter(parameter);
    if (!key) throw new Error(`Unknown physiological parameter "${parameter}"`);
    const value = physiology[key];

    if (test.lt !== undefined && !(typeof value === "number" && value < test.lt)) return false;
    if (test.lte !== undefined && !(typeof value === "number" && value <= test.lte)) return false;
    if (test.gt !== undefined && !(typeof value === "number" && value > test.gt)) return false;
    if (test.gte !== undefined && !(typeof value === "number" && value >= test.gte)) return false;
    if (test.eq !== undefined && value !== test.eq) return false;
    if (test.neq !== undefined && value === test.neq) return false;
    if (test.in !== undefined && !test.in.includes(value)) return false;
    return true;
}

/** Names of the alarms whose thresholds the physiology currently crosses. */
export function computeAlarms(
    thresholds: readonly StateThreshold[] | undefined,
    physiology: PhysiologySnapshot
): string[] {
    if (!thresholds) return [];
    const active: string[] = [];
    for (const t of thresholds) {
        const { parameter, trigger, ...test } = t;
        if (testParameter(parameter, test, physiology) && !active.includes(trigger)) active.push(trigger);
    }
    return active;
}

// ── Evaluation ──────────────────────────────────────────────────────────────

/** Evaluates one leaf of the grammar. Shared with the scorer, which layers encounter predicates on top. */
export function evaluateLeaf(cond: ConditionLeaf, ctx: ConditionContext): boolean {
    if ("time_elapsed_gte_minutes" in cond) return ctx.time >= cond.time_elapsed_gte_minutes * 60;
    if ("time_elapsed_lt_minutes" in cond) return ctx.time < cond.time_elapsed_lt_minutes * 60;
    if ("flag" in cond) return (ctx.flags[cond.flag] === true) === cond.is;
    if ("state" in cond) return ctx.state === cond.state;
    if ("alarm" in cond) return ctx.alarms.includes(cond.alarm);
    if ("minutes_since_flag" in cond) {
        const { flag, gte } = cond.minutes_since_flag;
        const setAt = ctx.flagSetAt[flag];
        return ctx.flags[flag] === true && setAt !== undefined && ctx.time - setAt >= gte * 60;
    }
    if ("parameter" in cond) {
        const { parameter, ...test } = cond;
        return testParameter(parameter, test, ctx.physiology);
    }
    throw new Error(`Unknown condition: ${JSON.stringify(cond)}`);
}

export function evaluateCondition(cond: RuleCondition, ctx: ConditionContext): boolean {
    if ("all" in cond) return cond.all.every((c) => evaluateCondition(c, ctx));
    if ("any" in cond) return cond.any.some((c) => evaluateCondition(c, ctx));
    if ("not" in cond) return !evaluateCondition(cond.not, ctx);
    return evaluateLeaf(cond, ctx);
}

// ── Time boundaries ─────────────────────────────────────────────────────────

/**
 * Absolute times (seconds) at which a time-dependent leaf of `cond` can change
 * truth value. The engine evaluates rules at exactly these instants, so a rule
 * fires at the moment it becomes true — independent of how often the UI ticks.
 * Returning a superset is harmless; returning a subset would skip a firing.
 */
export function collectTimeBoundaries(cond: RuleCondition, ctx: Pick<ConditionContext, "flagSetAt" | "flags">): number[] {
    if ("all" in cond) return cond.all.flatMap((c) => collectTimeBoundaries(c, ctx));
    if ("any" in cond) return cond.any.flatMap((c) => collectTimeBoundaries(c, ctx));
    if ("not" in cond) return collectTimeBoundaries(cond.not, ctx);
    if ("time_elapsed_gte_minutes" in cond) return [cond.time_elapsed_gte_minutes * 60];
    if ("time_elapsed_lt_minutes" in cond) return [cond.time_elapsed_lt_minutes * 60];
    if ("minutes_since_flag" in cond) {
        const { flag, gte } = cond.minutes_since_flag;
        const setAt = ctx.flagSetAt[flag];
        return ctx.flags[flag] === true && setAt !== undefined ? [setAt + gte * 60] : [];
    }
    return [];
}

// ── Structural walking (used by the validator) ──────────────────────────────

export type ConditionVisitor = (leaf: ConditionLeaf) => void;

export function walkCondition(cond: RuleCondition, visit: ConditionVisitor): void {
    if ("all" in cond) return cond.all.forEach((c) => walkCondition(c, visit));
    if ("any" in cond) return cond.any.forEach((c) => walkCondition(c, visit));
    if ("not" in cond) return walkCondition(cond.not, visit);
    visit(cond);
}
