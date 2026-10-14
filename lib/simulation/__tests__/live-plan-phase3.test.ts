// Phase 3 of live plans: timed infusions and clinical end points (more blocks are added below as each part lands).
// Played through the real engine and the server's replay.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { validateSimulationCase } from "../validate-config";
import { checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan, scoreBedside, type LivePlan } from "../live-plan";
import { goldenFixtureCase, goldenFixturePlan } from "./live-plan-golden-fixture";

const MIN = 60;
const base = () => upgradeLegacyCase(goldenFixtureCase as unknown as Record<string, unknown>) as unknown as SimulationCaseConfig;
const errorsOf = (p: LivePlan) => checkLivePlan(p, measuredOnArrival(base())).errors.join(" | ");

// The shocked toddler (arrives HR 148, BP 86/54; stages at 6 and 12 min). The bolus runs over 4 minutes, and he
// counts as stabilised only once systolic is 90 or more.
function infusionRaw(bolus: Record<string, unknown> = {}, over: Record<string, unknown> = {}): Record<string, unknown> {
    const p = JSON.parse(JSON.stringify(goldenFixturePlan));
    p.treatments = p.treatments.map((t: Record<string, unknown>) => (t.id === "fluid_bolus_20ml_kg" ? { ...t, infusion: { over_minutes: 4 }, ...bolus } : t));
    p.end_points = { vital: "sbp", at_least: 90 };
    return { ...p, ...over };
}
const infusion = (bolus: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => normaliseLivePlan(infusionRaw(bolus, over), "ai");

function run(p: LivePlan, steps: Array<[string, number]>, until: number) {
    const c = compileLivePlan(base(), p);
    const engine = new EncounterEngine(c);
    for (const [a, m] of steps) engine.giveIntervention(a, m * MIN);
    engine.advanceTo(until * MIN);
    return { c, engine, score: scoreBedside(c, p, engine.events, until) };
}
const at = (p: LivePlan, steps: Array<[string, number]>, minute: number) => run(p, steps, minute).engine.state;

describe("timed infusions", () => {
    it("passes the check, and the compiled case passes the engine's validator", () => {
        assert.equal(errorsOf(infusion()), "");
        assert.deepEqual(validateSimulationCase(compileLivePlan(base(), infusion())).errors ?? [], []);
    });

    it("spreads the effect minute by minute, and the shares add up exactly", () => {
        // No IV access, so never stabilised: the whole infusion arrives. Effect hr -14, BP +8/+5 over 4 minutes.
        const steps: Array<[string, number]> = [["fluid_bolus_20ml_kg", 1]];
        assert.equal(at(infusion(), steps, 1).systolic, 86, "nothing at the moment it is started");
        assert.deepEqual([2, 3, 4, 5].map((m) => at(infusion(), steps, m).systolic), [88, 90, 92, 94]);
        const done = at(infusion(), steps, 5);
        assert.equal(done.rate, 148 - 14);
        assert.equal(done.diastolic, 54 + 5);
    });

    it("stops acting once the patient is stabilised, and he is stabilised only when the end point is reached", () => {
        const { engine, score } = run(infusion(), [["iv_access", 1], ["fluid_bolus_20ml_kg", 1]], 3);
        assert.equal(engine.state.flagSetAt.live_stabilised, 3 * MIN, "systolic reaches 90 at minute 3");
        assert.equal(run(infusion(), [["iv_access", 1], ["fluid_bolus_20ml_kg", 1]], 5).engine.state.systolic, 90, "no further shares after stabilisation");
        assert.equal(score.outcome.stabilised, true);
    });

    it("acts only while its condition holds", () => {
        const titrated = infusion({ infusion: { over_minutes: 4, while: { vital: "sbp", below: 89 } } });
        assert.equal(at(titrated, [["fluid_bolus_20ml_kg", 1]], 5).systolic, 90, "two shares (to 88, then 90) and then it stops");
    });

    it("an end point that is never reached means never stabilised, however complete the path", () => {
        const high = infusion({}, { end_points: { vital: "sbp", at_least: 120 } });
        const { score } = run(high, [["iv_access", 1], ["fluid_bolus_20ml_kg", 1]], 19);
        assert.equal(score.outcome.stabilised, false);
    });

    it("refuses an infusion that cannot work", () => {
        assert.match(errorsOf(infusion({ infusion: { over_minutes: 0 } })), /over_minutes must be a whole number/);
        assert.match(errorsOf(infusion({ effect: undefined })), /needs an effect/);
        assert.match(errorsOf(infusion({ max_doses: 2 })), /cannot also have repeat doses/);
        assert.match(errorsOf(infusion({}, { end_points: undefined })), /needs end_points/);
    });

    it("the server's replay agrees with the browser", () => {
        for (const steps of [[["iv_access", 1], ["fluid_bolus_20ml_kg", 1]], [["fluid_bolus_20ml_kg", 2], ["furosemide_iv", 3], ["iv_access", 9]]] as Array<Array<[string, number]>>) {
            const p = infusion();
            const { c, engine, score } = run(p, steps, 19);
            const replayed = replayStudentEvents(c, engine.events.filter((e) => e.type === "INTERVENTION_GIVEN"));
            replayed.advanceTo(19 * MIN);
            assert.deepEqual(scoreBedside(c, p, replayed.events, 19), score);
            assert.equal(replayed.state.systolic, engine.state.systolic);
        }
    });
});
