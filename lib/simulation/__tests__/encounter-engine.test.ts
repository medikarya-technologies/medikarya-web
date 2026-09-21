import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { EncounterEngine } from "../encounter-engine";
import { PatientState } from "../patient-state";
import type { ClinicalEvent, EventOf } from "../encounter-events";
import { makeStemiConfig, minutes } from "./fixtures";

const transitions = (events: readonly ClinicalEvent[]) =>
    events.filter((e): e is EventOf<"STATE_TRANSITION"> => e.type === "STATE_TRANSITION");
const alerts = (events: readonly ClinicalEvent[]) =>
    events.filter((e): e is EventOf<"PATIENT_DETERIORATED"> => e.type === "PATIENT_DETERIORATED");

// ── Plan verification #1 & #2 ───────────────────────────────────────────────

describe("state machine (plan verification)", () => {
    it("aspirin alone leaves reperfusion un-initiated, and the 15-minute rule still fires", () => {
        const engine = new EncounterEngine(makeStemiConfig());

        const { consequence } = engine.giveIntervention("aspirin_300mg", 120);
        assert.match(consequence, /does NOT initiate reperfusion/i);

        const flags = engine.state.flags;
        assert.equal(flags.aspirin_given, true);
        assert.equal(flags.antiplatelet_therapy_started, true);
        assert.equal(flags.reperfusion_strategy_initiated, false, "aspirin must not start reperfusion");

        engine.advanceTo(minutes(15));

        const fired = transitions(engine.events);
        const critical = fired.find((t) => t.trigger === "critical_window_no_reperfusion");
        assert.ok(critical, "the 15-minute rule must fire");
        assert.equal(critical.timestamp, minutes(15), "and at exactly 15:00");
        assert.equal(critical.to, "worsening_ischemia");

        const alert = alerts(engine.events).find((a) => a.ruleId === "critical_window_no_reperfusion");
        assert.ok(alert, "the nurse alert is raised");
        assert.equal(engine.state.rhythm, "pvc_frequent");
    });

    it("activating the cath lab at minute 12 means the 15-minute rule never fires", () => {
        const engine = new EncounterEngine(makeStemiConfig());

        engine.orderTest("ecg_12_lead", "12-lead ECG", 60);
        engine.interpretResult("ecg_12_lead", "Anterior STEMI — ST elevation V1-V4", 150);
        engine.giveIntervention("aspirin_300mg", 200);
        engine.giveIntervention("activate_cath_lab", minutes(12));

        engine.advanceTo(minutes(25));

        assert.equal(engine.state.flags.reperfusion_strategy_initiated, true);
        assert.equal(transitions(engine.events).length, 0, "no deterioration transition at all");
        assert.equal(alerts(engine.events).length, 0);
        assert.equal(engine.state.state, "acute_presentation");
    });

    it("history-only, no ECG: the patient deteriorates through all three stages regardless of recognition", () => {
        // The plan's walk-through requires this; the physiology must not depend on the student noticing.
        const engine = new EncounterEngine(makeStemiConfig());
        engine.takeHistory("What brings you in?", "Crushing chest pain.", 30);
        engine.advanceTo(minutes(21));

        assert.deepEqual(
            transitions(engine.events).map((t) => [t.trigger, t.timestamp]),
            [
                ["early_ischemic_progression", minutes(8)],
                ["critical_window_no_reperfusion", minutes(15)],
                ["major_deterioration", minutes(20)],
            ]
        );
        assert.equal(engine.state.state, "cardiogenic_shock");
        assert.equal(engine.state.rhythm, "vt_sustained");
        assert.equal(engine.state.consciousness, "altered");
        assert.equal(engine.state.stability, "critical");
    });
});

// ── Determinism ─────────────────────────────────────────────────────────────

