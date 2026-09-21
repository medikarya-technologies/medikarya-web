// =========================
// lib/simulation/patient-state.ts
// =========================
// The Clinical State Engine. Pure TypeScript — no UI, no I/O.
//
// PatientState is a fold over the encounter event log:
//
//     state = fold(initial_state, events)
//
// so the same log + the same rules always produce the same patient. The only
// way state changes is by applying an event (`apply`). Deciding *whether* the
// patient should deteriorate right now is `evaluate` / `due`: they inspect the
// state and return the transition that is due, but never mutate anything. The
// caller (EncounterEngine) records that transition as events, which are then
// folded like any other.
//
// Rules are discrete-event scheduled: instead of polling, `due` computes the
// exact instants at which a time-dependent condition can flip and evaluates
// the rules there, so a rule fires at the moment it becomes true no matter how
// often (or how rarely) the UI ticks.

import type { ClinicalEvent } from "./encounter-events";
import type {
    ActionConsequence,
    Consciousness,
    EventRule,
    PhysiologicalChanges,
    RhythmType,
    SimulationCaseConfig,
    StabilityLevel,
    StateThreshold,
} from "./case-schema";
import {
    collectTimeBoundaries,
    computeAlarms,
    evaluateCondition,
    meanArterialPressure,
    type ConditionContext,
    type PhysiologySnapshot,
} from "./conditions";
import { textMatchesAll, textMatchesAny } from "./text-match";

// ── Public shapes ───────────────────────────────────────────────────────────

/** A transition that is due. Recording it as events is the caller's job. */
export interface StateTransition {
    ruleId: string;
    from: string;
    to: string;
    /** Exact simulation second at which the rule became true. */
    at: number;
    physiologicalChanges: PhysiologicalChanges | null;
    /** Nurse alert text with placeholders filled from the post-change vitals. `null` = silent. */
    narrative: string | null;
}

export interface SafetyEvent {
    timestamp: number;
    action: string;
    note?: string;
}

/** Plain, JSON-safe view of the patient. */
export interface PatientSnapshot {
    state: string;
    rhythm: RhythmType;
    rate: number;
    systolic: number;
    diastolic: number;
    map: number;
    spo2: number;
    rr: number;
    temperature: number;
    consciousness: Consciousness;
    stability: StabilityLevel;
    flags: Record<string, boolean>;
    flagSetAt: Record<string, number>;
    alarms: string[];
    firedRules: string[];
    safetyEvents: SafetyEvent[];
    lastEventTime: number;
}

/** Condition-grammar view of a plain snapshot (the UI holds snapshots, not PatientState instances). */
export function snapshotContext(s: PatientSnapshot, time: number = s.lastEventTime): ConditionContext {
    return {
        time,
        flags: s.flags,
        flagSetAt: s.flagSetAt,
        state: s.state,
        physiology: {
            hr: s.rate,
            sbp: s.systolic,
            dbp: s.diastolic,
            map: s.map,
            spo2: s.spo2,
            rr: s.rr,
            temperature: s.temperature,
            rhythm: s.rhythm,
            consciousness: s.consciousness,
        },
        alarms: s.alarms,
    };
}

// ── Delta parsing ───────────────────────────────────────────────────────────

