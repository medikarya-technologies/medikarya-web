// Severe dengue with shock on the real plan (data/cases, not in git), once the converted plan is saved: the compensated
// pathway, the hypotensive-shock transition and its repeat boluses, reassessment, harm, browser/server parity, and the
// rate-controlled infusion that is tapered over the ward hours (S2). Skips until the plan with the taper is on this machine.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { fluidAction, fluidStatus, fluidStopAction } from "../fluid-infusion";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan, REASSESS_ID, scoreBedside, type LivePlan } from "../live-plan";

const ID = "29-year-old-man-with-belly-pain-as-his-fever-settles";
const FILE = path.join(process.cwd(), "data", "cases", `${ID}.json`);
const have = fs.existsSync(FILE) ? (JSON.parse(fs.readFileSync(FILE, "utf8")).live_plan as LivePlan) : undefined;
const COMP = "crystalloid_resuscitation_dengue";
const BOLUS = "crystalloid_bolus_hypotensive";
const tapered = !!have?.treatments.some((t) => t.id === COMP && t.fluid);
const SKIP = !tapered && "the dengue plan with the rate-controlled taper is not saved on this machine yet";
const R = REASSESS_ID;
const rate = (level: string) => fluidAction(COMP, level);
const STOP = fluidStopAction(COMP);
const H = 60;

