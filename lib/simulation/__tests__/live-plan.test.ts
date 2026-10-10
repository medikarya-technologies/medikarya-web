// A live plan: checked, compiled into the engine's rules, and then PLAYED through the real engine, so the tests
// say what a student would see: an untreated patient gets worse on schedule, a treated one stops and recovers, a
// harmful treatment is flagged, and the bedside score follows what was done and when.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CATALOG_TEST_IDS } from "../../clinical-catalog";
import { isSimulationCase, type SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { INTERVENTION_IDS, interventionLabel, interventionsForCase } from "../intervention-catalog";
import { upgradeLegacyCase } from "../legacy-adapter";
import {
    blendLiveScore,
    checkLivePlan,
    compileLivePlan,
    isLivePlan,
    livePlanApplies,
    measuredOnArrival,
    normaliseLivePlan,
    scoreBedside,
    type LivePlan,
} from "../live-plan";
import { validateSimulationCase } from "../validate-config";
import { replayStudentEvents } from "../replay";
import type { ClinicalEvent } from "../encounter-events";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** An ordinary case: a dehydrated toddler, as the converter would have written it. */
function ordinaryCase(over: Record<string, unknown> = {}): Record<string, any> {
    return {
        id: "fixture-child",
        title: "Acute gastroenteritis with severe dehydration",
        displayTitle: "2-year-old boy with vomiting and loose stools",
        category: "Paediatrics",
        difficulty: "Intermediate",
        patient: {
            name: "Aarav",
            age: 2,
            gender: "Male",
            chiefComplaint: "Vomiting and loose stools for 3 days",
            vitalSigns: {
                heartRate: { value: 148, unit: "bpm" },
                bloodPressure: { systolic: 86, diastolic: 54, unit: "mmHg" },
                respiratoryRate: { value: 34, unit: "/min" },
                temperature: { value: 37.9, unit: "°C" },
                oxygenSaturation: { value: 97, unit: "%" },
            },
        },
        patient_facts: { general_physical_examination: { hydration: "Sunken eyes, dry mucosa, skin pinch goes back slowly" } },
        tests: [{ id: "serum-electrolytes", name: "Serum electrolytes", category: "Laboratory", result: { summary: "Sodium 131", values: [], interpretation: "Mild hyponatraemia" } }],
        evaluation_config: { diagnosis: { accepted_primary: ["Acute gastroenteritis with severe dehydration"] } },
        ...over,
    };
}

/** What a resident (or the AI) would write for that child, before it is tidied. */
function rawPlan(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        summary: "Untreated, the child goes from compensated to decompensated hypovolaemic shock within a quarter of an hour.",
        setting: "Paediatric emergency",
        critical_window_minutes: 8,
        time_limit_minutes: 20,
        arrival: { consciousness: "anxious", stability: "unstable" },
        stages: [
            { id: "Compensated shock", name: "Compensated shock", at_minutes: 6, vitals: { hr: 164, sbp: 80, dbp: 50, rr: 40 }, consciousness: "drowsy", nurse_says: "Doctor, he is getting sleepy and his hands are cold. Pulse {hr}." },
            { id: "decompensated", name: "Decompensated shock", at_minutes: 12, vitals: { hr: 178, sbp: 62, dbp: 38, rr: 48, spo2: 92 }, consciousness: "altered", stability: "critical", nurse_says: "I can barely feel his pulse. BP {bp}." },
        ],
        treatments: [
            { id: "iv_access", role: "essential", within_minutes: 5, says: "Two cannulae in on the second attempt; bloods sent.", why: "No fluids can be given without access." },
            { id: "fluid_bolus_20ml_kg", label: "IV fluid bolus", detail: "20 mL/kg Ringer's lactate over 15 minutes", group: "circulation", role: "essential", within_minutes: 8, effect: { hr: -14, sbp: 8, dbp: 5 }, says: "The bolus is running. His pulse is coming down.", why: "Shock in a dehydrated child is treated with a rapid isotonic bolus." },
            { id: "oxygen_supplemental", role: "supportive", effect: { spo2: 2 }, says: "Oxygen on by mask." },
            { id: "furosemide_iv", role: "harmful", effect: { sbp: -10, dbp: -6, hr: 8 }, says: "Furosemide given. His pressure falls further.", why: "A diuretic in a volume-depleted child deepens the shock." },
            { id: "ondansetron_4mg", role: "supportive", says: "Ondansetron given; the vomiting settles." },
        ],
        stabilised_by: ["iv_access", "fluid_bolus_20ml_kg"],
        recovery: { after_minutes: 4, vitals: { hr: 126, sbp: 94, dbp: 58, spo2: 99, rr: 30 }, consciousness: "alert", nurse_says: "He is waking up and asking for his mother. Pulse {hr}, BP {bp}." },
        basis: ["Timings: untreated hypovolaemic shock in a toddler."],
        ...over,
    };
}

