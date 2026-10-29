// Waiting at the bedside: which waits to offer, and what to tell the student happened while the clock ran on.
// The wait itself is the engine's (EncounterEngine.skipTime): it stops early at the first nurse alert, so a skip never
// sleeps through a deterioration. This file only decides the choices and words the summary. Pure, so it is tested.

import type { Consciousness } from "./case-schema";
import type { PatientSnapshot } from "./patient-state";

/** Wait lengths in minutes. A case that runs for hours (a fluid taper, a slow result) also offers hour steps. */
const SHORT_WAITS = [1, 5];
const LONG_WAITS = [1, 5, 15, 30, 60, 120, 240];

/** The waits that still fit in what is left of the encounter. */
export function waitSteps(limitSeconds: number, now: number): number[] {
    const left = (limitSeconds - now) / 60;
    return (limitSeconds > 3600 ? LONG_WAITS : SHORT_WAITS).filter((m) => m <= left);
}

/** "45 s", "4 min 45 s", "5 min", "1 h", "1 h 30 min". Seconds only under 10 minutes, where they tell an early stop apart. */
export function formatSpan(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s} s`;
    // Within 2 s of a whole minute is that minute: a wait starts a moment after the button press, so "4 min 59 s" means 5.
    const near = s % 60 <= 2 || s % 60 >= 58;
    if (s < 600 && !near) return `${Math.floor(s / 60)} min ${s % 60} s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return m % 60 === 0 ? `${h} h` : `${h} h ${m % 60} min`;
}

export interface SkipReport {
    /** Simulation seconds the wait began and ended at. */
    from: number;
    to: number;
    stopped: "alert" | "limit" | null;
    before: PatientSnapshot;
    after: PatientSnapshot;
    /** Tests whose results came back during the wait. */
    resultsBack: string[];
    /** Vitals the case never measured: the summary does not reveal them. */
    unmeasured?: readonly string[];
}

export interface SkipSummary {
    title: string;
    /** What changed on the monitor and what came back, as short sentences. */
    lines: string[];
}

const CONSCIOUSNESS: Record<Consciousness, string> = {
    alert: "alert",
    anxious: "anxious",
    drowsy: "drowsy",
    altered: "confused",
    unresponsive: "unresponsive",
};

/** What the student is told after a wait: how long passed, why it stopped early, and what changed. */
export function describeSkip(r: SkipReport): SkipSummary {
    const passed = formatSpan(r.to - r.from);
    const title =
        r.stopped === "alert"
            ? `Stopped after ${passed}: the nurse is calling`
            : r.stopped === "limit"
              ? `${passed} passed: the encounter has ended`
              : `${passed} passed`;

    const hidden = new Set(r.unmeasured ?? []);
    const { before: b, after: a } = r;
    const vitals: Array<{ key: string; label: string; was: string; now: string }> = [
        { key: "hr", label: "pulse", was: String(Math.round(b.rate)), now: String(Math.round(a.rate)) },
        { key: "bp", label: "BP", was: `${Math.round(b.systolic)}/${Math.round(b.diastolic)}`, now: `${Math.round(a.systolic)}/${Math.round(a.diastolic)}` },
        { key: "spo2", label: "SpO2", was: `${Math.round(b.spo2)}%`, now: `${Math.round(a.spo2)}%` },
        { key: "rr", label: "RR", was: String(Math.round(b.rr)), now: String(Math.round(a.rr)) },
    ].filter((v) => !hidden.has(v.key));

    const changed = vitals.filter((v) => v.was !== v.now);
    const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + ".";
    const lines: string[] = [];
    if (changed.length > 0) lines.push(sentence(changed.map((v) => `${v.label} ${v.was} → ${v.now}`).join(", ")));
    else if (vitals.length > 0) lines.push(`No change: ${vitals.map((v) => `${v.label} ${v.now}`).join(", ")}.`);
    if (a.consciousness !== b.consciousness) {
        lines.push(`Consciousness: ${CONSCIOUSNESS[b.consciousness]} → ${CONSCIOUSNESS[a.consciousness]}.`);
    }
    if (r.resultsBack.length > 0) lines.push(`${r.resultsBack.length === 1 ? "Result" : "Results"} back: ${r.resultsBack.join(", ")}.`);
    return { title, lines };
}
