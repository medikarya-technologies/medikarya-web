// =========================
// lib/simulation/monitor-sound.ts
// =========================
// What the bedside monitor sounds like, as numbers: the pitch of a pulse beep, when a rhythm has beats to beep to,
// the gap between beats, and the alarm's two-tone burst. The playing itself (Web Audio) is in
// components/cases/monitor-sound.tsx; this is the part that can be checked.
//
// Pure: no React, no audio, no `@/` imports.

/**
 * The pitch of a pulse beep. It falls as oxygen saturation falls, as on a pulse oximeter, so the tone tells an
 * attentive ear before the number does: 880 Hz at 100%, 440 Hz at 70% and below.
 */
export function pulsePitch(spo2: number): number {
    const s = Number.isFinite(spo2) ? Math.min(100, Math.max(70, spo2)) : 98;
    return Math.round(440 + ((s - 70) / 30) * 440);
}

/** Ventricular fibrillation has no organised beat to beep to, and a rate too low to count is not a beat either. */
export function makesBeats(rhythm: string, rate: number): boolean {
    return rhythm !== "vf" && Number.isFinite(rate) && rate >= 20;
}

/** Milliseconds between beats at a rate, kept to what a monitor could show (20 to 250 a minute). */
export function beatIntervalMs(rate: number): number {
    const r = Number.isFinite(rate) ? Math.min(250, Math.max(20, rate)) : 70;
    return 60_000 / r;
}

/**
 * Whether a timer should stand in for the trace: the beep normally comes from the trace drawing a beat (so it lands
 * on the QRS you can see), but on a phone with the monitor closed nothing is drawing. If no beat has come for a
 * beat and a half, the timer takes over; the moment the trace beats again it goes quiet.
 */
export function needsFallback(sinceLastBeatMs: number, rate: number): boolean {
    return sinceLastBeatMs > 1.5 * beatIntervalMs(rate);
}

/** One alarm burst: three short tones, the last one higher, then silence until the next. Offsets are from the start. */
export const ALARM_BURST: ReadonlyArray<{ at: number; ms: number; freq: number }> = [
    { at: 0, ms: 110, freq: 740 },
    { at: 170, ms: 110, freq: 740 },
    { at: 340, ms: 160, freq: 990 },
];

/** How often the burst repeats while an alarm is showing. */
export const ALARM_EVERY_MS = 4000;