const base = (c = ordinaryCase()) => upgradeLegacyCase(c) as unknown as SimulationCaseConfig & Record<string, any>;
const plan = (over: Record<string, unknown> = {}): LivePlan => normaliseLivePlan(rawPlan(over), "ai");
const live = (p: LivePlan = plan()) => compileLivePlan(base(), p);
const MIN = 60;

// ── Reading and checking ────────────────────────────────────────────────────

describe("live plan: tidying what was written", () => {
    it("does not carry the team's switch-on over to a redrafted plan: it has to be switched on again", () => {
        const tidied = normaliseLivePlan({ ...rawPlan(), status: "approved", team_checked_at: "2026-10-10T00:00:00Z" }, "ai");
        assert.equal(tidied.status, "proposed");
        assert.equal(tidied.team_checked_at, undefined);
    });

    it("takes a shared-tray treatment's label and dose from the tray, never from the plan", () => {
        const p = normaliseLivePlan(rawPlan({ treatments: [{ id: "furosemide_iv", label: "Lasix", detail: "400 mg IV", role: "harmful", says: "Furosemide given, and it is harmful here." }] }), "ai");
        assert.equal(p.treatments[0].label, "Furosemide IV");
        assert.equal(p.treatments[0].detail, "40 mg IV");
        assert.equal(p.treatments[0].group, "medications");
    });

    it("keeps a treatment the case defines itself as written, and makes ids usable", () => {
        const p = plan();
        const bolus = p.treatments.find((t) => t.id === "fluid_bolus_20ml_kg")!;
        assert.equal(bolus.label, "IV fluid bolus");
        assert.equal(bolus.detail, "20 mL/kg Ringer's lactate over 15 minutes");
        assert.equal(p.stages[0].id, "compensated_shock", "a name typed as an id becomes one");
    });

    it("is always a proposal when it is first read, whoever wrote it", () => {
        assert.equal(normaliseLivePlan(rawPlan({ status: "approved" }), "ai").status, "proposed");
        assert.equal(plan().origin, "ai");
        assert.equal(isLivePlan(plan()), true);
        assert.equal(isLivePlan({ stages: [] }), false);
    });

    it("applies for students only once approved, and for an admin as soon as it is proposed", () => {
        const p = plan();
        assert.equal(livePlanApplies(p, false), false);
        assert.equal(livePlanApplies(p, true), true);
        assert.equal(livePlanApplies({ ...p, status: "approved" }, false), true);
        assert.equal(livePlanApplies(undefined, true), false);
    });
});

