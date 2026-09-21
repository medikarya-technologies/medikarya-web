// =========================
// lib/simulation/ecg-synth.ts
// =========================
// Synthesises ECG waveforms. Pure and deterministic (seeded) — no canvas, no
// DOM — so the telemetry monitor, the 12-lead viewer and the unit tests all
// draw from the same model.
//
//   PatientState.rhythm → RhythmModel (when the beats happen)
//   RhythmModel + LeadMorphology → sampleLead(t) (what each lead records)
//
// Rhythm morphology is state OUTPUT: the renderer reads the patient, never the
// other way round.
//
// Units: seconds and millivolts. Downstream code draws at 25 mm/s and 10 mm/mV.

import type { LeadMorphology, LeadName, RhythmType } from "./case-schema";

export const LEADS: readonly LeadName[] = [
    "I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6",
];

/** Fully-populated lead morphology (`qs` optional). */
export type LeadShape = Required<Omit<LeadMorphology, "qs">> & { qs?: number };

/** A normal adult 12-lead: per-lead p / q / r / s / ST / T (mV). q and s are depths. */
export const NORMAL_LEADS: Readonly<Record<LeadName, LeadShape>> = {
    I:   { p: 0.10, q: 0.04, r: 0.70, s: 0.08, st: 0, t: 0.25 },
    II:  { p: 0.15, q: 0.05, r: 1.00, s: 0.10, st: 0, t: 0.35 },
    III: { p: 0.08, q: 0.03, r: 0.45, s: 0.10, st: 0, t: 0.15 },
    aVR: { p: -0.12, q: 0.0, r: 0.08, s: 0.65, st: 0, t: -0.28 },
    aVL: { p: 0.05, q: 0.03, r: 0.35, s: 0.10, st: 0, t: 0.10 },
    aVF: { p: 0.10, q: 0.04, r: 0.75, s: 0.10, st: 0, t: 0.25 },
    V1:  { p: 0.06, q: 0.0, r: 0.20, s: 0.85, st: 0, t: -0.08 },
    V2:  { p: 0.07, q: 0.0, r: 0.55, s: 1.00, st: 0, t: 0.40 },
    V3:  { p: 0.08, q: 0.0, r: 0.85, s: 0.70, st: 0, t: 0.40 },
    V4:  { p: 0.08, q: 0.03, r: 1.25, s: 0.40, st: 0, t: 0.42 },
    V5:  { p: 0.08, q: 0.05, r: 1.25, s: 0.15, st: 0, t: 0.36 },
    V6:  { p: 0.07, q: 0.05, r: 0.95, s: 0.08, st: 0, t: 0.30 },
};

/** Layers a case's per-lead overrides onto the normal template. A `qs` complex replaces q/r/s. */
export function resolveLeads(
    overrides?: Partial<Record<LeadName, LeadMorphology>>
): Record<LeadName, LeadShape> {
    const out = {} as Record<LeadName, LeadShape>;
    for (const lead of LEADS) {
        const merged: LeadShape = { ...NORMAL_LEADS[lead], ...(overrides?.[lead] ?? {}) };
        if (merged.qs !== undefined) {
            merged.q = 0;
            merged.r = 0;
            merged.s = 0;
        }
        out[lead] = merged;
    }
    return out;
}

// ── Seeded randomness ───────────────────────────────────────────────────────

/** Small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── Rhythm model ────────────────────────────────────────────────────────────

export type BeatKind = "sinus" | "pvc" | "vt" | "escape" | "afib" | "flutter";

export interface Beat {
    /** QRS onset, seconds. */
    t: number;
    kind: BeatKind;
    /** Nominal R-R interval around this beat, seconds (drives QT shortening). */
    rr: number;
}

export interface RhythmModel {
    rhythm: RhythmType;
    rate: number;
    start: number;
    end: number;
    beats: Beat[];
    /** P-wave onsets. For heart block these are independent of the QRS complexes. */
    pWaves: number[];
    atrial: "p" | "fibrillation" | "flutter" | "none";
    vf: boolean;
    pr: number;
    qrs: number;
    qt?: number;
}