describe("determinism", () => {
    it("replaying the log from scratch reproduces the live state exactly", () => {
        const config = makeStemiConfig();
        const engine = new EncounterEngine(config);

        engine.takeHistory("Pain?", "Yes.", 20);
        engine.performExam("peripheral_perfusion", "Cool, clammy.", 90);
        engine.orderTest("ecg_12_lead", "12-lead ECG", 200);
        engine.giveIntervention("aspirin_300mg", 260);
        engine.advanceTo(minutes(16));
        engine.giveIntervention("activate_cath_lab", minutes(16) + 5);
        engine.advanceTo(minutes(24));

        const replayed = PatientState.fromEvents(config, engine.events).snapshot();
        assert.deepEqual(replayed, engine.state.snapshot());
    });

    it("tick granularity does not change what fires or when", () => {
        const coarse = new EncounterEngine(makeStemiConfig());
        coarse.advanceTo(minutes(22));

        const fine = new EncounterEngine(makeStemiConfig());
        for (let s = 1; s <= minutes(22); s++) fine.advanceTo(s);

        assert.deepEqual(fine.events, coarse.events);
    });

    it("evaluate() is a pure decision over the event log", () => {
        const config = makeStemiConfig();
        const state = PatientState.initial(config);

        const before = state.snapshot();
        const due = state.evaluate([], config.event_rules, config.state_thresholds, 9);
        assert.equal(due?.ruleId, "early_ischemic_progression");
        assert.equal(due?.at, minutes(8));
        assert.deepEqual(state.snapshot(), before, "evaluate must not mutate");

        assert.equal(state.evaluate([], config.event_rules, config.state_thresholds, 5), null);
    });
});

// ── Ordering ────────────────────────────────────────────────────────────────

describe("ordering", () => {
    it("an action at the exact instant a rule becomes true wins the tie", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.orderTest("ecg_12_lead", "ECG", 30); // keep rule 1 quiet
        engine.giveIntervention("activate_cath_lab", minutes(15));
        engine.advanceTo(minutes(25));

        assert.equal(transitions(engine.events).length, 0);
    });

    it("an action one second late loses it", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.orderTest("ecg_12_lead", "ECG", 30);
        engine.giveIntervention("activate_cath_lab", minutes(15) + 1);

        const fired = transitions(engine.events);
        assert.equal(fired.length, 1);
        assert.equal(fired[0].trigger, "critical_window_no_reperfusion");
        assert.equal(fired[0].timestamp, minutes(15), "stamped when it became true, not when the action arrived");
    });

    it("events never travel back in time", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.takeHistory("q1", "a1", 100);
        const appended = engine.takeHistory("q2", "a2", 40); // stale timestamp
        assert.equal(appended.at(-1)?.timestamp, 100);
    });
});

// ── Cascades, consequences, guards ──────────────────────────────────────────

describe("consequences", () => {
    it("rule 3 needs rule 2's state: the cascade runs in order with compounding vitals", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.advanceTo(minutes(21));
        const p = engine.state;

        // 112 +8 (rule 1) +10 (rule 2) then hr_set 178 (rule 3)
        assert.equal(p.rate, 178);
        // 94/62 −14/−8 −30/−20
        assert.equal(p.systolic, 50);
        assert.equal(p.diastolic, 34);
        // 91 −3 −5
        assert.equal(p.spo2, 83);
    });

    it("nurse-alert placeholders are filled from the post-change vitals", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.advanceTo(minutes(15));
        const alert = alerts(engine.events).find((a) => a.ruleId === "critical_window_no_reperfusion");
        // 94/62 → 80/54 ; HR 112 → 130 (with rule 1's +8)
        assert.match(alert!.narrative, /BP 80\/54/);
        assert.match(alert!.narrative, /HR 130/);
        assert.match(alert!.narrative, /frequent ventricular ectopics/);
    });

    it("an IV beta-blocker in a hypotensive patient causes immediate deterioration and a safety event", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        const result = engine.giveIntervention("metoprolol_iv", 45);

        assert.equal(result.safetyPenalty, true);
        assert.equal(engine.state.rhythm, "vt_sustained");
        assert.equal(engine.state.state, "cardiogenic_shock");
        assert.equal(engine.state.safetyEvents.length, 1);
        assert.equal(engine.state.safetyEvents[0].action, "metoprolol_iv");
        assert.equal(transitions(engine.events)[0].timestamp, 45, "fires at the moment of the action");
    });

    it("the same drug in a normotensive patient is not flagged (guards read live state)", () => {
        const base = makeStemiConfig();
        const config = makeStemiConfig({
            initial_state: { ...base.initial_state, systolic: 132, diastolic: 84 },
        });
        const engine = new EncounterEngine(config);
        const result = engine.giveIntervention("metoprolol_iv", 45);

        assert.equal(result.safetyPenalty, false);
        assert.equal(engine.state.state, "acute_presentation");
    });

    it("primary PCI is blocked until the cath lab is activated", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.orderTest("ecg_12_lead", "ECG", 20);

        const blocked = engine.giveIntervention("primary_pci_initiated", 100);
        assert.match(blocked.consequence, /has not been activated/i);
        assert.equal(engine.state.flags.pci_started, false);

        engine.giveIntervention("activate_cath_lab", 130);
        const ok = engine.giveIntervention("primary_pci_initiated", 160);
        assert.match(ok.consequence, /cath lab for primary PCI/i);
        assert.equal(engine.state.flags.pci_started, true);
    });

    it("reperfusion is achieved a set time after PCI starts, via a system action", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.orderTest("ecg_12_lead", "ECG", 20);
        engine.giveIntervention("activate_cath_lab", 100);
        engine.giveIntervention("primary_pci_initiated", 300);

        engine.advanceTo(300 + minutes(6) - 1);
        assert.equal(engine.state.flags.reperfusion_achieved, false, "not one second early");

        engine.advanceTo(300 + minutes(6));
        const reperfused = transitions(engine.events).find((t) => t.trigger === "pci_reperfusion");
        assert.equal(reperfused?.timestamp, 300 + minutes(6), "exactly 6 minutes after PCI started");
        assert.equal(engine.state.flags.reperfusion_achieved, true);
        assert.equal(engine.state.flags.ongoing_ischemia, false, "the system action cleared ischaemia");
        assert.equal(engine.state.state, "reperfused");
        assert.equal(engine.state.rate, 84);
        assert.equal(engine.state.stability, "stable");
    });
});

