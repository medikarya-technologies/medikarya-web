// Plays a live plan through the real engine the way a clinician checking it would: untreated, every essential
// treatment on time (scored through the server's replay), the same plus every harmful treatment, and every essential
// late. Shared by scripts and tests so they all exercise a plan the same way. Pure: no I/O.

import { createHash } from "crypto";
import type { SimulationCaseConfig } from "./case-schema";
import type { ClinicalEvent } from "./encounter-events";
import { EncounterEngine } from "./encounter-engine";
import { replayStudentEvents } from "./replay";
import { availableFlag, compileLivePlan, REASSESS_ID, requiredFlag, scoreBedside, type LivePlan, type LiveTreatment } from "./live-plan";

const MIN = 60;

export interface PlaythroughResult {
    score: number;
    items: Array<[string, string]>;
    harmful: string[];
    outcome: { stabilised: boolean; recovered: boolean; worst_stage: string | null };
    final: Record<string, string | number | undefined>;
    /** A hash of the full event log, so any change in what the engine did shows up. */
    events_sha: string;
}

export interface Playthroughs {
    untreated: PlaythroughResult;
    correct: PlaythroughResult;
    harmful: PlaythroughResult;
    late: PlaythroughResult;
    /**
     * Only in a plan with treatments that are required only in some states: the late path, plus each such treatment
     * given a minute after it becomes required (a late student who then rescues the patient). In such a plan the
     * correct and harmful paths also give each one a minute after it becomes required.
     */
    rescue?: PlaythroughResult;
}

/** JSON with keys sorted at every level, so equal objects hash equally whatever order they were built in. */
export function canonicalJson(v: unknown): string {
    const sort = (x: unknown): unknown =>
        Array.isArray(x) ? x.map(sort) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, sort((x as Record<string, unknown>)[k])])) : x;
    return JSON.stringify(sort(v));
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * What identifies a plan for the golden tests: everything that changes how it runs. Release blockers are records
 * about the case, not part of the physiology, so recording or clearing one does not make the golden test skip it.
 */
export function planSha(plan: unknown): string {
    const { release_blockers: _blockers, ...rest } = plan as Record<string, unknown>;
    return sha256(canonicalJson(rest));
}

/** The same for a compiled case, which carries its plan along. */
export function compiledSha(compiled: unknown): string {
    const c = compiled as Record<string, unknown>;
    const plan = c.live_plan as Record<string, unknown> | undefined;
    if (!plan || !("release_blockers" in plan)) return sha256(canonicalJson(c));
    const { release_blockers: _blockers, ...rest } = plan;
    return sha256(canonicalJson({ ...c, live_plan: rest }));
}

/**
 * The minutes at which a student who does everything right gives an essential treatment: from minute 1, a minute
 * apart, never after its window. A treatment that needs several doses gets each further dose as soon as its minimum
 * interval allows.
 */
function correctTimes(t: LiveTreatment, from: number, limit: number): number[] {
    return doseTimes(t, Math.min(from, t.within_minutes ?? limit));
}

/** Every dose a treatment needs, the first at `first` and each further one as soon as its interval allows. */
function doseTimes(t: LiveTreatment, first: number): number[] {
    const times = [first];
    for (let n = 2; n <= (t.doses_required ?? 1); n++) times.push(times[times.length - 1] + Math.max(1, t.min_interval_minutes ?? 1));
    return times;
}

function play(config: SimulationCaseConfig, plan: LivePlan, events: ClinicalEvent[] | null): PlaythroughResult {
    const limit = plan.time_limit_minutes;
    const engine = events ? replayStudentEvents(config, events) : new EncounterEngine(config);
    for (let m = 1; m <= limit; m++) engine.advanceTo(m * MIN);
    return result(config, plan, engine);
}

/** An essential treatment that cannot go on a fixed schedule: it is required, or on the tray, only in some states. */
const isConditional = (t: LiveTreatment) => t.role === "essential" && !!(t.required_when || t.available_when);

/**
 * The scheduled events, and each conditional essential a minute after it becomes required (or, if it is always
 * required, a minute after it becomes available), then replayed as the server would.
 */
