// Plays a live plan through the real engine the way a clinician checking it would: untreated, every essential
// treatment on time (scored through the server's replay), the same plus every harmful treatment, and every essential
// late. Shared by scripts and tests so they all exercise a plan the same way. Pure: no I/O.

import { createHash } from "crypto";
import type { SimulationCaseConfig } from "./case-schema";
import type { ClinicalEvent } from "./encounter-events";
import { EncounterEngine } from "./encounter-engine";
import { replayStudentEvents } from "./replay";
import { compileLivePlan, scoreBedside, type LivePlan, type LiveTreatment } from "./live-plan";

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
}

/** JSON with keys sorted at every level, so equal objects hash equally whatever order they were built in. */
export function canonicalJson(v: unknown): string {
    const sort = (x: unknown): unknown =>
        Array.isArray(x) ? x.map(sort) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, sort((x as Record<string, unknown>)[k])])) : x;
    return JSON.stringify(sort(v));
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

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
    const s = scoreBedside(config, plan, engine.events);
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

export function playthroughs(base: SimulationCaseConfig, plan: LivePlan): Playthroughs {
    const config = compileLivePlan(base, plan);
    const limit = plan.time_limit_minutes;
    const essentials = plan.treatments.filter((t) => t.role === "essential");

    const correct: ClinicalEvent[] = [];
    let next = 1;
    for (const t of essentials) {
        const times = correctTimes(t, next, limit);
        for (const at of times) correct.push(given(t.id, at));
        next = times[0] + 1;
    }
    correct.sort((a, b) => a.timestamp - b.timestamp);

    const harmful = [...correct, ...plan.treatments.filter((t) => t.role === "harmful").map((t, i) => given(t.id, next + i))].sort((a, b) => a.timestamp - b.timestamp);

    const late: ClinicalEvent[] = essentials
        .flatMap((t) => doseTimes(t, Math.min(limit - 1, (t.within_minutes ?? 5) + 2)).map((at) => given(t.id, Math.min(limit - 1, at))))
        .sort((a, b) => a.timestamp - b.timestamp);

    return { untreated: play(config, plan, null), correct: play(config, plan, correct), harmful: play(config, plan, harmful), late: play(config, plan, late) };
}