// ── Recognition (scorer-side flags) ─────────────────────────────────────────

describe("recognition", () => {
    it("a negated interpretation is not recognition", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.interpretResult("ecg_12_lead", "Sinus tachycardia. There is no ST elevation.", 100);
        assert.equal(engine.state.flags.stemi_recognized_by_student, false);
    });

    it("a correct interpretation sets the student-recognition flag without touching physiology", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        const before = engine.state.snapshot();
        engine.interpretResult("ecg_12_lead", "Anterior STEMI, ST elevation in V1-V4", 100);

        assert.equal(engine.state.flags.stemi_recognized_by_student, true);
        assert.equal(engine.state.rate, before.rate);
        assert.equal(engine.state.flags.ongoing_ischemia, true, "ground truth is independent of recognition");
    });

    it("a wrong-differential slot does not count: only the top-ranked entry is read", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.submitDifferential(["Pericarditis", "STEMI"], 100);
        assert.equal(engine.state.flags.stemi_recognized_by_student, false);
    });
});

// ── Alarms ──────────────────────────────────────────────────────────────────

describe("state thresholds", () => {
    it("alarms are derived from the current physiology", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        assert.deepEqual(engine.state.alarms, []);

        engine.advanceTo(minutes(21));
        assert.deepEqual(new Set(engine.state.alarms), new Set(["shock_state", "critical_hypoxia", "cardiac_arrest_risk"]));
    });
});

// ── Hard limit ──────────────────────────────────────────────────────────────

describe("encounter limit", () => {
    it("nothing fires after the hard time limit", () => {
        const engine = new EncounterEngine(
            makeStemiConfig({
                clinical_constraints: { recommended_actions: 10, critical_window_minutes: 5, hard_time_limit_minutes: 10 },
            })
        );
        engine.advanceTo(minutes(40));

        assert.deepEqual(
            transitions(engine.events).map((t) => t.trigger),
            ["early_ischemic_progression"],
            "only the 8-minute rule fits inside a 10-minute encounter"
        );
    });
});

// ── Subscriptions ───────────────────────────────────────────────────────────

describe("external store contract", () => {
    it("notifies subscribers and hands out a stable snapshot until something changes", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        let calls = 0;
        const off = engine.subscribe(() => calls++);

        const first = engine.getSnapshot();
        assert.equal(engine.getSnapshot(), first, "stable reference when idle");

        engine.takeHistory("q", "a", 10);
        assert.equal(calls, 1);
        assert.notEqual(engine.getSnapshot(), first);
        assert.equal(engine.getSnapshot().events.length, 1);

        off();
        engine.takeHistory("q2", "a2", 20);
        assert.equal(calls, 1, "unsubscribed");
    });

    it("advanceTo with nothing due does not notify", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        let calls = 0;
        engine.subscribe(() => calls++);
        engine.advanceTo(30);
        assert.equal(calls, 0);
    });

    it("restores from a saved log without re-firing anything", () => {
        const first = new EncounterEngine(makeStemiConfig());
        first.advanceTo(minutes(16));
        const saved = [...first.events];

        const restored = new EncounterEngine(makeStemiConfig(), saved);
        assert.deepEqual(restored.events, saved);
        assert.deepEqual(restored.state.snapshot(), first.state.snapshot());

        restored.advanceTo(minutes(16));
        assert.deepEqual(restored.events, saved, "already-fired rules stay fired");
    });
});
