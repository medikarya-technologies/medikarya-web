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
