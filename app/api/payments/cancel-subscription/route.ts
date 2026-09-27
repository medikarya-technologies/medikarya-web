import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRazorpay } from "@/lib/razorpay";
import { supabaseServer } from "@/lib/supabase/server";
import { currentSubscription } from "@/lib/payments/subscriptions";

// Cancels the student's subscription at the end of the period they have paid for: no further charges, and the plan
// stays until then (Razorpay keeps it "active" and marks it cancelled at that date). cancel_at records the date,
// so the plan stops then even if Razorpay's webhook is missed.
export async function POST() {
  const razorpay = getRazorpay();
  if (!razorpay) return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const sub = await currentSubscription(userId);
    if (!sub) return NextResponse.json({ error: "You have no active plan to cancel." }, { status: 404 });
    if (sub.cancel_at) return NextResponse.json({ cancelAt: sub.cancel_at });

    let cancelAt: string;
    try {
      const updated = (await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, true)) as unknown as {
        status: string;
        change_scheduled_at?: number | null;
        current_end?: number | null;
        ended_at?: number | null;
      };
      const at = updated.change_scheduled_at ?? updated.current_end ?? updated.ended_at;
      cancelAt = at ? new Date(at * 1000).toISOString() : new Date().toISOString();
    } catch (error) {
      // Razorpay refuses cancel-at-cycle-end (400) in the last billing cycle and for a subscription that never got
      // a billing cycle going; only then cancel now. Anything else (a network error) must not cost the student the
      // rest of a period they paid for, so it fails instead.
      if ((error as { statusCode?: number })?.statusCode !== 400) throw error;
      console.warn("Cancel at cycle end refused, cancelling now:", error);
      await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, false);
      cancelAt = new Date().toISOString();
    }

    const { error } = await supabaseServer
      .from("subscriptions")
      .update({ cancel_at: cancelAt, updated_at: new Date().toISOString() })
      .eq("razorpay_subscription_id", sub.razorpay_subscription_id);
    if (error) {
      // Razorpay has it cancelled either way; the webhook will record the end. Say so rather than fail.
      console.error("Cancelled at Razorpay but could not record cancel_at (has add_subscription_cancel_at.sql run?):", error);
    }

    return NextResponse.json({ cancelAt });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return NextResponse.json({ error: "We could not cancel just now. Please try again, or contact support." }, { status: 500 });
  }
}
