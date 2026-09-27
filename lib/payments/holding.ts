// Whether a stored subscription still gives its tier. Pure, so it can be tested; lib/payments/subscriptions.ts
// reads the rows and uses this.

// Statuses in which the student holds (or is about to hold) a plan. "pending" is a renewal Razorpay is retrying.
export const HOLDING_STATUSES = ["authenticated", "active", "pending"];

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
  if (row.current_end && Date.parse(row.current_end) + LAPSE_GRACE_MS < now) return false;
  return true;
}