describe("live plan: the check a clinician's plan has to pass", () => {
    const measured = measuredOnArrival(base());

    it("passes a complete plan", () => {
        const check = checkLivePlan(plan(), measured);
        assert.deepEqual(check.errors, []);
    });

    it("reads the arrival vitals from the case", () => {
        assert.deepEqual(measured, { hr: 148, sbp: 86, dbp: 54, spo2: 97, rr: 34, temp: 37.9 });
    });

    it("needs the plan to supply a vital the case never recorded", () => {
        const noSpo2 = ordinaryCase();
        delete noSpo2.patient.vitalSigns.oxygenSaturation;
        const m = measuredOnArrival(base(noSpo2));
        assert.equal(m.spo2, undefined);
        assert.match(checkLivePlan(plan(), m).errors.join("\n"), /arrival\.vitals\.spo2/);
        assert.deepEqual(checkLivePlan(plan({ arrival: { vitals: { spo2: 96 } } }), m).errors, []);
    });

    it("refuses steps that are out of order or after the end", () => {
        const stages = rawPlan().stages as any[];
        const backwards = checkLivePlan(plan({ stages: [stages[1], stages[0]] }), measured);
        assert.match(backwards.errors.join("\n"), /must be later than the step before it/);
        const late = checkLivePlan(plan({ time_limit_minutes: 10 }), measured);
        assert.match(late.errors.join("\n"), /after the encounter ends/);
    });

    it("refuses impossible vitals and a target written as an effect", () => {
        const stages = (rawPlan().stages as any[]).map((s) => ({ ...s }));
        stages[0].vitals = { hr: 400, sbp: 50, dbp: 70 };
        const e = checkLivePlan(plan({ stages }), measured).errors.join("\n");
        assert.match(e, /heart rate 400 is outside/);
        assert.match(e, /diastolic BP \(70\) must be below systolic \(50\)/);

        const treatments = (rawPlan().treatments as any[]).map((t) => ({ ...t }));
        treatments[1].effect = { sbp: 110, dbp: 70 };
        assert.match(checkLivePlan(plan({ treatments }), measured).errors.join("\n"), /effect is a change, not a target/);
    });

    it("needs an essential treatment, a deadline for it, and something that stops the deterioration", () => {
        const treatments = (rawPlan().treatments as any[]).map((t) => ({ ...t, role: t.role === "essential" ? "supportive" : t.role }));
        const e = checkLivePlan(plan({ treatments }), measured).errors.join("\n");
        assert.match(e, /at least one must be essential/);
        assert.match(e, /stops the deterioration, so it has to be essential/);

        assert.match(checkLivePlan(plan({ stabilised_by: [] }), measured).errors.join("\n"), /name the treatments that stop the deterioration/);
        assert.match(checkLivePlan(plan({ stabilised_by: ["adrenaline_1mg"] }), measured).errors.join("\n"), /is not one of the treatments/);
    });

    it("needs a dose for a treatment that is not on the shared tray", () => {
        const treatments = (rawPlan().treatments as any[]).map((t) => (t.id === "fluid_bolus_20ml_kg" ? { ...t, detail: "" } : t));
        assert.match(checkLivePlan(plan({ treatments }), measured).errors.join("\n"), /needs the dose and route/);
    });

    it("warns when the tray gives the answer away", () => {
        const treatments = (rawPlan().treatments as any[]).filter((t) => t.role === "essential");
        assert.match(checkLivePlan(plan({ treatments }), measured).warnings.join("\n"), /gives the answer away/);
    });
});

// ── Compiling ───────────────────────────────────────────────────────────────

