// =========================
// lib/simulation/fluid-infusion.ts
// =========================
// A rate-controlled IV infusion: started at a rate, stepped down one rate at a time, stopped, or finished once its
// volume is in. Pure: everything is worked out from the flags the engine sets when the student acts and the times
// they were set, so the browser and the server's replay get the same answer from the same log.
//
// The student's actions are tray actions on the treatment: "<id>@<rate id>" starts it at that rate (once it is running,
// steps it down to that rate; once it is stopped, restarts it there), and "<id>@stop" stops it. They are ordinary INTERVENTION_GIVEN events, so the
// replay, refusals and scoring treat them like any other treatment. Finishing is never an action: the engine fires a
// rule the moment the volume is delivered (the fluid_delivered condition), and the server's replay regenerates it.
//
// Volumes are counted in mL x seconds per hour (rate in mL/h times seconds), summed in a fixed order, so the browser and
// the server add the same numbers the same way. Divide by 3600 for mL.

import type { CustomInterventionDef, FluidInfusionDef, FluidSchedule } from "./case-schema";

export const FLUID_STOP = "stop";

/** The tray action that starts the infusion at a rate, or steps it down to that rate. */
export const fluidAction = (id: string, level: string) => `${id}@${level}`;
export const fluidStopAction = (id: string) => fluidAction(id, FLUID_STOP);

/** "<id>@<rate id>" or "<id>@stop" as its parts; null for any other action. */
export function parseFluidAction(action: string): { id: string; level: string } | null {
    const at = action.indexOf("@");
    if (at <= 0 || at === action.length - 1) return null;
    return { id: action.slice(0, at), level: action.slice(at + 1) };
}

/**
 * How many times the infusion can run: started once, then restarted after a stop up to FLUID_RUNS - 1 times. Each run
 * has its own rate flags, so a restart never rewrites the history of the run before it (and its mistakes still count).
 */
export const FLUID_RUNS = 3;
/** The flags of run 1 keep their plain names; a restart's are numbered. */
const runTag = (n: number) => (n === 1 ? "" : `run${n}_`);

/** Set when the infusion first runs at this rate in this run (never cleared: the rate history is these flags' set times). */
export const fluidLevelFlag = (id: string, level: string, n = 1) => `fluid_${id}_${runTag(n)}at_${level}`;
export const fluidStoppedFlag = (id: string, n = 1) => `fluid_${id}_${runTag(n)}stopped`;
export const fluidCompletedFlag = (id: string) => `fluid_${id}_completed`;

/** What the fluid_delivered condition reads, one schedule per run: each rate's flag, in order, and the flags that end that run. */
export function fluidSchedules(id: string, def: FluidInfusionDef): FluidSchedule[] {
    return Array.from({ length: FLUID_RUNS }, (_, i) => ({
        levels: def.levels.map((l) => ({ flag: fluidLevelFlag(id, l.id, i + 1), ml_per_h: l.ml_per_h })),
        ends: [fluidStoppedFlag(id, i + 1), ...(def.volume_ml !== undefined ? [fluidCompletedFlag(id)] : [])],
    }));
}

type Flags = Readonly<Record<string, boolean>>;
type SetAt = Readonly<Record<string, number>>;

/** Each rate a run has run at, with when it began, in the order they began. */
function entered(s: FluidSchedule, flags: Flags, setAt: SetAt): Array<{ at: number; rate: number }> {
    return s.levels
        .filter((l) => flags[l.flag] === true && setAt[l.flag] !== undefined)
        .map((l) => ({ at: setAt[l.flag], rate: l.ml_per_h }))
        .sort((a, b) => a.at - b.at);
}

/** When a run ended (stopped or finished), if it has. */
function endedAt(s: FluidSchedule, flags: Flags, setAt: SetAt): number | undefined {
    const ends = s.ends.filter((f) => flags[f] === true && setAt[f] !== undefined).map((f) => setAt[f]);
    return ends.length > 0 ? Math.min(...ends) : undefined;
}

/** What one run has given by `time`, in mL x seconds per hour. */
function runRateSeconds(s: FluidSchedule, flags: Flags, setAt: SetAt, time: number): number {
    const until = Math.min(time, endedAt(s, flags, setAt) ?? Infinity);
    const rates = entered(s, flags, setAt);
    let sum = 0;
    rates.forEach((r, i) => {
        const end = Math.min(until, i + 1 < rates.length ? rates[i + 1].at : Infinity);
        if (end > r.at) sum += r.rate * (end - r.at);
    });
    return sum;
}

