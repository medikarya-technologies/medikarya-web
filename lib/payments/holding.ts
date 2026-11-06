// Whether a stored subscription still gives its tier. Pure, so it can be tested; lib/payments/subscriptions.ts
// reads the rows and uses this.

// Statuses in which the student holds (or is about to hold) a plan. "pending" is a renewal Razorpay is retrying.
// A cancelled or completed mandate still grants access through current_end, the end of the period already paid
// for. "halted" (every retry failed) holds nothing: by then Razorpay has moved current_end on to the cycle that
// was never paid, so honouring it would give that cycle away.
export const HOLDING_STATUSES = ["authenticated", "active", "pending", "cancelled", "completed"];

// Statuses in which Razorpay will not charge again: the plan runs to current_end and then stops.
export const ENDED_STATUSES = ["cancelled", "completed"];

// Statuses in which the current cycle has started but its payment has not gone through.
const UNPAID_STATUSES = ["pending", "halted"];

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
  // Once Razorpay marks a mandate terminal, keep the paid-through period and no more: no grace, since no renewal
  // is coming, and no access at all if it never told us current_end. This covers students who remove Autopay
  // in their UPI app.
  if (ENDED_STATUSES.includes(row.status)) return row.current_end != null && Date.parse(row.current_end) > now;
  if (row.current_end && Date.parse(row.current_end) + LAPSE_GRACE_MS < now) return false;
  return true;
}

/** A subscription's status and cycle dates (ISO strings), as Razorpay sends them or as they are stored. */
export interface CycleDates {
  status: string;
  current_start: string | null;
  current_end: string | null;
}

/**
 * The current_end to store when Razorpay reports a subscription. Normally Razorpay's own value, but:
 * - some terminal events omit current_end, so keep the last known one rather than erase a paid period;
 * - a mandate that ends while a renewal is unpaid (pending or halted) arrives with current_end at the end of that
 *   unpaid cycle; the paid period really ended when the cycle began, so store its start instead;
 * - once a mandate has ended, its date is settled: a repeated webhook (Razorpay retries them) must not move it;
 * - a mandate cancelled while its cycle is paid (say two days into a month) keeps that whole cycle, even if the
 *   cancellation carries an earlier date than the one we stored.
 */
export function paidThroughToStore(incoming: CycleDates, stored: CycleDates | null): string | null {
  if (ENDED_STATUSES.includes(incoming.status) && stored) {
    if (ENDED_STATUSES.includes(stored.status) && stored.current_end) return stored.current_end;
    if (UNPAID_STATUSES.includes(stored.status)) return incoming.current_start ?? stored.current_start ?? null;
    if (stored.status === "active" && stored.current_end) {
      const reported = incoming.current_end;
      return reported && Date.parse(reported) > Date.parse(stored.current_end) ? reported : stored.current_end;
    }
  }
  return incoming.current_end ?? stored?.current_end ?? null;
}
