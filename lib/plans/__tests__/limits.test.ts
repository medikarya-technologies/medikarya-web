import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decide, explain, higherPlan, indiaDay, lockedFor, type Usage } from "../limits";

const fresh: Usage = { casesToday: 0, liveToday: 0, liveEver: 0, openedToday: false };
const beginner = { live: false, difficulty: 1 as const };
const intermediate = { live: false, difficulty: 2 as const };
const advanced = { live: false, difficulty: 3 as const };
const live = { live: true, difficulty: 3 as const };

describe("decide", () => {
  it("lets a Student open Beginner cases, two a day", () => {
    assert.deepEqual(decide("student", beginner, fresh), { ok: true });
    assert.deepEqual(decide("student", beginner, { ...fresh, casesToday: 1 }), { ok: true });
    assert.deepEqual(decide("student", beginner, { ...fresh, casesToday: 2 }), { ok: false, reason: "cases_today", limit: 2, needs: "intern" });
  });

  it("locks harder normal cases to the plan that includes them", () => {
    assert.deepEqual(decide("student", intermediate, fresh), { ok: false, reason: "locked", needs: "intern" });
    assert.deepEqual(decide("student", advanced, fresh), { ok: false, reason: "locked", needs: "resident" });
    assert.deepEqual(decide("intern", intermediate, fresh), { ok: true });
    assert.deepEqual(decide("intern", advanced, fresh), { ok: false, reason: "locked", needs: "resident" });
    assert.deepEqual(decide("resident", advanced, fresh), { ok: true });
  });

  it("gives a Student one live case, once ever, whatever its difficulty", () => {
    assert.deepEqual(decide("student", live, fresh), { ok: true });
    assert.deepEqual(decide("student", live, { ...fresh, liveEver: 1 }), { ok: false, reason: "live_trial_used", limit: 1, needs: "intern" });
  });

  it("counts live cases per day for paid plans, separately from normal cases", () => {
    assert.deepEqual(decide("intern", live, { ...fresh, liveToday: 4, casesToday: 15 }), { ok: true });
    assert.deepEqual(decide("intern", live, { ...fresh, liveToday: 5 }), { ok: false, reason: "live_today", limit: 5, needs: "resident" });
    assert.deepEqual(decide("resident", live, { ...fresh, liveToday: 10, liveEver: 500 }), { ok: false, reason: "live_today", limit: 10, needs: undefined });
    assert.deepEqual(decide("intern", intermediate, { ...fresh, liveToday: 5, casesToday: 14 }), { ok: true });
  });

  it("never limits a Resident's normal cases", () => {
    assert.deepEqual(decide("resident", advanced, { ...fresh, casesToday: 10_000 }), { ok: true });
  });

  it("does not charge again for a case already opened today (resume, reload, try again)", () => {
    assert.deepEqual(decide("student", beginner, { ...fresh, casesToday: 2, openedToday: true }), { ok: true });
    assert.deepEqual(decide("intern", live, { ...fresh, liveToday: 5, openedToday: true }), { ok: true });
  });

  it("still locks a case opened today on a plan that has since lapsed", () => {
    // Opened as an Intern this morning, subscription cancelled this afternoon.
    assert.deepEqual(decide("student", intermediate, { ...fresh, casesToday: 2, openedToday: true }), { ok: false, reason: "locked", needs: "intern" });
    assert.deepEqual(decide("student", live, { ...fresh, liveEver: 4, liveToday: 1, openedToday: true }), { ok: false, reason: "live_trial_used", limit: 1, needs: "intern" });
  });

  it("lets a Student resume their free live case the same day", () => {
    assert.deepEqual(decide("student", live, { ...fresh, liveEver: 1, liveToday: 1, openedToday: true }), { ok: true });
  });
});

describe("lockedFor", () => {
  it("marks only what the plan can never open, not daily limits", () => {
    assert.equal(lockedFor("student", beginner, 0), null);
    assert.equal(lockedFor("student", intermediate, 0), "intern");
    assert.equal(lockedFor("intern", advanced, 0), "resident");
    assert.equal(lockedFor("student", live, 0), null);
    assert.equal(lockedFor("student", live, 1), "intern");
    assert.equal(lockedFor("intern", live, 40), null);
  });
});

describe("explain", () => {
  it("says what happened and what would change it", () => {
    assert.equal(explain({ ok: false, reason: "locked", needs: "resident" }), "This case is part of the Resident plan.");
    assert.equal(
      explain({ ok: false, reason: "cases_today", limit: 2, needs: "intern" }),
      "You have opened all 2 of today's cases. More open tomorrow. Upgrade to Intern for more."
    );
    assert.equal(explain({ ok: false, reason: "live_today", limit: 10 }), "You have used all 10 of today's live cases. More open tomorrow.");
  });
});

describe("indiaDay / higherPlan", () => {
  it("turns over at midnight in India, not UTC", () => {
    assert.equal(indiaDay(new Date("2026-09-27T18:29:00Z")), "2026-09-27");
    assert.equal(indiaDay(new Date("2026-09-27T18:30:00Z")), "2026-09-28");
  });
  it("picks the higher of two plans", () => {
    assert.equal(higherPlan("intern", "resident"), "resident");
    assert.equal(higherPlan("intern", "student"), "intern");
  });
});
