// The monitor must agree with the engine wherever a decision rests on a number: its natural variation never crosses a
// threshold a plan decides by (including pulse pressure, which comes from two readings), and a reassessment is an exact
// reading that the monitor shows too, at the same second.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import type { EventOf } from "../encounter-events";
import { upgradeLegacyCase } from "../legacy-adapter";
import { checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan, REASSESS_ID } from "../live-plan";
import { EXACT_HOLD_SECONDS, isExactAt, liveReading, monitorBoundaries, nextMeasurementTime, nibpReading } from "../live-vitals";
import { goldenFixtureCase } from "./live-plan-golden-fixture";

const base = () => upgradeLegacyCase(goldenFixtureCase as unknown as Record<string, unknown>) as unknown as SimulationCaseConfig;

// A plan that decides by systolic under 90, saturation under 92 and pulse pressure 20 or less.
const plan = normaliseLivePlan(
    {
        summary: "Untreated, the pulse pressure narrows and the pressure falls.",
        critical_window_minutes: 5,
        time_limit_minutes: 20,
        findings: [{ id: "cold_hands", label: "Cold hands", present: true }],
        reassessment: {
            label: "Reassess: circulation",
            detail: "Pulse, BP and perfusion",
            checks: [{ when: { vital: "pp", at_most: 20 }, says: "The pulse pressure is narrow.", otherwise: "The pulse pressure is wide enough." }],
            report: { vitals: ["hr", "sbp", "dbp", "pp", "spo2", "rr"] },
        },
        stages: [
            { id: "narrowing", name: "Narrowing", at_minutes: 6, vitals: { hr: 160, sbp: 80, dbp: 62 }, nurse_says: "Doctor, pulse {hr}, BP {bp}." },
            { id: "worse", name: "Worse", at_minutes: 12, vitals: { hr: 172, sbp: 70, dbp: 60 }, nurse_says: "Doctor, the pressure is {bp} now." },
        ],
        treatments: [
            { id: "iv_access", role: "essential", within_minutes: 4, says: "A cannula is in." },
            { id: "oxygen", label: "Oxygen", detail: "Face mask", group: "airway", role: "essential", within_minutes: 6, effect: { spo2: 2 }, says: "The mask is on.", available_when: { vital: "spo2", below: 92 }, required_when: { vital: "spo2", below: 92 } },
            { id: "bolus", label: "Fluid bolus", detail: "A bolus", group: "circulation", role: "supportive", effect: { sbp: 12, dbp: 2 }, says: "The bolus runs in.", available_when: { vital: "sbp", below: 90 } },
            { id: "continuous_monitoring", role: "supportive", says: "He is on the monitor." },
            { id: "mouth_gag", label: "Mouth gag", detail: "Spoon between the teeth", group: "airway", role: "harmful", effect: { spo2: -3 }, says: "A tooth chips.", why: "Objects in the mouth injure and obstruct." },
        ],
        stabilised_by: ["iv_access"],
        recovery: { after_minutes: 4, vitals: { hr: 130, sbp: 96, dbp: 60, spo2: 97, rr: 26 }, consciousness: "alert", nurse_says: "He is settling." },
    },
    "ai"
);

describe("the monitor never puts a decision on the wrong side of a threshold", () => {
    const compiled = () => compileLivePlan(base(), plan);

    it("the plan is valid and its thresholds are found, including pulse pressure", () => {
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base())), { errors: [], warnings: [] });
        const b = monitorBoundaries(compiled());
        assert.ok(b.thresholds.some((t) => t.parameter === "sbp" && t.lt === 90), "systolic under 90");
        assert.ok(b.thresholds.some((t) => t.parameter === "spo2" && t.lt === 92), "saturation under 92");
        assert.ok(b.derived.pp.includes(21), "pulse pressure 20 or less is a boundary at 21");
    });

    it("systolic and saturation stay on the true side of the plan's thresholds, second after second", () => {
        const b = monitorBoundaries(compiled());
        const opts = { seed: "case-a", age: 29, thresholds: b.thresholds, derived: b.derived };
        for (let t = 0; t < 1500; t++) {
            // true saturation 92 (not under 92): the screen must never show 91; true 91 (under): never 92
            assert.ok(liveReading({ rate: 100, systolic: 100, diastolic: 80, spo2: 92, rr: 20, rhythm: "sinus_normal" }, t, opts).spo2 >= 92, `at ${t}`);
            assert.ok(liveReading({ rate: 100, systolic: 100, diastolic: 80, spo2: 91, rr: 20, rhythm: "sinus_normal" }, t, opts).spo2 < 92, `at ${t}`);
        }
        for (let at = 0; at < 600; at += 3) {
            assert.ok(nibpReading({ systolic: 90, diastolic: 70 }, at, opts).systolic >= 90, `cuff at ${at}`);
            assert.ok(nibpReading({ systolic: 89, diastolic: 70 }, at, opts).systolic < 90, `cuff at ${at}`);
        }
    });

    it("pulse pressure keeps its side of 20 on the screen: under, at and above", () => {
        const b = monitorBoundaries(compiled());
        const opts = { seed: "case-b", age: 29, thresholds: b.thresholds, derived: b.derived };
        const sideOf = (pp: number) => pp > 20;
        let guardMatters = false;
        for (const [sbp, dbp] of [[99, 80], [100, 80], [101, 80], [96, 76], [97, 76], [98, 76]] as const) {
            for (let at = 0; at < 900; at++) {
                const shown = nibpReading({ systolic: sbp, diastolic: dbp }, at, opts);
                assert.equal(sideOf(shown.systolic - shown.diastolic), sideOf(sbp - dbp), `${sbp}/${dbp} at ${at} showed ${shown.systolic}/${shown.diastolic}`);
                // Without the guard the same cuff readings do cross, so the guard is what holds the line.
                const loose = nibpReading({ systolic: sbp, diastolic: dbp }, at, { seed: "case-b", age: 29 });
                if (sideOf(loose.systolic - loose.diastolic) !== sideOf(sbp - dbp)) guardMatters = true;
            }
        }
        assert.ok(guardMatters, "the unguarded monitor does cross 20, so this test is sensitive");
    });

    it("mean pressure thresholds are held in the same way", () => {
        const opts = { seed: "case-c", age: 29, derived: { map: [70] } };
        for (let at = 0; at < 900; at++) {
            const mapOf = (s: number, d: number) => (s + 2 * d) / 3;
            const shown = nibpReading({ systolic: 100, diastolic: 55 }, at, opts); // MAP 70
            assert.ok(mapOf(shown.systolic, shown.diastolic) >= 70, `at ${at}`);
        }
    });
});

