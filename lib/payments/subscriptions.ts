import { supabaseServer } from "@/lib/supabase/server";
import { HOLDING_STATUSES, stillHolds, type SubscriptionRow } from "./holding";

export { HOLDING_STATUSES, stillHolds, type SubscriptionRow } from "./holding";

// The paid tiers and how they're billed. Each (tier, period) is one Razorpay Plan, made in the dashboard or via
// the API, and referenced by id from env, since the plan is the source of truth for price. Test and live mode
// have separate plans, so .env.local holds the test ids and the deployed site's settings hold the live ones.
export type PaidTier = "intern" | "resident";
export type BillingPeriod = "monthly" | "yearly";

const PLAN_ENV: Record<PaidTier, Record<BillingPeriod, string>> = {
  intern: { monthly: "RAZORPAY_PLAN_ID_INTERN", yearly: "RAZORPAY_PLAN_ID_INTERN_YEARLY" },
  resident: { monthly: "RAZORPAY_PLAN_ID_RESIDENT", yearly: "RAZORPAY_PLAN_ID_RESIDENT_YEARLY" },
};

export function isPaidTier(value: unknown): value is PaidTier {
  return value === "intern" || value === "resident";
}

export function planIdFor(tier: PaidTier, period: BillingPeriod): string | null {
  return process.env[PLAN_ENV[tier][period]] || null;
}

// No true "forever" option in Razorpay (100-year max): a subscription ends by being cancelled, not by running out.
export const TOTAL_COUNT: Record<BillingPeriod, number> = { monthly: 1200, yearly: 100 };


/** The subset of Razorpay's subscription entity this app stores. */
export interface RazorpaySubscriptionEntity {
  id: string;
  plan_id: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  notes?: Record<string, string | number | null> | unknown[] | null;
}

function note(sub: RazorpaySubscriptionEntity, key: string): string | undefined {
  const notes = sub.notes;
  if (!notes || Array.isArray(notes)) return undefined;
  const value = notes[key];
  return value == null ? undefined : String(value);
}

export function subscriptionOwner(sub: RazorpaySubscriptionEntity): { userId?: string; tier?: string } {
  return { userId: note(sub, "userId"), tier: note(sub, "tier") };
}

/**
 * Saves Razorpay's current view of a subscription. Called by the webhook (the durable source of truth, which
 * also hears about renewals and cancellations) and right after checkout (so access starts at once, and so it
 * works on a laptop, where Razorpay's webhook can't reach localhost). Both write the same row, by subscription id.
 */
export async function saveSubscription(
  sub: RazorpaySubscriptionEntity
): Promise<{ error?: string; unattributed?: boolean }> {
  const { userId, tier } = subscriptionOwner(sub);
  if (!userId || !tier) return { error: `Subscription ${sub.id} has no userId/tier in notes`, unattributed: true };

  const { error } = await supabaseServer.from("subscriptions").upsert(
    {
      clerk_user_id: userId,
      razorpay_subscription_id: sub.id,
      razorpay_plan_id: sub.plan_id,
      tier,
      status: sub.status,
      current_start: sub.current_start ? new Date(sub.current_start * 1000).toISOString() : null,
      current_end: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "razorpay_subscription_id" }
  );
  return error ? { error: error.message } : {};
}

// ── Reading a student's current subscription ────────────────────────────────

/** Monthly or yearly, from which of the configured plans this is. */
export function periodOfPlan(planId: string): BillingPeriod {
  const yearly = [process.env.RAZORPAY_PLAN_ID_INTERN_YEARLY, process.env.RAZORPAY_PLAN_ID_RESIDENT_YEARLY];
  return yearly.includes(planId) ? "yearly" : "monthly";
}

/** The subscription that gives this student their plan now (the highest tier if, oddly, there are two). */
export async function currentSubscription(userId: string): Promise<SubscriptionRow | null> {
  // select * so this keeps working whether or not the cancel_at column has been added yet
  const { data, error } = await supabaseServer.from("subscriptions").select("*").eq("clerk_user_id", userId).in("status", HOLDING_STATUSES);
  if (error) throw error;
  const holding = ((data ?? []) as SubscriptionRow[]).filter((row) => stillHolds(row));
  return holding.sort((a, b) => (a.tier === "resident" ? -1 : b.tier === "resident" ? 1 : 0))[0] ?? null;
}
