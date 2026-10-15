import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cleanAnswers } from "../answers";
import { PROTOCOL_CARDS } from "../decisions";

describe("what a professor's saved answers can contain", () => {
  const withOptions = PROTOCOL_CARDS.find((c) => c.options)!;
  const free = PROTOCOL_CARDS.find((c) => c.prompt)!;
  const first = withOptions.options![0].id;

  it("keeps a real choice, a note and written text", () => {
    assert.deepEqual(cleanAnswers({ [withOptions.id]: { choice: first, note: "  fine  " } }), { [withOptions.id]: { choice: first, note: "fine" } });
    assert.deepEqual(cleanAnswers({ [free.id]: { other: "about 1 in 5" } }), { [free.id]: { other: "about 1 in 5" } });
  });

  it("drops a card that does not exist and a choice that is not one of the card's options", () => {
    assert.deepEqual(cleanAnswers({ nope: { choice: "A" } }), {});
    assert.deepEqual(cleanAnswers({ [withOptions.id]: { choice: "Z" } }), {});
    assert.deepEqual(cleanAnswers({ [free.id]: { choice: "A" } }), {}, "a card answered in words has no options to choose");
  });

  it("cuts very long text and ignores anything that is not text", () => {
    const a = cleanAnswers({ [free.id]: { other: "x".repeat(5000), note: "y".repeat(9000) }, [withOptions.id]: { choice: 5, note: { a: 1 } } });
    assert.equal(a[free.id].other!.length, 1500);
    assert.equal(a[free.id].note!.length, 3000);
    assert.equal(a[withOptions.id], undefined);
  });

  it("copes with anything else a request could hold", () => {
    for (const bad of [null, undefined, 5, "text", [], [1, 2], { [withOptions.id]: null }, { [withOptions.id]: "A" }]) assert.deepEqual(cleanAnswers(bad), {});
  });

  it("has 22 cards, each with options or a prompt, and ids that are unique", () => {
    assert.equal(PROTOCOL_CARDS.length, 22);
    assert.equal(new Set(PROTOCOL_CARDS.map((c) => c.id)).size, 22);
    for (const c of PROTOCOL_CARDS) assert.ok(c.options?.length || c.prompt, c.id);
  });
});