describe("a reassessment is an exact reading that the monitor shows too", () => {
    const patientAt = (secondsToAdvance: number) => {
        const e = new EncounterEngine(compileLivePlan(base(), plan));
        e.advanceTo(secondsToAdvance);
        return e;
    };

    it("what the reassessment reports is what the monitor shows, for the hold after it", () => {
        const e = patientAt(7 * 60 + 5); // after the stage at 6 minutes
        const rt = 7 * 60 + 5;
        e.giveIntervention(REASSESS_ID, rt);
        const found = e.events.find((x): x is EventOf<"REASSESSED"> => x.type === "REASSESSED")!.findings.vitals!;
        const b = monitorBoundaries(e.config);
        const opts = { seed: "case-d", age: 29, thresholds: b.thresholds, derived: b.derived, exactAt: [rt] };
        const truth = { rate: e.state.rate, systolic: e.state.systolic, diastolic: e.state.diastolic, spo2: e.state.spo2, rr: e.state.rr, rhythm: e.state.rhythm };
        for (let t = rt; t < rt + EXACT_HOLD_SECONDS; t++) {
            const live = liveReading(truth, t, opts);
            const measuredAt = nextMeasurementTime({ measuredAt: rt - 100, base: { systolic: 1, diastolic: 1 } }, t, { systolic: truth.systolic, diastolic: truth.diastolic }, [rt]);
            const cuff = nibpReading({ systolic: truth.systolic, diastolic: truth.diastolic }, measuredAt, opts);
            assert.deepEqual({ hr: live.hr, spo2: live.spo2, rr: live.rr, sbp: cuff.systolic, dbp: cuff.diastolic, pp: cuff.systolic - cuff.diastolic }, { hr: found.hr, spo2: found.spo2, rr: found.rr, sbp: found.sbp, dbp: found.dbp, pp: found.pp }, `at ${t}`);
        }
        assert.equal(measuredAt(rt), rt, "the cuff is taken at the reassessment's second");
        function measuredAt(t: number) {
            return nextMeasurementTime({ measuredAt: 0, base: { systolic: truth.systolic, diastolic: truth.diastolic } }, t, { systolic: truth.systolic, diastolic: truth.diastolic }, [rt]);
        }
    });

    it("the exact hold ends, and the natural variation resumes", () => {
        assert.equal(isExactAt(99, [100]), false);
        assert.equal(isExactAt(100, [100]), true);
        assert.equal(isExactAt(100 + EXACT_HOLD_SECONDS - 1, [100]), true);
        assert.equal(isExactAt(100 + EXACT_HOLD_SECONDS, [100]), false);
        const truth = { rate: 120, systolic: 100, diastolic: 80, spo2: 96, rr: 24, rhythm: "sinus_tachycardia" as const };
        const opts = { seed: "case-e", age: 29, exactAt: [100] };
        let differs = false;
        for (let t = 100 + EXACT_HOLD_SECONDS; t < 400; t++) {
            const r = liveReading(truth, t, opts);
            if (r.hr !== 120 || r.spo2 !== 96 || r.rr !== 24) differs = true;
        }
        assert.ok(differs, "the monitor wanders again after the hold");
    });

    it("without a reassessment nothing changes: the same numbers as before for the same second", () => {
        const truth = { rate: 120, systolic: 100, diastolic: 80, spo2: 96, rr: 24, rhythm: "sinus_tachycardia" as const };
        for (let t = 0; t < 300; t++) {
            assert.deepEqual(liveReading(truth, t, { seed: "s", age: 30 }), liveReading(truth, t, { seed: "s", age: 30, exactAt: [] }));
        }
        assert.deepEqual(nibpReading({ systolic: 100, diastolic: 80 }, 180, { seed: "s", age: 30 }), nibpReading({ systolic: 100, diastolic: 80 }, 180, { seed: "s", age: 30, derived: {}, exactAt: [] }));
    });
});
