import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
    deriveAppearance,
    describeLook,
    figureFor,
    levelOfFinding,
    resolveLook,
    type AppearanceSpec,
    type ResolvedLook,
} from "../appearance";
import { upgradeLegacyCase } from "../legacy-adapter";
import { validateSimulationCase } from "../validate-config";
import { PatientState, snapshotContext } from "../patient-state";
import { bundledSimulationCases } from "../../../data/cases/simulation";
import { appearanceOverlays } from "../../../data/cases/simulation/appearance";
import { isSimulationCase, type SimulationCaseConfig } from "../case-schema";
import { INTERVENTION_IDS } from "../intervention-catalog";
import { CATALOG_TEST_IDS } from "../../clinical-catalog";
import { makeStemiConfig } from "./fixtures";

const look = (over: Partial<ResolvedLook> = {}): ResolvedLook => ({
    pallor: 0, jaundice: 0, cyanosis: 0, flushed: 0, sweating: 0, sunken_eyes: 0, expression: "calm", ...over,
});

const ctxIn = (config: SimulationCaseConfig, state: string) => snapshotContext({ ...PatientState.initial(config).snapshot(), state });

describe("appearance: who is in the bed", () => {
    it("chooses a figure from the age and the recorded gender", () => {
        assert.equal(figureFor(0.08, "Male"), "infant");
        assert.equal(figureFor(2, "Male"), "toddler", "a 2-year-old is a toddler, not a small adult");
        assert.equal(figureFor(4.9, "Female"), "toddler");
        assert.equal(figureFor(5, "Female"), "child");
        assert.equal(figureFor(11, "Female"), "child");
        assert.equal(figureFor(13, "Male"), "adult_m");
        assert.equal(figureFor(24, "Female"), "adult_f");
        assert.equal(figureFor(49, "male"), "adult_m");
        assert.equal(figureFor(72, "Male"), "adult_m", "old age is a matter of degree (persona.ts), not another body");
        assert.equal(figureFor(65, "Female"), "adult_f");
        assert.equal(figureFor(undefined, undefined), "adult_m");
    });
});

describe("appearance: reading how strongly a finding is stated", () => {
    it("reads the words the real cases use", () => {
        const cases: Array<[string, number]> = [
            ["Absent", 0],
            ["Not specifically documented", 0],
            ["No pallor", 0],
            ["Lower palpebral conjunctiva evaluated (pallor documented)", 0],
            ["Mild pallor present", 1],
            ["Mild scleral icterus (lemon-yellow tint)", 1],
            ["Present; conjunctivae are pale", 2],
            ["Obvious jaundice", 2],
            ["Marked pallor", 3],
            ["Severe cyanosis", 3],
        ];
        for (const [text, level] of cases) assert.equal(levelOfFinding(text), level, text);
    });
});

describe("appearance: resolving over time", () => {
    const spec: AppearanceSpec = {
        pallor: 2,
        sweating: 3,
        expression: "pain",
        note: "Pale and sweating.",
        variants: [
            { when: { state: "reperfused" }, pallor: 1, sweating: 1, expression: "tired", note: "Calmer." },
            { when: { state: "cardiogenic_shock" }, pallor: 3, expression: "drowsy" },
        ],
    };
    const config = makeStemiConfig();

    it("shows the base look until the patient changes", () => {
        const l = resolveLook(spec, ctxIn(config, "acute_presentation"));
        assert.deepEqual([l.pallor, l.sweating, l.expression, l.note], [2, 3, "pain", "Pale and sweating."]);
    });

    it("lets the first matching variant override it, field by field", () => {
        const l = resolveLook(spec, ctxIn(config, "reperfused"));
        assert.deepEqual([l.pallor, l.sweating, l.expression, l.note], [1, 1, "tired", "Calmer."]);
        const shock = resolveLook(spec, ctxIn(config, "cardiogenic_shock"));
        assert.equal(shock.pallor, 3);
        assert.equal(shock.sweating, 3, "inherited from the base");
        assert.equal(shock.expression, "drowsy");
    });

    it("never lets an old sentence describe a patient who has changed", () => {
        const shock = resolveLook(spec, ctxIn(config, "cardiogenic_shock"));
        assert.equal(shock.note, undefined, "the variant gave no note, so it inherits none: the sentence is composed fresh");
        assert.match(describeLook(shock), /very pale/i);
    });

    it("is calm and unremarkable when the case says nothing", () => {
        assert.deepEqual(resolveLook(undefined, ctxIn(config, "x")), look());
    });
});

