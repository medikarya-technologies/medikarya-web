import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { currentSubscription, periodOfPlan } from "@/lib/payments/subscriptions";

// The student's current paid subscription, for the Plan & billing page: which, how it bills, when it renews or ends.
// null when they are on the free plan.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const sub = await currentSubscription(userId);
    if (!sub) return NextResponse.json({ subscription: null });
    return NextResponse.json({
      subscription: {
        tier: sub.tier,
        period: periodOfPlan(sub.razorpay_plan_id),
        status: sub.status,
        currentEnd: sub.current_end,
        cancelAt: sub.cancel_at ?? null,
      },
    });
  } catch (error) {
    console.error("Could not read subscription:", error);
    return NextResponse.json({ error: "Could not read your subscription" }, { status: 503 });
  }
}