describe("live plan: compiled into a case the engine runs", () => {
    it("is a valid simulation case, with a clock and a tray", () => {
        const c = live();
        assert.equal(isSimulationCase(c), true);
        const v = validateSimulationCase(c, { knownActions: INTERVENTION_IDS, knownTestIds: CATALOG_TEST_IDS });
        assert.deepEqual(v.errors, []);
        assert.deepEqual(c.clinical_constraints, { critical_window_minutes: 8, hard_time_limit_minutes: 20, time_scale: 1 });
        assert.ok(c.event_rules.length > 0, "which is what makes the plans page count it as a live case");
        assert.equal(c.setting, "Paediatric emergency");
    });

    it("keeps everything the ordinary case had: patient, tests, examination, scoring", () => {
        const b = base();
        const c = live();
        assert.deepEqual(c.custom_tests, b.custom_tests);
        assert.deepEqual(c.investigation_results, b.investigation_results);
        assert.deepEqual(c.examination, b.examination);
        assert.equal(c.scoring_mode, "classic");
        assert.deepEqual((c as any).evaluation_config, (b as any).evaluation_config);
    });

    it("offers exactly the plan's treatments, the case's own among them", () => {
        const c = live();
        const tray = interventionsForCase(c);
        assert.deepEqual(tray.map((t) => t.id).sort(), ["fluid_bolus_20ml_kg", "furosemide_iv", "iv_access", "ondansetron_4mg", "oxygen_supplemental"]);
        assert.equal(interventionLabel(c, "fluid_bolus_20ml_kg"), "IV fluid bolus");
        assert.equal(tray.find((t) => t.id === "fluid_bolus_20ml_kg")!.detail, "20 mL/kg Ringer's lactate over 15 minutes");
        assert.equal(interventionLabel(c, "iv_access"), "IV access ×2");
    });

    it("starts the monitor where the case says the patient arrived", () => {
        const s = new EncounterEngine(live()).state;
        assert.deepEqual([s.rate, s.systolic, s.diastolic, s.spo2, s.rr, s.temperature], [148, 86, 54, 97, 34, 37.9]);
        assert.equal(s.consciousness, "anxious");
        assert.equal(s.stability, "unstable");
    });

    it("fills a vital the case never recorded from the plan, and stops showing it as unmeasured", () => {
        const noSpo2 = ordinaryCase();
        delete noSpo2.patient.vitalSigns.oxygenSaturation;
        const b = base(noSpo2);
        assert.deepEqual(b.initial_state.unmeasured, ["spo2"]);
        const c = compileLivePlan(b, plan({ arrival: { vitals: { spo2: 95 } } }));
        assert.deepEqual(c.initial_state.unmeasured, []);
        assert.equal(new EncounterEngine(c).state.spo2, 95);
    });
});

// ── Playing it ──────────────────────────────────────────────────────────────

describe("live plan: an untreated patient gets worse on schedule", () => {
    it("reaches each step at its minute, with the monitor the plan wrote", () => {
        const engine = new EncounterEngine(live());
        assert.deepEqual(engine.advanceTo(5 * MIN + 59), [], "nothing before the first step");

        const first = engine.advanceTo(6 * MIN);
        assert.equal(first.find((e) => e.type === "STATE_TRANSITION")!.timestamp, 6 * MIN);
        let s = engine.state;
        assert.deepEqual([s.state, s.rate, s.systolic, s.diastolic, s.rr, s.spo2, s.consciousness], ["compensated_shock", 164, 80, 50, 40, 97, "drowsy"]);

        engine.advanceTo(19 * MIN);
        s = engine.state;
        assert.deepEqual([s.state, s.rate, s.systolic, s.diastolic, s.rr, s.spo2, s.consciousness, s.stability], ["decompensated", 178, 62, 38, 48, 92, "altered", "critical"]);
    });

    it("has the nurse say what the plan wrote, with the monitor's own numbers", () => {
        const engine = new EncounterEngine(live());
        const alerts = engine.advanceTo(19 * MIN).filter((e) => e.type === "PATIENT_DETERIORATED") as Array<{ narrative: string }>;
        assert.deepEqual(alerts.map((a) => a.narrative), ["Doctor, he is getting sleepy and his hands are cold. Pulse 164.", "I can barely feel his pulse. BP 62/38."]);
    });
});

