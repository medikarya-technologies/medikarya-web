import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cardsFor, cleanAnswers } from "../answers";
import { PROTOCOL_CARDS, PROTOCOL_PACKAGE } from "../decisions";
import { DISCUSS, SHORT_CARDS, SHORT_PACKAGE } from "../short";

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

describe("the short follow-up package", () => {
  const short = cardsFor(SHORT_PACKAGE);
  const multi = SHORT_CARDS.find((c) => c.multi)!;
  const single = SHORT_CARDS.find((c) => !c.multi && c.options.some((o) => o.id === DISCUSS.id))!;

  it("keeps ticked boxes as known ids, each once, in the card's order", () => {
    assert.deepEqual(cleanAnswers({ [multi.id]: { choice: "C, A,A,Q" } }, short), { [multi.id]: { choice: "A,C" } });
    assert.deepEqual(cleanAnswers({ [multi.id]: { choice: "Q,R" } }, short), {}, "nothing known ticked, nothing kept");
  });

  it("lets a single question be answered 'discuss when we meet', and keeps the closing comment", () => {
    assert.deepEqual(cleanAnswers({ [single.id]: { choice: DISCUSS.id } }, short), { [single.id]: { choice: DISCUSS.id } });
    assert.deepEqual(cleanAnswers({ S0: { choice: "B", note: "add oxygen" } }, short), { S0: { choice: "B", note: "add oxygen" } });
  });

  it("keeps each package to its own questions", () => {
    assert.deepEqual(cleanAnswers({ C1: { choice: "A" } }, short), {}, "a long-package card is not stored on a short link");
    assert.deepEqual(cleanAnswers({ S0: { choice: "A" } }), {}, "and a short card is not stored on a long link");
    assert.deepEqual(cardsFor("unknown-package"), []);
    assert.equal(cardsFor(PROTOCOL_PACKAGE), PROTOCOL_CARDS);
  });

  it("has only whole answers: every single question offers 'discuss', every card has options", () => {
    for (const c of SHORT_CARDS) {
      assert.ok(c.options.length >= 2, c.id);
      assert.ok(!c.options.some((o) => /\(state|other:/i.test(o.label)), `${c.id} asks the reviewer to write an answer`);
    }
  });
});
