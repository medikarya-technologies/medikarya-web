// Free plan time given outside Razorpay (table plan_grants, scripts/create_reviews_and_grants.sql). Today that is
// the reward for a published case: 1 month of Resident per case, stacking after any time still running, up to 6
// months in all from case rewards. Pure, so it is tested; lib/plans/server.ts reads the rows and admin actions
// write them.

import type { Plan } from "./limits";

export const CASE_REWARD = { tier: "resident" as const, monthsPerCase: 1, capMonths: 6 };

export interface GrantRow {
  tier: string;
  months: number;
  starts_at: string;
  ends_at: string;
  reason: string;
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

/**
 * The window a new case reward would cover: it starts when any free time still running ends (or now), and is
 * trimmed so case rewards never add up to more than the cap. null once the cap is reached.
 */
export function caseRewardWindow(existing: readonly GrantRow[], now = new Date()): { months: number; startsAt: Date; endsAt: Date } | null {
  const given = existing.filter((g) => g.reason === "case_published").reduce((sum, g) => sum + g.months, 0);
  const months = Math.min(CASE_REWARD.monthsPerCase, CASE_REWARD.capMonths - given);
  if (months <= 0) return null;
  const running = existing.map((g) => new Date(g.ends_at)).filter((d) => d > now);
  const startsAt = running.length ? new Date(Math.max(...running.map((d) => d.getTime()))) : now;
  return { months, startsAt, endsAt: addMonths(startsAt, months) };
}

/** The best plan any grant gives right now, and until when (the latest end among grants of that plan). */
export function activeGrant(grants: readonly GrantRow[], now = new Date()): { plan: Plan; endsAt: string } | null {
  const live = grants.filter((g) => (g.tier === "intern" || g.tier === "resident") && new Date(g.starts_at) <= now && new Date(g.ends_at) > now);
  if (live.length === 0) return null;
  const plan: Plan = live.some((g) => g.tier === "resident") ? "resident" : "intern";
  // Stacked grants run back to back, so the plan lasts until the last of them ends.
  const ends = grants.filter((g) => g.tier === plan && new Date(g.ends_at) > now).map((g) => g.ends_at).sort();
  return { plan, endsAt: ends[ends.length - 1] };
}
