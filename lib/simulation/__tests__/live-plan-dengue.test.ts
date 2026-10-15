// Severe dengue with shock on the real plan (data/cases, not in git), once the converted plan is saved: the compensated
// pathway, the hypotensive-shock transition and its repeat boluses, reassessment, harm, browser/server parity, and what
// the engine can and cannot do with fluids. Skips until the converted plan (with the hypotensive bolus) is on this machine.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan, REASSESS_ID, scoreBedside, type LivePlan } from "../live-plan";

const ID = "29-year-old-man-with-belly-pain-as-his-fever-settles";
const FILE = path.join(process.cwd(), "data", "cases", `${ID}.json`);
const have = fs.existsSync(FILE) ? (JSON.parse(fs.readFileSync(FILE, "utf8")).live_plan as LivePlan) : undefined;
const converted = !!have?.treatments.some((t) => t.id === "crystalloid_bolus_hypotensive");
const SKIP = !converted && "the converted dengue plan is not saved on this machine yet";
const R = REASSESS_ID;
const COMP = "crystalloid_resuscitation_dengue";
const BOLUS = "crystalloid_bolus_hypotensive";

describe("dengue shock: the converted plan", { skip: SKIP }, () => {
    const c = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const plan = c.live_plan as LivePlan;
    const base = upgradeLegacyCase(c) as unknown as SimulationCaseConfig;
    const cfg = compileLivePlan(base, plan);
    const END = plan.time_limit_minutes - 1;

    function run(steps: Array<[string, number]>, to = END) {
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

    it("is still proposed, passes the check, and keeps all three release blockers open", () => {
        assert.equal(plan.status, "proposed");
        assert.deepEqual(checkLivePlan(plan, measuredOnArrival(base)), { errors: [], warnings: [] });
        const open = (plan.release_blockers ?? []).filter((b) => !b.cleared_at).map((b) => b.id).sort();
        assert.deepEqual(open, ["clinical_review", "dengue_ncvbdc_figures", "infusion_model_limitation"]);
    });

    it("untreated he slides into profound shock and is never stabilised", () => {
        const { e, score, stabilised } = run([]);
        assert.equal(score.score, 0);
        assert.ok(!stabilised);
        assert.ok(e.state.systolic < 70);
    });

    it("compensated shock: IV access then the slow crystalloid stabilises him and scores full marks", () => {
        const { score, stabilised } = run([["iv_access", 2], [COMP, 3], ["serial_monitoring_dengue", 4]]);
        assert.ok(stabilised);
        assert.equal(score.score, 100);
        assert.equal(item(score, BOLUS), "not_needed");
    });

    it("fluids need IV access, and the hypotensive bolus is not on the tray until he is hypotensive", () => {
        assert.match(run([[COMP, 1]]).out[0], /^Not given: there is no IV access yet/);
        const early = run([["iv_access", 2], [BOLUS, 3]]);
        assert.match(early.out[1], /^Not given/);
        assert.ok(!early.stabilised);
    });

    it("late but still compensated: treated at the narrowing stage he is stabilised with a late cannula", () => {
        const { score, stabilised } = run([["iv_access", 6], [COMP, 7], ["serial_monitoring_dengue", 8]]);
        assert.ok(stabilised);
        assert.equal(item(score, "iv_access"), "late");
    });

    it("hypotensive shock: the slow compensated rate alone is the wrong rate and does not stabilise him", () => {
        const { out, stabilised } = run([["iv_access", 9], [COMP, 10]]);
        assert.match(out[1], /already under 90/);
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
        assert.match(before, /cold and mottled/);
        assert.match(before, /very little urine/);
        assert.match(before, /above 45%/);
        const after = run([["iv_access", 2], [COMP, 3], [R, 12]]).out[2];
        assert.match(after, /hands are warmer/);
        assert.match(after, /Urine is draining/);
    });

    it("the harmful actions cost marks but do not undo correct care", () => {
        const { score } = run([["iv_access", 2], [COMP, 3], ["serial_monitoring_dengue", 4], ["free_flowing_fluids", 5], ["platelet_transfusion_count_only", 6], ["diclofenac_im", 7], ["dexamethasone_iv", 8]]);
        assert.deepEqual(score.harmful.map((h) => h.id).sort(), ["dexamethasone_iv", "diclofenac_im", "free_flowing_fluids", "platelet_transfusion_count_only"]);
        assert.equal(score.score, 40);
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

    it("what it cannot do: no step-down or rate change, and running fluids on after recovery does no harm", () => {
        const plan = c.live_plan as LivePlan;
        assert.ok(!plan.treatments.some((t) => /step|rate/i.test(t.id)), "no stepped-rate treatment exists");
        const recovered = sbpSeries(plan, [["iv_access", 2], [COMP, 3], [COMP, 5], [COMP, 7]], 20).e.state;
        assert.equal(recovered.systolic, 104, "giving the fluid again changes nothing and harms nothing");
    });
});
