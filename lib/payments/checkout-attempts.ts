import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

export type CheckoutAttemptOutcome = "started" | "failed" | "abandoned" | "paid";

const TABLE = "subscription_checkout_attempts";

export async function recordCheckoutStarted(input: {
  userId: string;
  subscriptionId: string;
  tier: "intern" | "resident";
  period: "monthly" | "yearly";
  couponCode: string | null;
}) {
  const { error } = await supabaseServer.from(TABLE).upsert(
    {
      clerk_user_id: input.userId,
      razorpay_subscription_id: input.subscriptionId,
      tier: input.tier,
      billing_period: input.period,
      coupon_code: input.couponCode,
      outcome: "started",
      failure_code: null,
      failure_description: null,
      payment_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "razorpay_subscription_id" }
  );
  if (error) throw error;
}

export async function reportCheckoutOutcome(input: {
  userId: string;
  subscriptionId: string;
  outcome: "failed" | "abandoned";
  failureCode?: string | null;
  failureDescription?: string | null;
}) {
  const clean = (value: string | null | undefined, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) || null : null;

  let update = supabaseServer
    .from(TABLE)
    .update({
      outcome: input.outcome,
      failure_code: input.outcome === "failed" ? clean(input.failureCode, 80) : null,
      failure_description: input.outcome === "failed" ? clean(input.failureDescription, 300) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("razorpay_subscription_id", input.subscriptionId)
    .eq("clerk_user_id", input.userId);

  // A close event must not overwrite a failure, and a late client callback must never downgrade a paid attempt.
  update = input.outcome === "abandoned" ? update.eq("outcome", "started") : update.neq("outcome", "paid");

  const { data, error } = await update.select("id").maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markCheckoutPaid(subscriptionId: string, paymentId?: string | null) {
  const { error } = await supabaseServer
    .from(TABLE)
    .update({
      outcome: "paid",
      failure_code: null,
      failure_description: null,
      ...(paymentId ? { payment_id: paymentId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("razorpay_subscription_id", subscriptionId);
  if (error) throw error;
}
