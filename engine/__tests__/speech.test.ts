import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { spokenDashes } from "../speech";

describe("spokenDashes", () => {
  it("turns a dash between two thoughts into a comma, spaced or not", () => {
    assert.equal(spokenDashes("Doctor, please help—my little boy is so weak."), "Doctor, please help, my little boy is so weak.");
    assert.equal(spokenDashes("Doctor, please help — my chest hurts."), "Doctor, please help, my chest hurts.");
    assert.equal(spokenDashes("It started at night – around two."), "It started at night, around two.");
  });

  it("makes a broken-off sentence trail away", () => {
    assert.equal(spokenDashes("I was going to tell you—"), "I was going to tell you...");
  });

  it("leaves number ranges and plain speech alone", () => {
    assert.equal(spokenDashes("About 3–4 times a day, doctor."), "About 3–4 times a day, doctor.");
    assert.equal(spokenDashes("No, he has not had a fever."), "No, he has not had a fever.");
  });

  it("does not leave a comma before other punctuation", () => {
    assert.equal(spokenDashes("Yes — , that's right."), "Yes, that's right.");
    assert.equal(spokenDashes("Since when —?"), "Since when?");
  });
});
