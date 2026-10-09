import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { currentSubscription } from "@/lib/payments/subscriptions";
import { decide, higherPlan, indiaDay, type CaseKind, type Decision, type Plan } from "./limits";
import { activeGrant, type ActiveGrant, type GrantRow } from "./grants";
import { readViewAs } from "./view-as";

export { caseKindOf as caseKind } from "./limits";

// The student's plan and today's usage, from the database, for lib/plans/limits.ts to decide on.

export interface PlanStatus {
  plan: Plan;
  /** Admins are never limited (they test and review cases), unless they are viewing as a student plan. */
  admin: boolean;
  /** The account really is an admin (true even while viewing as a student plan). */
  realAdmin: boolean;
  /** An admin viewing the site as this plan ("View as student"): limits apply to them as to that student. */
  viewingAs: Plan | null;
  casesToday: number;
  liveToday: number;
  liveEver: number;
  /** Case ids opened today; opening one of these again is free. */
  openedToday: string[];
  /** Free plan time (a reward for a published case, a workshop pass) that is giving this plan, and when it ends. */
  grant: ActiveGrant | null;
}

/** Free plan time given to this email (plan_grants). Missing table or a failed read = none: never blocks a case. */
export async function grantsFor(email: string | null | undefined): Promise<GrantRow[]> {
  if (!email) return [];
  const { data, error } = await supabaseServer.from("plan_grants").select("tier, months, starts_at, ends_at, reason").eq("email", email.toLowerCase());
  if (error) {
    console.error("Could not read plan grants:", error.message);
    return [];
  }
  return (data ?? []) as GrantRow[];
}

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const today = indiaDay();
  const [subscription, profile, startsToday, liveEver] = await Promise.all([
    currentSubscription(userId),
    supabaseServer.from("user_profiles").select("role, email").eq("clerk_user_id", userId).maybeSingle(),
    supabaseServer.from("case_starts").select("case_id, live").eq("clerk_user_id", userId).eq("day", today),
    supabaseServer.from("case_starts").select("id", { count: "exact", head: true }).eq("clerk_user_id", userId).eq("live", true),
  ]);
  const failed = startsToday.error ?? liveEver.error;
  if (failed) throw failed;

  const tier = subscription?.tier;
  const paid: Plan = tier === "intern" || tier === "resident" ? tier : "student";
  // A paid subscription and free plan time can overlap; the better of the two applies.
  const grant = activeGrant(await grantsFor(profile.data?.email));
  const realAdmin = profile.data?.role === "admin";
  // Only an admin's cookie counts; anyone else's is ignored.
  const viewingAs = realAdmin ? await readViewAs() : null;
  const plan = viewingAs ?? (grant ? higherPlan(paid, grant.plan) : paid);

  const rows = startsToday.data ?? [];
  return {
    plan,
    admin: realAdmin && !viewingAs,
    realAdmin,
    viewingAs,
    casesToday: rows.filter((r) => !r.live).length,
    liveToday: rows.filter((r) => r.live).length,
    liveEver: liveEver.count ?? 0,
    openedToday: rows.map((r) => r.case_id),
    // while viewing as a plan, the admin's own free time would only confuse what they are looking at
    grant: viewingAs ? null : grant,
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