describe("live plan: the right treatment in time stops it", () => {
    it("holds the patient where they are, then brings them to the recovery the plan wrote", () => {
        const engine = new EncounterEngine(live());
        engine.giveIntervention("iv_access", 2 * MIN);
        const bolus = engine.giveIntervention("fluid_bolus_20ml_kg", 4 * MIN);
        assert.equal(bolus.consequence, "The bolus is running. His pulse is coming down.");
        assert.equal(bolus.safetyPenalty, false);
        assert.equal(engine.state.state, "stabilised");
        assert.deepEqual([engine.state.rate, engine.state.systolic, engine.state.diastolic], [134, 94, 59], "the bolus's own effect");

        assert.deepEqual(engine.advanceTo(7 * MIN + 59).filter((e) => e.type === "STATE_TRANSITION"), [], "no step at 6 minutes");
        const recovery = engine.advanceTo(8 * MIN);
        assert.equal((recovery.find((e) => e.type === "PATIENT_DETERIORATED") as any).narrative, "He is waking up and asking for his mother. Pulse 126, BP 94/58.");
        const s = engine.state;
        assert.deepEqual([s.state, s.rate, s.systolic, s.diastolic, s.spo2, s.rr, s.consciousness, s.stability], ["recovering", 126, 94, 58, 99, 30, "alert", "stable"]);

        assert.deepEqual(engine.advanceTo(19 * MIN), [], "and nothing more happens");
    });

    it("needs every stabilising treatment: one of two is not enough", () => {
        const engine = new EncounterEngine(live());
        engine.giveIntervention("iv_access", 2 * MIN);
        engine.advanceTo(7 * MIN);
        assert.equal(engine.state.state, "compensated_shock");
    });

    it("still works late: the patient stops where they have got to, then recovers", () => {
        const engine = new EncounterEngine(live());
        engine.giveIntervention("iv_access", 7 * MIN);
        engine.giveIntervention("fluid_bolus_20ml_kg", 8 * MIN);
        assert.equal(engine.state.state, "stabilised");
        engine.advanceTo(19 * MIN);
        assert.equal(engine.state.state, "recovering");
        assert.equal(engine.state.firedRules.has("live_stage_decompensated"), false);
    });

    it("keeps what a supportive treatment improved when the next step arrives", () => {
        const engine = new EncounterEngine(live());
        engine.giveIntervention("oxygen_supplemental", 1 * MIN);
        assert.equal(engine.state.spo2, 99);
        engine.advanceTo(13 * MIN);
        assert.equal(engine.state.spo2, 94, "untreated it would be 92; the oxygen's +2 carries through");
    });
});

describe("live plan: a harmful treatment", () => {
    it("does what the plan wrote, and is recorded as unsafe", () => {
        const engine = new EncounterEngine(live());
        const r = engine.giveIntervention("furosemide_iv", 3 * MIN);
        assert.equal(r.safetyPenalty, true);
        assert.equal(r.consequence, "Furosemide given. His pressure falls further.");
        assert.deepEqual([engine.state.rate, engine.state.systolic, engine.state.diastolic], [156, 76, 48]);
        assert.equal(engine.state.safetyEvents.length, 1);
    });

    it("acts once: giving anything a second time changes nothing", () => {
        const engine = new EncounterEngine(live());
        engine.giveIntervention("furosemide_iv", 3 * MIN);
        const again = engine.giveIntervention("furosemide_iv", 4 * MIN);
        assert.equal(again.consequence, "Already given. No further change.");
        assert.equal(again.safetyPenalty, false);
        assert.equal(engine.state.systolic, 76);
    });
});

// ── Scoring ─────────────────────────────────────────────────────────────────