/** "+8" → 8, "-3" → -3, 5 → 5. `null` when unparseable (the validator reports it). */
export function tryParseDelta(value: string | number | undefined): number | null {
    if (value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const m = /^\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(value);
    return m ? Number(m[1]) : null;
}

/** "-14/-8" → [-14, -8]. A lone value moves systolic by that amount and diastolic by 60% of it. */
export function tryParseBpDelta(value: string | undefined): [number, number] | null {
    if (value === undefined) return [0, 0];
    const pair = /^\s*([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(value);
    if (pair) return [Number(pair[1]), Number(pair[2])];
    const single = tryParseDelta(value);
    return single === null ? null : [single, Math.round(single * 0.6)];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const RHYTHM_LABELS: Record<RhythmType, string> = {
    sinus_normal: "sinus rhythm",
    sinus_tachycardia: "sinus tachycardia",
    sinus_bradycardia: "sinus bradycardia",
    afib: "atrial fibrillation",
    flutter: "atrial flutter",
    complete_heart_block: "complete heart block",
    pvc_occasional: "occasional ventricular ectopics",
    pvc_frequent: "frequent ventricular ectopics",
    pvc_bigeminy: "ventricular bigeminy",
    vt_sustained: "ventricular tachycardia",
    vf: "ventricular fibrillation",
};

export function rhythmLabel(rhythm: RhythmType): string {
    return RHYTHM_LABELS[rhythm] ?? rhythm;
}

/**
 * Fills {hr} {bp} {sbp} {dbp} {map} {spo2} {rr} {rhythm} {temp} from the
 * patient's current vitals — used for nurse alerts, exam findings and hints so
 * authored prose can never disagree with the numbers on the monitor.
 */
export function interpolateVitals(
    template: string,
    p: Pick<PatientState, "rate" | "systolic" | "diastolic" | "map" | "spo2" | "rr" | "rhythm" | "temperature">
): string {
    const values: Record<string, string> = {
        hr: String(p.rate),
        bp: `${p.systolic}/${p.diastolic}`,
        sbp: String(p.systolic),
        dbp: String(p.diastolic),
        map: String(p.map),
        spo2: String(p.spo2),
        rr: String(p.rr),
        rhythm: rhythmLabel(p.rhythm),
        temp: p.temperature.toFixed(1),
    };
    return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}

// ── PatientState ────────────────────────────────────────────────────────────

export class PatientState {
    state: string;
    rhythm: RhythmType;
    rate: number;
    systolic: number;
    diastolic: number;
    spo2: number;
    rr: number;
    temperature: number;
    consciousness: Consciousness;
    stability: StabilityLevel;
    flags: Record<string, boolean>;
    flagSetAt: Record<string, number> = {};
    alarms: string[] = [];
    firedRules: Set<string> = new Set();
    safetyEvents: SafetyEvent[] = [];
    lastEventTime = 0;

    private constructor(private readonly config: SimulationCaseConfig) {
        const init = config.initial_state;
        const vitals = config.patient?.vitalSigns;

        this.state = init.state ?? "baseline";
        this.rhythm = init.rhythm;
        this.rate = init.rate ?? vitals?.heartRate?.value ?? 80;
        this.systolic = init.systolic ?? vitals?.bloodPressure?.systolic ?? 120;
        this.diastolic = init.diastolic ?? vitals?.bloodPressure?.diastolic ?? 80;
        this.spo2 = init.spo2 ?? vitals?.oxygenSaturation?.value ?? 98;
        this.rr = init.rr ?? vitals?.respiratoryRate?.value ?? 16;
        this.temperature = init.temperature ?? vitals?.temperature?.value ?? 36.8;
        this.consciousness = init.consciousness ?? "alert";
        this.stability = init.stability;
        this.flags = { ...init.flags };
        this.refreshAlarms();
    }

    /** The patient at minute zero. */
    static initial(config: SimulationCaseConfig): PatientState {
        return new PatientState(config);
    }

    /** The patient after every event in the log has been folded in order. */
    static fromEvents(config: SimulationCaseConfig, events: readonly ClinicalEvent[]): PatientState {
        const patient = new PatientState(config);
        for (const event of events) patient.apply(event);
        return patient;
    }

    get map(): number {
        return meanArterialPressure(this.systolic, this.diastolic);
    }

    clone(): PatientState {
        const c = new PatientState(this.config);
        c.state = this.state;
        c.rhythm = this.rhythm;
        c.rate = this.rate;
        c.systolic = this.systolic;
        c.diastolic = this.diastolic;
        c.spo2 = this.spo2;
        c.rr = this.rr;
        c.temperature = this.temperature;
        c.consciousness = this.consciousness;
        c.stability = this.stability;
        c.flags = { ...this.flags };
        c.flagSetAt = { ...this.flagSetAt };
        c.alarms = [...this.alarms];
        c.firedRules = new Set(this.firedRules);
        c.safetyEvents = this.safetyEvents.map((s) => ({ ...s }));
        c.lastEventTime = this.lastEventTime;
        return c;
    }

    snapshot(): PatientSnapshot {
        return {
            state: this.state,
            rhythm: this.rhythm,
            rate: this.rate,
            systolic: this.systolic,
            diastolic: this.diastolic,
            map: this.map,
            spo2: this.spo2,
            rr: this.rr,
            temperature: this.temperature,
            consciousness: this.consciousness,
            stability: this.stability,
            flags: { ...this.flags },
            flagSetAt: { ...this.flagSetAt },
            alarms: [...this.alarms],
            firedRules: [...this.firedRules],
            safetyEvents: this.safetyEvents.map((s) => ({ ...s })),
            lastEventTime: this.lastEventTime,
        };
    }

    /** Condition-grammar view of the patient at `time`. */
    context(time: number = this.lastEventTime): ConditionContext {
        return {
            time,
            flags: this.flags,
            flagSetAt: this.flagSetAt,
            state: this.state,
            physiology: this.physiology(),
            alarms: this.alarms,
        };
    }

    private physiology(): PhysiologySnapshot {
        return {
            hr: this.rate,
            sbp: this.systolic,
            dbp: this.diastolic,
            map: this.map,
            spo2: this.spo2,
            rr: this.rr,
            temperature: this.temperature,
            rhythm: this.rhythm,
            consciousness: this.consciousness,
        };
    }

    private refreshAlarms(): void {
        this.alarms = computeAlarms(this.config.state_thresholds, this.physiology());
    }

    // ── Folding events ──────────────────────────────────────────────────────

    /**
     * Fold one event into the state. This is the ONLY mutation path — the
     * engine appends an event to the log and applies it here, so live play and
     * a from-scratch replay of the log cannot diverge.
     */
    apply(event: ClinicalEvent): void {
        this.lastEventTime = Math.max(this.lastEventTime, event.timestamp);

        if (event.type === "STATE_TRANSITION") {
            const rule = this.config.event_rules.find((r) => r.id === event.trigger);
            if (rule) {
                this.firedRules.add(rule.id);
                this.applyRuleEffects(rule, event.timestamp);
            }
            this.state = event.to;
        } else {
            for (const key of this.actionKeysFor(event)) {
                this.applyAction(key, event.timestamp);
            }
        }

        this.refreshAlarms();
    }

    /** Action keys an event maps to — the vocabulary `action_consequences` is written in. */
    private actionKeysFor(event: ClinicalEvent): string[] {
        switch (event.type) {
            case "TEST_ORDERED":
                return [`${event.testId}_ordered`];
            case "EXAM_PERFORMED":
                return [`${event.manoeuvre}_performed`];
            case "INTERVENTION_GIVEN":
                return [event.action];
            case "RESULT_INTERPRETED": {
                const keys = this.recognise("interpretation", event.studentInterpretation, event.testId);
                const consequence = this.config.investigation_results?.[event.testId]?.state_consequence;
                if (consequence) keys.push(consequence);
                return keys;
            }
            case "DIFFERENTIAL_SUBMITTED":
                return event.ranked[0] ? this.recognise("differential", event.ranked[0]) : [];
            case "DIAGNOSIS_SUBMITTED":
                return this.recognise("diagnosis", event.primary);
            default:
                return [];
        }
    }

    private recognise(
        source: "interpretation" | "differential" | "diagnosis",
        text: string,
        testId?: string
    ): string[] {
        const keys: string[] = [];
        for (const rule of this.config.recognition_rules ?? []) {
            if (!rule.sources.includes(source)) continue;
            if (source === "interpretation" && rule.testId && rule.testId !== testId) continue;
            if (!textMatchesAny(text, rule.any_of)) continue;
            if (rule.all_of && !textMatchesAll(text, rule.all_of)) continue;
            if (!keys.includes(rule.action)) keys.push(rule.action);
        }
        return keys;
    }

    /**
     * Consequences of `action` that apply right now. Every guard is evaluated
     * against the state BEFORE any of them is applied, so authoring order can't
     * change the outcome.
     */
    resolveConsequences(action: string, time: number = this.lastEventTime): ActionConsequence[] {
        const ctx = this.context(time);
        return this.config.action_consequences.filter(
            (c) => c.action === action && (!c.when || evaluateCondition(c.when, ctx))
        );
    }

    private applyAction(action: string, time: number): void {
        const matched = this.resolveConsequences(action, time);
        for (const consequence of matched) {
            this.applySets(consequence.sets, time);
            if (consequence.physiological_changes) this.applyChanges(consequence.physiological_changes);
            if (consequence.safety_penalty) {
                this.safetyEvents.push({ timestamp: time, action, note: consequence.trajectory_note });
            }
        }
    }

    private applyRuleEffects(rule: EventRule, time: number): void {
        if (rule.physiological_changes) this.applyChanges(rule.physiological_changes);
        this.applySets(rule.sets, time);
        const emitted = rule.emits === undefined ? [] : Array.isArray(rule.emits) ? rule.emits : [rule.emits];
        for (const action of emitted) this.applyAction(action, time);
    }

    private applySets(sets: Record<string, boolean> | undefined, time: number): void {
        if (!sets) return;
        for (const [name, value] of Object.entries(sets)) this.setFlag(name, value, time);
    }

    private setFlag(name: string, value: boolean, time: number): void {
        const wasTrue = this.flags[name] === true;
        this.flags[name] = value;
        if (value && !wasTrue) this.flagSetAt[name] = time;
        if (!value) delete this.flagSetAt[name];
    }

    private applyChanges(changes: PhysiologicalChanges): void {
        if (changes.hr_set !== undefined) this.rate = changes.hr_set;
        this.rate += tryParseDelta(changes.hr_delta) ?? 0;

        const [dSys, dDia] = tryParseBpDelta(changes.bp_delta) ?? [0, 0];
        this.systolic += dSys;
        this.diastolic += dDia;

        this.spo2 += tryParseDelta(changes.spo2_delta) ?? 0;
        this.rr += tryParseDelta(changes.rr_delta) ?? 0;
        this.temperature += tryParseDelta(changes.temp_delta) ?? 0;

        if (changes.rhythm) this.rhythm = changes.rhythm;
        if (changes.consciousness) this.consciousness = changes.consciousness;
        if (changes.stability) this.stability = changes.stability;

        // Keep vitals physiologically possible; VF/asystole-style states are expressed through rhythm.
        this.rate = Math.round(clamp(this.rate, 0, 240));
        this.systolic = Math.round(clamp(this.systolic, 30, 260));
        this.diastolic = Math.round(clamp(this.diastolic, 15, Math.min(160, this.systolic - 10)));
        this.spo2 = Math.round(clamp(this.spo2, 50, 100));
        this.rr = Math.round(clamp(this.rr, 4, 60));
        this.temperature = Math.round(clamp(this.temperature, 32, 42) * 10) / 10;
    }

    // ── Deciding what is due ────────────────────────────────────────────────

    /**
     * The transition that is due at or before `elapsedMinutes`, derived from
     * the event log alone. Deterministic: the same log + the same rules always
     * yield the same answer. Does not mutate anything.
     *
     * `eventRules` / `stateThresholds` default to the case's own, and exist so
     * the decision can be tested in isolation against arbitrary rule sets.
     */
    evaluate(
        events: readonly ClinicalEvent[],
        eventRules: readonly EventRule[] = this.config.event_rules,
        stateThresholds: readonly StateThreshold[] = this.config.state_thresholds ?? [],
        elapsedMinutes: number
    ): StateTransition | null {
        const replayed = PatientState.fromEvents(
            { ...this.config, event_rules: [...eventRules], state_thresholds: [...stateThresholds] },
            events
        );
        return replayed.due(elapsedMinutes * 60, { inclusive: true });
    }

    /**
     * The earliest transition due at or before `untilSeconds` (`inclusive`) or
     * strictly before it. Rules are tried in authored order at each instant,
     * and each rule fires at most once.
     */
    due(untilSeconds: number, options: { inclusive: boolean }): StateTransition | null {
        const unfired = this.config.event_rules.filter((r) => !this.firedRules.has(r.id));
        if (unfired.length === 0) return null;

        const t0 = this.lastEventTime;
        const inWindow = (t: number) => (options.inclusive ? t <= untilSeconds : t < untilSeconds);

        // Instants at which anything time-dependent can change truth value.
        const instants = new Set<number>();
        if (inWindow(t0)) instants.add(t0);
        const ctx0 = this.context(t0);
        for (const rule of unfired) {
            for (const boundary of collectTimeBoundaries(rule.when, ctx0)) {
                if (boundary > t0 && inWindow(boundary)) instants.add(boundary);
            }
        }

        for (const at of [...instants].sort((a, b) => a - b)) {
            const ctx = this.context(at);
            for (const rule of unfired) {
                if (evaluateCondition(rule.when, ctx)) return this.makeTransition(rule, at);
            }
        }
        return null;
    }

    private makeTransition(rule: EventRule, at: number): StateTransition {
        const after = this.clone();
        after.applyRuleEffects(rule, at);
        return {
            ruleId: rule.id,
            from: this.state,
            to: rule.transition,
            at,
            physiologicalChanges: rule.physiological_changes ?? null,
            narrative: rule.narrative ? interpolateVitals(rule.narrative, after) : null,
        };
    }
}