export interface RhythmTiming {
    pr_ms?: number;
    qrs_ms?: number;
    qt_ms?: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Builds the beat schedule for `rhythm` at `rate` bpm over [start, end) seconds.
 * The same seed always gives the same beats.
 */
export function buildRhythm(
    rhythm: RhythmType,
    rate: number,
    start: number,
    end: number,
    seed = 1,
    timing: RhythmTiming = {}
): RhythmModel {
    const rng = mulberry32(seed);
    const bpm = clamp(rate || 60, 20, 260);
    const rr = 60 / bpm;
    const pr = (timing.pr_ms ?? 160) / 1000;
    const qrs = (timing.qrs_ms ?? 92) / 1000;
    const qt = timing.qt_ms !== undefined ? timing.qt_ms / 1000 : undefined;

    const model: RhythmModel = {
        rhythm, rate: bpm, start, end, beats: [], pWaves: [], atrial: "p", vf: false, pr, qrs, qt,
    };

    switch (rhythm) {
        case "sinus_normal":
        case "sinus_tachycardia":
        case "sinus_bradycardia": {
            for (let t = start + 0.3; t < end; t += rr * (1 + (rng() - 0.5) * 0.04)) {
                model.beats.push({ t, kind: "sinus", rr });
                model.pWaves.push(t - pr);
            }
            break;
        }

        case "pvc_occasional":
        case "pvc_frequent":
        case "pvc_bigeminy": {
            // Sinus rhythm with premature ventricular beats followed by a compensatory pause.
            const nextGap = () =>
                rhythm === "pvc_bigeminy" ? 1 : rhythm === "pvc_frequent" ? 2 + Math.floor(rng() * 3) : 5 + Math.floor(rng() * 5);
            let untilPvc = nextGap();
            let t = start + 0.3;
            while (t < end) {
                model.beats.push({ t, kind: "sinus", rr });
                model.pWaves.push(t - pr);
                untilPvc -= 1;
                if (untilPvc <= 0) {
                    const pvcAt = t + rr * 0.62;
                    if (pvcAt < end) model.beats.push({ t: pvcAt, kind: "pvc", rr });
                    t += rr * 2; // compensatory pause
                    untilPvc = nextGap();
                } else {
                    t += rr;
                }
            }
            break;
        }

        case "afib": {
            model.atrial = "fibrillation";
            model.pWaves = [];
            for (let t = start + 0.2; t < end; ) {
                model.beats.push({ t, kind: "afib", rr });
                t += Math.max(0.28, rr * (0.65 + rng() * 0.7)); // irregularly irregular
            }
            break;
        }

        case "flutter": {
            // Flutter waves at ~300/min, conducted at a fixed ratio chosen from the rate.
            model.atrial = "flutter";
            model.pWaves = [];
            const ratio = Math.max(2, Math.round(300 / bpm));
            for (let t = start + 0.25; t < end; t += ratio * 0.2) {
                model.beats.push({ t, kind: "flutter", rr: ratio * 0.2 });
            }
            break;
        }

        case "complete_heart_block": {
            // Atria and ventricles beat independently: regular P waves at ~80/min, slow wide escape QRS.
            const atrialPeriod = 60 / 80;
            for (let t = start + 0.1; t < end; t += atrialPeriod) model.pWaves.push(t);
            for (let t = start + 0.35; t < end; t += rr) model.beats.push({ t, kind: "escape", rr });
            model.qrs = Math.max(qrs, 0.13);
            break;
        }

        case "vt_sustained": {
            model.atrial = "none";
            model.pWaves = [];
            model.qrs = 0.16;
            for (let t = start + 0.1; t < end; t += rr) model.beats.push({ t, kind: "vt", rr });
            break;
        }

        case "vf": {
            model.vf = true;
            model.atrial = "none";
            model.pWaves = [];
            break;
        }
    }

    return model;
}

// ── Sampling ────────────────────────────────────────────────────────────────

const gauss = (t: number, mu: number, sigma: number): number =>
    Math.exp(-0.5 * ((t - mu) / sigma) * ((t - mu) / sigma));
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** Signed amplitude of a wide ventricular beat in each lead (an RVOT-type PVC / VT morphology). */
const WIDE_BEAT_AMP: Readonly<Record<LeadName, number>> = {
    I: 0.4, II: 1.1, III: 1.2, aVR: -0.8, aVL: -0.55, aVF: 1.2,
    V1: -1.2, V2: -1.3, V3: -1.0, V4: -0.3, V5: 0.7, V6: 0.9,
};

/** One conducted beat as recorded in one lead, `dt` seconds after QRS onset. */
function conductedBeat(shape: LeadShape, dt: number, rr: number, qrs: number, qtOverride?: number): number {
    const complex =
        shape.qs !== undefined
            ? -shape.qs * gauss(dt, 0.04, 0.02)
            : -shape.q * gauss(dt, 0.012, 0.007) + shape.r * gauss(dt, 0.034, 0.01) - shape.s * gauss(dt, 0.056, 0.01);

    const j = qrs; // J point
    const qt = qtOverride ?? 0.39 * Math.sqrt(rr); // Bazett-style shortening with rate
    const tEnd = Math.max(j + 0.12, qt);

    // ST shift: a smooth plateau from the J point that fades out by the end of the T wave.
    const stWindow = sigmoid((dt - j) / 0.006) * (1 - sigmoid((dt - (tEnd - 0.02)) / 0.03));
    const tWave = shape.t * gauss(dt, j + (tEnd - j) * 0.55, (tEnd - j) * 0.19);

    return complex + shape.st * stWindow + tWave;
}

function wideBeat(kind: "pvc" | "escape" | "vt", lead: LeadName, dt: number): number {
    const amp = WIDE_BEAT_AMP[lead];
    if (kind === "vt") return amp * (gauss(dt, 0.09, 0.05) - 0.75 * gauss(dt, 0.22, 0.06));
    const scale = kind === "escape" ? 0.8 : 1;
    // A broad main deflection with a discordant T wave.
    return scale * amp * (gauss(dt, 0.07, 0.034) - 0.45 * gauss(dt, 0.3, 0.07));
}

function fibrillatorySample(t: number, lead: LeadShape): number {
    const visibility = Math.max(0.5, Math.abs(lead.p) * 10);
    return 0.045 * visibility * (
        Math.sin(2 * Math.PI * 6.2 * t) +
        0.7 * Math.sin(2 * Math.PI * 8.9 * t + 1.1) +
        0.5 * Math.sin(2 * Math.PI * 4.3 * t + 2.2)
    );
}

function flutterSample(t: number, lead: LeadShape): number {
    const visibility = Math.max(0.6, Math.abs(lead.p) * 8);
    const phase = (t / 0.2) % 1;
    return -0.12 * visibility * (phase - 0.5);
}

function vfSample(t: number, leadIndex: number): number {
    const envelope = 0.55 + 0.35 * Math.sin(t * 1.3);
    return envelope * (
        0.5 * Math.sin(2 * Math.PI * 4.1 * t + 0.9 * Math.sin(2 * Math.PI * 0.35 * t)) +
        0.35 * Math.sin(2 * Math.PI * 6.3 * t + 1.7) +
        0.25 * Math.sin(2 * Math.PI * 2.6 * t + 0.4 * leadIndex)
    );
}

/** Index of the first beat whose onset is ≥ t (binary search over the ascending beat list). */
function firstBeatAtOrAfter(beats: readonly Beat[], t: number): number {
    let lo = 0;
    let hi = beats.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (beats[mid].t < t) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/**
 * The voltage (mV) recorded by `lead` at time `t`. Only beats within a window
 * around `t` are evaluated, so sampling stays cheap enough for a 60 fps trace.
 */
export function sampleLead(model: RhythmModel, lead: LeadName, shape: LeadShape, t: number): number {
    if (model.vf) return vfSample(t, LEADS.indexOf(lead));

    let v = 0;

    // Atrial activity
    if (model.atrial === "p") {
        for (const p of model.pWaves) {
            if (p > t + 0.2) break;
            if (p < t - 0.25) continue;
            v += shape.p * gauss(t, p + 0.05, 0.022);
        }
    } else if (model.atrial === "fibrillation") {
        v += fibrillatorySample(t, shape);
    } else if (model.atrial === "flutter") {
        v += flutterSample(t, shape);
    }

    // Ventricular beats within reach of t (QRS onset up to ~0.7 s before, or just about to start)
    const from = firstBeatAtOrAfter(model.beats, t - 0.7);
    for (let i = from; i < model.beats.length; i++) {
        const beat = model.beats[i];
        const dt = t - beat.t;
        if (dt < -0.05) break;
        switch (beat.kind) {
            case "pvc":
            case "escape":
            case "vt":
                v += wideBeat(beat.kind, lead, dt);
                break;
            default:
                v += conductedBeat(shape, dt, beat.rr, model.qrs, model.qt);
        }
    }
    return v;
}
