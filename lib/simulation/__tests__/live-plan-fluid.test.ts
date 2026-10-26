// Live plans S2: a rate-controlled IV fluid (docs/live-plan-fluid-engine-spec.md sections 5, 7, 8, 11, 12). Started at
// a rate, stepped down one rate at a time, stopped, finished by its volume; overload from a rate kept on too long;
// scoring as a pure function of the log; the same patient and score from the browser and the server's replay.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import type { ClinicalEvent } from "../encounter-events";
import { deliveredBoundary, deliveredRateSeconds, fluidAction, fluidActionLabels, fluidStatus, fluidStopAction, parseFluidAction } from "../fluid-infusion";
import { interventionLabel, interventionsForCase } from "../intervention-catalog";
import { upgradeLegacyCase } from "../legacy-adapter";
import { checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan, REFUSED_PREFIX, scoreBedside, type LivePlan } from "../live-plan";
import { playthroughs } from "../live-plan-playthrough";
import { replayStudentEvents } from "../replay";
import { validateSimulationCase } from "../validate-config";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

const MIN = 60;
const base = () => upgradeLegacyCase(goldenFixtureCase as unknown as Record<string, unknown>) as unknown as SimulationCaseConfig;
const F = "fluid_bolus_20ml_kg";
const at = (level: string) => fluidAction(F, level);
const STOP = fluidStopAction(F);

