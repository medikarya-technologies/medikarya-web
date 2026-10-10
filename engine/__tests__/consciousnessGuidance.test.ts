import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { consciousnessGuidance, speakerKind } from "../consciousnessGuidance";

describe("speakerKind", () => {
  it("tells the patient, a parent and someone else speaking for the patient apart", () => {
    assert.equal(speakerKind({ speaker: "patient", can_speak_for_self: true }), "self");
    assert.equal(speakerKind({ speaker: "mother", can_speak_for_self: false }), "parent");
    assert.equal(speakerKind({ speaker: "Father" }), "parent");
    assert.equal(speakerKind({ speaker: "wife", can_speak_for_self: false }), "companion");
    assert.equal(speakerKind({ speaker: "care home nurse", can_speak_for_self: false }), "companion");
    assert.equal(speakerKind({ speaker: "daughter" }), "companion");
  });

  it("treats any case whose patient cannot speak for himself as someone speaking for him", () => {
    assert.equal(speakerKind({ speaker: "Kavita", can_speak_for_self: false }), "companion");
  });

  it("defaults to the patient when the case says nothing", () => {
    for (const role of [undefined, null, {}, { speaker: 7 }]) assert.equal(speakerKind(role as never), "self");
  });
});

describe("consciousnessGuidance", () => {
  it("keeps someone speaking for an unresponsive patient able to answer", () => {
    for (const level of ["drowsy", "altered", "unresponsive"]) {
      const line = consciousnessGuidance(level, "companion");
      assert.match(line, /still answer/);
      assert.doesNotMatch(line, /cannot speak|your child/i);
    }
  });

  it("silences only the patient himself when he is unresponsive", () => {
    assert.match(consciousnessGuidance("unresponsive", "self"), /cannot speak/);
    assert.match(consciousnessGuidance("unresponsive", "parent"), /Your child/);
  });

  it("says nothing extra for an alert patient or no level", () => {
    for (const kind of ["self", "parent", "companion"] as const) {
      assert.equal(consciousnessGuidance(undefined, kind), "");
      assert.equal(consciousnessGuidance("alert", kind), "");
    }
  });
});
