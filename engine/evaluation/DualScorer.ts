// =========================
// engine/evaluation/DualScorer.ts
// =========================
// One event stream, two tracks.
//
//   Clinical score     what the student DID       evaluateClinicalPerformance(events)
//   Independent score  Clinical − assistance cost  what they did WITHOUT help
//
// Both consume the exact same EncounterEvent[]. Nothing here reads UI state, and
// nothing here is an LLM: scoring is a deterministic evaluation of the case's
// own `scoring_rubric`, so the same encounter always scores the same and every
// point of difference between the two tracks traces to a timestamped
// ASSIST_USED event.
//
// Pure TypeScript with relative imports only — it runs identically in a server
// action, in the browser and in the node:test harness.

import type { ClinicalEvent, EventOf, AssistType } from "../../lib/simulation/encounter-events";
import { formatClock } from "../../lib/simulation/encounter-events";
import {
    SCORING_DOMAINS,
    type ExpertImpression,
    type RubricItem,
    type RubricPenalty,
    type ScoringDomain,
    type ScoringPredicate,
    type SimulationCaseConfig,
} from "../../lib/simulation/case-schema";
import { evaluateLeaf, type ConditionContext } from "../../lib/simulation/conditions";
import { PatientState, snapshotContext } from "../../lib/simulation/patient-state";
import { anyTextMatches, textMatchesAny } from "../../lib/simulation/text-match";
import { ASSIST_LABELS } from "../../lib/simulation/assist-policy";

// ── Result shapes ───────────────────────────────────────────────────────────

export interface ScoredItem {
    id: string;
    label: string;
    domain: ScoringDomain;
    weight: number;
    /** 0–1: 1 met, partial credit in between, 0 unmet. */
    credit: number;
    critical: boolean;
    basis: "met" | "partial" | "graded" | "unmet";
    knowledgeGap?: string;
}

export interface ScoredPenalty {
    id: string;
    label: string;
    domain: ScoringDomain;
    points: number;
    critical: boolean;
    knowledgeGap?: string;
}

export interface AssistanceLine {
    type: AssistType;
    label: string;
    cost: number;
    timestamp: number;
    /** "02:14" */
    clock: string;
    target?: string;
}

export interface ReasoningError {
    id: string;
    title: string;
    error: string;
    whyItMattered: string;
    knowledgeGap: string;
}

export interface Milestones {
    /** First time each test was ordered, in seconds. */
    firstOrderedAt: Record<string, number>;
    /** First time each intervention was given, in seconds. */
    firstGaveAt: Record<string, number>;
    /** When each named flag last became true. */
    flagSetAt: Record<string, number>;
    deteriorations: Array<{ ruleId: string; timestamp: number; narrative: string }>;
    /** Investigations + interventions. */
    budgetedActions: number;
    recommendedActions: number;
    /** Timestamp of the last event. */
    endedAt: number;
}

export interface ClinicalPerformance {
    /** 0–100, integer. */
    score: number;
    domains: Record<ScoringDomain, number>;
    weights: Record<ScoringDomain, number>;
    items: ScoredItem[];
    penalties: ScoredPenalty[];
    safetyIssues: Array<{ action: string; timestamp: number; note?: string }>;
    didWell: string[];
    missed: Array<{ text: string; critical: boolean }>;
    reasoningError: ReasoningError | null;
    otherErrors: ReasoningError[];
    /** Knowledge gaps to reinforce, most important first. */
    knowledgeGaps: string[];
    diagnosis: { studentDiagnosis: string; isCorrect: boolean; groundTruth: string };
    milestones: Milestones;
}

export interface DualScoreResult extends ClinicalPerformance {
    clinicalScore: number;
    independentScore: number;
    assistanceCost: number;
    assistance: AssistanceLine[];
    expertImpressions: ExpertImpression[];
    keyLearningPoints: string[];
}

const DEFAULT_SAFETY_PENALTY_POINTS = 15;

// ── Encounter context ───────────────────────────────────────────────────────