describe("appearance: saying what you see", () => {
    it("says it the way a doctor would", () => {
        assert.equal(describeLook(look({ pallor: 3, jaundice: 2 })), "Face is very pale and yellow.");
        assert.equal(describeLook(look({ pallor: 2 })), "Looks pale.");
        assert.equal(describeLook(look({ pallor: 2, jaundice: 1 })), "Looks pale, with a slight yellow tint to the eyes.");
        assert.equal(describeLook(look({ jaundice: 2 })), "Eyes and face look yellow.");
        assert.equal(describeLook(look({ jaundice: 1 })), "A slight yellow tint to the eyes.");
    });

    it("adds the sweat, the colour of the lips and the expression", () => {
        assert.equal(
            describeLook(look({ pallor: 3, sweating: 3, cyanosis: 1, expression: "distress" })),
            "Looks very pale. Drenched in sweat and bluish around the lips. Clearly distressed."
        );
        assert.equal(describeLook(look({ expression: "tired", sunken_eyes: 1 })), "With sunken eyes. Looks tired.");
    });

    it("describes a visible swelling", () => {
        assert.equal(describeLook(look({ swelling: "neck_right" })), "Visible swelling on the right side of the neck.");
    });

    it("prefers the case's own words", () => {
        assert.equal(describeLook(look({ pallor: 3, note: "Grey, drowsy and drenched in sweat." })), "Grey, drowsy and drenched in sweat.");
    });

    it("has nothing to say about a patient who looks well", () => {
        assert.equal(describeLook(look()), "");
    });
});

describe("appearance: reading a classic case", () => {
    const general = (fields: Record<string, string>, extra: Record<string, unknown> = {}) => ({
        patient: { name: "X", age: 50, gender: "Female", chiefComplaint: "Tiredness" },
        patient_facts: { general_physical_examination: fields, ...extra },
    });

    it("uses the case's own general condition as the observation, and adds the skin finding it leaves out", () => {
        const a = deriveAppearance(general({ general_condition: "Elderly male, alert and oriented, appears fatigued", pallor: "Mild pallor present" }))!;
        assert.equal(a.pallor, 1);
        assert.equal(a.expression, "tired");
        assert.equal(a.note, "Elderly male, alert and oriented, appears fatigued. Looks slightly pale.");
    });

    it("does not repeat a finding the case's words already state", () => {
        const a = deriveAppearance(
            general({ general_condition: "Appears pale and fatigued", pallor: "Present; conjunctivae are pale", jaundice: "Mild scleral icterus (lemon-yellow tint)" })
        )!;
        assert.equal([a.pallor, a.jaundice].join(), "2,1");
        assert.equal(a.note, "Appears pale and fatigued. A slight yellow tint to the eyes.");
    });

    it("draws nothing for findings the case says are absent", () => {
        assert.equal(deriveAppearance(general({ pallor: "Absent", jaundice: "Absent", cyanosis: "Absent" })), undefined);
    });

    it("keeps a comfortable patient calm, with the case's caveat in the note", () => {
        const a = deriveAppearance(general({ general_condition: "Alert, comfortable at rest but mildly distressed during movement due to flank pain" }))!;
        assert.equal(a.expression, "calm");
        assert.match(a.note ?? "", /distressed during movement/);
    });

    it("reads a documented neck swelling, on the side the case gives", () => {
        const a = deriveAppearance({
            patient: { age: 54 },
            patient_facts: { local_examination: { inspection: { swelling: "Single diffuse swelling on the right side of the neck (6 x 8 cm)" } } },
        })!;
        assert.equal(a.swelling, "neck_right");
    });

    it("reads yellow eyes from a structured jaundice fact or the chief complaint", () => {
        const fact = deriveAppearance({ patient: { chiefComplaint: "Feeding poorly" }, patient_facts: { jaundice: { present: true, severity: "mild" } } })!;
        assert.equal(fact.jaundice, 1);
        const complaint = deriveAppearance({ patient: { chiefComplaint: "Yellow eyes and face" }, patient_facts: { jaundice: { present: true, severity: "mild" } } })!;
        assert.equal(complaint.jaundice, 2, "the complaint says the eyes and face are yellow");
    });

    it("reads photophobia as a squint, but not the absence of it", () => {
        assert.equal(deriveAppearance({ patient: { history_of_present_illness: { headache: { associated_symptoms: ["Nausea", "Photophobia"] } } } })?.expression, "photophobic");
        assert.equal(deriveAppearance({ patient: { history_of_present_illness: { headache: { associated_symptoms: ["No photophobia"] } } } }), undefined);
    });

    it("does not mistake a pale stool for a pale patient", () => {
        const a = deriveAppearance({
            patient: { chiefComplaint: "Vomiting and diarrhoea" },
            patient_facts: { diarrhea: { appearance: "pale and offensive" }, general: { weakness: true } },
        });
        assert.equal(a, undefined, "history is not appearance");
    });

    it("says nothing where the case says nothing", () => {
        assert.equal(deriveAppearance({ patient: { age: 30 }, patient_facts: {} }), undefined);
        assert.doesNotThrow(() => deriveAppearance({}));
        assert.doesNotThrow(() => deriveAppearance(null as never));
    });
});

