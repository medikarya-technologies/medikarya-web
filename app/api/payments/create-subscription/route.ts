import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRazorpay } from "@/lib/razorpay";
import { TOTAL_COUNT, currentSubscription, isPaidTier, planIdFor, type BillingPeriod } from "@/lib/payments/subscriptions";

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
    const period: BillingPeriod = body.period === "yearly" ? "yearly" : "monthly";

    if (!isPaidTier(tier)) {
      return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });
    }
    const planId = planIdFor(tier, period);
    if (!planId) {
      return NextResponse.json({ error: `No ${period} plan is configured for ${tier}` }, { status: 400 });
    }

    // One plan at a time: a second checkout while one is live would bill the student twice.
    // (Changing plan is not built yet; it needs Razorpay's update-subscription flow.)
    const holding = await currentSubscription(userId);
    if (holding) {
      return NextResponse.json(
        { error: `You already have an active ${holding.tier === "resident" ? "Resident" : "Intern"} plan.` },
        { status: 409 }
      );
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: TOTAL_COUNT[period],
      notes: { userId, tier, period },
    });

    // The key id is public; sending the one the subscription was made with keeps checkout on the same key.
    return NextResponse.json({ subscription_id: subscription.id, key_id: process.env.RAZORPAY_KEY_ID });
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
