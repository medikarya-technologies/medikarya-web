import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { patientFactsText } from "../patientFacts";

describe("patientFactsText", () => {
  it("writes grouped facts out as readable lines, never [object Object]", () => {
    const out = patientFactsText({
      identity: { name: "Mohan Lal Verma", age_years: 85 },
      symptoms: { circumstances_of_falls: "Mostly on getting out of bed", positive: ["falls", "dizziness"], negative: [] },
      personal_history: { smoking: "Five cigarettes a day" },
      family_history: "Nothing relevant.",
    });
    assert.doesNotMatch(out, /object Object/);
    assert.deepEqual(out.split("\n"), [
      "identity:",
      "  name: Mohan Lal Verma",
      "  age years: 85",
      "symptoms:",
      "  circumstances of falls: Mostly on getting out of bed",
      "  positive: falls, dizziness",
      "personal history:",
      "  smoking: Five cigarettes a day",
      "family history: Nothing relevant.",
    ]);
  });

  it("leaves out the examination, which the doctor finds and the patient does not know", () => {
    const out = patientFactsText({
      chief_complaint: "Numb feet",
      neurological_examination: { reflexes: "Ankle jerks absent" },
      abdominal_examination: "Normal.",
      mental_state_examination: { orientation: "Disorientated" },
    });
    assert.equal(out, "chief complaint: Numb feet");
  });

  it("lists objects inside a list one per line", () => {
    const out = patientFactsText({ medicines: [{ name: "Atenolol", dose: "50 mg" }, { name: "Metformin" }] });
    assert.deepEqual(out.split("\n"), ["medicines:", "  - name: Atenolol", "    dose: 50 mg", "  - name: Metformin"]);
  });

  it("gives nothing for no facts", () => {
    for (const f of [undefined, null, "text", [], {}]) assert.equal(patientFactsText(f), "");
  });

  it("reads a real case's grouped facts when this machine has it", () => {
    let c: any;
    try {
      c = require("../../data/cases/85-year-old-man-who-keeps-falling.json");
    } catch {
      return; // data/cases is gitignored
    }
    const out = patientFactsText(c.patient_facts);
    assert.match(out, /circumstances of falls: .*getting out of bed/);
    assert.doesNotMatch(out, /object Object|blood pressure standing/);
  });
});