describe("appearance: the adapter", () => {
    const classic = (extra: Record<string, unknown> = {}) => ({
        id: "fixture",
        patient: { name: "X", age: 63, gender: "Female", chiefComplaint: "Tiredness", vitalSigns: { heartRate: { value: 96 } } },
        patient_facts: { general_physical_examination: { general_condition: "Appears pale and fatigued", pallor: "Present; conjunctivae are pale" } },
        tests: [{ id: "cbc", name: "CBC", category: "haematology", result: { values: [], summary: "Hb 8.2", interpretation: "Hb 8.2" } }],
        ...extra,
    });
    const up = (c: Record<string, unknown>, overlay?: { appearance?: AppearanceSpec }) => upgradeLegacyCase(c, overlay) as unknown as SimulationCaseConfig;

    it("derives a look for a classic case", () => {
        assert.equal(up(classic()).appearance?.pallor, 2);
    });

    it("prefers an authored overlay, and the case's own block over both", () => {
        assert.equal(up(classic(), { appearance: { pallor: 3, note: "Ashen." } }).appearance?.note, "Ashen.");
        assert.equal(up(classic({ appearance: { pallor: 1, note: "Own words." } }), { appearance: { pallor: 3 } }).appearance?.note, "Own words.");
    });

    it("leaves the case without an appearance when there is none to give", () => {
        const c = classic({ patient_facts: {} });
        assert.equal(up(c).appearance, undefined);
    });

    it("validates an appearance block, and rejects a wrong one", () => {
        const ok = validateSimulationCase(up(classic()), { knownActions: INTERVENTION_IDS, knownTestIds: CATALOG_TEST_IDS });
        assert.deepEqual(ok.errors, []);
        const bad = validateSimulationCase(
            { ...up(classic()), appearance: { pallor: 5, expression: "smug", swelling: "knee", skin_tone: "green", variants: [{ when: { flag: "nope", is: true }, pallor: 9 }] } },
            {}
        );
        const paths = bad.errors.map((e) => e.path);
        for (const expected of ["appearance.pallor", "appearance.expression", "appearance.swelling", "appearance.skin_tone", "appearance.variants[0].pallor", "appearance.variants[0].when.flag"]) {
            assert.ok(paths.includes(expected), `${expected} in ${paths.join(", ")}`);
        }
    });
});

describe("appearance: what a case may say about clothes and accessories", () => {
    const base = () => makeStemiConfig();
    const check = (appearance: Record<string, unknown>) => validateSimulationCase({ ...base(), appearance } as unknown as SimulationCaseConfig, {}).errors.map((e) => e.path);

    it("accepts a real garment and a real list of accessories", () => {
        assert.deepEqual(check({ attire: "saree", accessories: ["earrings", "bindi"], skin_tone: "brown" }), []);
        assert.deepEqual(check({ attire: "gown", accessories: [] }), [], "an empty list is 'none', and is allowed");
    });

    it("rejects a garment or accessory that is not one, pointing at the exact place", () => {
        assert.deepEqual(check({ attire: "spacesuit" }), ["appearance.attire"]);
        assert.deepEqual(check({ accessories: "glasses" }), ["appearance.accessories"]);
        assert.deepEqual(check({ accessories: ["glasses", "monocle", "bindi", "hat"] }), ["appearance.accessories[1]", "appearance.accessories[3]"]);
    });
});

