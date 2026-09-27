import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRazorpay } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  const razorpay = getRazorpay();
  if (!razorpay) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  try {
    // Allow both authenticated and guest checkout — the order itself is what needs paying for.
    let userId: string | null = null;
    try {
      userId = (await auth()).userId;
    } catch {
      // Guest access — no session
    }

    const body = await request.json();
    const { amount, currency = "INR", receipt } = body;

    if (!Number.isInteger(amount) || amount < 100) {
      return NextResponse.json({ error: "amount must be an integer number of paise, at least 100 (₹1)" }, { status: 400 });
    }

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: receipt ?? `receipt_${Date.now()}`,
      notes: userId ? { userId } : undefined,
    });

    // The key id is public (checkout needs it in the browser). Sending the one this order was made with means
    // the modal can never open with a different key than the server's, e.g. after the keys are regenerated.
    return NextResponse.json({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 401) {
      console.error("Razorpay auth failed — check RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET:", error);
      return NextResponse.json({ error: "Payment gateway authentication failed" }, { status: 401 });
    }
    console.error("Error creating Razorpay order:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
