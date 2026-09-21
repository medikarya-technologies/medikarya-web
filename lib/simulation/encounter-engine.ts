// =========================
// lib/simulation/encounter-engine.ts
// =========================
// The framework-free core of the ClinicalEventManager.
//
//   Any ClinicalEvent dispatched
//        ↓
//   EncounterEngine.dispatch()
//        ↓  append to the log, fold into PatientState
//   PatientState.due()  — time + action/flag + physiology triggers
//        ↓
//   STATE_TRANSITION / PATIENT_DETERIORATED appended to the same log
//        ↓
//   vitals · telemetry · nurse alert all re-render from the new state
//
// The engine owns the log and nothing else. It is time-agnostic — callers pass
// timestamps — so the React clock, a server-side replay and a unit test all
// drive it identically.
//
// Ordering rule: ACTIONS WIN TIES. Before an event is applied, only
// transitions due strictly *before* its timestamp fire; the ones due exactly at
// that instant are evaluated after, so an intervention at 15:00.0 beats a rule
// that becomes true at 15:00.0.

import type { AssistType, ClinicalEvent } from "./encounter-events";
import { hardLimitSeconds, type SimulationCaseConfig } from "./case-schema";
import { PatientState, type PatientSnapshot, type StateTransition } from "./patient-state";
import { AssistPolicy, resolveAssistPolicy, type AssistDenialReason } from "./assist-policy";

export interface EncounterSnapshot {
    /** Bumps on every change; use as the external-store version. */
    version: number;
    events: readonly ClinicalEvent[];
    patient: PatientSnapshot;
}

export type AssistResult =
    | { ok: true; cost: number; /** false when this assist was already paid for */ charged: boolean; appended: ClinicalEvent[] }
    | { ok: false; reason: AssistDenialReason };

export interface InterventionResult {
    appended: ClinicalEvent[];
    /** The trajectory note shown to the student. */
    consequence: string;
    /** True when the action was flagged unsafe in the current state. */
    safetyPenalty: boolean;
}

export class EncounterEngine {
    readonly policy: AssistPolicy;
    private readonly log: ClinicalEvent[] = [];
    private readonly patient: PatientState;
    private readonly listeners = new Set<() => void>();
    private readonly limitSeconds: number;
    private version = 0;
    private cached: EncounterSnapshot;

    constructor(
        readonly config: SimulationCaseConfig,
        initialEvents: readonly ClinicalEvent[] = []
    ) {
        this.policy = resolveAssistPolicy(config.assist_config);
        this.limitSeconds = hardLimitSeconds(config);
        this.patient = PatientState.initial(config);
        for (const event of initialEvents) this.appendRaw(event);
        this.cached = this.buildSnapshot();
    }

    // ── Reading ─────────────────────────────────────────────────────────────

    get events(): readonly ClinicalEvent[] {
        return this.log;
    }

    /** Live patient state. Treat as read-only — change it by dispatching events. */
    get state(): PatientState {
        return this.patient;
    }

    get lastTimestamp(): number {
        return this.log.length > 0 ? this.log[this.log.length - 1].timestamp : 0;
    }

    /** Seconds at which the encounter is force-ended. */
    get hardLimitSeconds(): number {
        return this.limitSeconds;
    }

    // useSyncExternalStore-compatible

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = (): EncounterSnapshot => this.cached;

    // ── Driving time ────────────────────────────────────────────────────────

    /**
     * Advance the simulation clock to `seconds`, firing every rule that became
     * true on the way (each stamped at the instant it became true).
     */
    advanceTo(seconds: number): ClinicalEvent[] {
        const appended = this.fireDue(seconds, true);
        if (appended.length > 0) this.commit();
        return appended;
    }

    // ── Dispatching ─────────────────────────────────────────────────────────

    /** Append any event, firing whatever is due before it and because of it. Returns everything appended, in log order. */
    dispatch(event: ClinicalEvent): ClinicalEvent[] {
        const t = Math.max(event.timestamp, this.lastTimestamp);
        const stamped = { ...event, timestamp: t } as ClinicalEvent;

        const appended = this.fireDue(t, false);
        this.appendRaw(stamped);
        appended.push(stamped);
        appended.push(...this.fireDue(t, true));

        this.commit();
        return appended;
    }

    takeHistory(question: string, response: string, timestamp: number): ClinicalEvent[] {
        return this.dispatch({ type: "HISTORY_TAKEN", timestamp, question, response });
    }

    performExam(manoeuvre: string, findings: string, timestamp: number): ClinicalEvent[] {
        return this.dispatch({ type: "EXAM_PERFORMED", timestamp, manoeuvre, findings });
    }

    orderTest(testId: string, testName: string, timestamp: number): ClinicalEvent[] {
        return this.dispatch({ type: "TEST_ORDERED", timestamp, testId, testName });
    }

    interpretResult(
        testId: string,
        studentInterpretation: string,
        timestamp: number,
        orderTimestamp?: number
    ): ClinicalEvent[] {
        return this.dispatch({
            type: "RESULT_INTERPRETED",
            timestamp,
            testId,
            studentInterpretation,
            ...(orderTimestamp !== undefined ? { orderTimestamp } : {}),
        });
    }

    submitDifferential(ranked: string[], timestamp: number): ClinicalEvent[] {
        return this.dispatch({ type: "DIFFERENTIAL_SUBMITTED", timestamp, ranked });
    }

