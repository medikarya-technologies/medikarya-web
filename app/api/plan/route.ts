import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PLAN_LIMITS } from "@/lib/plans/limits";
import { getPlanStatus } from "@/lib/plans/server";

// The signed-in student's plan and today's usage, for the library's locks, the dashboard and the pricing page.
// The limits themselves are enforced when a case starts (app/api/cases/[id]/start), not here.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const status = await getPlanStatus(userId);
    const limits = PLAN_LIMITS[status.plan];
    // Infinity does not survive JSON; null means "no limit".
    const cap = (n: number) => (Number.isFinite(n) ? n : null);
    return NextResponse.json({
      ...status,
      limits: { maxDifficulty: limits.maxDifficulty, casesPerDay: cap(limits.casesPerDay), livePerDay: cap(limits.livePerDay), liveEver: cap(limits.liveEver) },
    });
  } catch (error) {
    console.error("Could not read plan status:", error);
    return NextResponse.json({ error: "Could not read your plan" }, { status: 503 });
  }
}