interface EncounterContext {
    events: readonly ClinicalEvent[];
    condition: ConditionContext;
    finalState: PatientState;
    recommendedActions: number;
    /** TEST_ORDERED / INTERVENTION_GIVEN events, in order. */
    budgeted: ClinicalEvent[];
}

const ids = (v: string | string[]): string[] => (Array.isArray(v) ? v : [v]);

function lastOf<T extends ClinicalEvent["type"]>(events: readonly ClinicalEvent[], type: T): EventOf<T> | undefined {
    for (let i = events.length - 1; i >= 0; i--) if (events[i].type === type) return events[i] as EventOf<T>;
    return undefined;
}

// ── Predicates ──────────────────────────────────────────────────────────────

function evalPredicate(p: ScoringPredicate, ctx: EncounterContext): boolean {
    if ("all" in p) return p.all.every((c) => evalPredicate(c, ctx));
    if ("any" in p) return p.any.some((c) => evalPredicate(c, ctx));
    if ("not" in p) return !evalPredicate(p.not, ctx);

    if ("ordered" in p) {
        const wanted = ids(p.ordered);
        return ctx.events.some((e) => {
            if (e.type !== "TEST_ORDERED" || !wanted.includes(e.testId)) return false;
            if (p.within_minutes !== undefined && e.timestamp > p.within_minutes * 60) return false;
            if (p.within_actions !== undefined && ctx.budgeted.indexOf(e) >= p.within_actions) return false;
            return true;
        });
    }
    if ("gave" in p) {
        const wanted = ids(p.gave);
        return ctx.events.some(
            (e) =>
                e.type === "INTERVENTION_GIVEN" &&
                wanted.includes(e.action) &&
                (p.within_minutes === undefined || e.timestamp <= p.within_minutes * 60)
        );
    }
    if ("performed" in p) {
        const wanted = ids(p.performed);
        return ctx.events.some((e) => e.type === "EXAM_PERFORMED" && wanted.includes(e.manoeuvre));
    }
    if ("asked_about" in p) {
        // A question the student asked is a fact regardless of how it is phrased ("Any bleeding?").
        return ctx.events.some(
            (e) => e.type === "HISTORY_TAKEN" && textMatchesAny(e.question, p.asked_about, { negationAware: false })
        );
    }
    if ("interpretation_mentions" in p) {
        const { testId, any_of } = p.interpretation_mentions;
        return ctx.events.some(
            (e) =>
                e.type === "RESULT_INTERPRETED" &&
                (!testId || e.testId === testId) &&
                textMatchesAny(e.studentInterpretation, any_of)
        );
    }
    if ("reasoning_mentions" in p) {
        const dx = lastOf(ctx.events, "DIAGNOSIS_SUBMITTED");
        return !!dx && textMatchesAny(dx.reasoning, p.reasoning_mentions);
    }
    if ("diagnosis_matches" in p) {
        const dx = lastOf(ctx.events, "DIAGNOSIS_SUBMITTED");
        return !!dx && textMatchesAny(dx.primary, p.diagnosis_matches);
    }
    if ("differential_slot" in p) {
        const diff = lastOf(ctx.events, "DIFFERENTIAL_SUBMITTED");
        const entry = diff?.ranked[p.differential_slot.slot - 1];
        return !!entry && textMatchesAny(entry, p.differential_slot.matches);
    }
    if ("differential_contains" in p) {
        const diff = lastOf(ctx.events, "DIFFERENTIAL_SUBMITTED");
        return !!diff && anyTextMatches(diff.ranked, p.differential_contains);
    }
    if ("plan_mentions" in p) {
        const plan = lastOf(ctx.events, "MANAGEMENT_SUBMITTED");
        return !!plan && anyTextMatches(plan.steps, p.plan_mentions);
    }
    if ("revealed" in p) {
        const wanted = ids(p.revealed);
        return ctx.events.some((e) => e.type === "RESULT_REVEALED" && wanted.includes(e.testId));
    }
    if ("rule_fired" in p) {
        return ctx.events.some((e) => e.type === "STATE_TRANSITION" && e.trigger === p.rule_fired);
    }
    if ("budgeted_actions_lte" in p) {
        const limit = p.budgeted_actions_lte === "recommended" ? ctx.recommendedActions : p.budgeted_actions_lte;
        return ctx.budgeted.length <= limit;
    }
    // Everything else is the shared time / flag / state / alarm / parameter grammar,
    // evaluated against the patient as they ended the encounter.
    return evaluateLeaf(p as Parameters<typeof evaluateLeaf>[0], ctx.condition);
}