describe("appearance: the STEMI patient", () => {
    const stemi = bundledSimulationCases[0] as unknown as SimulationCaseConfig;

    it("looks the way the nurse and the examination describe him, at each stage", () => {
        const at = (state: string) => resolveLook(stemi.appearance, ctxIn(stemi, state));
        assert.match(describeLook(at("acute_presentation")), /pale and sweating heavily/);
        assert.match(describeLook(at("increasing_ischemia")), /pale and sweating heavily/, "no change yet");
        assert.match(describeLook(at("worsening_ischemia")), /Greyer and more sweaty/);
        assert.equal(at("worsening_ischemia").pallor, 3);
        assert.match(describeLook(at("cardiogenic_shock")), /drowsy/i);
        assert.equal(at("cardiogenic_shock").expression, "drowsy");
        assert.match(describeLook(at("reperfused")), /colour returning/);
        assert.equal(at("reperfused").pallor, 1);
    });

    it("stays valid", () => {
        assert.deepEqual(validateSimulationCase(stemi, { knownActions: INTERVENTION_IDS, knownTestIds: CATALOG_TEST_IDS }).errors, []);
    });
});

describe("appearance: the real classic cases", () => {
    const dir = path.join(process.cwd(), "data", "cases");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
    if (files.length === 0) {
        it.skip("no local case JSON files here", () => {});
        return;
    }
    const load = (id: string) => {
        const file = path.join(dir, `${id}.json`);
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    };
    const derived = (id: string) => {
        const raw = load(id);
        return raw && !isSimulationCase(raw) ? deriveAppearance(raw) : undefined;
    };
    const run = (id: string, fn: () => void) => (load(id) ? it(id, fn) : it.skip(`${id} (not present)`, () => {}));

    run("complete-heart-block-syncope", () => {
        const a = derived("complete-heart-block-syncope")!;
        assert.equal(a.pallor, 1);
        assert.equal(a.expression, "tired");
        assert.match(a.note ?? "", /appears fatigued\. Looks slightly pale\.$/);
    });
    run("vitamin-b12-deficiency-pernicious-anaemia", () => {
        const a = derived("vitamin-b12-deficiency-pernicious-anaemia")!;
        assert.deepEqual([a.pallor, a.jaundice, a.expression], [2, 1, "tired"]);
        assert.match(a.note ?? "", /^Appears pale and fatigued\. A slight yellow tint to the eyes\.$/);
    });
    run("malaria-returning-traveller-fever", () => {
        const a = derived("malaria-returning-traveller-fever")!;
        assert.equal(a.expression, "tired");
        assert.equal(a.note, "Looks unwell.");
        assert.equal(a.pallor ?? 0, 0, "'not specifically documented' draws nothing");
    });
    run("autosomal-dominant-polycystic-kidney-disease", () => {
        const a = derived("autosomal-dominant-polycystic-kidney-disease")!;
        assert.equal(a.expression, "calm");
        assert.match(a.note ?? "", /comfortable at rest/);
    });
    run("non-toxic-nodular-goitre-neck-swelling", () => {
        const a = derived("non-toxic-nodular-goitre-neck-swelling")!;
        assert.equal(a.swelling, "neck_right");
        assert.equal(a.pallor ?? 0, 0, "the case only says the conjunctiva was examined");
    });
    run("neonatal-jaundice-breastmilk", () => {
        assert.equal(derived("neonatal-jaundice-breastmilk")!.jaundice, 2);
    });
    run("severe-migraine-with-aura", () => {
        assert.equal(derived("severe-migraine-with-aura")!.expression, "photophobic");
    });
    // The two that document nothing about appearance are drafted in the overlay, for review.
    run("iron-deficiency-anemia-in-pregnancy", () => {
        assert.equal(derived("iron-deficiency-anemia-in-pregnancy"), undefined);
        assert.equal(appearanceOverlays["iron-deficiency-anemia-in-pregnancy"].pallor, 2);
    });
    run("viral-gastroenteritis", () => {
        assert.equal(derived("viral-gastroenteritis"), undefined, "a pale stool is not a pale patient");
        assert.equal(appearanceOverlays["viral-gastroenteritis"].sunken_eyes, 1);
    });
});
