import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { activeGrant, caseRewardWindow, type GrantRow } from "../grants";

const now = new Date("2026-10-01T00:00:00Z");
const grant = (starts: string, ends: string, over: Partial<GrantRow> = {}): GrantRow => ({
  tier: "resident",
  months: 1,
  starts_at: starts,
  ends_at: ends,
  reason: "case_published",
  ...over,
});

describe("caseRewardWindow", () => {
  it("gives a first-time author one month from now", () => {
    const w = caseRewardWindow([], now)!;
    assert.equal(w.months, 1);
    assert.equal(w.startsAt.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal(w.endsAt.toISOString(), "2026-11-01T00:00:00.000Z");
  });

  it("stacks after free time that is still running", () => {
    const w = caseRewardWindow([grant("2026-09-15T00:00:00Z", "2026-10-15T00:00:00Z")], now)!;
    assert.equal(w.startsAt.toISOString(), "2026-10-15T00:00:00.000Z");
    assert.equal(w.endsAt.toISOString(), "2026-11-15T00:00:00.000Z");
  });

  it("starts now when earlier rewards have run out", () => {
    const w = caseRewardWindow([grant("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")], now)!;
    assert.equal(w.startsAt.toISOString(), now.toISOString());
  });

  it("stops at 6 months of case rewards in all", () => {
    const six = Array.from({ length: 6 }, () => grant("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"));
    assert.equal(caseRewardWindow(six, now), null);
    const five = six.slice(1);
    assert.equal(caseRewardWindow(five, now)!.months, 1);
  });

  it("does not count other kinds of grant towards the cap", () => {
    const other = Array.from({ length: 6 }, () => grant("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", { reason: "manual" }));
    assert.notEqual(caseRewardWindow(other, now), null);
  });
});

describe("activeGrant", () => {
  it("gives the plan while a grant runs, and until the last stacked grant ends", () => {
    const g = activeGrant([grant("2026-09-15T00:00:00Z", "2026-10-15T00:00:00Z"), grant("2026-10-15T00:00:00Z", "2026-11-15T00:00:00Z")], now)!;
    assert.equal(g.plan, "resident");
    assert.equal(g.endsAt, "2026-11-15T00:00:00Z");
  });

  it("gives nothing before a grant starts or after it ends", () => {
    assert.equal(activeGrant([grant("2026-10-15T00:00:00Z", "2026-11-15T00:00:00Z")], now), null);
    assert.equal(activeGrant([grant("2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z")], now), null);
  });
});
