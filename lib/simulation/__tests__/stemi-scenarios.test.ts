// The real acute-anterior-stemi case, played end to end: does the case JSON
// behave the way it was authored to?

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { ClinicalEvent, EventOf } from "../encounter-events";
import { newEngine, playExcellent, ECG_READ } from "./players";
import { EncounterEngine } from "../encounter-engine";
import { stemiCase } from "./players";
import {
    demographicsOf,
    patientAtEvent,
    listOrders,
    resolveInvestigation,
    resolveExamFindings,
    selectSocraticHint,
    shownHintIds,
    isResultReady,
    HINT_TARGET_PREFIX,
} from "../case-resolvers";
import { assessVitals } from "../vitals-assess";

const min = (m: number) => m * 60;
const fired = (events: readonly ClinicalEvent[]) =>
    events.filter((e): e is EventOf<"STATE_TRANSITION"> => e.type === "STATE_TRANSITION").map((t) => [t.trigger, t.timestamp] as const);

describe("stemi: deterioration timeline", () => {
    it("an idle patient deteriorates at 8, 15 and 20 minutes and ends in VT", () => {
        const engine = newEngine();
        engine.advanceTo(min(22));
        assert.deepEqual(fired(engine.events), [
            ["early_ischemic_progression", min(8)],
            ["critical_window_no_reperfusion", min(15)],
            ["major_deterioration", min(20)],
        ]);
        assert.equal(engine.state.rhythm, "vt_sustained");
        assert.equal(engine.state.rate, 178);
        assert.equal(engine.state.state, "cardiogenic_shock");
        assert.ok(engine.state.alarms.includes("shock_state"));
        assert.ok(engine.state.alarms.includes("critical_hypoxia"));
        assert.ok(engine.state.alarms.includes("cardiac_arrest_risk"));
    });

    it("the nurse alert reports the live vitals, not authored numbers", () => {
        const engine = newEngine();
        engine.advanceTo(min(21));
        const alerts = engine.events.filter((e): e is EventOf<"PATIENT_DETERIORATED"> => e.type === "PATIENT_DETERIORATED");
        assert.equal(alerts.length, 2, "rule 1 is silent; rules 2 and 3 alert");
        assert.match(alerts[0].narrative, /BP now 80\/54/);
        assert.match(alerts[1].narrative, new RegExp(`BP ${engine.state.systolic}/${engine.state.diastolic}`));
    });

    it("an early ECG silences the 8-minute rule but not the 15-minute one", () => {
        const engine = newEngine();
        engine.orderTest("ecg_12_lead", "ECG", 60);
        engine.advanceTo(min(16));
        assert.deepEqual(fired(engine.events).map(([id]) => id), ["critical_window_no_reperfusion"]);
    });
});

describe("stemi: reperfusion pathway", () => {
    it("cath lab at minute 12 + PCI at 14: never deteriorates, reperfused six minutes after PCI", () => {
        const engine = newEngine();
        engine.orderTest("ecg_12_lead", "ECG", 60);
        engine.giveIntervention("activate_cath_lab", min(12));
        engine.giveIntervention("primary_pci_initiated", min(14));
        engine.advanceTo(min(25));

        assert.deepEqual(fired(engine.events), [["pci_reperfusion", min(20)]]);
        assert.equal(engine.state.flags.reperfusion_achieved, true);
        assert.equal(engine.state.flags.ongoing_ischemia, false);
        assert.equal(engine.state.state, "reperfused");
        assert.equal(engine.state.rhythm, "sinus_normal");
        assert.deepEqual(engine.state.alarms, []);
    });

    it("activating the lab and then dithering is not a free pass: the lab stalls at +8 minutes", () => {
        const engine = newEngine();
        engine.orderTest("ecg_12_lead", "ECG", 60);
        engine.giveIntervention("activate_cath_lab", min(2));
        engine.advanceTo(min(12));
        assert.deepEqual(fired(engine.events), [["cath_lab_stall", min(10)]]);
        assert.equal(engine.state.state, "worsening_ischemia");
    });

    it("primary PCI without activating first still works — and activates the pathway for you", () => {
        const engine = newEngine();
        const result = engine.giveIntervention("primary_pci_initiated", 100);
        assert.equal(engine.state.flags.cath_lab_activated, true);
        assert.equal(engine.state.flags.pci_started, true);
        assert.match(result.consequence, /activating the STEMI pathway first is faster/i);
    });

    it("fibrinolysis also reperfuses, after ten minutes, but is not the preferred choice", () => {
        const engine = newEngine();
        const result = engine.giveIntervention("fibrinolysis_given", 200);
        assert.match(result.consequence, /primary PCI is preferred/i);
        engine.advanceTo(200 + min(10));
        assert.equal(engine.state.flags.reperfusion_achieved, true);
        assert.equal(fired(engine.events).at(-1)?.[0], "lysis_reperfusion");
    });
});