function playRescue(config: SimulationCaseConfig, plan: LivePlan, scheduled: ClinicalEvent[]): PlaythroughResult {
    const limit = plan.time_limit_minutes;
    const conditional = plan.treatments.filter(isConditional);
    const engine = new EncounterEngine(config);
    const pending = [...scheduled];
    const done = new Set<string>();
    for (let m = 1; m <= limit; m++) {
        for (const t of conditional) {
            const due = t.required_when ? engine.state.flags[requiredFlag(t.id)] === true : engine.state.flags[availableFlag(t.id)] === true;
            if (!done.has(t.id) && due) {
                done.add(t.id);
                pending.push(given(t.id, m));
            }
        }
        pending.sort((a, b) => a.timestamp - b.timestamp);
        while (pending.length > 0 && pending[0].timestamp <= m * MIN) {
            const e = pending.shift() as ClinicalEvent & { action: string };
            engine.giveIntervention(e.action, e.timestamp);
        }
        engine.advanceTo(m * MIN);
    }
    // Scored from the server's replay of what was given, as a real attempt is.
    const replayed = replayStudentEvents(config, engine.events.filter((e) => e.type === "INTERVENTION_GIVEN"));
    for (let m = 1; m <= limit; m++) replayed.advanceTo(m * MIN);
    return result(config, plan, replayed);
}

function result(config: SimulationCaseConfig, plan: LivePlan, engine: EncounterEngine): PlaythroughResult {
    // The playthroughs run to the time limit, so that is when the encounter ends.
    const s = scoreBedside(config, plan, engine.events, plan.time_limit_minutes);
    const st = engine.state;
    return {
        score: s.score,
        items: s.items.map((i) => [i.id, i.status]),
        harmful: s.harmful.map((h) => h.id),
        outcome: s.outcome,
        final: { hr: st.rate, sbp: st.systolic, dbp: st.diastolic, spo2: st.spo2, rr: st.rr, temp: st.temperature, consciousness: st.consciousness, stability: st.stability, rhythm: st.rhythm },
        events_sha: sha256(canonicalJson(engine.events)),
    };
}

const given = (action: string, minutes: number): ClinicalEvent => ({ type: "INTERVENTION_GIVEN", timestamp: minutes * MIN, action, consequence: "x" });

/** A treatment's doses at these minutes, each further dose preceded by a reassessment when the plan asks for one. */
const dosesAt = (t: LiveTreatment, times: number[]): ClinicalEvent[] =>
    times.flatMap((at, i) => (i > 0 && t.reassess_before_repeat ? [given(REASSESS_ID, at), given(t.id, at)] : [given(t.id, at)]));

export function playthroughs(base: SimulationCaseConfig, plan: LivePlan): Playthroughs {
    const config = compileLivePlan(base, plan);
    const limit = plan.time_limit_minutes;
    const essentials = plan.treatments.filter((t) => t.role === "essential");

    const correct: ClinicalEvent[] = [];
    let next = 1;
    // A treatment required or available only in some states is given only once it is; on a fixed schedule it would be refused.
    for (const t of essentials.filter((x) => !isConditional(x))) {
        const times = correctTimes(t, next, limit);
        correct.push(...dosesAt(t, times));
        next = times[0] + 1;
    }
    correct.sort((a, b) => a.timestamp - b.timestamp);

    const harmful = [...correct, ...plan.treatments.filter((t) => t.role === "harmful").map((t, i) => given(t.id, next + i))].sort((a, b) => a.timestamp - b.timestamp);

    const late: ClinicalEvent[] = essentials
        .filter((t) => !isConditional(t))
        .flatMap((t) => dosesAt(t, doseTimes(t, Math.min(limit - 1, (t.within_minutes ?? 5) + 2)).map((at) => Math.min(limit - 1, at))))
        .sort((a, b) => a.timestamp - b.timestamp);

    // With treatments required only in some states, correct care also gives each one as soon as it is required.
    const conditional = plan.treatments.some(isConditional);
    return {
        untreated: play(config, plan, null),
        correct: conditional ? playRescue(config, plan, correct) : play(config, plan, correct),
        harmful: conditional ? playRescue(config, plan, harmful) : play(config, plan, harmful),
        late: play(config, plan, late),
        ...(conditional ? { rescue: playRescue(config, plan, late) } : {}),
    };
}
