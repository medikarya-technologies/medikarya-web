import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { activeGrant, caseRewardWindow, monthsEarned, type GrantRow } from "../grants";

const now = new Date("2026-10-01T00:00:00Z");
const grant = (starts: string, ends: string, over: Partial<GrantRow> = {}): GrantRow => ({
  tier: "resident",
  months: 1,
  starts_at: starts,
  ends_at: ends,
  reason: "case_published",
  ...over,
});

describe("monthsEarned", () => {
  it("gives 1 month at the 1st case, 3 by the 3rd and 6 by the 5th, and no more", () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 30].map(monthsEarned), [0, 1, 1, 3, 3, 6, 6, 6]);
  });
});

describe("caseRewardWindow", () => {
  it("gives a first-time author one month from now", () => {
    const w = caseRewardWindow([], 1, now)!;
    assert.equal(w.months, 1);
    assert.equal(w.startsAt.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal(w.endsAt.toISOString(), "2026-11-01T00:00:00.000Z");
  });

  it("gives nothing between milestones", () => {
    assert.equal(caseRewardWindow([grant("2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z")], 2, now), null);
    assert.equal(caseRewardWindow([grant("2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", { months: 3 })], 4, now), null);
  });

  it("gives the next milestone's months, stacked after free time still running", () => {
    const w = caseRewardWindow([grant("2026-09-15T00:00:00Z", "2026-10-15T00:00:00Z")], 3, now)!;
    assert.equal(w.months, 2);
    assert.equal(w.startsAt.toISOString(), "2026-10-15T00:00:00.000Z");
    assert.equal(w.endsAt.toISOString(), "2026-12-15T00:00:00.000Z");
  });

  it("starts now when earlier rewards have run out", () => {
    const w = caseRewardWindow([grant("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")], 3, now)!;
    assert.equal(w.startsAt.toISOString(), now.toISOString());
  });

  it("never gives twice for the same milestone, and stops at 6 months in all", () => {
    const three = [grant("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", { months: 3 })];
    assert.equal(caseRewardWindow(three, 3, now), null);
    assert.equal(caseRewardWindow(three, 5, now)!.months, 3);
    const six = [grant("2026-01-01T00:00:00Z", "2026-07-01T00:00:00Z", { months: 6 })];
    assert.equal(caseRewardWindow(six, 12, now), null);
  });

  it("lets authors rewarded under the old one-month-per-case rule keep what they had", () => {
    const four = Array.from({ length: 4 }, () => grant("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"));
    assert.equal(caseRewardWindow(four, 4, now), null);
    assert.equal(caseRewardWindow(four, 5, now)!.months, 2);
  });

  it("does not count other kinds of grant", () => {
    const other = [grant("2026-01-01T00:00:00Z", "2026-07-01T00:00:00Z", { months: 6, reason: "manual" })];
    assert.equal(caseRewardWindow(other, 1, now)!.months, 1);
  });

  it("starts now even while an Intern workshop pass is running, since Resident is better", () => {
    const pass = [grant("2026-09-25T00:00:00Z", "2026-10-09T00:00:00Z", { tier: "intern", reason: "workshop: the MAMC workshop" })];
    assert.equal(caseRewardWindow(pass, 1, now)!.startsAt.toISOString(), now.toISOString());
  });
});

describe("activeGrant", () => {
  it("gives the plan while a grant runs, and until the last stacked grant ends", () => {
    const g = activeGrant([grant("2026-09-15T00:00:00Z", "2026-10-15T00:00:00Z"), grant("2026-10-15T00:00:00Z", "2026-11-15T00:00:00Z")], now)!;
    assert.equal(g.plan, "resident");
    assert.equal(g.endsAt, "2026-11-15T00:00:00Z");
  });

  it("says where the plan comes from: a published case, a workshop pass, or anything else", () => {
    const running = (over: Partial<GrantRow>) => grant("2026-09-25T00:00:00Z", "2026-10-09T00:00:00Z", over);
    assert.deepEqual(
      [activeGrant([running({})], now)!.from, activeGrant([running({ reason: "manual" })], now)!.from],
      ["case", "other"]
    );
    const pass = activeGrant([running({ tier: "intern", reason: "workshop: the MAMC workshop" })], now)!;
    assert.deepEqual([pass.plan, pass.from, pass.pass], ["intern", "pass", "the MAMC workshop"]);
    // a Resident reward beats an Intern pass running at the same time, and is what the student is told about
    const both = activeGrant([running({ tier: "intern", reason: "workshop: the MAMC workshop" }), running({})], now)!;
    assert.deepEqual([both.plan, both.from, both.pass], ["resident", "case", null]);
  });

  it("gives nothing before a grant starts or after it ends", () => {
    assert.equal(activeGrant([grant("2026-10-15T00:00:00Z", "2026-11-15T00:00:00Z")], now), null);
    assert.equal(activeGrant([grant("2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z")], now), null);
  });
});