describe("stemi: dangerous drugs and stabilisation", () => {
    it("an IV beta-blocker crashes him into VT, and the safety issue is recorded", () => {
        const engine = newEngine();
        const result = engine.giveIntervention("metoprolol_iv", 90);
        assert.equal(result.safetyPenalty, true);
        assert.equal(engine.state.rhythm, "vt_sustained");
        assert.equal(engine.state.state, "cardiogenic_shock");
        assert.equal(engine.state.safetyEvents.length, 1);
    });

    it("GTN at BP 94 is unsafe, drops the pressure and is recorded", () => {
        const engine = newEngine();
        const before = engine.state.systolic;
        const result = engine.giveIntervention("gtn_sublingual", 60);
        assert.equal(result.safetyPenalty, true);
        assert.equal(engine.state.flags.unsafe_nitrate_given, true);
        assert.ok(engine.state.systolic < before);
    });

    it("morphine is not flagged unsafe here, just cautioned", () => {
        const engine = newEngine();
        const result = engine.giveIntervention("morphine_iv", 60);
        assert.equal(result.safetyPenalty, false);
        assert.match(result.consequence, /BP drifts down/);
    });

    it("cardioversion terminates VT, then it recurs after three minutes unless PCI has started", () => {
        const engine = newEngine();
        engine.advanceTo(min(20)); // shock + VT
        assert.equal(engine.state.rhythm, "vt_sustained");

        const shocked = engine.giveIntervention("synchronised_cardioversion", min(20) + 30);
        assert.match(shocked.consequence, /sinus rhythm restored/i);
        assert.equal(engine.state.rhythm, "sinus_tachycardia");
        assert.equal(engine.state.flags.vt_terminated, true);

        engine.advanceTo(min(20) + 30 + min(3));
        assert.equal(fired(engine.events).at(-1)?.[0], "vt_recurrence");
        assert.equal(engine.state.rhythm, "vt_sustained");
        assert.equal(engine.state.flags.vt_terminated, false);
    });

    it("cardioversion followed by PCI stabilises him for good", () => {
        const engine = newEngine();
        engine.advanceTo(min(20));
        engine.giveIntervention("synchronised_cardioversion", min(20) + 20);
        engine.giveIntervention("norepinephrine_infusion", min(20) + 30);
        engine.giveIntervention("primary_pci_initiated", min(20) + 40);
        engine.advanceTo(min(25));
        // PCI started, so VT does not recur; the encounter ends at 25 minutes before reperfusion completes.
        assert.ok(!fired(engine.events).some(([id]) => id === "vt_recurrence"));
        assert.equal(engine.state.flags.pci_started, true);
    });

    it("cardioverting a patient who is not in VT is refused with a note", () => {
        const engine = newEngine();
        const result = engine.giveIntervention("synchronised_cardioversion", 60);
        assert.match(result.consequence, /no VT to cardiovert/i);
        assert.equal(engine.state.flags.vt_terminated, false);
    });

    it("shocking a non-shockable rhythm is a safety issue", () => {
        const engine = newEngine();
        const result = engine.giveIntervention("defibrillation", 60);
        assert.equal(result.safetyPenalty, true);
    });

    it("oxygen only helps when SpO₂ is actually low", () => {
        const engine = newEngine();
        const low = engine.giveIntervention("oxygen_supplemental", 30);
        assert.match(low.consequence, /SpO₂ is improving/);
        assert.equal(engine.state.spo2, 95);

        const again = engine.giveIntervention("oxygen_supplemental", 60);
        assert.match(again.consequence, /not recommended unless SpO₂ is below 90%/);
    });
});