describe("dengue shock: the converted plan", { skip: SKIP }, () => {
    const c = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const plan = c.live_plan as LivePlan;
    const base = upgradeLegacyCase(c) as unknown as SimulationCaseConfig;
    const cfg = compileLivePlan(base, plan);

    /** The bedside part by default: the first half hour, before any step of the taper falls due. */
    function run(steps: Array<[string, number]>, to = 30) {
        const e = new EncounterEngine(cfg);
        const out = steps.map(([a, m]) => {
            if (m * 60 > e.lastTimestamp) e.advanceTo(m * 60);
            return String(e.giveIntervention(a, m * 60).consequence);
        });
        e.advanceTo(to * 60);
        const score = scoreBedside(cfg, plan, e.events, to);
        const r = replayStudentEvents(cfg, e.events.filter((x) => x.type === "INTERVENTION_GIVEN"));
        r.advanceTo(to * 60);
        assert.deepEqual(scoreBedside(cfg, plan, r.events, to), score, "browser and server must agree");
        assert.deepEqual(r.state.snapshot(), e.state.snapshot(), "browser and server must leave the same patient");
        const stabilised = e.state.flagSetAt.live_stabilised !== undefined;
        return { e, out, score, stabilised };
    }
    const item = (s: ReturnType<typeof scoreBedside>, id: string) => s.items.find((i) => i.id === id)!.status;
    const steps = (s: ReturnType<typeof scoreBedside>) => s.items.find((i) => i.id === `${COMP}:rate`)?.fluid_steps?.map((x) => [x.label, x.status]);

    it("is still proposed, passes the check, and keeps the infusion release blocker open", () => {
        assert.equal(plan.status, "proposed");
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base)), { errors: [], warnings: [] });
        const open = (plan.release_blockers ?? []).filter((b) => !b.cleared_at).map((b) => b.id);
        assert.deepEqual(open, ["infusion_model_limitation"]);
    });

    it("untreated he slides into profound shock and is never stabilised", () => {
        const { e, score, stabilised } = run([]);
        assert.equal(score.score, 0);
        assert.ok(!stabilised);
        assert.ok(e.state.systolic < 70);
    });

    it("compensated shock: IV access then the infusion at 10 mL/kg/h stabilises him and scores full marks", () => {
        const { score, stabilised, out } = run([["iv_access", 2], [rate("r10"), 3], ["serial_monitoring_dengue", 4]]);
        assert.match(out[1], /^Started at 10 mL\/kg\/h\. The saline is running on a pump/);
        assert.ok(stabilised);
        assert.equal(score.score, 100);
        assert.equal(item(score, BOLUS), "not_needed");
    });

    it("fluids need IV access, and the hypotensive bolus is not on the tray until he is hypotensive", () => {
        assert.match(run([[rate("r10"), 1]]).out[0], /^Not given: there is no IV access yet/);
        assert.match(run([[COMP, 1]]).out[0], /^Not given: choose the rate to start it at/);
        const early = run([["iv_access", 2], [BOLUS, 3]]);
        assert.match(early.out[1], /^Not given/);
        assert.ok(!early.stabilised);
    });

    it("late but still compensated: treated at the narrowing stage he is stabilised with a late cannula", () => {
        const { score, stabilised } = run([["iv_access", 6], [rate("r10"), 7], ["serial_monitoring_dengue", 8]]);
        assert.ok(stabilised);
        assert.equal(item(score, "iv_access"), "late");
    });

    it("hypotensive shock: the slow infusion alone is the wrong treatment and does not stabilise him", () => {
        const { out, stabilised } = run([["iv_access", 9], [rate("r10"), 10]]);
        assert.match(out[1], /systolic BP is under 90: a rate this slow does not treat hypotensive shock/);
        assert.ok(!stabilised);
    });

    it("hypotensive shock: one rapid bolus is enough at the first low BP, on the hypotensive path", () => {
        const { score, stabilised, e } = run([["iv_access", 9], [BOLUS, 10], ["serial_monitoring_dengue", 11]]);
        assert.ok(stabilised);
        assert.equal(item(score, BOLUS), "on_time");
        assert.equal(item(score, COMP), "missed", "the compensated window was missed");
        assert.ok(e.state.systolic >= 90);
    });

    it("decompensated shock: a second bolus needs a reassessment and the interval to have passed", () => {
        const noReassess = run([["iv_access", 14], [BOLUS, 14.5], [BOLUS, 17]]);
        assert.match(noReassess.out[2], /^Not given/);
        assert.ok(!noReassess.stabilised);
        const tooSoon = run([["iv_access", 14], [BOLUS, 14.5], [R, 14.7], [BOLUS, 15]]);
        assert.match(tooSoon.out[3], /too soon/);
        const right = run([["iv_access", 14], [BOLUS, 14.5], [R, 15], [BOLUS, 16.5]]);
        assert.ok(right.stabilised, "two boluses with a reassessment between stabilise him before the next stage");
        assert.match(right.out[2], /under 90 mmHg/);
    });

    it("a bolus when the BP is already 90 or more is refused as not indicated", () => {
        const { out } = run([["iv_access", 9], [BOLUS, 9.5], [R, 10], [BOLUS, 11.5]]);
        assert.match(out[3], /^Not given: his systolic BP is no longer under 90/);
    });

    it("profound shock is not stabilised by three boluses: that needs inotropes and ICU, which are not modelled", () => {
        const { stabilised, e } = run([["iv_access", 19], [BOLUS, 19.5], [R, 20], [BOLUS, 21.5], [R, 22], [BOLUS, 23.5]]);
        assert.ok(!stabilised);
        assert.ok(e.state.systolic < 90);
    });

    it("the reassessment reports BP, perfusion, urine and the haematocrit, and they change once he recovers", () => {
        const before = run([[R, 1]]).out[0];
        assert.match(before, /90 mmHg/);
        assert.match(before, /Peripheries still cold/);
        assert.match(before, /Oliguria/);
        assert.match(before, /above 45%/);
        const after = run([["iv_access", 2], [rate("r10"), 3], [R, 12]]).out[2];
        assert.match(after, /Peripheries warmer/);
        assert.match(after, /Urine is draining/);
        assert.match(after, /haematocrit has come down below 45%/);
    });

    it("the harmful actions cost marks but do not undo correct care; platelets cost nothing (the reviewer's choice)", () => {
        const { score } = run([["iv_access", 2], [rate("r10"), 3], ["serial_monitoring_dengue", 4], ["free_flowing_fluids", 5], ["platelet_transfusion_count_only", 6], ["diclofenac_im", 7], ["dexamethasone_iv", 8]]);
        assert.deepEqual(score.harmful.map((h) => h.id).sort(), ["dexamethasone_iv", "diclofenac_im", "free_flowing_fluids"]);
        assert.equal(score.score, 55);
    });

    // ── The taper (NCVBDC 2023, Dr Pawan Lal's review, WHO 2009), in clinical hours.

    it("compensated shock tapered as the guideline says: 10 for 1 h, 7 to 10, 5 to 7, 3 to 5, 2 to 3, stopped at 24 h: full marks", () => {
        const course: Array<[string, number]> = [
            ["iv_access", 2],
            [rate("r10"), 3],
            ["serial_monitoring_dengue", 4],
            [R, 62],
            [rate("r7"), 63],
            [rate("r5"), 63 + H],
            [rate("r3"), 63 + 2 * H],
            [rate("r2"), 63 + 4 * H],
            [STOP, 3 + 24 * H],
        ];
        const { e, out, score } = run(course, 3 + 24 * H + 10);
        assert.match(out[3], /The systolic BP is 90 mmHg or more/);
        assert.equal(out[4], "The pump is turned down to 7 mL/kg/h (455 mL/h).");
        assert.deepEqual(steps(score), [
            ["Started at 10 mL/kg/h", "on_time"],
            ["10 mL/kg/h for 60 to 90 min", "on_time"],
            ["7 to 10 mL/kg/h for 1 to 2 h", "on_time"],
            ["5 to 7 mL/kg/h for 1 to 2 h", "on_time"],
            ["3 to 5 mL/kg/h for 2 to 4 h", "on_time"],
            ["Stopped 24 to 48 h after it was started", "on_time"],
        ]);
        assert.equal(score.score, 100);
        assert.deepEqual(score.harmful, []);
        // 650 + 455 + 325 + 2 x 195 + 19 h x 130 mL.
        const def = cfg.custom_interventions!.find((i) => i.id === COMP)!.fluid!;
        const s = fluidStatus(COMP, def, e.state.flags, e.state.flagSetAt, e.lastTimestamp);
        assert.equal(s.state, "stopped");
        assert.equal(s.deliveredMl, 650 + 455 + 325 + 2 * 195 + 19 * 130);
    });

    it("kept at 10 mL/kg/h once he has recovered, he is overloaded at 90 minutes: the nurse calls, a long wait stops there, and it is harm", () => {
        const e = new EncounterEngine(cfg);
        e.giveIntervention("iv_access", 2 * 60);
        e.giveIntervention(rate("r10"), 3 * 60);
        e.advanceTo(30 * 60);
        const before = { rr: e.state.rr, spo2: e.state.spo2 };
        const w = e.skipTime(30 * 60, 4 * H * 60);
        assert.equal(w.stopped, "alert");
        assert.equal(w.to, 93 * 60);
        assert.deepEqual({ rr: e.state.rr, spo2: e.state.spo2 }, { rr: before.rr + 4, spo2: before.spo2 - 4 });
        assert.ok(e.events.some((x) => x.type === "PATIENT_DETERIORATED" && /crackles at both lung bases/.test(x.narrative)));
        const score = scoreBedside(cfg, plan, e.events, 100);
        assert.deepEqual(score.harmful.map((h) => [h.id, h.at_minutes]), [[`${COMP}:overload_r10`, 93]]);
        // Stepped down in time, he is not overloaded.
        const stepped = run([["iv_access", 2], [rate("r10"), 3], [rate("r7"), 63]], 200);
        assert.deepEqual(stepped.score.harmful, []);
    });

    it("after one hypotensive bolus the infusion starts at 10 mL/kg/h; after two, at 7 to 10", () => {
        const one = run([["iv_access", 9], [BOLUS, 10], [rate("r10"), 11]]).score;
        assert.deepEqual(steps(one)?.[0], ["Started at 10 mL/kg/h", "on_time"]);
        const two = run([["iv_access", 14], [BOLUS, 14.5], [R, 15], [BOLUS, 16.5], [rate("r7"), 17]]).score;
        assert.deepEqual(steps(two)?.[0], ["Started at 7 to 10 mL/kg/h", "on_time"]);
        const wrong = run([["iv_access", 14], [BOLUS, 14.5], [R, 15], [BOLUS, 16.5], [rate("r10"), 17]]).score;
        const first = wrong.items.find((i) => i.id === `${COMP}:rate`)!.fluid_steps![0];
        assert.deepEqual([first.status, first.expected], ["wrong", "7 to 10 mL/kg/h"]);
    });

    it("stepping down before the hour is up, or stopping before 24 hours, is too soon and earns half", () => {
        const { score } = run([["iv_access", 2], [rate("r10"), 3], [rate("r7"), 30], [STOP, 10 * H]], 11 * H);
        assert.deepEqual(steps(score), [
            ["Started at 10 mL/kg/h", "on_time"],
            ["10 mL/kg/h for 60 to 90 min", "early"],
            ["7 to 10 mL/kg/h for 1 to 2 h", "late"],
            ["Stopped 24 to 48 h after it was started", "early"],
        ]);
    });

    it("the rate comes down one step at a time and never goes up", () => {
        const { out } = run([["iv_access", 2], [rate("r10"), 3], [rate("r5"), 63], [rate("r7"), 64], [rate("r10"), 65]], 70);
        assert.match(out[2], /^Not given: the rate comes down one step at a time: it is running at 10 mL\/kg\/h, so the next step is 7 to 10 mL\/kg\/h/);
        assert.equal(out[3], "The pump is turned down to 7 mL/kg/h (455 mL/h).");
        assert.match(out[4], /^Not given: it is running at 7 to 10 mL\/kg\/h, below this rate/);
    });
});

