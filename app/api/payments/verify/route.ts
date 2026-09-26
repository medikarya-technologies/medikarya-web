import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing razorpay_order_id, razorpay_payment_id or razorpay_signature" }, { status: 400 });
    }

    const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(String(razorpay_signature), "utf8");
    const verified = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);

    if (!verified) {
      return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
    }

    return NextResponse.json({ verified: true, order_id: razorpay_order_id, payment_id: razorpay_payment_id });
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
