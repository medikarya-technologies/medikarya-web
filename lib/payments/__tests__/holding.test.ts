import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { paidThroughToStore, stillHolds, type CycleDates, type SubscriptionRow } from "../holding";

const now = Date.parse("2026-09-27T12:00:00Z");
const row = (over: Partial<SubscriptionRow>): SubscriptionRow => ({
  tier: "intern",
  status: "active",
  razorpay_subscription_id: "sub_1",
  razorpay_plan_id: "plan_1",
  current_end: "2026-10-27T12:00:00Z",
  ...over,
});

describe("stillHolds", () => {
  it("holds while active and paid up", () => {
    assert.equal(stillHolds(row({}), now), true);
    assert.equal(stillHolds(row({ status: "pending" }), now), true);
  });

  it("keeps a cancelled mandate active through the paid period, with no grace after it", () => {
    for (const status of ["cancelled", "completed"]) {
      assert.equal(stillHolds(row({ status }), now), true, status);
    }
    assert.equal(stillHolds(row({ status: "cancelled", current_end: null }), now), false);
    assert.equal(stillHolds(row({ status: "cancelled", current_end: "2026-09-27T11:59:00Z" }), now), false);
    assert.equal(stillHolds(row({ status: "completed", current_end: "2026-09-26T12:00:00Z" }), now), false);
  });

  it("does not hold once halted, expired or created-but-unpaid", () => {
    // halted: current_end is already the end of the cycle that was never paid
    for (const status of ["halted", "expired", "created"]) {
      assert.equal(stillHolds(row({ status }), now), false, status);
    }
  });

  it("holds until a scheduled cancellation, then stops, whatever the status says", () => {
    assert.equal(stillHolds(row({ cancel_at: "2026-10-27T12:00:00Z" }), now), true);
    assert.equal(stillHolds(row({ cancel_at: "2026-09-27T11:59:00Z" }), now), false);
  });

  it("stops a few days after the paid period if the webhook never moved it on", () => {
    assert.equal(stillHolds(row({ current_end: "2026-09-25T12:00:00Z" }), now), true);
    assert.equal(stillHolds(row({ current_end: "2026-09-23T12:00:00Z" }), now), false);
  });
});

describe("paidThroughToStore", () => {
  // Razorpay's own sample: a renewal fails and the cycle has already moved on to the unpaid one.
  const paidEnd = "2026-09-27T12:00:00Z";
  const unpaidEnd = "2026-10-27T12:00:00Z";
  const dates = (status: string, current_start: string | null, current_end: string | null): CycleDates => ({ status, current_start, current_end });

  it("stores Razorpay's current_end for an ordinary update", () => {
    assert.equal(paidThroughToStore(dates("active", paidEnd, unpaidEnd), dates("active", null, paidEnd)), unpaidEnd);
    assert.equal(paidThroughToStore(dates("active", null, paidEnd), null), paidEnd);
  });

  it("keeps the last known date when a cancellation omits current_end", () => {
    assert.equal(paidThroughToStore(dates("cancelled", null, null), dates("active", null, unpaidEnd)), unpaidEnd);
    assert.equal(paidThroughToStore(dates("cancelled", null, null), null), null);
  });

  it("ends a mandate cancelled during an unpaid renewal when that cycle began", () => {
    for (const before of ["pending", "halted"]) {
      assert.equal(paidThroughToStore(dates("cancelled", paidEnd, unpaidEnd), dates(before, paidEnd, unpaidEnd)), paidEnd, before);
      assert.equal(paidThroughToStore(dates("cancelled", null, unpaidEnd), dates(before, paidEnd, unpaidEnd)), paidEnd, before);
      assert.equal(paidThroughToStore(dates("cancelled", null, unpaidEnd), dates(before, null, unpaidEnd)), null, before);
    }
  });

  it("does not move an ended mandate's date when the webhook repeats", () => {
    assert.equal(paidThroughToStore(dates("cancelled", paidEnd, unpaidEnd), dates("cancelled", paidEnd, paidEnd)), paidEnd);
  });
});

describe("a monthly plan cancelled two days after paying", () => {
  // Paid on 1 Nov for the month to 1 Dec; Autopay cancelled on 3 Nov.
  const paidStart = "2026-11-01T10:00:00Z";
  const paidEnd = "2026-12-01T10:00:00Z";
  const stored: CycleDates = { status: "active", current_start: paidStart, current_end: paidEnd };
  const at = (iso: string) => Date.parse(iso);

  const afterCancel = (current_end: string | null, cancel_at: string | null = null): SubscriptionRow => ({
    tier: "intern",
    status: "cancelled",
    razorpay_subscription_id: "sub_1",
    razorpay_plan_id: "plan_1",
    current_end: paidThroughToStore({ status: "cancelled", current_start: paidStart, current_end }, stored),
    cancel_at,
  });

  it("keeps the whole paid month when Autopay is removed in the UPI app", () => {
    // whatever date Razorpay's cancellation carries: the paid end, none, or the day it was cancelled
    for (const reported of [paidEnd, null, "2026-11-03T09:00:00Z"]) {
      const row = afterCancel(reported);
      assert.equal(row.current_end, paidEnd, String(reported));
      assert.equal(stillHolds(row, at("2026-11-03T12:00:00Z")), true, String(reported));
      assert.equal(stillHolds(row, at("2026-12-01T09:59:00Z")), true, String(reported));
      assert.equal(stillHolds(row, at("2026-12-01T10:01:00Z")), false, String(reported));
    }
  });

  it("keeps the whole paid month when cancelled on the site", () => {
    // The site schedules the cancel for the cycle end; Razorpay keeps the mandate active until then.
    const scheduled: SubscriptionRow = { ...afterCancel(paidEnd), status: "active", current_end: paidEnd, cancel_at: paidEnd };
    assert.equal(stillHolds(scheduled, at("2026-11-03T12:00:00Z")), true);
    assert.equal(stillHolds(scheduled, at("2026-12-01T10:01:00Z")), false);
    // ...and Razorpay's cancelled webhook at the cycle end changes nothing.
    assert.equal(stillHolds(afterCancel(paidEnd, paidEnd), at("2026-12-01T10:01:00Z")), false);
  });
});