describe("stemi: recognition", () => {
    it("recognising the ECG sets the scorer flag and leaves the physiology alone", () => {
        const engine = newEngine();
        const before = engine.state.snapshot();
        engine.interpretResult("ecg_12_lead", ECG_READ, 100, 60);
        assert.equal(engine.state.flags.stemi_recognized_by_student, true);
        assert.equal(engine.state.rate, before.rate);
    });

    it("interpreting the troponin confirms myocardial injury (case-layer state_consequence)", () => {
        const engine = newEngine();
        engine.interpretResult("troponin_i", "Raised troponin.", 100, 60);
        assert.equal(engine.state.flags.myocardial_injury_confirmed, true);
    });

    it("NSTEMI is not recognised as STEMI", () => {
        const engine = newEngine();
        engine.submitDiagnosis("NSTEMI", "", 100);
        assert.equal(engine.state.flags.stemi_recognized_by_student, false);
    });
});

describe("stemi: results are pure functions of the log", () => {
    it("the first ECG shows the STEMI pattern at the live rate; a repeat after reperfusion shows resolution", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);
        engine.orderTest("ecg_12_lead", "12-lead ECG", 60);
        engine.giveIntervention("activate_cath_lab", 120);
        engine.giveIntervention("primary_pci_initiated", 130);
        engine.advanceTo(130 + min(6));
        engine.orderTest("ecg_12_lead", "12-lead ECG", 130 + min(6) + 30);

        const events = engine.events;
        const demo = demographicsOf(config as never);
        const [first, repeat] = listOrders(events);

        const r1 = resolveInvestigation(config, "ecg_12_lead", patientAtEvent(config, events, first.eventIndex), first.orderedAt, demo)!;
        assert.equal(r1.ecg!.rate, 112);
        assert.equal(r1.ecg!.rhythm, "sinus_tachycardia");
        assert.equal(r1.ecg!.leads.V3!.st, 0.45);
        assert.match(r1.interpretation!, /Acute anterior STEMI/);
        assert.ok(r1.criticalFindings.length > 0);

        const r2 = resolveInvestigation(config, "ecg_12_lead", patientAtEvent(config, events, repeat.eventIndex), repeat.orderedAt, demo)!;
        assert.equal(r2.ecg!.leads.V3!.st, 0.12, "ST elevation resolved by >70%");
        assert.equal(r2.ecg!.leads.V3!.t, -0.35, "reperfusion T-wave inversion");
        assert.equal(r2.ecg!.rhythm, "sinus_normal");
        assert.match(r2.interpretation!, /Reperfusion/);
        assert.equal(r2.criticalFindings.length, 0);
    });

    it("a repeat ECG taken while in VT records VT", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);
        engine.advanceTo(min(21));
        engine.orderTest("ecg_12_lead", "12-lead ECG", min(21) + 5);
        const [order] = listOrders(engine.events);
        const r = resolveInvestigation(config, "ecg_12_lead", patientAtEvent(config, engine.events, order.eventIndex), order.orderedAt, demographicsOf(config as never))!;
        assert.equal(r.ecg!.rhythm, "vt_sustained");
        assert.equal(r.ecg!.rate, 178);
    });

    it("case-authored labs override; everything else returns a normal result from the catalog", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);
        engine.orderTest("cbc", "CBC", 10);
        engine.orderTest("tsh", "TSH", 20);
        const demo = demographicsOf(config as never);
        const [cbc, tsh] = listOrders(engine.events);

        const cbcResult = resolveInvestigation(config, "cbc", patientAtEvent(config, engine.events, cbc.eventIndex), cbc.orderedAt, demo)!;
        assert.equal(cbcResult.caseSpecific, true);
        assert.equal(cbcResult.values.find((v) => v.key === "wbc")!.status, "high");
        assert.equal(cbcResult.values.find((v) => v.key === "hb")!.status, "normal");
        assert.equal(cbcResult.values.find((v) => v.key === "hb")!.referenceRange, "13.5–17.5", "male range for this patient");

        const tshResult = resolveInvestigation(config, "tsh", patientAtEvent(config, engine.events, tsh.eventIndex), tsh.orderedAt, demo)!;
        assert.equal(tshResult.caseSpecific, false);
        assert.ok(tshResult.values.every((v) => v.status === "normal"));
        assert.match(tshResult.summary, /within reference range/);
    });

    it("the single-value shorthand and critical overrides resolve correctly", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);
        engine.orderTest("troponin_i", "Troponin I", 10);
        const [order] = listOrders(engine.events);
        const r = resolveInvestigation(config, "troponin_i", patientAtEvent(config, engine.events, order.eventIndex), 10, demographicsOf(config as never))!;
        assert.equal(r.values[0].value, "4.82");
        assert.equal(r.values[0].status, "critical");
        assert.equal(r.values[0].referenceRange, "< 0.04");
        assert.equal(r.stateConsequence, "confirms_myocardial_injury");
    });

    it("turnaround gates availability: ECG in 30 s, troponin in 6 minutes, unknown tests use the catalog", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);
        engine.orderTest("ecg_12_lead", "ECG", 100);
        engine.orderTest("troponin_i", "Troponin", 100);
        engine.orderTest("blood_culture", "Blood cultures", 100);
        const [ecg, trop, cx] = listOrders(engine.events);

        assert.equal(isResultReady(config, ecg, 129), false);
        assert.equal(isResultReady(config, ecg, 130), true);
        assert.equal(isResultReady(config, trop, 100 + min(6) - 1), false);
        assert.equal(isResultReady(config, trop, 100 + min(6)), true);
        assert.equal(isResultReady(config, cx, 100 + min(120)), false, "blood cultures take a day");
    });

    it("an unknown test id resolves to null rather than throwing", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);
        assert.equal(resolveInvestigation(config, "not_a_test", engine.state.snapshot(), 0, { sex: "male" }), null);
    });

    it("the portable CXR is a report: findings visible, impression separate", () => {
        const config = stemiCase();
        const r = resolveInvestigation(config, "cxr_portable", newEngine().state.snapshot(), 0, { sex: "male" })!;
        assert.match(r.report!.findings, /Kerley B/);
        assert.match(r.report!.impression, /pulmonary venous congestion/i);
    });
});

