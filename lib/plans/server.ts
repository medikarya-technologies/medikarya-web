import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { currentSubscription } from "@/lib/payments/subscriptions";
import { decide, indiaDay, type CaseKind, type Decision, type Plan } from "./limits";

export { caseKindOf as caseKind } from "./limits";

// The student's plan and today's usage, from the database, for lib/plans/limits.ts to decide on.

export interface PlanStatus {
  plan: Plan;
  /** Admins are never limited (they test and review cases). */
  admin: boolean;
  casesToday: number;
  liveToday: number;
  liveEver: number;
  /** Case ids opened today; opening one of these again is free. */
  openedToday: string[];
}

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const today = indiaDay();
  const [subscription, profile, startsToday, liveEver] = await Promise.all([
    currentSubscription(userId),
    supabaseServer.from("user_profiles").select("role").eq("clerk_user_id", userId).maybeSingle(),
    supabaseServer.from("case_starts").select("case_id, live").eq("clerk_user_id", userId).eq("day", today),
    supabaseServer.from("case_starts").select("id", { count: "exact", head: true }).eq("clerk_user_id", userId).eq("live", true),
  ]);
  const failed = startsToday.error ?? liveEver.error;
  if (failed) throw failed;

  const tier = subscription?.tier;
  const plan: Plan = tier === "intern" || tier === "resident" ? tier : "student";

  const rows = startsToday.data ?? [];
  return {
    plan,
    admin: profile.data?.role === "admin",
    casesToday: rows.filter((r) => !r.live).length,
    liveToday: rows.filter((r) => r.live).length,
    liveEver: liveEver.count ?? 0,
    openedToday: rows.map((r) => r.case_id),
  };
}

/** Decides whether this student may open this case now and, if so, counts it. */
export async function admitCaseStart(userId: string, caseId: string, kind: CaseKind): Promise<Decision> {
  const status = await getPlanStatus(userId);
  const decision: Decision = status.admin
    ? { ok: true }
    : decide(status.plan, kind, { ...status, openedToday: status.openedToday.includes(caseId) });
  if (!decision.ok) return decision;

  // ignoreDuplicates: a second open of the same case the same day is a no-op, not an error.
  const { error } = await supabaseServer
    .from("case_starts")
    .upsert({ clerk_user_id: userId, case_id: caseId, live: kind.live, day: indiaDay() }, { onConflict: "clerk_user_id,case_id,day", ignoreDuplicates: true });
  if (error) throw error;
  return decision;
}