/** Seconds of the first event satisfying an event predicate (ordered / gave / performed, combined with any/all). */
function firstTimeOf(p: ScoringPredicate, ctx: EncounterContext): number | null {
    if ("any" in p) {
        const times = p.any.map((c) => firstTimeOf(c, ctx)).filter((t): t is number => t !== null);
        return times.length ? Math.min(...times) : null;
    }
    if ("all" in p) {
        const times = p.all.map((c) => firstTimeOf(c, ctx));
        return times.every((t) => t !== null) ? Math.max(...(times as number[])) : null;
    }
    const pick = (matcher: (e: ClinicalEvent) => boolean): number | null => {
        const hit = ctx.events.find(matcher);
        return hit ? hit.timestamp : null;
    };
    if ("ordered" in p) {
        const wanted = ids(p.ordered);
        return pick((e) => e.type === "TEST_ORDERED" && wanted.includes(e.testId));
    }
    if ("gave" in p) {
        const wanted = ids(p.gave);
        return pick((e) => e.type === "INTERVENTION_GIVEN" && wanted.includes(e.action));
    }
    if ("performed" in p) {
        const wanted = ids(p.performed);
        return pick((e) => e.type === "EXAM_PERFORMED" && wanted.includes(e.manoeuvre));
    }
    return null;
}

// ── Items & penalties ───────────────────────────────────────────────────────

function scoreItem(item: RubricItem, ctx: EncounterContext, defaultPartial: number): ScoredItem {
    let credit = 0;
    let basis: ScoredItem["basis"] = "unmet";

    if (item.graded) {
        const t = firstTimeOf(item.graded.measure, ctx);
        if (t !== null) {
            const minutes = t / 60;
            const { full_within_minutes: full, zero_after_minutes: zero } = item.graded;
            credit = minutes <= full ? 1 : minutes >= zero ? 0 : (zero - minutes) / (zero - full);
            basis = "graded";
        }
    } else if (item.met_when && evalPredicate(item.met_when, ctx)) {
        credit = 1;
        basis = "met";
    } else if (item.partial_when && evalPredicate(item.partial_when, ctx)) {
        credit = item.partial_credit ?? defaultPartial;
        basis = "partial";
    }

    return {
        id: item.id,
        label: item.label,
        domain: item.domain,
        weight: item.weight,
        credit,
        critical: item.critical === true,
        basis: credit >= 0.999 ? (basis === "graded" ? "graded" : "met") : credit > 0 ? (basis === "graded" ? "graded" : "partial") : "unmet",
        knowledgeGap: item.knowledge_gap,
    };
}

/** Points a penalty costs. `per_match` charges once per distinct id that matched, capped at `max_points`. */
function penaltyPoints(penalty: RubricPenalty, ctx: EncounterContext): number {
    if (!evalPredicate(penalty.when, ctx)) return 0;
    let points = penalty.points;

    if (penalty.per_match) {
        const w = penalty.when;
        let matched = 1;
        if ("ordered" in w) {
            const wanted = new Set(ids(w.ordered));
            matched = new Set(
                ctx.events.filter((e): e is EventOf<"TEST_ORDERED"> => e.type === "TEST_ORDERED" && wanted.has(e.testId)).map((e) => e.testId)
            ).size;
        } else if ("gave" in w) {
            const wanted = new Set(ids(w.gave));
            matched = new Set(
                ctx.events.filter((e): e is EventOf<"INTERVENTION_GIVEN"> => e.type === "INTERVENTION_GIVEN" && wanted.has(e.action)).map((e) => e.action)
            ).size;
        }
        points = penalty.points * Math.max(1, matched);
    }
    return penalty.max_points !== undefined ? Math.min(points, penalty.max_points) : points;
}

