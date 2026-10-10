import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { caseRules } from "../caseRules";

describe("caseRules", () => {
  it("lists the case's rules under a heading that keeps the diagnosis off limits", () => {
    const out = caseRules({ key_constraints: ["Use plain words.", "Mention the eye episode only if asked."] });
    const [heading, ...lines] = out.split("\n");
    assert.match(heading, /RULES FOR THIS CASE/);
    assert.match(heading, /none of them lets you name or guess the diagnosis/);
    assert.deepEqual(lines, ["- Use plain words.", "- Mention the eye episode only if asked."]);
  });

  it("gives nothing when there are no rules", () => {
    for (const role of [undefined, null, {}, { key_constraints: [] }, { key_constraints: "not a list" }, { key_constraints: ["", "   ", 7] }]) {
      assert.equal(caseRules(role as never), "");
    }
  });

  it("keeps each rule to one line and the list to a sensible size", () => {
    const out = caseRules({ key_constraints: ["two\nlines", "x".repeat(400), ...Array.from({ length: 30 }, (_, i) => `rule ${i}`)] });
    const lines = out.split("\n").slice(1);
    assert.equal(lines[0], "- two lines");
    assert.ok(lines[1].length <= 303 && lines[1].endsWith("…"));
    assert.equal(lines.length, 15);
  });
});