describe("live plan: the bedside score", () => {
    const score = (play: (e: EncounterEngine) => void) => {
        const c = live();
        const engine = new EncounterEngine(c);
        play(engine);
        engine.advanceTo(19 * MIN);
        return scoreBedside(c, plan(), engine.events);
    };

    it("is full when every essential treatment went in on time", () => {
        const s = score((e) => {
            e.giveIntervention("iv_access", 2 * MIN);
            e.giveIntervention("fluid_bolus_20ml_kg", 4 * MIN);
        });
        assert.equal(s.score, 100);
        assert.deepEqual(s.items.map((i) => [i.id, i.status, i.at_minutes]), [["iv_access", "on_time", 2], ["fluid_bolus_20ml_kg", "on_time", 4]]);
        assert.deepEqual(s.outcome, { stabilised: true, recovered: true, worst_stage: null });
    });

    it("gives half for a treatment that came late, and says how far the patient got", () => {
        const s = score((e) => {
            e.giveIntervention("iv_access", 2 * MIN);
            e.giveIntervention("fluid_bolus_20ml_kg", 10 * MIN);
        });
        assert.equal(s.score, 75);
        assert.deepEqual(s.items.map((i) => i.status), ["on_time", "late"]);
        assert.deepEqual(s.outcome, { stabilised: true, recovered: true, worst_stage: "Compensated shock" });
    });

    it("is zero when nothing essential was done", () => {
        const s = score(() => {});
        assert.equal(s.score, 0);
        assert.deepEqual(s.items.map((i) => i.status), ["missed", "missed"]);
        assert.deepEqual(s.outcome, { stabilised: false, recovered: false, worst_stage: "Decompensated shock" });
    });

    it("takes points off for each harmful treatment, once, and says why", () => {
        const s = score((e) => {
            e.giveIntervention("iv_access", 2 * MIN);
            e.giveIntervention("fluid_bolus_20ml_kg", 4 * MIN);
            e.giveIntervention("furosemide_iv", 5 * MIN);
            e.giveIntervention("furosemide_iv", 6 * MIN);
        });
        assert.equal(s.score, 85);
        assert.deepEqual(s.harmful, [{ id: "furosemide_iv", label: "Furosemide IV", at_minutes: 5, why: "A diuretic in a volume-depleted child deepens the shock." }]);
    });

    it("is scored the same on the server when every treatment is the case's own, with nothing from the shared tray", () => {
        // A plan of only its own treatments compiles to an empty shared tray; the server must still see them given.
        const own = plan({
            treatments: [
                { id: "two_cannulae", label: "Two IV cannulae", detail: "Two wide-bore cannulae; bloods sent", group: "circulation", role: "essential", within_minutes: 5, says: "Two cannulae in; bloods sent.", why: "No fluids can be given without access." },
                { id: "fluid_bolus_20ml_kg", label: "IV fluid bolus", detail: "20 mL/kg Ringer's lactate over 15 minutes", group: "circulation", role: "essential", within_minutes: 8, effect: { hr: -14, sbp: 8, dbp: 5 }, says: "The bolus is running. His pulse is coming down." },
                { id: "furosemide_20mg", label: "Furosemide", detail: "20 mg IV", group: "medications", role: "harmful", effect: { sbp: -10, dbp: -6 }, says: "Furosemide given. His pressure falls further.", why: "A diuretic deepens the shock." },
            ],
            stabilised_by: ["two_cannulae", "fluid_bolus_20ml_kg"],
        });
        const c = compileLivePlan(base(), own);
        assert.deepEqual(c.available_interventions, []);
        assert.deepEqual(interventionsForCase(c).map((i) => i.id), ["two_cannulae", "fluid_bolus_20ml_kg", "furosemide_20mg"]);

        const fromBrowser: ClinicalEvent[] = [
            { type: "INTERVENTION_GIVEN", timestamp: 2 * MIN, action: "two_cannulae", consequence: "x" },
            { type: "INTERVENTION_GIVEN", timestamp: 4 * MIN, action: "fluid_bolus_20ml_kg", consequence: "x" },
        ];
        const replayed = replayStudentEvents(c, fromBrowser);
        replayed.advanceTo(19 * MIN);
        const s = scoreBedside(c, own, replayed.events);
        assert.equal(s.score, 100);
        assert.deepEqual(s.outcome, { stabilised: true, recovered: true, worst_stage: null });
    });

    it("counts for 40% of a live case's final score", () => {
        assert.equal(blendLiveScore(80, 100), 88);
        assert.equal(blendLiveScore(80, 0), 48);
        assert.equal(blendLiveScore(50, 75), 60);
    });
});
