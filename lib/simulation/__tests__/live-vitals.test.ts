import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { NIBP_CYCLE_SECONDS, boundariesFor, drift, hashSeed, liveReading, nextMeasurementTime, nibpReading, stayOnSide, unitNoise, type LiveBase } from "../live-vitals";
import { assessVitals, vitalLimitsForAge } from "../vitals-assess";
import type { StateThreshold } from "../case-schema";

const base = (over: Partial<LiveBase> = {}): LiveBase => ({ rate: 84, systolic: 118, diastolic: 76, spo2: 97, rr: 16, rhythm: "sinus_normal", ...over });

/** The badges the abnormality assist would show for a set of numbers. */
const badges = (b: { rate: number; systolic: number; diastolic: number; spo2: number; rr: number }, age?: number) =>
    assessVitals(
        { ...b, map: (b.systolic + 2 * b.diastolic) / 3, temperature: 36.8, rhythm: "sinus_normal" },
        { patient: age === undefined ? undefined : { age } }
    ).map((v) => `${v.key}:${v.badge}:${v.severity}`);

describe("live vitals: noise", () => {
    it("is deterministic", () => {
        assert.equal(drift("case", "hr", 12.5, [7, 3]), drift("case", "hr", 12.5, [7, 3]));
        assert.equal(unitNoise("a", "b"), unitNoise("a", "b"));
        assert.equal(hashSeed("x"), hashSeed("x"));
        assert.notEqual(hashSeed("x"), hashSeed("y"));
    });

    it("stays within [-1, 1] and actually moves", () => {
        const values = Array.from({ length: 4000 }, (_, i) => drift("case", "hr", i * 0.25, [7.3, 3.1, 1.7]));
        assert.ok(values.every((v) => v >= -1 && v <= 1));
        assert.ok(Math.max(...values) > 0.5 && Math.min(...values) < -0.5, "it uses its range");
        for (let i = 0; i < 200; i++) {
            const u = unitNoise("s", `k${i}`);
            assert.ok(u >= -1 && u <= 1);
        }
    });

    it("differs between cases so two monitors do not wobble in step", () => {
        const a = Array.from({ length: 60 }, (_, i) => drift("case-a", "hr", i, [7.3, 3.1]));
        const b = Array.from({ length: 60 }, (_, i) => drift("case-b", "hr", i, [7.3, 3.1]));
        assert.notDeepEqual(a, b);
    });
});

describe("live vitals: stayOnSide", () => {
    it("holds a value on its own side of a boundary", () => {
        assert.equal(stayOnSide(99, 102, [100]), 99, "base is below 100: cannot reach 100");
        assert.equal(stayOnSide(101, 97, [100]), 100, "base is at or above 100: cannot fall below it");
        assert.equal(stayOnSide(98, 99, [100]), 99, "untouched when it does not cross");
    });
});

