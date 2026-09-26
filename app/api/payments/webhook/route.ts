import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";
import { supabaseServer } from "@/lib/supabase/server";

// Razorpay's subscription lifecycle, delivered here — this is what actually marks a user's access as
// active, not the checkout success screen (a payment can succeed client-side and the tab close before
// the app ever hears about it; the webhook is the durable source of truth). Events this cares about all
// carry payload.subscription.entity; the rest (invoice.*, payment.* on their own) are ignored.
const RELEVANT_EVENTS = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.completed",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.paused",
  "subscription.resumed",
  "subscription.updated",
]);

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not set — refusing to process webhooks unverified.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Signature verification needs the exact raw bytes Razorpay signed — request.json() would
  // re-serialize and could differ (key order, whitespace), silently breaking every signature.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !validateWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody);

    if (!RELEVANT_EVENTS.has(event.event) || !event.payload?.subscription?.entity) {
      return NextResponse.json({ received: true, ignored: event.event });
    }

    const sub = event.payload.subscription.entity;
    const userId = sub.notes?.userId;
    const tier = sub.notes?.tier;

    if (!userId || !tier) {
      console.error(`Subscription ${sub.id} has no userId/tier in notes — cannot attribute it to a user.`);
      return NextResponse.json({ received: true, error: "Missing notes.userId/tier" });
    }

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

    if (error) {
      console.error("Failed to upsert subscription:", error);
      return NextResponse.json({ error: "Database write failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Razorpay webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
