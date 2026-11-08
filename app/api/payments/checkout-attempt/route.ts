import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { reportCheckoutOutcome } from "@/lib/payments/checkout-attempts";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const body = await request.json();
    const subscriptionId = typeof body.subscriptionId === "string" ? body.subscriptionId.trim() : "";
    const outcome = body.outcome;

    if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId) || (outcome !== "failed" && outcome !== "abandoned")) {
      return NextResponse.json({ error: "Invalid checkout outcome" }, { status: 400 });
    }

    const recorded = await reportCheckoutOutcome({
      userId,
      subscriptionId,
      outcome,
      failureCode: typeof body.failureCode === "string" ? body.failureCode : null,
      failureDescription: typeof body.failureDescription === "string" ? body.failureDescription : null,
    });
    return NextResponse.json({ recorded });
  } catch (error) {
    console.error("Could not record subscription checkout outcome:", error);
    return NextResponse.json({ error: "Could not record checkout outcome" }, { status: 500 });
  }
}
