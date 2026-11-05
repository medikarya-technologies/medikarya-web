import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { stillHolds, type SubscriptionRow } from "../holding";

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

  it("keeps a cancelled mandate active through the paid period", () => {
    for (const status of ["cancelled", "halted", "completed"]) {
      assert.equal(stillHolds(row({ status }), now), true, status);
    }
    for (const status of ["expired", "created"]) {
      assert.equal(stillHolds(row({ status }), now), false, status);
    }
    assert.equal(stillHolds(row({ status: "cancelled", current_end: null }), now), false);
    assert.equal(stillHolds(row({ status: "cancelled", current_end: "2026-09-27T11:59:00Z" }), now), false);
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