// ── Assistance (Independent track) ──────────────────────────────────────────

export function computeAssistance(events: readonly ClinicalEvent[]): { total: number; lines: AssistanceLine[] } {
    const lines = events
        .filter((e): e is EventOf<"ASSIST_USED"> => e.type === "ASSIST_USED")
        .map((e) => ({
            type: e.assistType,
            label: ASSIST_LABELS[e.assistType],
            cost: e.cost,
            timestamp: e.timestamp,
            clock: formatClock(e.timestamp),
            ...(e.target !== undefined ? { target: e.target } : {}),
        }));
    return { total: lines.reduce((sum, l) => sum + l.cost, 0), lines };
}

// ── Clinical track ──────────────────────────────────────────────────────────

export function evaluateClinicalPerformance(
    events: readonly ClinicalEvent[],
    config: SimulationCaseConfig
): ClinicalPerformance {
    const rubric = config.scoring_rubric;
    if (!rubric) throw new Error(`Case "${config.id}" has no scoring_rubric and cannot be scored.`);

    const finalState = PatientState.fromEvents(config, events);
    const endedAt = events.length > 0 ? events[events.length - 1].timestamp : 0;
    const recommendedActions = config.clinical_constraints?.recommended_actions ?? 10;
    const budgeted = events.filter((e) => e.type === "TEST_ORDERED" || e.type === "INTERVENTION_GIVEN");

    const ctx: EncounterContext = {
        events,
        finalState,
        condition: snapshotContext(finalState.snapshot(), Math.max(endedAt, finalState.lastEventTime)),
        recommendedActions,
        budgeted,
    };

    // Items
    const items = rubric.items.map((item) => scoreItem(item, ctx, 0.5));

    // Penalties
    const penalties: ScoredPenalty[] = [];
    for (const p of rubric.penalties ?? []) {
        const points = penaltyPoints(p, ctx);
        if (points > 0) {
            penalties.push({ id: p.id, label: p.label, domain: p.domain, points, critical: p.critical === true, knowledgeGap: p.knowledge_gap });
        }
    }

    // Safety issues are read from the state fold: the consequence that flagged them is the case's, not ours.
    const safetyIssues = finalState.safetyEvents.map((s) => ({ ...s }));
    const safetyPoints = rubric.safety_penalty_points ?? DEFAULT_SAFETY_PENALTY_POINTS;

    // Domains
    const domains = {} as Record<ScoringDomain, number>;
    for (const d of SCORING_DOMAINS) {
        const inDomain = items.filter((i) => i.domain === d);
        const possible = inDomain.reduce((s, i) => s + i.weight, 0);
        const earned = inDomain.reduce((s, i) => s + i.weight * i.credit, 0);
        let score = possible > 0 ? (earned / possible) * 100 : 100;
        score -= penalties.filter((p) => p.domain === d).reduce((s, p) => s + p.points, 0);
        if (d === "management") score -= safetyIssues.length * safetyPoints;
        domains[d] = Math.round(Math.min(100, Math.max(0, score)));
    }

    const weights = { ...rubric.weights };
    const totalWeight = SCORING_DOMAINS.reduce((s, d) => s + (weights[d] ?? 0), 0) || 1;
    const score = Math.round(
        Math.min(100, Math.max(0, SCORING_DOMAINS.reduce((s, d) => s + (weights[d] ?? 0) * domains[d], 0) / totalWeight))
    );

    // Did well / missed
    const byWeight = (a: ScoredItem, b: ScoredItem) => b.weight - a.weight;
    const textOf = new Map(rubric.items.map((i) => [i.id, i]));
    const didWell = items
        .filter((i) => i.credit >= 0.75 && textOf.get(i.id)?.did_well)
        .sort(byWeight)
        .map((i) => textOf.get(i.id)!.did_well as string);

    const missedItems = items
        .filter((i) => i.credit < 0.5 && textOf.get(i.id)?.missed)
        .sort((a, b) => Number(b.critical) - Number(a.critical) || byWeight(a, b));
    const missed: ClinicalPerformance["missed"] = [
        ...safetyIssues.map((s) => ({ text: `Safety: ${s.note ?? s.action}`, critical: true })),
        ...penalties.filter((p) => p.critical).map((p) => ({ text: p.label, critical: true })),
        ...missedItems.map((i) => ({ text: textOf.get(i.id)!.missed as string, critical: i.critical })),
        ...penalties.filter((p) => !p.critical).map((p) => ({ text: p.label, critical: false })),
    ];

    // Reasoning errors
    const triggered = (rubric.misconceptions ?? [])
        .filter((m) => evalPredicate(m.when, ctx))
        .sort((a, b) => b.priority - a.priority)
        .map<ReasoningError>((m) => ({
            id: m.id,
            title: m.title,
            error: m.error,
            whyItMattered: m.why_it_mattered,
            knowledgeGap: m.knowledge_gap,
        }));

    // Knowledge gaps, most important first: misconceptions, then penalties and unmet critical items, then the rest.
    const gaps: string[] = [];
    const addGap = (g?: string) => {
        if (g && !gaps.includes(g)) gaps.push(g);
    };
    triggered.forEach((m) => addGap(m.knowledgeGap));
    penalties.forEach((p) => addGap(p.knowledgeGap));
    items.filter((i) => i.credit < 0.5 && i.critical).sort(byWeight).forEach((i) => addGap(i.knowledgeGap));
    items.filter((i) => i.credit < 0.5).sort(byWeight).forEach((i) => addGap(i.knowledgeGap));

    // Diagnosis
    const dx = lastOf(events, "DIAGNOSIS_SUBMITTED");
    const studentDiagnosis = dx?.primary ?? "";
    const isCorrect = !!dx && textMatchesAny(dx.primary, rubric.diagnosis.accepted);

    // Milestones (generic — the debrief chooses what to show)
    const firstOrderedAt: Record<string, number> = {};
    const firstGaveAt: Record<string, number> = {};
    const deteriorations: Milestones["deteriorations"] = [];
    for (const e of events) {
        if (e.type === "TEST_ORDERED" && !(e.testId in firstOrderedAt)) firstOrderedAt[e.testId] = e.timestamp;
        if (e.type === "INTERVENTION_GIVEN" && !(e.action in firstGaveAt)) firstGaveAt[e.action] = e.timestamp;
        if (e.type === "PATIENT_DETERIORATED") deteriorations.push({ ruleId: e.ruleId, timestamp: e.timestamp, narrative: e.narrative });
    }

    return {
        score,
        domains,
        weights,
        items,
        penalties,
        safetyIssues,
        didWell,
        missed,
        reasoningError: triggered[0] ?? null,
        otherErrors: triggered.slice(1),
        knowledgeGaps: gaps,
        diagnosis: { studentDiagnosis, isCorrect, groundTruth: rubric.diagnosis.ground_truth },
        milestones: {
            firstOrderedAt,
            firstGaveAt,
            flagSetAt: { ...finalState.flagSetAt },
            deteriorations,
            budgetedActions: budgeted.length,
            recommendedActions,
            endedAt,
        },
    };
}

// ── Both tracks ─────────────────────────────────────────────────────────────

export function scoreEncounter(events: readonly ClinicalEvent[], config: SimulationCaseConfig): DualScoreResult {
    // Both tracks consume the exact same event stream.
    const clinical = evaluateClinicalPerformance(events, config);
    const assistance = computeAssistance(events);

    const clinicalScore = clinical.score;
    const independentScore = Math.min(100, Math.max(0, clinicalScore - assistance.total));

    return {
        ...clinical,
        clinicalScore,
        independentScore,
        assistanceCost: assistance.total,
        assistance: assistance.lines,
        // Shown to every student in the debrief, whether or not they used the assist.
        expertImpressions: config.scoring_rubric?.expert_impressions ?? [],
        keyLearningPoints: config.scoring_rubric?.key_learning_points ?? [],
    };
}
