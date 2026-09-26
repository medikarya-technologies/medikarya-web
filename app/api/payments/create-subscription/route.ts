import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRazorpay } from "@/lib/razorpay";

// One Razorpay Plan per paid tier — created in the dashboard (Plans can't be edited once made),
// referenced here by id rather than re-deriving amounts, since the plan is the source of truth for price.
const PLAN_ID_BY_TIER: Record<string, string> = {
  intern: process.env.RAZORPAY_PLAN_ID_INTERN ?? "",
  resident: process.env.RAZORPAY_PLAN_ID_RESIDENT ?? "",
};

// No true "forever" option in Razorpay (100-year max) — a subscription is ended by cancelling it via
// the API when someone unsubscribes, not by running out of billing cycles. 100 years of monthly cycles.
const TOTAL_COUNT_MONTHLY = 1200;

export async function POST(request: NextRequest) {
  const razorpay = getRazorpay();
  if (!razorpay) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json();
    const { tier } = body;

    const planId = PLAN_ID_BY_TIER[tier];
    if (!planId) {
      return NextResponse.json({ error: `Unknown or unconfigured tier: ${tier}` }, { status: 400 });
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: TOTAL_COUNT_MONTHLY,
      notes: { userId, tier },
    });

    return NextResponse.json({ subscription_id: subscription.id });
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 401) {
      console.error("Razorpay auth failed — check RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET:", error);
      return NextResponse.json({ error: "Payment gateway authentication failed" }, { status: 401 });
    }
    console.error("Error creating Razorpay subscription:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
