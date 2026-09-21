import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { LEADS, NORMAL_LEADS, buildRhythm, mulberry32, resolveLeads, sampleLead } from "../ecg-synth";
import type { RhythmType } from "../case-schema";

const beatsOf = (r: RhythmType, rate: number, seconds = 10, seed = 1) => buildRhythm(r, rate, 0, seconds, seed);
const intervals = (ts: number[]) => ts.slice(1).map((t, i) => t - ts[i]);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const cv = (xs: number[]) => {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m;
};

describe("rhythm scheduling", () => {
    it("sinus rhythms beat at the requested rate", () => {
        for (const [rhythm, rate] of [["sinus_normal", 60], ["sinus_tachycardia", 112], ["sinus_bradycardia", 45]] as const) {
            const m = beatsOf(rhythm, rate);
            const perMinute = (m.beats.length / 10) * 60;
            assert.ok(Math.abs(perMinute - rate) <= rate * 0.15, `${rhythm}: ${perMinute} vs ${rate}`);
            assert.equal(m.pWaves.length, m.beats.length, "each sinus beat is preceded by a P wave");
        }
    });

    it("every P wave precedes its QRS by the PR interval", () => {
        const m = beatsOf("sinus_normal", 75);
        m.beats.forEach((b, i) => assert.ok(Math.abs(b.t - m.pWaves[i] - 0.16) < 1e-9));
    });

    it("bigeminy alternates sinus and premature ventricular beats", () => {
        const m = beatsOf("pvc_bigeminy", 70);
        const pvc = m.beats.filter((b) => b.kind === "pvc").length;
        const sinus = m.beats.filter((b) => b.kind === "sinus").length;
        assert.ok(pvc >= sinus - 1 && pvc <= sinus, `${pvc} PVC vs ${sinus} sinus`);
    });

    it("PVCs are premature and followed by a compensatory pause", () => {
        const m = beatsOf("pvc_frequent", 72, 20);
        const rr = 60 / 72;
        m.beats.forEach((b, i) => {
            if (b.kind !== "pvc") return;
            const before = m.beats[i - 1];
            const after = m.beats[i + 1];
            assert.ok(b.t - before.t < rr * 0.7, "premature");
            if (after) assert.ok(after.t - before.t >= rr * 1.9, "pause: the next sinus beat is on schedule, so R-R spans two cycles");
        });
    });

    it("frequent ectopy is more frequent than occasional", () => {
        const occasional = beatsOf("pvc_occasional", 72, 60, 3).beats.filter((b) => b.kind === "pvc").length;
        const frequent = beatsOf("pvc_frequent", 72, 60, 3).beats.filter((b) => b.kind === "pvc").length;
        assert.ok(frequent > occasional * 1.5, `${frequent} vs ${occasional}`);
        assert.ok(occasional > 0);
    });

    it("atrial fibrillation is irregularly irregular with no P waves", () => {
        const m = beatsOf("afib", 100, 30);
        assert.equal(m.pWaves.length, 0);
        assert.equal(m.atrial, "fibrillation");
        assert.ok(cv(intervals(m.beats.map((b) => b.t))) > 0.15, "R-R variability");
    });

    it("flutter conducts at a fixed ratio from a 300/min atrial rate", () => {
        const m = beatsOf("flutter", 150);
        assert.equal(m.atrial, "flutter");
        for (const gap of intervals(m.beats.map((b) => b.t))) assert.ok(Math.abs(gap - 0.4) < 1e-9, "2:1 conduction");
    });

    it("complete heart block: atrial and ventricular rates are independent", () => {
        const m = beatsOf("complete_heart_block", 36);
        const atrialRate = (m.pWaves.length / 10) * 60;
        const ventricularRate = (m.beats.length / 10) * 60;
        assert.ok(Math.abs(atrialRate - 80) < 12, `atrial ${atrialRate}`);
        assert.ok(Math.abs(ventricularRate - 36) < 8, `ventricular ${ventricularRate}`);
        assert.ok(m.beats.every((b) => b.kind === "escape"));
        assert.ok(m.qrs >= 0.13, "wide escape QRS");
    });

    it("sustained VT is regular, wide and fast, with no P waves", () => {
        const m = beatsOf("vt_sustained", 178);
        assert.ok(m.beats.every((b) => b.kind === "vt"));
        assert.equal(m.pWaves.length, 0);
        const gaps = intervals(m.beats.map((b) => b.t));
        assert.ok(cv(gaps) < 0.01, "monomorphic and regular");
        assert.ok(Math.abs(60 / mean(gaps) - 178) < 2);
    });

    it("ventricular fibrillation has no organised beats", () => {
        const m = beatsOf("vf", 0);
        assert.equal(m.vf, true);
        assert.equal(m.beats.length, 0);
    });

    it("is deterministic per seed, and the seed matters where randomness does", () => {
        const a = beatsOf("pvc_occasional", 72, 60, 5);
        const b = beatsOf("pvc_occasional", 72, 60, 5);
        const c = beatsOf("pvc_occasional", 72, 60, 6);
        assert.deepEqual(a, b);
        assert.notDeepEqual(a.beats.map((x) => x.kind), c.beats.map((x) => x.kind));
    });

    it("clamps absurd rates instead of producing an infinite loop", () => {
        assert.ok(beatsOf("sinus_normal", 0).beats.length < 100);
        assert.ok(beatsOf("sinus_normal", 9999).beats.length < 600);
    });
});