// The shocked toddler (arrives HR 148, BP 86/54; stages at 6 and 12 min) with his fluid as a three-step ladder. The
// numbers are the test's own, not clinical ones.
function fluidRaw(fluid: Record<string, unknown> = {}, over: Record<string, unknown> = {}): Record<string, unknown> {
    const p = JSON.parse(JSON.stringify(goldenFixturePlan));
    p.treatments = p.treatments.map((t: Record<string, unknown>) => {
        if (t.id !== F) return t;
        const { effect: _effect, ...rest } = t;
        return {
            ...rest,
            requires: [{ when: { given: "iv_access" }, says: "there is no IV access yet." }],
            fluid: {
                levels: [
                    {
                        id: "r20",
                        label: "20 mL/kg/h",
                        ml_per_h: 240,
                        hold_minutes: { at_least: 60, at_most: 90 },
                        effect: { hr: -14, sbp: 8, dbp: 5 },
                        overload: { after_minutes: 120, when: { stabilised: true }, effect: { rr: 6, spo2: -4 }, nurse_says: "His breathing is faster, RR {rr}, saturation {spo2}%.", why: "Kept at the full rate after he recovered." },
                    },
                    { id: "r10", label: "10 mL/kg/h", ml_per_h: 120, hold_minutes: { at_least: 60, at_most: 120 } },
                    { id: "r5", label: "5 mL/kg/h", ml_per_h: 60 },
                ],
                start: [{ level: "r10", when: { stage_reached: "decompensated" } }, { level: "r20" }],
                stop: { at_least: 180, at_most: 600 },
                ...fluid,
            },
        };
    });
    return { ...p, time_limit_minutes: 720, ...over };
}
const fluidPlan = (fluid: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => normaliseLivePlan(fluidRaw(fluid, over), "ai");
const errorsOf = (p: LivePlan) => checkLivePlan(p, measuredOnArrival(base())).errors.join(" | ");

/** Plays the steps in the browser's engine and in the server's replay of what was given, and checks they agree. */
function run(p: LivePlan, steps: Array<[string, number]>, until: number) {
    const c = compileLivePlan(base(), p);
    const engine = new EncounterEngine(c);
    const said = steps.map(([a, m]) => engine.giveIntervention(a, m * MIN).consequence);
    engine.advanceTo(until * MIN);
    const score = scoreBedside(c, p, engine.events, until);
    const replayed = replayStudentEvents(c, engine.events.filter((e) => e.type === "INTERVENTION_GIVEN"));
    replayed.advanceTo(until * MIN);
    assert.deepEqual(replayed.state.snapshot(), engine.state.snapshot(), "browser and server leave the same patient");
    assert.deepEqual(scoreBedside(c, p, replayed.events, until), score, "browser and server score the same");
    return { c, engine, said, score };
}
const rate = (s: ReturnType<typeof scoreBedside>) => s.items.find((i) => i.id === `${F}:rate`);
const statusOf = (r: ReturnType<typeof run>, minute: number) => {
    const def = r.c.custom_interventions!.find((i) => i.id === F)!.fluid!;
    const s = r.engine.state;
    return fluidStatus(F, def, s.flags, s.flagSetAt, minute * MIN);
};

describe("rate-controlled fluid: the plan", () => {
    it("passes the check; the compiled case validates, and the fluid is on the tray as the case's own entry with its rates", () => {
        const p = fluidPlan();
        assert.equal(errorsOf(p), "");
        const c = compileLivePlan(base(), p);
        assert.deepEqual(validateSimulationCase(c).errors, []);
        const own = interventionsForCase(c).find((i) => i.id === F);
        assert.ok(own);
        assert.deepEqual(c.custom_interventions!.find((i) => i.id === F)!.fluid!.levels.map((l) => [l.id, l.ml_per_h]), [["r20", 240], ["r10", 120], ["r5", 60]]);
    });

    it("the normaliser keeps every fluid field and reads a bad number as one the check reports", () => {
        const p = fluidPlan({ volume_ml: 300, completed_says: "The bag has run through.", stop_says: "The drip is turned off." });
        const f = p.treatments.find((t) => t.id === F)!.fluid!;
        assert.equal(f.volume_ml, 300);
        assert.equal(f.levels[0].overload?.after_minutes, 120);
        assert.deepEqual(f.start, [{ level: "r10", when: { stage_reached: "decompensated" } }, { level: "r20" }]);
        const bad = fluidPlan({ stop: { at_least: "soon", at_most: 600 } });
        assert.match(errorsOf(bad), /stop needs whole minutes/);
    });

    it("refuses a ladder that is not from the highest rate down, bad windows, and fields a fluid cannot combine with", () => {
        const up = fluidRaw();
        (up.treatments as any[]).find((t) => t.id === F).fluid.levels[1].ml_per_h = 300;
        assert.match(errorsOf(normaliseLivePlan(up, "ai")), /must be lower than the one before it/);
        const hold = fluidRaw();
        (hold.treatments as any[]).find((t) => t.id === F).fluid.levels[0].hold_minutes = { at_least: 90, at_most: 60 };
        assert.match(errorsOf(normaliseLivePlan(hold, "ai")), /hold_minutes needs whole minutes/);
        // A window may run past the end (a stop 24 to 48 hours after starting), but one that can never be on time is flagged.
        const late = checkLivePlan(fluidPlan({ stop: { at_least: 1440, at_most: 2880 } }), measuredOnArrival(base()));
        assert.deepEqual(late.errors, []);
        assert.match(late.warnings.join(" | "), /stop: it can never be on time, because the encounter ends at 720 min/);
        assert.match(errorsOf(fluidPlan({ completed_says: "The bag has run through." })), /completed_says only goes with volume_ml/);
        assert.match(errorsOf(fluidPlan({ start: [{ level: "r99" }] })), /"r99" is not one of its rates/);
        const doses = fluidRaw();
        Object.assign((doses.treatments as any[]).find((t) => t.id === F), { max_doses: 2, effect: { sbp: 4, dbp: 2 } });
        const e = errorsOf(normaliseLivePlan(doses, "ai"));
        assert.match(e, /cannot also have repeat doses/);
        assert.match(e, /effect is set per rate/);
    });

    it("only a plan with a fluid ladder may run on past 45 minutes, up to 48 hours", () => {
        assert.equal(errorsOf(fluidPlan({}, { time_limit_minutes: 48 * 60 })), "");
        assert.match(errorsOf(fluidPlan({}, { time_limit_minutes: 48 * 60 + 1 })), /between 6 and 2880/);
        assert.match(errorsOf(normaliseLivePlan({ ...JSON.parse(JSON.stringify(goldenFixturePlan)), time_limit_minutes: 120 }, "ai")), /between 6 and 45\./);
    });
});

describe("rate-controlled fluid: the tray", () => {
    it("is started at a rate, behind its prerequisite; the treatment itself has no plain Give", () => {
        const { said, engine } = run(fluidPlan(), [[at("r20"), 1], [F, 2], ["iv_access", 3], [at("r20"), 4]], 5);
        assert.match(said[0], /^Not given: there is no IV access yet/);
        assert.match(said[1], /^Not given: choose the rate to start it at/);
        assert.match(said[3], /^Started at 20 mL\/kg\/h\. The bolus is running/);
        assert.equal(engine.state.flagSetAt.given_fluid_bolus_20ml_kg, 4 * MIN);
        assert.equal(engine.state.systolic, 86 + 8, "the starting rate's effect, at once");
        assert.ok(engine.state.flagSetAt.live_stabilised !== undefined, "iv access and the fluid stabilise him");
    });

    it("steps down one rate at a time and never up; stops; nothing changes once stopped", () => {
        const { said, engine } = run(
            fluidPlan(),
            [["iv_access", 1], [at("r20"), 2], [at("r5"), 3], [at("r20"), 4], [at("r10"), 62], [at("r20"), 63], [at("r10"), 64], [STOP, 70], [at("r5"), 71], [STOP, 72]],
            80
        );
        assert.match(said[2], /^Not given: the rate comes down one step at a time: it is running at 20 mL\/kg\/h, so the next step is 10 mL\/kg\/h/);
        assert.match(said[3], /^Not given: it is already running at 20 mL\/kg\/h/);
        assert.equal(said[4], "The rate is reduced to 10 mL/kg/h.");
        assert.match(said[5], /^Not given: it is running at 10 mL\/kg\/h, below this rate/);
        assert.match(said[6], /^Not given: it is already running at 10/);
        assert.equal(said[7], "The infusion is stopped.");
        assert.match(said[8], /^Not given: the infusion has been stopped/);
        assert.match(said[9], /^Not given: the infusion has been stopped/);
        assert.equal(engine.state.flagSetAt.fluid_fluid_bolus_20ml_kg_at_r5, undefined);
    });

    it("counts what has run in from the rate history, and the tray's status agrees", () => {
        const r = run(fluidPlan(), [["iv_access", 1], [at("r20"), 2], [at("r10"), 62], [STOP, 92]], 100);
        // 60 min at 240 mL/h, then 30 min at 120 mL/h, then nothing.
        assert.deepEqual(statusOf(r, 100), { state: "stopped", level: "r10", since: 62 * MIN, startedAt: 2 * MIN, endedAt: 92 * MIN, deliveredMl: 300, remainingMl: null });
        assert.equal(statusOf(r, 32).deliveredMl, 120, "by the time asked about");
    });

    it("finishes by itself the moment its volume is in, with a nurse alert, and the wait stops there", () => {
        const p = fluidPlan({ volume_ml: 100, completed_says: "The bag has run through." });
        const c = compileLivePlan(base(), p);
        const e = new EncounterEngine(c);
        e.giveIntervention("iv_access", 1 * MIN);
        e.giveIntervention(at("r20"), 2 * MIN);
        e.giveIntervention(at("r10"), 12 * MIN); // 40 mL in; 60 mL left at 120 mL/h is 30 minutes
        const w = e.skipTime(13 * MIN, 240 * MIN);
        assert.equal(w.stopped, "alert");
        assert.equal(w.to, 42 * MIN);
        const done = e.events.find((x) => x.type === "STATE_TRANSITION" && x.trigger === "live_fluid_fluid_bolus_20ml_kg_completed");
        assert.equal(done?.timestamp, 42 * MIN);
        assert.ok(e.events.some((x) => x.type === "PATIENT_DETERIORATED" && x.narrative === "The bag has run through."));
        const def = c.custom_interventions!.find((i) => i.id === F)!.fluid!;
        assert.deepEqual(fluidStatus(F, def, e.state.flags, e.state.flagSetAt, 50 * MIN), { state: "completed", level: "r10", since: 12 * MIN, startedAt: 2 * MIN, endedAt: 42 * MIN, deliveredMl: 100, remainingMl: 0 });
        assert.match(e.giveIntervention(STOP, 51 * MIN).consequence, /^Not given: the infusion has finished/);
        // The finish is the engine's to say: a forged one is thrown away and the real one regenerated.
        const forged: ClinicalEvent[] = [
            ...e.events.filter((x) => x.type === "INTERVENTION_GIVEN"),
            { type: "STATE_TRANSITION", timestamp: 3 * MIN, from: "x", to: "x", trigger: "live_fluid_fluid_bolus_20ml_kg_completed" },
        ];
        const r = replayStudentEvents(c, forged);
        assert.equal(r.state.flagSetAt.fluid_fluid_bolus_20ml_kg_completed, 42 * MIN);
    });

    it("a rate kept on past its time once he has recovered overloads him: the monitor changes, the nurse says so, and a long wait stops there", () => {
        const c = compileLivePlan(base(), fluidPlan());
        const e = new EncounterEngine(c);
        e.giveIntervention("iv_access", 1 * MIN);
        e.giveIntervention(at("r20"), 2 * MIN);
        e.advanceTo(30 * MIN);
        const before = { rr: e.state.rr, spo2: e.state.spo2 };
        const w = e.skipTime(30 * MIN, 240 * MIN);
        assert.equal(w.stopped, "alert");
        assert.equal(w.to, 122 * MIN, "120 minutes at the full rate");
        assert.deepEqual({ rr: e.state.rr, spo2: e.state.spo2 }, { rr: before.rr + 6, spo2: before.spo2 - 4 });
        assert.ok(e.events.some((x) => x.type === "PATIENT_DETERIORATED" && /breathing is faster/.test(x.narrative)));
    });
});

describe("rate-controlled fluid: scoring", () => {
    const steps = (s: ReturnType<typeof scoreBedside>) => rate(s)!.fluid_steps!.map((x) => [x.label, x.status]);

    it("the right start, each rate for its time, and the stop in its window: the rate item in full", () => {
        const { score } = run(fluidPlan(), [["iv_access", 1], [at("r20"), 2], [at("r10"), 72], [at("r5"), 162], [STOP, 300]], 320);
        assert.deepEqual(steps(score), [
            ["Started at 20 mL/kg/h", "on_time"],
            ["20 mL/kg/h for 60 to 90 min", "on_time"],
            ["10 mL/kg/h for 1 to 2 h", "on_time"],
            ["Stopped 3 to 10 h after it was started", "on_time"],
        ]);
        assert.equal(rate(score)!.status, "on_time");
        assert.equal(score.score, 100);
        assert.deepEqual(score.harmful, []);
    });

    it("too soon and too late each earn half; kept past its time to the end earns nothing and overloads him", () => {
        const early = run(fluidPlan(), [["iv_access", 1], [at("r20"), 2], [at("r10"), 30]], 60).score;
        assert.deepEqual(steps(early).slice(1), [["20 mL/kg/h for 60 to 90 min", "early"], ["10 mL/kg/h for 1 to 2 h", "not_due"], ["Stopped 3 to 10 h after it was started", "not_due"]]);
        const late = run(fluidPlan(), [["iv_access", 1], [at("r20"), 2], [at("r10"), 110]], 130).score;
        assert.deepEqual(steps(late).slice(1, 2), [["20 mL/kg/h for 60 to 90 min", "late"]]);
        assert.deepEqual(late.harmful, [], "stepped down before the overload at 120 minutes");
        const kept = run(fluidPlan(), [["iv_access", 1], [at("r20"), 2]], 200).score;
        assert.deepEqual(steps(kept).slice(1), [["20 mL/kg/h for 60 to 90 min", "missed"], ["Stopped 3 to 10 h after it was started", "not_due"]]);
        assert.deepEqual(kept.harmful.map((h) => [h.id, h.at_minutes]), [[`${F}:overload_r20`, 122]]);
        // Two essential treatments in time (iv access, the fluid) and the rate item half-way (start right, kept on): 5/6, less 15.
        assert.equal(kept.score, Math.round((100 * (1 + 1 + 0.5)) / 3 - 15));
    });

    it("the starting rate is judged on the patient as he was when it was started", () => {
        const wrong = run(fluidPlan(), [["iv_access", 1], [at("r10"), 2]], 30).score;
        assert.deepEqual(rate(wrong)!.fluid_steps![0], { label: "Started at 10 mL/kg/h", at_minutes: 2, status: "wrong", expected: "20 mL/kg/h" });
        // Once he has reached decompensated shock the plan asks for the lower rate (the test plan's own rule).
        const late = run(fluidPlan(), [["iv_access", 13], [at("r10"), 14]], 30).score;
        assert.equal(rate(late)!.fluid_steps![0].status, "on_time");
    });

    it("a fluid never started has no rate item, and its refusals are listed as not changed", () => {
        const { score } = run(fluidPlan(), [[at("r20"), 1], ["iv_access", 2], [at("r20"), 3], [at("r5"), 4]], 10);
        assert.deepEqual(score.refused?.map((r) => [r.id, r.reason]), [[F, "needs_first"], [F, "fluid"]]);
        assert.equal(run(fluidPlan(), [["iv_access", 1]], 10).score.items.some((i) => i.id === `${F}:rate`), false);
    });

    it("browser and server agree for any order of rate changes, stops and waits", () => {
        const actions = ["iv_access", at("r20"), at("r10"), at("r5"), STOP, F];
        let seed = 7;
        const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
        for (let trial = 0; trial < 25; trial++) {
            const sequence: Array<[string, number]> = [];
            let minute = 0;
            for (let k = 0; k < 8; k++) {
                minute += Math.round(next() * 50 * 10) / 10;
                sequence.push([actions[Math.floor(next() * actions.length)], minute]);
            }
            run(fluidPlan({ volume_ml: 200 }), sequence, Math.min(720, minute + 60));
        }
    });

    it("the playthroughs give it as planned: the usual rate, each step as soon as its time is up, the stop in its window", () => {
        const p = playthroughs(base(), fluidPlan());
        assert.equal(p.correct.outcome.stabilised, true);
        assert.deepEqual(p.correct.items.find(([id]) => id === `${F}:rate`), [`${F}:rate`, "on_time"]);
        assert.deepEqual(p.correct.harmful, []);
    });
});

describe("rate-controlled fluid: the pure parts", () => {
    const s = { levels: [{ flag: "a", ml_per_h: 240 }, { flag: "b", ml_per_h: 120 }], ends: ["stop"] };

    it("adds the volume in whole mL x seconds per hour, from each rate's start to the next, and stops at the end flag", () => {
        const flags = { a: true, b: true, stop: true };
        assert.equal(deliveredRateSeconds(s, flags, { a: 0, b: 600, stop: 900 }, 10_000), 240 * 600 + 120 * 300);
        assert.equal(deliveredRateSeconds(s, { a: true }, { a: 100 }, 100), 0);
        assert.equal(deliveredRateSeconds(s, { a: true }, { a: 100 }, 50), 0, "nothing before it started");
    });

    it("finds the instant the volume will be in, on a whole second, and none once it has ended", () => {
        assert.equal(deliveredBoundary(s, 40, { a: true }, { a: 0 }), 600);
        assert.equal(deliveredBoundary(s, 40.01, { a: true }, { a: 0 }), 601, "rounded up to a whole second");
        assert.equal(deliveredBoundary(s, 100, { a: true, b: true }, { a: 0, b: 600 }), 600 + 1800);
        assert.equal(deliveredBoundary(s, 100, { a: true, stop: true }, { a: 0, stop: 60 }), null);
    });

    it("reads and labels a fluid's actions", () => {
        assert.deepEqual(parseFluidAction("iv_fluid@r10"), { id: "iv_fluid", level: "r10" });
        assert.equal(parseFluidAction("iv_fluid"), null);
        const c = compileLivePlan(base(), fluidPlan());
        assert.equal(interventionLabel(c, at("r10")), "IV fluid bolus: 10 mL/kg/h");
        assert.equal(fluidActionLabels(c.custom_interventions).get(STOP), "IV fluid bolus: stopped");
    });

    it("a refused rate change is marked as one, so the tray shows it as not given", () => {
        const { said } = run(fluidPlan(), [["iv_access", 1], [STOP, 2]], 3);
        assert.ok(said[1].startsWith(REFUSED_PREFIX));
    });
});
