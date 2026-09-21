// Scripted "students" that play the real acute-anterior-stemi case through the
// engine, so tests can assert what the case + scorer do with recognisable
// behaviours (an excellent run, an aspirin-only run, a beta-blocker mistake…).

import { EncounterEngine } from "../encounter-engine";
import type { SimulationCaseConfig } from "../case-schema";
import { getBundledSimulationCase } from "../../../data/cases/simulation";

export const stemiCase = (): SimulationCaseConfig =>
    JSON.parse(JSON.stringify(getBundledSimulationCase("acute-anterior-stemi"))) as SimulationCaseConfig;

export const newEngine = (): EncounterEngine => new EncounterEngine(stemiCase());

export const ECG_READ =
    "Sinus tachycardia. Acute anterior STEMI: ST elevation V1-V4 with hyperacute T waves and Q waves, " +
    "ST elevation in I and aVL, reciprocal ST depression in II, III and aVF. Proximal LAD occlusion.";

export const DIAGNOSIS = "Acute anterior ST-elevation myocardial infarction (proximal LAD occlusion)";

export const REASONING =
    "Crushing central chest pain radiating to the arm and jaw with sweating in a smoker with diabetes and " +
    "hypertension. ECG shows ST elevation V1-V4 with reciprocal inferior changes — an anterior STEMI.";

/** Six focused history questions (pain, onset, associated, risk factors, safety screen, mimics). */
export function takeFocusedHistory(engine: EncounterEngine, start = 15): number {
    const questions = [
        "Where exactly is the pain and does it radiate to your arm or jaw?",
        "When did the pain start and how long has it lasted?",
        "Any sweating, nausea or breathlessness with it?",
        "Do you smoke, and do you have diabetes, high blood pressure or high cholesterol? Any family history?",
        "Any allergies, bleeding problems, stroke or recent surgery? Are you on blood thinners?",
        "Is the pain tearing or going through to your back? Any leg swelling or recent travel?",
    ];
    let t = start;
    for (const q of questions) {
        engine.takeHistory(q, "…", t);
        t += 15;
    }
    return t;
}

/** What the assisted variant of the excellent run spends: 1 + 3 + 3 + 2. */
export const EXCELLENT_ASSIST_COST = 9;

/**
 * A textbook run: ECG early, recognise, protect, activate the cath lab, PCI,
 * reperfused, full assessment. With `assists`, the SAME clinical actions are
 * played at the SAME times, with four paid-for assists interleaved.
 */
export function playExcellent(engine: EncounterEngine, opts: { assists?: boolean } = {}): void {
    const assists = opts.assists === true;

    if (assists) engine.requestAssist("highlight_abnormal", 12, "vitals"); // −1
    takeFocusedHistory(engine); // to t=105
    engine.orderTest("ecg_12_lead", "12-lead ECG", 110);
    if (assists) {
        engine.revealResult({ testId: "ecg_12_lead", orderTimestamp: 110, revealType: "hint", assistType: "ecg_interpretation_hint", timestamp: 125 }); // −3
    }
    engine.interpretResult("ecg_12_lead", ECG_READ, 140, 110);
    engine.performExam("peripheral_perfusion", "Cool, clammy.", 160);
    engine.performExam("blood_pressure_both_arms", "No inter-arm difference.", 175);
    engine.giveIntervention("continuous_monitoring", 190);
    engine.giveIntervention("iv_access", 200);
    if (assists) engine.requestAssist("socratic_hint", 205, "hint:general"); // −3
    engine.giveIntervention("aspirin_300mg", 210);
    engine.giveIntervention("p2y12_loading", 220);
    engine.giveIntervention("heparin_ufh_bolus", 230);
    engine.giveIntervention("activate_cath_lab", 250);
    engine.giveIntervention("primary_pci_initiated", 270);
    engine.orderTest("hs_troponin_i", "High-sensitivity troponin I", 290);
    engine.orderTest("cbc", "CBC", 295);
    engine.orderTest("bmp", "BMP", 300);
    if (assists) engine.requestAssist("explain_abnormal", 305, "cbc@295"); // −2
    engine.orderTest("cxr_portable", "Portable chest X-ray", 310);
    engine.advanceTo(11 * 60); // PCI started at 270 → reperfusion at 630
    finishExcellent(engine, 700);
}

export function finishExcellent(engine: EncounterEngine, t: number): void {
    engine.submitDifferential(["Acute anterior STEMI", "Acute pericarditis", "Aortic dissection"], t);
    engine.submitDiagnosis(DIAGNOSIS, REASONING, t + 10);
    engine.submitManagement(
        [
            "Aspirin 300 mg and ticagrelor loading",
            "Heparin",
            "Primary PCI via cath lab activation",
            "Admit to CCU, DAPT, statin, ACE inhibitor, echo for LV function",
            "Continuous monitoring, IV access, cautious morphine",
        ],
        t + 20
    );
}

/** Gives aspirin (correct) and stops there — the plan's central reasoning error. */
export function playAspirinOnly(engine: EncounterEngine): void {
    engine.takeHistory("What's the pain like?", "Crushing.", 20);
    engine.orderTest("ecg_12_lead", "12-lead ECG", 60);
    engine.interpretResult("ecg_12_lead", ECG_READ, 100, 60);
    engine.giveIntervention("aspirin_300mg", 130);
    engine.advanceTo(24 * 60);
    engine.submitDifferential(["Acute anterior STEMI", "Pericarditis", "Aortic dissection"], 24 * 60 + 5);
    engine.submitDiagnosis(DIAGNOSIS, REASONING, 24 * 60 + 10);
    engine.submitManagement(["Aspirin", "Monitor"], 24 * 60 + 20);
}

/** No ECG, one question, wrong diagnosis — the patient deteriorates all the way. */
export function playNoAction(engine: EncounterEngine): void {
    engine.takeHistory("What's wrong?", "Chest pain.", 30);
    engine.advanceTo(24 * 60);
    engine.submitDifferential(["Unstable angina", "Anxiety", "GORD"], 24 * 60 + 5);
    engine.submitDiagnosis("Unstable angina", "Chest pain.", 24 * 60 + 10);
    engine.submitManagement(["Observe"], 24 * 60 + 20);
}
