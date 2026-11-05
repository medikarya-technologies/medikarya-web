// Whether a stored subscription still gives its tier. Pure, so it can be tested; lib/payments/subscriptions.ts
// reads the rows and uses this.

// Statuses in which the student holds (or is about to hold) a plan. A cancelled/completed mandate still grants
// access through current_end: that is the end of the billing period already paid for.
export const HOLDING_STATUSES = ["authenticated", "active", "pending", "cancelled", "completed", "halted"];

export interface SubscriptionRow {
  tier: string;
  status: string;
  razorpay_subscription_id: string;
  razorpay_plan_id: string;
  current_end: string | null;
  /** Set when the student cancels: the plan runs to this date (scripts/add_subscription_cancel_at.sql). */
  cancel_at?: string | null;
}

// Razorpay's webhook moves a subscription on (renewed, cancelled, halted). If a webhook is ever missed, a paid
// period that ended more than this long ago no longer counts, so access cannot outlive the payment for long.
export const LAPSE_GRACE_MS = 3 * 86_400_000;

export function stillHolds(row: SubscriptionRow, now = Date.now()): boolean {
  if (!HOLDING_STATUSES.includes(row.status)) return false;
  if (row.cancel_at && Date.parse(row.cancel_at) <= now) return false;
  // Once Razorpay marks a mandate terminal, preserve the paid-through period but don't grant access forever
  // if it omitted current_end. This covers customers who remove Autopay directly in their UPI app.
  if (["cancelled", "completed", "halted"].includes(row.status) && !row.current_end) return false;
  if (row.current_end && Date.parse(row.current_end) + LAPSE_GRACE_MS < now) return false;
  return true;
}
