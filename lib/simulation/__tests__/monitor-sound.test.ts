import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ALARM_BURST, ALARM_EVERY_MS, beatIntervalMs, makesBeats, needsFallback, pulsePitch } from "../monitor-sound";

describe("monitor sound: the pulse tone", () => {
    it("is 880 Hz at full saturation and falls to 440 Hz, never leaving that range", () => {
        assert.equal(pulsePitch(100), 880);
        assert.equal(pulsePitch(70), 440);
        assert.equal(pulsePitch(50), 440);
        assert.equal(pulsePitch(120), 880);
    });

    it("never rises as saturation falls", () => {
        let last = Infinity;
        for (let s = 100; s >= 60; s--) {
            const f = pulsePitch(s);
            assert.ok(f <= last, `${s}%: ${f} after ${last}`);
            last = f;
        }
    });

    it("falls back to a normal-sounding tone when the reading is not a number", () => {
        const f = pulsePitch(Number.NaN);
        assert.ok(f > 800 && f < 880);
    });
});

describe("monitor sound: the beat", () => {
    it("has no beat to beep to in ventricular fibrillation, or when the rate is too low to count", () => {
        assert.equal(makesBeats("vf", 300), false);
        assert.equal(makesBeats("sinus_normal", 0), false);
        assert.equal(makesBeats("sinus_normal", 19), false);
        assert.equal(makesBeats("sinus_normal", Number.NaN), false);
        for (const r of ["sinus_normal", "afib", "vt_sustained", "complete_heart_block", "pvc_bigeminy"]) assert.equal(makesBeats(r, 60), true, r);
    });

    it("spaces beats by the rate, within what a monitor could show", () => {
        assert.equal(beatIntervalMs(60), 1000);
        assert.equal(beatIntervalMs(120), 500);
        assert.equal(beatIntervalMs(5), 3000);
        assert.equal(beatIntervalMs(1000), 240);
        assert.equal(beatIntervalMs(Number.NaN), 60_000 / 70);
    });

    it("lets a timer stand in only when the trace has been silent for a beat and a half", () => {
        assert.equal(needsFallback(500, 60), false);
        assert.equal(needsFallback(1400, 60), false);
        assert.equal(needsFallback(1600, 60), true);
        assert.equal(needsFallback(400, 150), false);
        assert.equal(needsFallback(700, 150), true);
    });
});

describe("monitor sound: the alarm", () => {
    it("is a short burst that finishes well before it repeats", () => {
        const end = Math.max(...ALARM_BURST.map((n) => n.at + n.ms));
        assert.ok(end < 1000, `burst lasts ${end} ms`);
        assert.ok(end < ALARM_EVERY_MS / 2);
    });

    it("has its tones in order, without overlapping, the last one the highest", () => {
        for (let i = 1; i < ALARM_BURST.length; i++) {
            const before = ALARM_BURST[i - 1];
            assert.ok(ALARM_BURST[i].at >= before.at + before.ms, `tone ${i} starts before tone ${i - 1} ends`);
        }
        const last = ALARM_BURST[ALARM_BURST.length - 1];
        assert.equal(last.freq, Math.max(...ALARM_BURST.map((n) => n.freq)));
    });
});