describe("dengue shock: what the engine does with fluids (variants of the converted plan)", { skip: SKIP }, () => {
    const c = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const base = upgradeLegacyCase(c) as unknown as SimulationCaseConfig;
    const sbpSeries = (plan: LivePlan, steps: Array<[string, number]>, to: number) => {
        const e = new EncounterEngine(compileLivePlan(base, plan));
        let k = 0;
        const out: number[] = [];
        for (let m = 1; m <= to; m++) {
            while (k < steps.length && steps[k][1] === m) e.giveIntervention(steps[k++][0], m * 60);
            e.advanceTo(m * 60);
            out.push(e.state.systolic);
        }
        return { out, e };
    };
    // The hypotensive bolus as a timed infusion, optionally stopped by a tray action.
    const infusionVariant = (withStop: boolean, effect = { sbp: 24, dbp: 6, hr: -30 }) => {
        const p = JSON.parse(JSON.stringify(c.live_plan));
        const t = p.treatments.find((x: { id: string }) => x.id === BOLUS);
        for (const k of ["max_doses", "min_interval_minutes", "repeat_only_while", "not_indicated_says", "reassess_before_repeat", "says_per_dose"]) delete t[k];
        t.effect = effect;
        t.infusion = { over_minutes: 8, ...(withStop ? { while: { not: { given: "stop_iv_fluids" } } } : {}) };
        p.treatments.push({ id: "stop_iv_fluids", label: "Stop the IV fluids", detail: "Stop the infusion", group: "circulation", role: "supportive", says: "The infusion is stopped.", requires: [{ when: { given: BOLUS }, says: "no fluid is running." }] });
        return normaliseLivePlan(p, "ai");
    };

    it("the untreated course is applied as differences, so what a treatment has improved stays improved", () => {
        // The same slow infusion started at minute 9 reaches a higher BP than the untreated course at every later minute,
        // including after the stage at minute 14: the stage lowers the BP by a difference, it does not reset it.
        const untreated = sbpSeries(infusionVariant(false), [], 16).out;
        const infusing = sbpSeries(infusionVariant(false), [["iv_access", 9], [BOLUS, 9]], 16).out;
        assert.ok(untreated[13] < untreated[12], "the stage at minute 14 lowers the untreated BP");
        for (let m = 10; m <= 16; m++) assert.ok(infusing[m - 1] > untreated[m - 1], `treated is above untreated at minute ${m}`);
    });

    it("a timed infusion can be stopped by a tray action (infusion.while), and then it stops adding effect", () => {
        const ran = sbpSeries(infusionVariant(true), [["iv_access", 9], [BOLUS, 9]], 12).out;
        const stopped = sbpSeries(infusionVariant(true), [["iv_access", 9], [BOLUS, 9], ["stop_iv_fluids", 11]], 12).out;
        assert.ok(ran[11] > stopped[11], "the stopped infusion gave less than the one left running");
        assert.equal(stopped[10], stopped[11], "no more effect after it is stopped");
    });

    it("what it still cannot do: the response is the plan's per-rate table, not a volume model, so cutting the rate early causes no relapse", () => {
        const plan = c.live_plan as LivePlan;
        const early = sbpSeries(plan, [["iv_access", 2], [rate("r10"), 3], [rate("r7"), 10], [rate("r5"), 11], [rate("r3"), 12], [rate("r2"), 13], [STOP, 14]], 40).e.state;
        assert.equal(early.systolic, 104, "he recovers to the plan's recovery BP whatever the rate");
    });
});