describe("stemi: examination findings follow the patient", () => {
    it("fills vitals placeholders and swaps findings by state", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);

        assert.equal(resolveExamFindings(config, "pulse", engine.state.snapshot(), 0), "Radial pulse 112/min, regular, low volume.");
        assert.match(resolveExamFindings(config, "blood_pressure_both_arms", engine.state.snapshot(), 0)!, /Right arm 94\/62/);

        engine.advanceTo(min(21));
        assert.match(resolveExamFindings(config, "pulse", engine.state.snapshot(), min(21))!, /Thready and fast at 178\/min/);
        assert.match(resolveExamFindings(config, "peripheral_perfusion", engine.state.snapshot(), min(21))!, /mottled/);
        assert.match(resolveExamFindings(config, "neuro_screen", engine.state.snapshot(), min(21))!, /GCS 12/);
    });

    it("returns null for a manoeuvre the case doesn't define", () => {
        const config = stemiCase();
        assert.equal(resolveExamFindings(config, "fundoscopy", newEngine().state.snapshot(), 0), null);
    });

    it("examining peripheral perfusion is what sets shock_assessment_done", () => {
        const engine = newEngine();
        engine.performExam("jvp", "…", 30);
        assert.equal(engine.state.flags.shock_assessment_done, false);
        engine.performExam("peripheral_perfusion", "…", 60);
        assert.equal(engine.state.flags.shock_assessment_done, true);
    });
});