    submitDiagnosis(primary: string, reasoning: string, timestamp: number): ClinicalEvent[] {
        return this.dispatch({ type: "DIAGNOSIS_SUBMITTED", timestamp, primary, reasoning });
    }

    submitManagement(steps: string[], timestamp: number): ClinicalEvent[] {
        return this.dispatch({ type: "MANAGEMENT_SUBMITTED", timestamp, steps });
    }

    /**
     * Give an intervention. The consequence text is resolved against the
     * patient's state at this instant (after anything already due has fired)
     * and stored on the event, so the log alone explains what the student saw.
     */
    giveIntervention(action: string, timestamp: number): InterventionResult {
        const t = Math.max(timestamp, this.lastTimestamp);
        const appended = this.fireDue(t, false);

        const matched = this.patient.resolveConsequences(action, t);
        const notes = matched.map((m) => m.trajectory_note).filter((n): n is string => !!n);
        const consequence = notes.length > 0 ? notes.join(" ") : "Administered.";
        const safetyPenalty = matched.some((m) => m.safety_penalty === true);

        const event: ClinicalEvent = { type: "INTERVENTION_GIVEN", timestamp: t, action, consequence };
        this.appendRaw(event);
        appended.push(event);
        appended.push(...this.fireDue(t, true));

        this.commit();
        return { appended, consequence, safetyPenalty };
    }

    // ── Assists ─────────────────────────────────────────────────────────────

    /**
     * Spend an assist. The case's assist ladder is enforced here: a disabled or
     * unlisted type is refused and nothing is logged. Asking again for the same
     * (type, target) is free — you've already paid for that help.
     */
    requestAssist(type: AssistType, timestamp: number, target?: string): AssistResult {
        const availability = this.policy.availability(type);
        if (!availability.available) return { ok: false, reason: availability.reason! };

        if (target !== undefined && this.hasAssist(type, target)) {
            return { ok: true, cost: 0, charged: false, appended: [] };
        }
        const appended = this.dispatch({
            type: "ASSIST_USED",
            timestamp,
            assistType: type,
            cost: availability.cost,
            ...(target !== undefined ? { target } : {}),
        });
        return { ok: true, cost: availability.cost, charged: true, appended };
    }

    /**
     * Reveal the expert read of a result. Charged to the Independent track only:
     * the assist is logged (ASSIST_USED) and so is the fact of the reveal
     * (RESULT_REVEALED). Revealing the same order again is free.
     */
    revealResult(args: {
        testId: string;
        orderTimestamp: number;
        revealType: "impression" | "hint";
        assistType: AssistType;
        timestamp: number;
    }): AssistResult {
        const { testId, orderTimestamp, revealType, assistType, timestamp } = args;
        const target = `${testId}@${orderTimestamp}`;

        const result = this.requestAssist(assistType, timestamp, target);
        if (!result.ok) return result;

        const alreadyRevealed = this.log.some(
            (e) =>
                e.type === "RESULT_REVEALED" &&
                e.testId === testId &&
                e.orderTimestamp === orderTimestamp &&
                e.revealType === revealType
        );
        if (alreadyRevealed) return result;

        const appended = this.dispatch({
            type: "RESULT_REVEALED",
            timestamp,
            testId,
            revealType,
            orderTimestamp,
        });
        return { ...result, appended: [...result.appended, ...appended] };
    }

    private hasAssist(type: AssistType, target: string): boolean {
        return this.log.some((e) => e.type === "ASSIST_USED" && e.assistType === type && e.target === target);
    }

    // ── Internals ───────────────────────────────────────────────────────────

    private appendRaw(event: ClinicalEvent): void {
        this.log.push(event);
        this.patient.apply(event);
    }

    /**
     * Fire every transition due up to `t`. A cascade (rule B enabled by rule A)
     * is handled by looping; each rule fires at most once, so it terminates.
     * Nothing fires after the encounter's hard limit.
     */
    private fireDue(t: number, inclusive: boolean): ClinicalEvent[] {
        const appended: ClinicalEvent[] = [];
        const cap = Math.min(t, this.limitSeconds);
        const inc = inclusive || t > this.limitSeconds;

        for (let guard = 0; guard < 256; guard++) {
            const transition = this.patient.due(cap, { inclusive: inc });
            if (!transition) break;
            for (const event of transitionEvents(transition)) {
                this.appendRaw(event);
                appended.push(event);
            }
        }
        return appended;
    }

    private commit(): void {
        this.version += 1;
        this.cached = this.buildSnapshot();
        for (const listener of this.listeners) listener();
    }

    private buildSnapshot(): EncounterSnapshot {
        return { version: this.version, events: [...this.log], patient: this.patient.snapshot() };
    }
}

/** The events that record a transition: always the transition, plus a nurse alert when it has a narrative. */
export function transitionEvents(transition: StateTransition): ClinicalEvent[] {
    const events: ClinicalEvent[] = [
        {
            type: "STATE_TRANSITION",
            timestamp: transition.at,
            from: transition.from,
            to: transition.to,
            trigger: transition.ruleId,
        },
    ];
    if (transition.narrative) {
        events.push({
            type: "PATIENT_DETERIORATED",
            timestamp: transition.at,
            narrative: transition.narrative,
            ruleId: transition.ruleId,
        });
    }
    return events;
}
