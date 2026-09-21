// =========================
// lib/simulation/encounter-events.ts
// =========================
// The canonical encounter event log.
//
// Everything that happens in a simulated encounter is one typed event in a
// single append-only stream. Patient state, the timeline, scoring, replay,
// the debrief and analytics are all *derived* from this stream — nothing
// derives clinical truth from local UI state.
//
// Pure TypeScript. No React, no I/O, relative imports only, so the same file
// runs in the browser, in server actions and in the node:test harness.

// ── Assist ladder vocabulary ────────────────────────────────────────────────

export const ASSIST_TYPES = [
    "highlight_abnormal",
    "explain_abnormal",
    "ecg_interpretation_hint",
    "radiology_impression",
    "socratic_hint",
    "diagnostic_hint",
    "reveal_diagnosis",
    "management_guidance",
] as const;

export type AssistType = (typeof ASSIST_TYPES)[number];

// ── Event union ─────────────────────────────────────────────────────────────
// `timestamp` is SECONDS elapsed on the simulation clock since the encounter
// began (not wall-clock time). Optional fields are additive metadata; the
// required shape of every event is exactly the locked plan.

export type ClinicalEvent =
    | { type: "HISTORY_TAKEN"; timestamp: number; question: string; response: string }
    | { type: "EXAM_PERFORMED"; timestamp: number; manoeuvre: string; findings: string }
    | { type: "TEST_ORDERED"; timestamp: number; testId: string; testName: string }
    | {
        type: "RESULT_INTERPRETED";
        timestamp: number;
        testId: string;
        studentInterpretation: string;
        /** `timestamp` of the TEST_ORDERED this refers to — a test can be ordered more than once. */
        orderTimestamp?: number;
    }
    | {
        type: "RESULT_REVEALED";
        timestamp: number;
        testId: string;
        revealType: "impression" | "hint";
        orderTimestamp?: number;
    }
    | { type: "INTERVENTION_GIVEN"; timestamp: number; action: string; consequence: string }
    | {
        type: "ASSIST_USED";
        timestamp: number;
        assistType: AssistType;
        cost: number;
        /** What the assist was spent on (e.g. an order key or "vitals"). Used to charge once per target. */
        target?: string;
    }
    | { type: "STATE_TRANSITION"; timestamp: number; from: string; to: string; trigger: string }
    | { type: "PATIENT_DETERIORATED"; timestamp: number; narrative: string; ruleId: string }
    | { type: "DIFFERENTIAL_SUBMITTED"; timestamp: number; ranked: string[] }
    | { type: "DIAGNOSIS_SUBMITTED"; timestamp: number; primary: string; reasoning: string }
    | { type: "MANAGEMENT_SUBMITTED"; timestamp: number; steps: string[] };

/** The plan calls the log `EncounterEvent[]` and the union `ClinicalEvent`; they are one type. */
export type EncounterEvent = ClinicalEvent;
export type EncounterEventType = ClinicalEvent["type"];
export type EventOf<T extends EncounterEventType> = Extract<ClinicalEvent, { type: T }>;

export const ENCOUNTER_EVENT_TYPES: readonly EncounterEventType[] = [
    "HISTORY_TAKEN",
    "EXAM_PERFORMED",
    "TEST_ORDERED",
    "RESULT_INTERPRETED",
    "RESULT_REVEALED",
    "INTERVENTION_GIVEN",
    "ASSIST_USED",
    "STATE_TRANSITION",
    "PATIENT_DETERIORATED",
    "DIFFERENTIAL_SUBMITTED",
    "DIAGNOSIS_SUBMITTED",
    "MANAGEMENT_SUBMITTED",
];

// ── Time helpers ────────────────────────────────────────────────────────────

export const minutesToSeconds = (minutes: number): number => minutes * 60;
export const secondsToMinutes = (seconds: number): number => seconds / 60;

export { formatClock } from "./clock-format";

// ── Selectors ───────────────────────────────────────────────────────────────

export function eventsOfType<T extends EncounterEventType>(
    events: readonly ClinicalEvent[],
    type: T
): EventOf<T>[] {
    return events.filter((e): e is EventOf<T> => e.type === type);
}

/**
 * A test can be ordered more than once (serial ECGs, repeat troponin), so an
 * order is identified by test id + the moment it was placed.
 */
export function orderKey(testId: string, orderedAt: number): string {
    return `${testId}@${orderedAt}`;
}

/** Investigations + interventions: the "orders" the recommended-actions budget counts. */
export function countBudgetedActions(events: readonly ClinicalEvent[]): number {
    return events.filter((e) => e.type === "TEST_ORDERED" || e.type === "INTERVENTION_GIVEN").length;
}

// ── Runtime validation (untrusted input: localStorage, client → server) ─────

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

/** Structural check for one event. Rejects anything that would crash a consumer. */
export function isClinicalEvent(value: unknown): value is ClinicalEvent {
    if (!value || typeof value !== "object") return false;
    const e = value as Record<string, unknown>;
    if (!isNum(e.timestamp) || e.timestamp < 0) return false;

    switch (e.type) {
        case "HISTORY_TAKEN":
            return isStr(e.question) && isStr(e.response);
        case "EXAM_PERFORMED":
            return isStr(e.manoeuvre) && isStr(e.findings);
        case "TEST_ORDERED":
            return isStr(e.testId) && isStr(e.testName);
        case "RESULT_INTERPRETED":
            return (
                isStr(e.testId) &&
                isStr(e.studentInterpretation) &&
                (e.orderTimestamp === undefined || isNum(e.orderTimestamp))
            );
        case "RESULT_REVEALED":
            return (
                isStr(e.testId) &&
                (e.revealType === "impression" || e.revealType === "hint") &&
                (e.orderTimestamp === undefined || isNum(e.orderTimestamp))
            );
        case "INTERVENTION_GIVEN":
            return isStr(e.action) && isStr(e.consequence);
        case "ASSIST_USED":
            return (
                isStr(e.assistType) &&
                (ASSIST_TYPES as readonly string[]).includes(e.assistType) &&
                isNum(e.cost) &&
                e.cost >= 0 &&
                (e.target === undefined || isStr(e.target))
            );
        case "STATE_TRANSITION":
            return isStr(e.from) && isStr(e.to) && isStr(e.trigger);
        case "PATIENT_DETERIORATED":
            return isStr(e.narrative) && isStr(e.ruleId);
        case "DIFFERENTIAL_SUBMITTED":
            return isStrArr(e.ranked);
        case "DIAGNOSIS_SUBMITTED":
            return isStr(e.primary) && isStr(e.reasoning);
        case "MANAGEMENT_SUBMITTED":
            return isStrArr(e.steps);
        default:
            return false;
    }
}

/**
 * Filters an untrusted array down to valid events and puts them in
 * non-decreasing timestamp order (stable, so same-instant events keep their
 * relative order). Never throws.
 */
export function sanitizeEvents(input: unknown): ClinicalEvent[] {
    if (!Array.isArray(input)) return [];
    const valid = input.filter(isClinicalEvent);
    return valid
        .map((event, index) => ({ event, index }))
        .sort((a, b) => a.event.timestamp - b.event.timestamp || a.index - b.index)
        .map(({ event }) => event);
}
