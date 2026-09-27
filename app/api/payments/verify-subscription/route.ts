import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { getRazorpay } from "@/lib/razorpay";
import { saveSubscription, subscriptionOwner, type RazorpaySubscriptionEntity } from "@/lib/payments/subscriptions";

// Runs when subscription checkout reports success. For a subscription Razorpay signs payment_id|subscription_id
// (not order_id, as for a one-time payment). Once the signature holds, it reads the subscription back from
// Razorpay (the client's word is not enough for the status) and saves it, so the plan shows at once.
export async function POST(request: NextRequest) {
  const razorpay = getRazorpay();
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!razorpay || !secret) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await request.json();
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing razorpay_payment_id, razorpay_subscription_id or razorpay_signature" },
        { status: 400 }
      );
    }

    const expected = createHmac("sha256", secret).update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(String(razorpay_signature), "utf8");
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
    }

    const sub = (await razorpay.subscriptions.fetch(razorpay_subscription_id)) as unknown as RazorpaySubscriptionEntity;
    const owner = subscriptionOwner(sub);
    if (owner.userId !== userId) {
      return NextResponse.json({ error: "This subscription belongs to a different account" }, { status: 403 });
    }

    const { error } = await saveSubscription(sub);
    if (error) {
      // The payment itself went through; the webhook will save it too, so say so rather than failing the student.
      console.error("Verified subscription could not be saved:", error);
      return NextResponse.json({ verified: true, saved: false, status: sub.status, tier: owner.tier });
    }

    return NextResponse.json({ verified: true, saved: true, status: sub.status, tier: owner.tier });
  } catch (error) {
    console.error("Error verifying Razorpay subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