describe("waveform sampling", () => {
    const peakIn = (model: ReturnType<typeof buildRhythm>, lead: (typeof LEADS)[number], shape = NORMAL_LEADS[lead], from = 0, to = 10) => {
        let max = -Infinity;
        let min = Infinity;
        for (let t = from; t < to; t += 0.002) {
            const v = sampleLead(model, lead, shape, t);
            if (v > max) max = v;
            if (v < min) min = v;
        }
        return { max, min };
    };

    it("lead II shows an R wave of about 1 mV", () => {
        const { max } = peakIn(beatsOf("sinus_normal", 70), "II");
        assert.ok(max > 0.9 && max < 1.15, `R peak ${max}`);
    });

    it("aVR is predominantly negative, V1 is rS, V5 is tall-R", () => {
        const m = beatsOf("sinus_normal", 70);
        assert.ok(peakIn(m, "aVR").min < -0.5);
        assert.ok(peakIn(m, "V1").min < -0.7, "deep S in V1");
        assert.ok(peakIn(m, "V5").max > 1.1, "tall R in V5");
    });

    it("the baseline between beats is isoelectric", () => {
        const m = buildRhythm("sinus_normal", 60, 0, 10, 1);
        const b = m.beats[3];
        const v = sampleLead(m, "II", NORMAL_LEADS.II, b.t + 0.62);
        assert.ok(Math.abs(v) < 0.03, `TP segment ${v}`);
    });

    it("ST elevation appears at the J point + 40 ms in an affected lead and is absent in a normal one", () => {
        const m = buildRhythm("sinus_normal", 70, 0, 10, 1);
        const b = m.beats[3];
        const stemi = resolveLeads({ V3: { qs: 0.7, st: 0.45, t: 0.6 } });
        const elevated = sampleLead(m, "V3", stemi.V3, b.t + 0.13);
        const normal = sampleLead(m, "V3", NORMAL_LEADS.V3, b.t + 0.13);
        assert.ok(elevated > 0.3, `elevated ST ${elevated}`);
        assert.ok(normal < 0.2, `normal ST ${normal}`);
    });

    it("ST depression is recorded below the baseline", () => {
        const m = buildRhythm("sinus_normal", 70, 0, 10, 1);
        const b = m.beats[3];
        const depressed = resolveLeads({ III: { st: -0.12, t: 0.1 } });
        assert.ok(sampleLead(m, "III", depressed.III, b.t + 0.13) < -0.05);
    });

    it("a QS complex has no R wave: the lead is negative through the QRS", () => {
        const m = buildRhythm("sinus_normal", 70, 0, 10, 1);
        const b = m.beats[3];
        const qs = resolveLeads({ V2: { qs: 0.9, st: 0.4, t: 0.7 } }).V2;
        let max = -Infinity;
        for (let dt = 0; dt < 0.08; dt += 0.002) max = Math.max(max, sampleLead(m, "V2", qs, b.t + dt));
        assert.ok(max < 0.15, `no positive R wave, got ${max}`);
        assert.ok(sampleLead(m, "V2", qs, b.t + 0.04) < -0.6);
    });

    it("PVCs are wide and bizarre relative to conducted beats", () => {
        const m = beatsOf("pvc_bigeminy", 70);
        const pvc = m.beats.find((b) => b.kind === "pvc")!;
        assert.ok(sampleLead(m, "II", NORMAL_LEADS.II, pvc.t + 0.07) > 0.8);
        // Still deflecting 100 ms in, when a narrow complex is long finished.
        assert.ok(sampleLead(m, "II", NORMAL_LEADS.II, pvc.t + 0.1) > 0.6);
    });

    it("VT swings above and below the baseline continuously", () => {
        const m = beatsOf("vt_sustained", 178);
        const { max, min } = peakIn(m, "II", NORMAL_LEADS.II, 1, 6);
        assert.ok(max > 0.8 && min < -0.6, `${min}…${max}`);
    });

    it("VF is chaotic but bounded, and differs between leads", () => {
        const m = beatsOf("vf", 0);
        const { max, min } = peakIn(m, "II", NORMAL_LEADS.II, 0, 10);
        assert.ok(max < 2 && min > -2 && max - min > 0.5);
        assert.notEqual(sampleLead(m, "II", NORMAL_LEADS.II, 3.3), sampleLead(m, "V1", NORMAL_LEADS.V1, 3.3));
    });

    it("heart block shows P waves that do not line up with the QRS", () => {
        const m = beatsOf("complete_heart_block", 36);
        const pTimes = m.pWaves;
        const nearQrs = pTimes.filter((p) => m.beats.some((b) => Math.abs(b.t - (p + 0.16)) < 0.02));
        assert.ok(nearQrs.length < pTimes.length / 2, "P waves are dissociated from the QRS");
    });

    it("sampling a long window stays fast (binary-searched, not a full scan)", () => {
        const m = buildRhythm("sinus_normal", 100, 0, 600, 1);
        const started = Date.now();
        for (let t = 590; t < 600; t += 0.002) sampleLead(m, "II", NORMAL_LEADS.II, t);
        assert.ok(Date.now() - started < 500);
    });
});

describe("lead resolution", () => {
    it("layers overrides onto the normal template", () => {
        const leads = resolveLeads({ V4: { st: 0.3 } });
        assert.equal(leads.V4.st, 0.3);
        assert.equal(leads.V4.r, NORMAL_LEADS.V4.r, "untouched fields keep their normal values");
        assert.equal(leads.II.st, 0);
    });

    it("a QS override clears q, r and s", () => {
        const v1 = resolveLeads({ V1: { qs: 0.7 } }).V1;
        assert.deepEqual([v1.q, v1.r, v1.s, v1.qs], [0, 0, 0, 0.7]);
    });

    it("always returns all twelve leads", () => {
        assert.equal(Object.keys(resolveLeads()).length, 12);
    });
});

describe("prng", () => {
    it("is deterministic and uniform-ish", () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const xs = Array.from({ length: 1000 }, () => a());
        assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => b()));
        assert.ok(xs.every((x) => x >= 0 && x < 1));
        assert.ok(Math.abs(mean(xs) - 0.5) < 0.05);
    });
});
