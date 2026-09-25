import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { canUpgrade, upgradeLegacyCase } from "../legacy-adapter";
import { validateSimulationCase } from "../validate-config";
import { hardLimitSeconds, isSimulationCase, type SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { getTestDef, listOrderableTests, orderableCategories } from "../test-catalog";
import { demographicsOf, resolveInvestigation, turnaroundMinutes } from "../case-resolvers";
import { assessVitals, vitalLimitsForAge } from "../vitals-assess";
import { INTERVENTION_IDS, interventionsForCase } from "../intervention-catalog";
import { CATALOG_TEST_IDS, type TestCategory } from "../../clinical-catalog";
import { replayStudentEvents } from "../replay";
import { classicInputsFromEvents } from "../classic-inputs";
import { PatientState } from "../patient-state";
import type { ClinicalEvent } from "../encounter-events";
import { makeStemiConfig } from "./fixtures";

// ── Fixtures: classic cases in the shapes the real ones use ─────────────────

/** An adult with an abnormal ECG, examination sections and a mix of result shapes (complete heart block). */
function adultCase(): Record<string, any> {
    return {
        id: "fixture-adult",
        title: "Recurrent syncope",
        displayTitle: "72-year-old man with recurrent fainting",
        patient: {
            name: "Mr. Rajiv Mehta",
            age: 72,
            gender: "Male",
            chiefComplaint: "Recurrent fainting for 1 month.",
            vitalSigns: {
                heartRate: { unit: "bpm", value: 36, note: "Markedly bradycardic, regular" },
                temperature: { unit: "°C", value: 36.7 },
                bloodPressure: { unit: "mmHg", systolic: 104, diastolic: 62 },
                respiratoryRate: { unit: "breaths/min", value: 18 },
                oxygenSaturation: { unit: "%", value: 97 },
            },
        },
        patient_facts: {
            identity: { name: "Mr. Rajiv Mehta" },
            cardiovascular_examination: {
                murmurs: "None",
                heart_sounds: "S1 and S2 present; variable intensity of S1 noted",
                cannon_a_waves: "Intermittently present in JVP",
            },
            general_physical_examination: {
                jvp: "Not elevated",
                pulse: "36 bpm, regular, low volume",
                pallor: "Mild pallor present",
                cyanosis: "Absent",
            },
        },
        tests: [
            {
                id: "ecg",
                name: "12-lead ECG",
                category: "Cardiology",
                result: {
                    values: [
                        { parameter: "Atrial Rate", value: "82", unit: "bpm", referenceRange: "60-100" },
                        { parameter: "Ventricular Rate", value: "36", unit: "bpm", referenceRange: "60-100" },
                        { parameter: "AV Dissociation", value: "Present", unit: "", referenceRange: "Absent" },
                    ],
                    summary: "Complete AV dissociation with a slow regular ventricular escape rhythm at 35-36 bpm.",
                    ecg_parameters: {
                        axis: "Left axis deviation",
                        rhythm: "Complete AV block (Third-degree AV block)",
                        finding: "P waves and QRS complexes are completely dissociated.",
                        atrialRate: 82,
                        qrsDuration: 160,
                        ventricularRate: 36,
                    },
                    interpretation: "Complete (third-degree) AV block. The slow escape rhythm explains the syncope.",
                    criticalFindings: true,
                },
            },
            {
                id: "continuous-ecg-monitoring",
                name: "Continuous ECG Monitoring",
                category: "Cardiology",
                result: {
                    values: [{ parameter: "Rhythm", value: "Persistent bradycardia", unit: "", referenceRange: "Sinus" }],
                    summary: "Persistent bradycardia with pauses.",
                    interpretation: "Persistent bradycardia with pauses.",
                    criticalFindings: false,
                },
            },
            {
                id: "serum-electrolytes",
                name: "Serum Electrolytes",
                category: "Laboratory",
                result: {
                    values: [
                        { parameter: "Potassium", value: "4.1", unit: "mEq/L", referenceRange: "3.5-5.0" },
                        { parameter: "Sodium", value: "131", unit: "mEq/L", referenceRange: "135-145" },
                    ],
                    summary: "Mild hyponatraemia.",
                    interpretation: "Electrolytes do not explain the bradycardia.",
                    criticalFindings: false,
                },
            },
            {
                id: "echocardiography",
                name: "Echocardiography",
                category: "Imaging",
                result: {
                    values: [],
                    summary: "Normal LV size and function. No structural cause of block.",
                    interpretation: "No structural heart disease: the conduction disease is primary.",
                    criticalFindings: false,
                },
            },
        ],
        evaluation_config: {
            testing: { core_tests: ["ecg"], optional_tests: [], dangerous_tests: [], distractor_tests: [], testing_required: true },
            diagnosis: { accepted_primary: ["Complete heart block"], must_include_keywords: ["block"] },
            red_flags: [],
            management: { core_steps: ["Continuous cardiac monitoring"], dangerous_steps: [] },
        },
    };
}

/** A toddler: no examination data, summary-only results, and a heart rate that is normal for two. */
function toddlerCase(): Record<string, any> {
    return {
        id: "fixture-toddler",
        title: "Vomiting and diarrhoea",
        patient: {
            name: "Rohan Kumar",
            age: 2,
            gender: "Male",
            chiefComplaint: "Vomiting (3 days), watery diarrhoea (2 days)",
            vitalSigns: {
                bloodPressure: { unit: "mmHg", systolic: 90, diastolic: 60 },
                heartRate: { unit: "bpm", value: 130 },
                respiratoryRate: { unit: "breaths/min", value: 30 },
                temperature: { unit: "°C", value: 38.5 },
                oxygenSaturation: { unit: "%", value: 98 },
            },
        },
        patient_facts: { identity: { name: "Rohan Kumar" }, hydration: { severe_dehydration: false }, general: { weakness: true } },
        tests: [
            {
                id: "stool-elisa-rotavirus",
                name: "Stool ELISA for Rotavirus",
                category: "laboratory",
                result: { values: [], summary: "Positive for Rotavirus Antigen", interpretation: "Positive for Rotavirus Antigen", criticalFindings: false },
            },
            {
                id: "cbc",
                name: "Complete Blood Count (CBC)",
                category: "laboratory",
                result: {
                    values: [
                        { name: "Hemoglobin", unit: "g/dL", value: "11.2", status: "normal", normalRange: "11–14" },
                        { name: "WBC", unit: "×10³/µL", value: "13.5", status: "mildly_elevated", normalRange: "6–11" },
                    ],
                    summary: "hemoglobin: 11.2 g/dL, wbc: 13.5",
                    interpretation: "hemoglobin: 11.2 g/dL, wbc: 13.5",
                    criticalFindings: false,
                },
            },
            {
                id: "usg-abdomen",
                name: "Ultrasound Abdomen",
                category: "imaging",
                result: { values: [], summary: "No intussusception. Bowel loops are fluid-filled.", interpretation: "No intussusception. Bowel loops are fluid-filled.", criticalFindings: false },
            },
        ],
        evaluation_config: { testing: { core_tests: [], optional_tests: [], dangerous_tests: [], distractor_tests: [], testing_required: false } },
    };
}

/** Vitals partly unmeasured, and tests that carry no result data at all. */
function sparseCase(): Record<string, any> {
    return {
        id: "fixture-sparse",
        title: "Neck swelling",
        patient: {
            name: "Rubi",
            age: 54,
            gender: "Female",
            chiefComplaint: "Neck swelling",
            vitalSigns: {
                bloodPressure: { systolic: 110, diastolic: 60 },
                heartRate: { value: 86 },
                temperature: { note: "Afebrile to touch", unit: "°C", value: null },
            },
        },
        patient_facts: { local_examination: { palpation: { swelling: "Single 7 x 8 cm swelling on the right", carotid: "Palpable" }, inspection: "Moves with swallowing" } },
        tests: [
            { id: "bp", name: "Blood Pressure Monitoring", category: "vitals" },
            { id: "mri-brain", name: "MRI Brain", category: "imaging" },
        ],
    };
}

const validate = (c: unknown) => validateSimulationCase(c, { knownActions: INTERVENTION_IDS, knownTestIds: CATALOG_TEST_IDS });
const upgraded = (c: Record<string, any>) => upgradeLegacyCase(c) as unknown as SimulationCaseConfig & Record<string, any>;

// ── What gets upgraded ──────────────────────────────────────────────────────

describe("legacy adapter: what it leaves alone", () => {
    it("returns a case that is already a simulation case untouched", () => {
        const sim = makeStemiConfig();
        assert.equal(upgradeLegacyCase(sim as any), sim);
    });

    it("honours the per-case opt-out", () => {
        const c = { ...adultCase(), experience: "classic" };
        assert.equal(canUpgrade(c), false);
        assert.equal(upgradeLegacyCase(c), c);
    });

    it("leaves a case with no heart rate alone: a monitor has nothing to show", () => {
        const c = adultCase();
        delete c.patient.vitalSigns.heartRate;
        assert.equal(upgradeLegacyCase(c), c);
    });

    it("leaves a case with no tests alone: the order menu would be empty", () => {
        const c = adultCase();
        c.tests = [];
        assert.equal(upgradeLegacyCase(c), c);
    });

    it("tolerates junk without throwing", () => {
        for (const junk of [null, undefined, "x", 7, [], {}]) {
            assert.doesNotThrow(() => upgradeLegacyCase(junk as any));
        }
    });

    it("is idempotent", () => {
        const once = upgraded(adultCase());
        assert.equal(isSimulationCase(once), true);
        assert.equal(upgradeLegacyCase(once as any), once, "an upgraded case is a simulation case, so it is left alone");
    });

    it("keeps everything the classic flow reads", () => {
        const before = adultCase();
        const after = upgraded(before);
        for (const key of ["id", "title", "displayTitle", "patient", "patient_facts", "tests", "evaluation_config"]) {
            assert.deepEqual(after[key], before[key], `${key} must survive unchanged`);
        }
    });

    it("does not mutate its input", () => {
        const before = adultCase();
        const snapshot = JSON.stringify(before);
        upgraded(before);
        assert.equal(JSON.stringify(before), snapshot);
    });
});

describe("legacy adapter: the output is a valid simulation case", () => {
    for (const [name, make] of [["adult", adultCase], ["toddler", toddlerCase], ["sparse", sparseCase]] as const) {
        it(`${name}: no validation errors or warnings`, () => {
            const result = validate(upgraded(make()));
            assert.deepEqual(result.errors, []);
            assert.deepEqual(result.warnings, []);
        });
    }
});

// ── The monitor ─────────────────────────────────────────────────────────────

describe("legacy adapter: the monitor", () => {
    it("takes vitals from the case", () => {
        const s = upgraded(adultCase()).initial_state;
        assert.equal(s.rate, 36);
        assert.equal(s.systolic, 104);
        assert.equal(s.diastolic, 62);
        assert.equal(s.spo2, 97);
        assert.equal(s.rr, 18);
        assert.equal(s.temperature, 36.7);
        assert.equal(s.unmeasured, undefined);
    });

    it("reads the rhythm from the case's own ECG", () => {
        assert.equal(upgraded(adultCase()).initial_state.rhythm, "complete_heart_block");
    });

    it("calls 130/min normal sinus rhythm in a two-year-old, not tachycardia", () => {
        assert.equal(upgraded(toddlerCase()).initial_state.rhythm, "sinus_normal");
    });

    it("marks the extreme bradycardia unstable, and a well child stable", () => {
        assert.equal(upgraded(adultCase()).initial_state.stability, "unstable");
        assert.equal(upgraded(toddlerCase()).initial_state.stability, "stable");
    });

    it("shows a vital the case never measured as unmeasured, never as an invented number", () => {
        const s = upgraded(sparseCase()).initial_state;
        assert.deepEqual([...(s.unmeasured ?? [])].sort(), ["rr", "spo2", "temperature"]);
        assert.equal(s.temperature, undefined);
        const patient = PatientState.initial(upgraded(sparseCase())).snapshot();
        const rows = assessVitals(patient, upgraded(sparseCase()));
        const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
        assert.equal(byKey.temperature.display, "—");
        assert.equal(byKey.spo2.display, "—");
        assert.equal(byKey.temperature.badge, null);
        assert.notEqual(byKey.hr.display, "—");
    });

    it("converts a Fahrenheit reading rather than showing a 98 °C fever", () => {
        const c = adultCase();
        c.patient.vitalSigns.temperature = { unit: "°F", value: 98.6 };
        assert.equal(upgraded(c).initial_state.temperature, 37);
    });

    it("sets alarm limits for the patient's age", () => {
        const adult = upgraded(adultCase()).state_thresholds!;
        const limit = (list: typeof adult, trigger: string) => list.find((t) => t.trigger === trigger)!;
        assert.equal(limit(adult, "severe_bradycardia").lt, 42);
        assert.equal(limit(adult, "hypotension").lt, 90);
        const toddler = upgraded(toddlerCase()).state_thresholds!;
        assert.equal(limit(toddler, "severe_bradycardia").lt, 69);
        assert.equal(limit(toddler, "hypotension").lt, 74, "70 + 2 × age");
    });

    it("alarms on the extreme bradycardia but not on a normal child", () => {
        assert.deepEqual(PatientState.initial(upgraded(adultCase())).alarms, ["severe_bradycardia"]);
        assert.deepEqual(PatientState.initial(upgraded(toddlerCase())).alarms, []);
    });
});

describe("age-aware vitals", () => {
    const rowsFor = (age: number, over: Partial<{ rate: number; systolic: number; rr: number }>) =>
        assessVitals(
            { rate: 80, systolic: 100, diastolic: 60, map: 73, spo2: 98, rr: 16, temperature: 36.8, rhythm: "sinus_normal", ...over },
            { patient: { age } }
        );
    const badge = (rows: ReturnType<typeof rowsFor>, key: string) => rows.find((r) => r.key === key)!.badge;

    it("leaves an adult exactly as before", () => {
        assert.equal(badge(rowsFor(58, { rate: 100 }), "hr"), "TACHY");
        assert.equal(badge(rowsFor(58, { rate: 60 }), "hr"), "BRADY");
        assert.equal(badge(rowsFor(58, { rr: 21 }), "rr"), "HIGH RR");
        assert.equal(badge(rowsFor(58, { systolic: 90 }), "bp"), "HYPO");
    });

    it("does not badge 130/min in a toddler but does in an adult", () => {
        assert.equal(badge(rowsFor(2, { rate: 130, rr: 30 }), "hr"), null);
        assert.equal(badge(rowsFor(2, { rate: 130, rr: 30 }), "rr"), null);
        assert.equal(badge(rowsFor(40, { rate: 130 }), "hr"), "TACHY");
    });

    it("badges a toddler who really is tachycardic or hypotensive", () => {
        assert.equal(badge(rowsFor(2, { rate: 170, rr: 30 }), "hr"), "TACHY");
        assert.equal(badge(rowsFor(2, { rate: 130, rr: 30, systolic: 60 }), "bp"), "HYPO");
    });

    it("moves the limits down the age bands", () => {
        assert.equal(vitalLimitsForAge(0.05).band, "neonate");
        assert.equal(vitalLimitsForAge(0.5).band, "infant");
        assert.equal(vitalLimitsForAge(2).band, "toddler");
        assert.equal(vitalLimitsForAge(4).band, "preschool");
        assert.equal(vitalLimitsForAge(9).band, "school_age");
        assert.equal(vitalLimitsForAge(12).band, "adult");
        assert.equal(vitalLimitsForAge(undefined).band, "adult");
    });

    it("explains a vital without assuming chest pain", () => {
        const rows = rowsFor(40, { rate: 130 });
        assert.doesNotMatch(rows.find((r) => r.key === "hr")!.explanation, /chest pain/i);
    });
});

// ── Constraints, tray, hints ────────────────────────────────────────────────

describe("legacy adapter: what the case does not define is not shown", () => {
    it("sets no window, no budget and no time limit: the encounter is untimed", () => {
        const c = upgraded(adultCase());
        assert.equal(c.clinical_constraints.critical_window_minutes, undefined);
        assert.equal(c.clinical_constraints.recommended_actions, undefined);
        assert.equal(c.clinical_constraints.untimed, true);
        assert.equal(hardLimitSeconds(c), 180 * 60);
    });

    it("keeps the default limit for an authored case that names none", () => {
        assert.equal(hardLimitSeconds({ clinical_constraints: {} }), 25 * 60);
        assert.equal(hardLimitSeconds({ clinical_constraints: { hard_time_limit_minutes: 40 } }), 40 * 60);
    });

    it("has no treatment tray, and an empty list really means none", () => {
        const c = upgraded(adultCase());
        assert.deepEqual(c.available_interventions, []);
        assert.deepEqual(interventionsForCase(c), []);
        assert.ok(interventionsForCase({}).length > 20, "a case that says nothing still gets the full tray");
    });

    it("has no authored hints, so the hint assist is off", () => {
        const c = upgraded(adultCase());
        assert.equal(c.socratic_hints, undefined);
        const engine = new EncounterEngine(c);
        const hint = engine.requestAssist("socratic_hint", 10);
        assert.equal(hint.ok, false);
        assert.equal(engine.requestAssist("diagnostic_hint", 10).ok, false);
        assert.equal(engine.requestAssist("reveal_diagnosis", 10).ok, false);
    });

    it("keeps the assists that read the case's own results", () => {
        const engine = new EncounterEngine(upgraded(adultCase()));
        assert.equal(engine.requestAssist("highlight_abnormal", 10).ok, true);
        assert.equal(engine.requestAssist("explain_abnormal", 11, "vital:hr").ok, true);
    });

    it("the patient stays as presented: nothing deteriorates however long the encounter runs", () => {
        const c = upgraded(adultCase());
        const engine = new EncounterEngine(c);
        engine.advanceTo(170 * 60);
        assert.deepEqual(engine.events, []);
        assert.equal(engine.state.rate, 36);
    });

    it("ignores an intervention sent to a case with no tray, on the server too", () => {
        const c = upgraded(adultCase());
        const forged: ClinicalEvent[] = [{ type: "INTERVENTION_GIVEN", timestamp: 30, action: "aspirin_300mg", consequence: "x" }];
        const replayed = replayStudentEvents(c, forged);
        assert.equal(replayed.events.some((e) => e.type === "INTERVENTION_GIVEN"), false);
    });
});

// ── Examination ─────────────────────────────────────────────────────────────

describe("legacy adapter: examination", () => {
    it("turns each *_examination section into a manoeuvre, general first", () => {
        const exam = upgraded(adultCase()).examination!;
        assert.deepEqual(exam.map((m) => m.id), ["general_physical_examination", "cardiovascular_examination"]);
        assert.deepEqual(exam.map((m) => m.region), ["general", "cardiovascular"]);
        assert.equal(exam[0].label, "General examination");
    });

    it("writes the findings as readable lines using the case's own words", () => {
        const general = upgraded(adultCase()).examination!.find((m) => m.region === "general")!;
        assert.match(general.findings, /^JVP: Not elevated$/m);
        assert.match(general.findings, /Pulse: 36 bpm, regular, low volume/);
        assert.match(general.findings, /Pallor: Mild pallor present/);
    });

    it("flattens nested findings", () => {
        const local = upgraded(sparseCase()).examination!.find((m) => m.id === "local_examination")!;
        assert.equal(local.label, "Local examination");
        assert.match(local.findings, /Palpation — swelling: Single 7 x 8 cm swelling on the right/);
        assert.match(local.findings, /Inspection: Moves with swallowing/);
    });

    it("offers no examination when the case has none, rather than inventing findings", () => {
        assert.equal(upgraded(toddlerCase()).examination, undefined);
    });
});

// ── Investigations ──────────────────────────────────────────────────────────

describe("legacy adapter: investigations", () => {
    it("offers the case's own tests plus the master catalog, like a real ward", () => {
        const c = upgraded(adultCase());
        assert.equal(c.order_menu, "catalog");
        const ids = listOrderableTests(c).map((t) => t.id);
        assert.deepEqual(ids.slice(0, 4), ["ecg", "continuous-ecg-monitoring", "serum-electrolytes", "echocardiography"], "the case's own tests come first");
        assert.ok(ids.includes("troponin_i"), "a catalog test the case never authored is still orderable");
        assert.ok(ids.length > 4, "the rest of the catalog is there too");
        assert.equal(getTestDef(c, "troponin_i")?.name, "Troponin I (conventional)", "unauthored catalog tests still resolve, to a catalog-normal result");
        assert.equal(getTestDef(c, "ecg")?.name, "12-lead ECG", "the case's own test still wins over any catalog test sharing its id");
    });

    it("classifies each test", () => {
        const kinds = Object.fromEntries(upgraded(adultCase()).custom_tests!.map((t) => [t.id, t.kind]));
        assert.deepEqual(kinds, { ecg: "ecg", "continuous-ecg-monitoring": "bedside", "serum-electrolytes": "lab", echocardiography: "imaging" });
    });

    it("only draws an ECG for a test that has ECG parameters", () => {
        const c = adultCase();
        delete c.tests[0].result.ecg_parameters;
        assert.equal(upgraded(c).custom_tests!.find((t) => t.id === "ecg")!.kind, "lab", "no parameters, no tracing");
    });

    it("does not mistake a microscopy lab test for imaging", () => {
        const c = toddlerCase();
        c.tests.push({ id: "stool-routine", name: "Stool Routine & Microscopy", category: "laboratory", result: { values: [], summary: "No ova or cysts.", interpretation: "No ova or cysts." } });
        c.tests.push({ id: "iem", name: "Immunoelectron Microscopy", category: "imaging", result: { values: [], summary: "Viral particles seen.", interpretation: "Viral particles seen." } });
        const kinds = Object.fromEntries(upgraded(c).custom_tests!.map((t) => [t.id, t.kind]));
        assert.equal(kinds["stool-routine"], "lab");
        assert.equal(kinds["iem"], "imaging", "the case's own category still decides");
    });

    it("sorts the vague 'laboratory' category into real ones by the test's name", () => {
        const cats = Object.fromEntries(upgraded(toddlerCase()).custom_tests!.map((t) => [t.id, t.category]));
        assert.equal(cats["cbc"], "haematology");
        assert.equal(cats["stool-elisa-rotavirus"], "microbiology");
        assert.equal(cats["usg-abdomen"], "imaging");
        // The category list now spans the whole catalog (the order menu is open, not just this case's own
        // three categories) — haematology, microbiology and imaging are in there among the rest.
        const available = orderableCategories(upgraded(toddlerCase())).map((c) => c.id);
        const expected: TestCategory[] = ["haematology", "microbiology", "imaging"];
        assert.ok(expected.every((id) => available.includes(id)));
        assert.ok(available.length > 3, "the catalog's other categories (cardiac, biochemistry, ...) are orderable too");
    });

    it("returns results after a short wait, not the emergency department's hour", () => {
        const c = upgraded(toddlerCase());
        assert.equal(turnaroundMinutes(c, "cbc"), 0.25);
        assert.equal(turnaroundMinutes(c, "usg-abdomen"), 0.4);
        assert.ok(turnaroundMinutes(upgraded(adultCase()), "ecg") < 0.5);
    });

    it("lets a case's own definition of a test win over the catalog's", () => {
        const c = upgraded(toddlerCase());
        assert.equal(c.order_menu, "catalog", "the default now, not something this test needs to force");
        assert.equal(getTestDef(c, "cbc")?.name, "Complete Blood Count (CBC)");
    });
});

describe("legacy adapter: results keep the case's wording", () => {
    const resolve = (c: SimulationCaseConfig, testId: string) =>
        resolveInvestigation(c, testId, PatientState.initial(c).snapshot(), 0, demographicsOf(c as any));

    it("shows a lab's own table, with statuses read from either spelling of the data", () => {
        const c = upgraded(toddlerCase());
        const cbc = resolve(c, "cbc")!;
        assert.deepEqual(cbc.values.map((v) => [v.parameter, v.value, v.unit, v.referenceRange, v.status]), [
            ["Hemoglobin", "11.2", "g/dL", "11–14", "normal"],
            ["WBC", "13.5", "×10³/µL", "6–11", "high"],
        ]);
        const electro = resolve(upgraded(adultCase()), "serum-electrolytes")!;
        assert.deepEqual(electro.values.map((v) => v.status), ["normal", "low"], "status derived from the reference range");
    });

    it("keeps the expert's words behind the reveal, and only when there are any", () => {
        const electro = resolve(upgraded(adultCase()), "serum-electrolytes")!;
        assert.equal(electro.interpretation, "Electrolytes do not explain the bradycardia.");
        const cbc = resolve(upgraded(toddlerCase()), "cbc")!;
        assert.equal(cbc.interpretation, undefined, "summary and interpretation were the same sentence: nothing further to reveal");
    });

    it("reads a finding that is words against a reference that is words", () => {
        const c = toddlerCase();
        c.tests.push({
            id: "renal-us",
            name: "Renal Ultrasound",
            category: "Imaging",
            result: {
                values: [
                    { parameter: "Right kidney length", value: "18.2", unit: "cm", referenceRange: "9.0-12.0" },
                    { parameter: "Cyst distribution", value: "Innumerable bilateral cysts", referenceRange: "None / <3 cysts" },
                    { parameter: "Wall motion", value: "Normal throughout", referenceRange: "Normal" },
                    { parameter: "Effusion", value: "None", referenceRange: "None" },
                    { parameter: "AV dissociation", value: "Present", referenceRange: "Absent" },
                    { parameter: "Origin", value: "Infranodal", referenceRange: "N/A" },
                    { parameter: "PR interval", value: "Variable", unit: "ms", referenceRange: "120-200" },
                    { parameter: "LV hypertrophy", value: "Mild (IVSd 12 mm)", referenceRange: "Absent" },
                    { parameter: "Nitrite", value: "Positive", status: "positive" },
                ],
                summary: "Enlarged kidneys.",
                interpretation: "Polycystic kidneys.",
            },
        });
        const cfg = upgraded(c);
        const r = resolveInvestigation(cfg, "renal-us", PatientState.initial(cfg).snapshot(), 0, demographicsOf(cfg as any))!;
        assert.deepEqual(
            r.values.map((v) => [v.parameter, v.status]),
            [
                ["Right kidney length", "high"],
                ["Cyst distribution", "abnormal"],
                ["Wall motion", "normal"],
                ["Effusion", "normal"],
                ["AV dissociation", "abnormal"],
                ["Origin", "normal"],
                ["PR interval", "normal"],
                ["LV hypertrophy", "abnormal"],
                ["Nitrite", "abnormal"],
            ]
        );
    });

    it("makes a summary-only lab result its own result", () => {
        const elisa = resolve(upgraded(toddlerCase()), "stool-elisa-rotavirus")!;
        assert.equal(elisa.values.length, 0);
        assert.equal(elisa.summary, "Positive for Rotavirus Antigen");
        assert.equal(elisa.interpretation, undefined);
    });

    it("shows an imaging study's findings and holds the impression back", () => {
        const echo = resolve(upgraded(adultCase()), "echocardiography")!;
        assert.equal(echo.report?.findings, "Normal LV size and function. No structural cause of block.");
        assert.equal(echo.report?.impression, "No structural heart disease: the conduction disease is primary.");
        assert.equal(echo.interpretation, undefined, "the impression is not shown twice");
        const usg = resolve(upgraded(toddlerCase()), "usg-abdomen")!;
        assert.equal(usg.report?.impression, "", "identical wording: no separate impression to sell");
    });

    it("draws the case's ECG and gives nothing away before the reveal", () => {
        const ecg = resolve(upgraded(adultCase()), "ecg")!;
        assert.equal(ecg.kind, "ecg");
        assert.equal(ecg.ecg?.rhythm, "complete_heart_block");
        assert.equal(ecg.ecg?.rate, 36);
        assert.equal(ecg.ecg?.qrs_ms, 160);
        assert.equal(ecg.ecg?.axis_deg, -45);
        assert.deepEqual(ecg.values, [], "the measurements are interpretive here (AV dissociation), so they wait for the reveal");
        assert.deepEqual(ecg.criticalFindings, [], "`criticalFindings: true` carries no wording");
        assert.match(ecg.interpretation ?? "", /Complete AV dissociation/);
        assert.match(ecg.interpretation ?? "", /Complete \(third-degree\) AV block/);
        assert.match(ecg.interpretation ?? "", /Atrial Rate: 82 bpm/);
    });

    it("says so plainly when the case recorded no result at all", () => {
        const c = upgraded(sparseCase());
        const mri = resolve(c, "mri-brain")!;
        assert.match(mri.report?.findings ?? "", /No findings were recorded/);
        assert.match(resolve(c, "bp")!.summary, /No findings were recorded/);
    });

    it("carries an image through", () => {
        const c = adultCase();
        c.tests[3].imageUrl = "/assets/echo.png";
        assert.equal(resolve(upgraded(c), "echocardiography")?.imageUrl, "/assets/echo.png");
    });
});

describe("legacy adapter: a bedside encounter of a classic case", () => {
    it("orders, waits, and reveals through the ordinary engine", () => {
        const c = upgraded(adultCase());
        const engine = new EncounterEngine(c);
        engine.orderTest("echocardiography", "Echocardiography", 60);
        assert.equal(engine.requestAssist("radiology_impression", 90, "echocardiography@60").ok, true);
        const assists = engine.events.filter((e) => e.type === "ASSIST_USED");
        assert.equal(assists.length, 1);
        assert.equal((assists[0] as any).cost, 3);
    });

    it("hands the classic evaluator what it has always wanted, read back out of the log", () => {
        const events: ClinicalEvent[] = [
            { type: "HISTORY_TAKEN", timestamp: 5, question: "How long has this been going on?", response: "About a month." },
            { type: "TEST_ORDERED", timestamp: 20, testId: "ecg", testName: "12-lead ECG" },
            { type: "TEST_ORDERED", timestamp: 30, testId: "ecg", testName: "12-lead ECG" },
            { type: "ASSIST_USED", timestamp: 40, assistType: "highlight_abnormal", cost: 1 },
            { type: "DIFFERENTIAL_SUBMITTED", timestamp: 90, ranked: ["Complete heart block", "Sick sinus syndrome", ""] },
            { type: "DIAGNOSIS_SUBMITTED", timestamp: 91, primary: "Complete heart block", reasoning: "Slow regular pulse\nCannon a waves" },
            { type: "MANAGEMENT_SUBMITTED", timestamp: 92, steps: ["Continuous monitoring", "Urgent cardiology review", " "] },
        ];
        const inputs = classicInputsFromEvents(events, new Date("2026-09-20T10:00:00Z"));
        assert.equal(inputs.diagnosis.primaryDiagnosis, "Complete heart block");
        assert.deepEqual(inputs.diagnosis.differentials, ["Sick sinus syndrome"]);
        assert.deepEqual(inputs.diagnosis.supportingFindings, ["Slow regular pulse", "Cannon a waves"]);
        assert.deepEqual(inputs.diagnosis.managementPlan, ["Continuous monitoring", "Urgent cardiology review"]);
        assert.equal(inputs.diagnosis.submittedAt, "2026-09-20T10:00:00.000Z");
        assert.deepEqual(inputs.orderedTests, [{ id: "ecg", name: "12-lead ECG" }], "a repeat order is one test");
        assert.deepEqual(inputs.chatHistory, [
            { role: "user", content: "How long has this been going on?" },
            { role: "assistant", content: "About a month." },
        ]);
    });

    it("copes with a student who never submitted anything", () => {
        const inputs = classicInputsFromEvents([]);
        assert.equal(inputs.diagnosis.primaryDiagnosis, undefined);
        assert.deepEqual(inputs.diagnosis.managementPlan, []);
        assert.deepEqual(inputs.orderedTests, []);
    });
});

// ── The real cases, when this machine has them ──────────────────────────────
// `data/cases/*.json` is gitignored (the real flow is JSON → migrate → Supabase),
// so these run wherever the files are present and are skipped elsewhere.

describe("legacy adapter: the real cases", () => {
    const dir = path.join(process.cwd(), "data", "cases");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

    if (files.length === 0) {
        it.skip("no local case JSON files here", () => {});
        return;
    }

    // Which cases have authored examination findings today. If someone adds some, update this on purpose.
    const HAS_EXAM = new Set([
        "autosomal-dominant-polycystic-kidney-disease",
        "complete-heart-block-syncope",
        "malaria-returning-traveller-fever",
        "non-toxic-nodular-goitre-neck-swelling",
        "vitamin-b12-deficiency-pernicious-anaemia",
    ]);

    for (const file of files) {
        const id = file.replace(/\.json$/, "");
        const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        // Only classic cases: skip anything that is already a simulation case.
        if (isSimulationCase(raw)) continue;

        describe(id, () => {
            const c = upgraded(raw);

            it("upgrades and validates with no errors", () => {
                assert.equal(isSimulationCase(c), true);
                const result = validate(c);
                assert.deepEqual(result.errors, []);
            });

            it("keeps its evaluation config and every test", () => {
                assert.deepEqual(c.evaluation_config, raw.evaluation_config);
                assert.deepEqual(c.tests, raw.tests);
                assert.equal(c.custom_tests!.length, raw.tests.length);
                for (const t of raw.tests) {
                    assert.ok(c.investigation_results![t.id], `a result for ${t.id}`);
                    assert.ok(getTestDef(c, t.id), `${t.id} is orderable`);
                }
            });

            it("starts from the vitals the case records", () => {
                assert.equal(c.initial_state.rate, raw.patient.vitalSigns.heartRate.value);
            });

            it(`${HAS_EXAM.has(id) ? "has" : "has no"} examination findings`, () => {
                assert.equal((c.examination?.length ?? 0) > 0, HAS_EXAM.has(id));
            });

            it("every result resolves without throwing", () => {
                const patient = PatientState.initial(c).snapshot();
                for (const t of raw.tests) {
                    const r = resolveInvestigation(c, t.id, patient, 0, demographicsOf(c as any));
                    assert.ok(r, `${t.id} resolves`);
                    assert.ok(r.summary || r.values.length > 0 || r.report?.findings || r.ecg, `${t.id} shows something`);
                }
            });
        });
    }
});