/** What has run in by `time` over every run, in mL x seconds per hour (runs added in order). */
export function deliveredRateSeconds(runs: readonly FluidSchedule[], flags: Flags, setAt: SetAt, time: number): number {
    return runs.reduce((sum, s) => sum + runRateSeconds(s, flags, setAt, time), 0);
}

/**
 * The instant at which `gteMl` will have run in at the current rate, rounded up to a whole second after the rate began;
 * null when nothing is running. The condition is checked there, and a second later if rounding left it a hair short.
 */
export function deliveredBoundary(runs: readonly FluidSchedule[], gteMl: number, flags: Flags, setAt: SetAt): number | null {
    // The run that is running: it has begun and not ended (a later run begins only after the one before it stopped).
    const current = runs.find((s) => entered(s, flags, setAt).length > 0 && endedAt(s, flags, setAt) === undefined);
    if (!current) return null;
    const rates = entered(current, flags, setAt);
    const last = rates[rates.length - 1];
    if (!(last.rate > 0)) return null;
    const need = gteMl * 3600 - deliveredRateSeconds(runs, flags, setAt, last.at);
    if (need <= 0) return last.at;
    const at = last.at + Math.ceil(need / last.rate);
    return deliveredRateSeconds(runs, flags, setAt, at) >= gteMl * 3600 ? at : at + 1;
}

export interface FluidStatus {
    state: "not_started" | "running" | "stopped" | "completed";
    /** The rate it is (or was last) running at. */
    level: string | null;
    /** When it began running at that rate. */
    since: number | null;
    startedAt: number | null;
    /** When it was stopped or finished. */
    endedAt: number | null;
    deliveredMl: number;
    /** Only when it was set to give a volume. */
    remainingMl: number | null;
    /** Which run this is (1 until it is restarted), and whether a stopped infusion can still be restarted. */
    run: number;
    canRestart: boolean;
}

/** The infusion as the tray shows it, at `time`: its rate, how much has gone in and how much is left. */
export function fluidStatus(id: string, def: FluidInfusionDef, flags: Flags, setAt: SetAt, time: number): FluidStatus {
    const runs = fluidSchedules(id, def);
    const begun = (n: number) => def.levels.filter((l) => flags[fluidLevelFlag(id, l.id, n)] === true && setAt[fluidLevelFlag(id, l.id, n)] !== undefined);
    let n = 1;
    while (n < FLUID_RUNS && begun(n + 1).length > 0) n++;
    const byStart = begun(n).sort((a, b) => setAt[fluidLevelFlag(id, a.id, n)] - setAt[fluidLevelFlag(id, b.id, n)]);
    const current = byStart[byStart.length - 1];
    const first = begun(1).sort((a, b) => setAt[fluidLevelFlag(id, a.id)] - setAt[fluidLevelFlag(id, b.id)])[0];
    const raw = Math.floor(deliveredRateSeconds(runs, flags, setAt, time) / 3600);
    const delivered = def.volume_ml !== undefined ? Math.min(def.volume_ml, raw) : raw;
    const completed = flags[fluidCompletedFlag(id)] === true;
    const stopped = flags[fluidStoppedFlag(id, n)] === true;
    return {
        state: !current ? "not_started" : completed ? "completed" : stopped ? "stopped" : "running",
        level: current?.id ?? null,
        since: current ? setAt[fluidLevelFlag(id, current.id, n)] : null,
        startedAt: first ? setAt[fluidLevelFlag(id, first.id)] : null,
        endedAt: endedAt(runs[n - 1], flags, setAt) ?? null,
        deliveredMl: delivered,
        remainingMl: def.volume_ml !== undefined ? Math.max(0, def.volume_ml - delivered) : null,
        run: n,
        canRestart: stopped && !completed && n < FLUID_RUNS,
    };
}

/** Labels for a case's infusion actions ("IV crystalloid: 7 to 10 mL/kg/h", "IV crystalloid: stopped"), for the timeline and the tray's history. */
export function fluidActionLabels(own: readonly CustomInterventionDef[] | undefined): Map<string, string> {
    const out = new Map<string, string>();
    for (const t of own ?? []) {
        if (!t.fluid) continue;
        for (const l of t.fluid.levels) out.set(fluidAction(t.id, l.id), `${t.label}: ${l.label}`);
        out.set(fluidStopAction(t.id), `${t.label}: stopped`);
    }
    return out;
}