describe("live vitals: readings", () => {
    const opts = { seed: "fixture" };

    it("varies a little and stays close to the truth", () => {
        const hr = new Set<number>();
        const spo2 = new Set<number>();
        for (let t = 0; t < 600; t += 0.5) {
            const r = liveReading(base({ rate: 112, spo2: 96 }), t, opts);
            hr.add(r.hr);
            spo2.add(r.spo2);
            assert.ok(Math.abs(r.hr - 112) <= 3, `HR ${r.hr} strays from 112`);
            assert.ok(Math.abs(r.spo2 - 96) <= 2, `SpO2 ${r.spo2} strays from 96`);
        }
        assert.ok(hr.size >= 3, "the heart rate is not frozen");
        assert.ok(spo2.size >= 2, "neither is the saturation");
    });

    it("moves a very slow rhythm by only a beat", () => {
        for (let t = 0; t < 300; t += 0.5) {
            const r = liveReading(base({ rate: 36, rhythm: "complete_heart_block" }), t, opts);
            assert.ok(Math.abs(r.hr - 36) <= 1, `HR ${r.hr}`);
        }
    });

    it("reads an irregular rhythm less steadily than a regular one", () => {
        const spread = (rhythm: LiveBase["rhythm"]) => {
            const v = Array.from({ length: 600 }, (_, i) => liveReading(base({ rate: 120, rhythm }), i * 0.5, opts).hr);
            return Math.max(...v) - Math.min(...v);
        };
        assert.ok(spread("afib") > spread("sinus_normal"));
    });

    it("has no rate to wobble in ventricular fibrillation", () => {
        assert.equal(liveReading(base({ rate: 0, rhythm: "vf" }), 33, opts).hr, 0);
    });

    it("never reads above 100% or below 1 breath", () => {
        for (let t = 0; t < 300; t += 0.5) {
            assert.ok(liveReading(base({ spo2: 100 }), t, opts).spo2 <= 100);
            assert.ok(liveReading(base({ rr: 2 }), t, opts).rr >= 1);
        }
    });

    it("never changes what the abnormality badges say about the patient", () => {
        const ages = [undefined, 0.08, 0.5, 2, 4, 9, 30, 72];
        const rates = [30, 44, 46, 58, 60, 61, 70, 99, 100, 101, 112, 129, 130, 131, 170];
        const sats = [82, 89, 90, 91, 93, 94, 95, 96, 99, 100];
        const rrs = [6, 8, 11, 12, 16, 20, 21, 27, 28, 36];
        for (const age of ages) {
            const limits = vitalLimitsForAge(age);
            for (const rate of [...rates, limits.hrLow, limits.hrHigh, limits.hrHigh + 1]) {
                for (const spo2 of sats) {
                    for (const rr of [...rrs, limits.rrHigh, limits.rrHigh + 1]) {
                        const truth = { rate, systolic: 104, diastolic: 62, spo2, rr };
                        const expected = badges(truth, age);
                        for (let t = 0; t < 240; t += 3.7) {
                            const seen = liveReading({ ...truth, rhythm: "sinus_normal" }, t, { seed: "grid", age });
                            assert.deepEqual(
                                badges({ ...truth, rate: seen.hr, spo2: seen.spo2, rr: seen.rr }, age),
                                expected,
                                `age ${age}: HR ${rate}→${seen.hr}, SpO2 ${spo2}→${seen.spo2}, RR ${rr}→${seen.rr} at t=${t}`
                            );
                        }
                    }
                }
            }
        }
    });

    it("never carries a reading across the case's own monitor alarm", () => {
        const thresholds: StateThreshold[] = [
            { parameter: "spo2", lt: 90, trigger: "critical_hypoxia" },
            { parameter: "hr", lt: 42, trigger: "severe_bradycardia" },
            { parameter: "hr", gt: 140, trigger: "severe_tachycardia" },
            { parameter: "sbp", lt: 90, trigger: "hypotension" },
        ];
        const alarmsFor = (r: { hr: number; spo2: number }) => [r.spo2 < 90, r.hr < 42, r.hr > 140];
        for (const [rate, spo2] of [[41, 89], [42, 90], [43, 91], [140, 90], [141, 89], [39, 88], [80, 90], [80, 89]]) {
            for (let t = 0; t < 300; t += 1.3) {
                const seen = liveReading(base({ rate, spo2 }), t, { seed: "alarms", thresholds });
                assert.deepEqual(alarmsFor(seen), alarmsFor({ hr: rate, spo2 }), `HR ${rate}→${seen.hr}, SpO2 ${spo2}→${seen.spo2}`);
            }
        }
    });

    it("exposes every threshold the badges use", () => {
        const adult = boundariesFor("hr", { limits: vitalLimitsForAge(40) });
        assert.deepEqual([...adult].sort((a, b) => a - b), [46, 61, 100, 130]);
        const toddler = boundariesFor("hr", { limits: vitalLimitsForAge(2) });
        assert.ok(toddler.includes(98) && toddler.includes(141));
    });
});

describe("live vitals: the cuff", () => {
    const opts = { seed: "cuff" };

    it("gives the same reading for the same cycle and a fresh one for the next", () => {
        const a = nibpReading({ systolic: 118, diastolic: 76 }, 0, opts);
        assert.deepEqual(a, nibpReading({ systolic: 118, diastolic: 76 }, 0, opts));
        const seen = new Set(Array.from({ length: 30 }, (_, i) => nibpReading({ systolic: 118, diastolic: 76 }, i * NIBP_CYCLE_SECONDS, opts).systolic));
        assert.ok(seen.size >= 3, "successive readings differ");
        assert.ok([...seen].every((s) => Math.abs(s - 118) <= 3));
    });

    it("never moves the patient across the hypotension or shock line", () => {
        for (const [sys, dia] of [[91, 55], [90, 58], [89, 60], [100, 61], [99, 60], [80, 54], [66, 44], [94, 62]]) {
            const truthMap = (sys + 2 * dia) / 3 >= 65;
            for (let i = 0; i < 60; i++) {
                const r = nibpReading({ systolic: sys, diastolic: dia }, i * 180, opts);
                assert.equal((r.systolic + 2 * r.diastolic) / 3 >= 65, truthMap, `${sys}/${dia} → ${r.systolic}/${r.diastolic}`);
                assert.equal(r.systolic <= 90, sys <= 90, `${sys}/${dia} → ${r.systolic}/${r.diastolic}`);
                assert.equal(r.systolic < 100, sys < 100);
                assert.equal(r.diastolic <= 60, dia <= 60);
            }
        }
    });

    it("cycles on the clock and straight away when the pressure changes", () => {
        const truth = { systolic: 118, diastolic: 76 };
        const first = nextMeasurementTime(null, 7, truth);
        assert.equal(first, 0, "the first reading is the start of the current cycle");
        const prev = { measuredAt: 0, base: truth };
        assert.equal(nextMeasurementTime(prev, 100, truth), 0, "still inside the cycle");
        assert.equal(nextMeasurementTime(prev, NIBP_CYCLE_SECONDS, truth), NIBP_CYCLE_SECONDS, "the cuff cycles");
        assert.equal(nextMeasurementTime(prev, 100, { systolic: 80, diastolic: 54 }), 100, "the patient deteriorated: re-cycle now");
    });
});