describe("stemi: socratic hints", () => {
    it("offers the first applicable hint and never the same one twice", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);

        // Before the 2-minute mark and with vitals low, the "dangerous_drugs" hint fires first.
        const first = selectSocraticHint(config, engine.state.snapshot(), 30, [])!;
        assert.equal(first.id, "dangerous_drugs");

        const second = selectSocraticHint(config, engine.state.snapshot(), 30, [first.id]);
        assert.notEqual(second?.id, first.id);
    });

    it("suggests the ECG once three minutes have passed with none recorded", () => {
        const config = stemiCase();
        const engine = new EncounterEngine(config);
        engine.performExam("peripheral_perfusion", "…", 20); // silence the perfusion hint
        const hint = selectSocraticHint(config, engine.state.snapshot(), min(4), [])!;
        assert.equal(hint.id, "no_ecg");
        assert.match(hint.hint, /fastest test/);
    });

    it("hints never state the diagnosis", () => {
        const config = stemiCase();
        for (const h of config.socratic_hints ?? []) {
            assert.doesNotMatch(h.hint, /\bSTEMI\b|anterior|LAD/, `hint "${h.id}" gives the diagnosis away`);
        }
    });

    it("reads which hints were already paid for from the assist audit trail", () => {
        const engine = newEngine();
        engine.requestAssist("socratic_hint", 60, `${HINT_TARGET_PREFIX}no_ecg`);
        engine.requestAssist("explain_abnormal", 70, "cbc@10");
        assert.deepEqual(shownHintIds(engine.events), ["no_ecg"]);
    });
});

describe("stemi: vitals assessment (the highlight assist)", () => {
    it("labels the presenting vitals per the plan's thresholds", () => {
        const engine = newEngine();
        const vitals = Object.fromEntries(assessVitals(engine.state.snapshot(), stemiCase()).map((v) => [v.key, v]));

        assert.equal(vitals.hr.badge, "TACHY");
        assert.equal(vitals.hr.severity, "warning");
        assert.equal(vitals.bp.badge, "HYPO");
        assert.equal(vitals.spo2.badge, "HYPOXIC");
        assert.equal(vitals.spo2.severity, "warning");
        assert.equal(vitals.rr.badge, "HIGH RR");
        assert.equal(vitals.temperature.badge, null);
    });

    it("escalates amber to red as the patient worsens", () => {
        const engine = newEngine();
        engine.advanceTo(min(21));
        const vitals = Object.fromEntries(assessVitals(engine.state.snapshot(), stemiCase()).map((v) => [v.key, v]));
        assert.equal(vitals.hr.severity, "critical");
        assert.equal(vitals.bp.severity, "critical");
        assert.equal(vitals.spo2.severity, "critical");
    });

    it("uses the case's own explanation when it has one", () => {
        const engine = newEngine();
        const bp = assessVitals(engine.state.snapshot(), stemiCase()).find((v) => v.key === "bp")!;
        assert.match(bp.explanation, /well below his usual/);
    });
});

describe("stemi: a full excellent run", () => {
    it("ends reperfused with no deterioration and a clean audit", () => {
        const engine = newEngine();
        playExcellent(engine);
        assert.equal(engine.state.flags.reperfusion_achieved, true);
        assert.equal(fired(engine.events).map(([id]) => id).join(","), "pci_reperfusion");
        assert.equal(engine.state.safetyEvents.length, 0);
    });
});
