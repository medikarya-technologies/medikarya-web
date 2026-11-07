import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { broadKeyword, diagnosisMatches, keywordsMatch, normaliseDiagnosis } from "../diagnosisMatch";

// Made-up wordings (not library cases: the repo is public).
const ACCEPTED = ["Essential hypertension", "Hypertension", "Pre-eclampsia with severe features"];

describe("diagnosis matching", () => {
    it("ignores case, punctuation and extra spaces", () => {
        assert.equal(normaliseDiagnosis("  Hypertension. "), "hypertension");
        assert.equal(diagnosisMatches("Hypertension.", ACCEPTED, ["essential"]), true);
        assert.equal(diagnosisMatches("pre eclampsia with severe features", ACCEPTED, []), true);
    });

    it("treats the keywords as a second way in, not a requirement", () => {
        assert.equal(diagnosisMatches("Hypertension", ACCEPTED, ["essential"]), true);
        assert.equal(diagnosisMatches("Essential HTN with LVH", ACCEPTED, ["essential"]), true);
    });

    it("needs every keyword when the answer is not an accepted wording", () => {
        assert.equal(diagnosisMatches("Primary pneumothorax, right", [], ["primary", "pneumothorax"]), true);
        assert.equal(diagnosisMatches("Right pneumothorax", [], ["primary", "pneumothorax"]), false);
    });

    it("refuses a keyword answer that adds a word naming a different diagnosis", () => {
        const mild = ["Dengue without warning signs", "Dengue"];
        assert.equal(diagnosisMatches("Dengue fever, NS1 positive", mild, ["dengue"]), true);
        assert.equal(diagnosisMatches("Severe dengue with shock", mild, ["dengue"]), false);
        assert.equal(diagnosisMatches("DKA from an infected foot ulcer", ["Diabetic foot ulcer"], ["foot ulcer"]), false);
        assert.equal(diagnosisMatches("Infected diabetic foot ulcer", ["Infected diabetic foot ulcer"], ["foot ulcer"]), true);
    });

    it("treats British and American spellings alike", () => {
        assert.equal(keywordsMatch("Postpartum hemorrhage", ["postpartum haemorrhage"]), true);
        assert.equal(keywordsMatch("Acute pulmonary oedema", ["pulmonary", "edema"]), true);
        assert.equal(diagnosisMatches("Iron deficiency anaemia", ["Iron deficiency anemia"], []), true);
    });

    it("accepts a single obvious typo in a long word of an authored diagnosis", () => {
        assert.equal(diagnosisMatches("Essential hypertenssion", ACCEPTED, []), true);
        assert.equal(diagnosisMatches("Pre-eclampsia with severe featuers", ACCEPTED, []), true);
        assert.equal(diagnosisMatches("Anxiety", ACCEPTED, []), false);
        assert.equal(diagnosisMatches("Canker", ["Cancer"], []), false, "a short valid word must not fuzzy-match a different word");
    });

    it("forgives a slip in a short word, and two in a long one", () => {
        assert.equal(diagnosisMatches("fevir", ["Fever"], []), true);
        assert.equal(diagnosisMatches("migrane", ["Migraine"], []), true);
        assert.equal(diagnosisMatches("pnemonia", ["Pneumonia"], []), true);
        assert.equal(diagnosisMatches("apendisitis", ["Appendicitis"], []), true);
        assert.equal(diagnosisMatches("thallasemia", ["Thalassaemia"], []), true);
        assert.equal(diagnosisMatches("acute otits media", ["Acute otitis media"], []), true);
        assert.equal(diagnosisMatches("diabetis mellitus", ["Diabetes mellitus"], []), true);
        assert.equal(diagnosisMatches("gout", ["Goat"], []), false, "four-letter words must be exact");
    });

    it("allows extra words that cannot change the diagnosis", () => {
        assert.equal(diagnosisMatches("High fever", ["Fever"], []), true);
        assert.equal(diagnosisMatches("high grade fevir", ["Fever"], []), true);
        assert.equal(diagnosisMatches("Probable acute appendicitis", ["Acute appendicitis"], []), true);
        assert.equal(diagnosisMatches("Likely migraine", ["Migraine"], []), true);
        assert.equal(diagnosisMatches("Anterior wall STEMI", ["Anterior STEMI"], []), true);
    });

    it("refuses extra words that change the diagnosis", () => {
        assert.equal(diagnosisMatches("Complex febrile seizure", ["Febrile seizure"], []), false);
        assert.equal(diagnosisMatches("Chronic pancreatitis", ["Pancreatitis"], []), false);
        assert.equal(diagnosisMatches("NSTEMI", ["STEMI"], []), false);
        assert.equal(diagnosisMatches("Non-toxic goitre", ["Toxic goitre"], []), false);
        assert.equal(diagnosisMatches("Secondary hypertension", ["Hypertension"], []), false);
        assert.equal(diagnosisMatches("Febrile seizure or meningitis", ["Febrile seizure"], []), false);
        assert.equal(diagnosisMatches("Dengue with warning signs", ["Dengue without warning signs"], []), false);
    });

    it("never reads a different clinical word as a slip", () => {
        assert.equal(diagnosisMatches("Afebrile seizure", ["Febrile seizure"], []), false);
        assert.equal(diagnosisMatches("Nephritic syndrome", ["Nephrotic syndrome"], []), false);
        assert.equal(diagnosisMatches("Giant cell arthritis", ["Giant cell arteritis"], []), false);
        assert.equal(diagnosisMatches("Hypothyroidism", ["Hyperthyroidism"], []), false);
        assert.equal(diagnosisMatches("Hypokalaemia", ["Hyperkalaemia"], []), false);
        assert.equal(diagnosisMatches("Atypical pneumonia", ["Typical pneumonia"], []), false);
        assert.equal(diagnosisMatches("Keratosis", ["Keratitis"], []), false);
        assert.equal(diagnosisMatches("Empyema", ["Emphysema"], []), false);
        assert.equal(diagnosisMatches("Laryngitis", ["Pharyngitis"], []), false);
        assert.equal(diagnosisMatches("Type 1 diabetes", ["Type 2 diabetes"], []), false);
    });

    it("reads abbreviations, numerals, plurals and joined prefixes as the same words", () => {
        assert.equal(diagnosisMatches("HTN", ["Hypertension"], []), true);
        assert.equal(diagnosisMatches("T2DM", ["Type 2 diabetes mellitus"], []), true);
        assert.equal(diagnosisMatches("Type II DM", ["Type 2 diabetes mellitus"], []), true);
        assert.equal(diagnosisMatches("DM type 2", ["Type 2 diabetes mellitus"], []), true);
        assert.equal(diagnosisMatches("Category 3 dog bite", ["Category III dog bite"], []), true);
        assert.equal(diagnosisMatches("Third degree heart block", ["3rd degree heart block"], []), true);
        assert.equal(diagnosisMatches("Ureteric stones", ["Ureteric stone"], []), true);
        assert.equal(diagnosisMatches("Preeclampsia", ["Pre-eclampsia"], []), true);
        assert.equal(diagnosisMatches("Breast milk jaundice", ["Breastmilk jaundice"], []), true);
        assert.equal(diagnosisMatches("Dengue fever", ["Dengue"], []), true);
        assert.equal(diagnosisMatches("Postpartum haemorrhage", ["Post partum hemorrhage"], []), true);
        assert.equal(diagnosisMatches("Generalized anxiety disorder", ["Generalised anxiety disorder"], []), true);
    });

    it("flags a single keyword that other diseases share", () => {
        assert.equal(broadKeyword(["kidney"]), "kidney");
        assert.equal(broadKeyword(["Thyroid"]), "thyroid");
        assert.equal(broadKeyword(["acute kidney"]), null);
        assert.equal(broadKeyword(["hypothyroid"]), null);
        assert.equal(broadKeyword(["postpartum", "haemorrhage"]), null);
        assert.equal(broadKeyword([]), null);
    });

    it("refuses an empty or unrelated answer", () => {
        assert.equal(diagnosisMatches("", ACCEPTED, ["essential"]), false);
        assert.equal(diagnosisMatches("...", ACCEPTED, []), false);
        assert.equal(diagnosisMatches("Anxiety", ACCEPTED, ["essential"]), false);
    });
});
