import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { defaultStudioTab, studioStage, type StageConverted, type StageSheet } from "../stage";

const now = Date.parse("2026-10-10T12:00:00Z");
const sheet = (over: Partial<StageSheet> = {}): StageSheet => ({ status: "submitted", addedToPlatform: false, sentBackAt: null, ...over });
const draft = (over: Partial<StageConverted> = {}): StageConverted => ({ status: "draft", inQueue: true, review: null, ...over });
const review = (over: Partial<NonNullable<StageConverted["review"]>> = {}) => ({
  expiresAt: "2026-10-15T00:00:00Z",
  decision: null,
  decidedAt: null,
  ...over,
});

describe("studioStage tabs", () => {
  it("a submitted sheet not converted yet needs the admin", () => {
    assert.equal(studioStage(sheet(), null, now).tab, "todo");
  });

  it("a sheet sent back before conversion is with the author", () => {
    assert.equal(studioStage(sheet({ status: "changes_requested" }), null, now).tab, "author");
  });

  it("a sheet added to MediKarya by hand counts as live", () => {
    const s = studioStage(sheet({ status: "approved", addedToPlatform: true }), null, now);
    assert.equal(s.addedByHand, true);
    assert.equal(s.tab, "live");
  });

  it("a published case is live", () => {
    assert.equal(studioStage(sheet({ status: "approved" }), draft({ status: "published" }), now).tab, "live");
  });

  it("an unreviewed draft in the queue is with reviewers", () => {
    assert.equal(studioStage(sheet(), draft(), now).tab, "review");
  });

  it("an unreviewed draft missing from the queue needs the admin", () => {
    assert.equal(studioStage(sheet(), draft({ inQueue: false }), now).tab, "todo");
  });

  it("a review under way is with reviewers, even if the draft is not in the queue (a private link)", () => {
    const s = studioStage(sheet(), draft({ inQueue: false, review: review() }), now);
    assert.equal(s.waiting, true);
    assert.equal(s.tab, "review");
  });

  it("a review that ran out goes back to the queue if it is there, otherwise to the admin", () => {
    const old = review({ expiresAt: "2026-10-01T00:00:00Z" });
    assert.equal(studioStage(sheet(), draft({ review: old }), now).expired, true);
    assert.equal(studioStage(sheet(), draft({ review: old }), now).tab, "review");
    assert.equal(studioStage(sheet(), draft({ inQueue: false, review: old }), now).tab, "todo");
  });

  it("an approved draft is ready to publish", () => {
    const s = studioStage(sheet(), draft({ review: review({ decision: "approved", decidedAt: "2026-10-09T00:00:00Z" }) }), now);
    assert.equal(s.approved, true);
    assert.equal(s.tab, "todo");
  });

  it("changes asked: admin's turn, then the author's, then the admin's again once resubmitted", () => {
    const asked = review({ decision: "changes_requested", decidedAt: "2026-10-08T00:00:00Z" });
    assert.equal(studioStage(sheet(), draft({ review: asked }), now).tab, "todo");

    const withAuthor = studioStage(sheet({ status: "changes_requested", sentBackAt: "2026-10-09T00:00:00Z" }), draft({ review: asked }), now);
    assert.equal(withAuthor.withAuthor, true);
    assert.equal(withAuthor.tab, "author");

    const back = studioStage(sheet({ status: "submitted", sentBackAt: "2026-10-09T00:00:00Z" }), draft({ review: asked }), now);
    assert.equal(back.resubmitted, true);
    assert.equal(back.tab, "todo");
  });
});

describe("defaultStudioTab", () => {
  it("opens the first tab with something in it", () => {
    assert.equal(defaultStudioTab({ todo: 2, review: 4, author: 0, live: 9 }), "todo");
    assert.equal(defaultStudioTab({ todo: 0, review: 4, author: 0, live: 9 }), "review");
    assert.equal(defaultStudioTab({ todo: 0, review: 0, author: 0, live: 0 }), "todo");
  });
});
