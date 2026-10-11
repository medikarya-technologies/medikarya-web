import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { activeGrant, caseRewardsDue, type GrantRow } from "../grants";

const now = new Date("2026-10-01T00:00:00Z");
const grant = (starts: string, ends: string, over: Partial<GrantRow> = {}): GrantRow => ({
  tier: "resident",
  months: 1,
  starts_at: starts,
  ends_at: ends,
  reason: "case_published",
  ...over,
});

describe("caseRewardsDue", () => {
  it("gives a month of Intern at the 1st published case, from now", () => {
    const [r, ...rest] = caseRewardsDue([], 1, now);
    assert.equal(rest.length, 0);
    assert.deepEqual([r.at, r.tier, r.months], [1, "intern", 1]);
    assert.equal(r.startsAt.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal(r.endsAt.toISOString(), "2026-11-01T00:00:00.000Z");
  });

  it("gives nothing between milestones, the 3rd case included", () => {
    const first = [grant("2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", { tier: "intern" })];
    for (const n of [2, 3, 4]) assert.deepEqual(caseRewardsDue(first, n, now), []);
  });

  it("gives 2 months of Resident at the 5th, and nothing after", () => {
    const first = [grant("2026-09-01T00:00:00Z", "2026-09-30T00:00:00Z", { tier: "intern" })];
    const [r] = caseRewardsDue(first, 5, now);
    assert.deepEqual([r.at, r.tier, r.months], [5, "resident", 2]);
    assert.equal(r.endsAt.toISOString(), "2026-12-01T00:00:00.000Z");
    const both = [...first, grant("2026-10-01T00:00:00Z", "2026-12-01T00:00:00Z")];
    for (const n of [5, 6, 15, 40]) assert.deepEqual(caseRewardsDue(both, n, now), []);
  });

  it("gives both if a reward was missed, the Resident not waiting for the Intern", () => {
    const due = caseRewardsDue([], 5, now);
    assert.deepEqual(due.map((r) => r.tier), ["intern", "resident"]);
    assert.equal(due[1].startsAt.toISOString(), now.toISOString());
  });

  it("starts Intern after any Intern or Resident still running, and Resident only after Resident", () => {
    const pass = [grant("2026-09-25T00:00:00Z", "2026-10-09T00:00:00Z", { tier: "intern", reason: "workshop: the MAMC workshop" })];
    assert.equal(caseRewardsDue(pass, 1, now)[0].startsAt.toISOString(), "2026-10-09T00:00:00.000Z");
    const passThenFirst = [...pass, grant("2026-09-01T00:00:00Z", "2026-09-30T00:00:00Z", { tier: "intern" })];
    assert.equal(caseRewardsDue(passThenFirst, 5, now)[0].startsAt.toISOString(), now.toISOString());
  });

  it("does not count other kinds of grant as rewards already given", () => {
    const other = [grant("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", { reason: "manual" })];
    assert.equal(caseRewardsDue(other, 1, now).length, 1);
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
