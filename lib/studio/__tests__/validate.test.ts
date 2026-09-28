import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkDraft, diagnosisWords, type CheckContext } from "../validate";

const ctx: CheckContext = {
  catalogIds: new Set(["tsh", "ft4", "usg_neck_thyroid", "fnac", "ct_neck", "troponin_i", "lumbar_puncture"]),
  identifiers: { names: ["Rubi", "17"], places: ["Mustafabad (U.P.)"] },
};

function good(): any {
  return {
    title: "Non-Toxic Nodular Goitre",
    category: "General Surgery",
    difficulty: "Intermediate",
    estimatedTime: 20,
    tags: ["goitre"],
    displayTitle: "54-year-old woman with a 15-day neck swelling",
    displayDescription: "A 54-year-old woman with a painless neck swelling, difficulty swallowing and a change in voice.",
    displayTags: ["general-surgery", "neck-swelling"],
    patient: {
      name: "Sunita Devi",
      age: 54,
      gender: "Female",
      chiefComplaint: "Neck swelling for 15 days.",
      vitalSigns: { heartRate: { value: 86, unit: "bpm" } },
      allergies: [],
      currentMedications: [],
    },
    patient_text_brief: "I have had a swelling in my neck for 15 days.",
    patient_facts: {
      identity: {},
      chief_complaint: "Neck swelling",
      timeline: {},
      general_physical_examination: "Pallor present.",
      respiratory_examination: "Clear.",
      local_examination: { inspection: "Swelling moves with deglutition." },
    },
    ai_role: { speaker: "patient", first_person_description: "54-year-old homemaker", can_speak_for_self: true, key_constraints: ["Answer only what is asked."] },
    ai_examples: [
      { doctor: "How long?", patient: "15 days." },
      { doctor: "Pain?", patient: "No." },
      { doctor: "Swallowing?", patient: "Solids stick." },
    ],
    tests: [
      { id: "tsh", name: "TSH", category: "Laboratory", result: { summary: "Normal", values: [], interpretation: "Euthyroid" } },
      { id: "usg_neck_thyroid", name: "USG neck", category: "Imaging", result: { summary: "Nodule", values: [], interpretation: "Benign" } },
    ],
    evaluation_config: {
      history: { required_questions: ["a", "b", "c", "d"], important_questions: [], red_flag_questions: ["dysphagia"] },
      testing: { testing_required: true, core_tests: ["tsh", "usg_neck_thyroid"], optional_tests: ["ft4"], distractor_tests: ["troponin_i", "ct_neck", "ft4"], dangerous_tests: ["lumbar_puncture"] },
      diagnosis: { accepted_primary: ["non-toxic nodular goitre", "multinodular goitre"], must_include_keywords: ["goitre"] },
      management: { core_steps: ["Refer for thyroidectomy"], dangerous_steps: ["Radioiodine without FNAC"] },
      red_flags: [{ intent: "dysphagia", keywords: ["swallow"], present_in_case: true, critical: true }],
    },
    discussion: { keyPoints: ["one", "two", "three"], references: [] },
    walkthrough: "### Walkthrough",
  };
}

describe("checkDraft", () => {
  it("passes a complete, clean draft", () => {
    assert.deepEqual(checkDraft(good(), ctx), { errors: [], warnings: [] });
  });

  it("catches a scoring test that does not exist, and a core test without a result", () => {
    const c = good();
    c.evaluation_config.testing.distractor_tests.push("made_up_test");
    c.evaluation_config.testing.core_tests.push("fnac");
    const { errors } = checkDraft(c, ctx);
    assert.ok(errors.some((e) => e.includes('"made_up_test"')));
    assert.ok(errors.some((e) => e.includes('Core test "fnac" has no result')));
  });

  it("catches a library title or tag that names the diagnosis", () => {
    const c = good();
    c.displayTitle = "54-year-old woman with a nodular goitre";
    c.displayTags = ["goitre"];
    const { errors } = checkDraft(c, ctx);
    assert.ok(errors.some((e) => e.startsWith("displayTitle gives the diagnosis away")));
    assert.ok(errors.some((e) => e.startsWith("displayTags give the diagnosis away")));
  });

  it("catches the patient's real name anywhere, and warns about their address", () => {
    const c = good();
    c.walkthrough = "Rubi presents with a neck swelling from Mustafabad.";
    const { errors, warnings } = checkDraft(c, ctx);
    assert.ok(errors.some((e) => e.includes('"Rubi"')));
    assert.ok(warnings.some((w) => w.includes('"mustafabad"')));
  });

  it("does not flag a name that only appears inside another word", () => {
    const c = good();
    c.walkthrough = "Rubidium is not relevant here.";
    assert.deepEqual(checkDraft(c, ctx).errors, []);
  });

  it("needs something to examine, and warns when the systemic examination is thin", () => {
    const none = good();
    none.patient_facts = { identity: {}, chief_complaint: "x", timeline: {} };
    assert.ok(checkDraft(none, ctx).errors.some((e) => e.includes("nothing to examine")));
    const thin = good();
    delete thin.patient_facts.respiratory_examination;
    assert.ok(checkDraft(thin, ctx).warnings.some((w) => w.startsWith("Only 2 examination sections")));
  });

  it("rejects an appearance the portrait cannot draw", () => {
    const c = good();
    c.appearance = { pallor: 5, expression: "calm" };
    assert.ok(checkDraft(c, ctx).errors.some((e) => e.includes("appearance levels")));
    c.appearance = { pallor: 1, expression: "happy" };
    assert.ok(checkDraft(c, ctx).errors.some((e) => e.includes("appearance.expression")));
  });

  it("needs a heart rate for the bedside monitor", () => {
    const c = good();
    delete c.patient.vitalSigns.heartRate;
    assert.ok(checkDraft(c, ctx).errors.some((e) => e.includes("heartRate")));
  });
});

describe("diagnosisWords", () => {
  it("keeps the disease words and drops generic ones", () => {
    assert.deepEqual(diagnosisWords(["Left-sided uncomplicated direct inguinal hernia"]).sort(), ["direct", "hernia", "inguinal"]);
  });
});

import { CATALOG_TEST_IDS } from "../../clinical-catalog";
import example from "../example-case.json";

describe("the converter's worked example", () => {
  it("passes the same check every converted case must pass", () => {
    const result = checkDraft(example.case, { catalogIds: new Set(CATALOG_TEST_IDS), identifiers: { names: ["Rubi"], places: ["Mustafabad (U.P.)"] } });
    assert.deepEqual(result, { errors: [], warnings: [] });
  });
});
