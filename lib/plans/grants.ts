// Free plan time given outside Razorpay (table plan_grants, scripts/create_reviews_and_grants.sql). Today that is
// the reward for publishing cases, by milestone: 1 month of Resident at the 1st published case, 2 more at the 3rd and
// 3 more at the 5th (6 in all), each stacking after any time still running. Pure, so it is tested;
// lib/plans/server.ts reads the rows and admin actions write them.

import type { Plan } from "./limits";

export const CASE_REWARD = {
  tier: "resident" as const,
  /** Months given when an author's published cases reach `at`. The 1st, 3rd and 5th line up with the titles. */
  milestones: [
    { at: 1, months: 1 },
    { at: 3, months: 2 },
    { at: 5, months: 3 },
  ],
  capMonths: 6,
};

/** Months of Resident an author has earned in all with this many published cases. */
export function monthsEarned(published: number): number {
  const total = CASE_REWARD.milestones.filter((m) => published >= m.at).reduce((sum, m) => sum + m.months, 0);
  return Math.min(total, CASE_REWARD.capMonths);
}

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
 * The reward due now that the author has `published` cases: whatever their milestones have earned in all, less what
 * case rewards have already given them (so publishing again, or republishing a case, never gives twice, and authors
 * rewarded under the old one-month-per-case rule keep what they had). It starts when any free time still running ends
 * (or now). null when nothing is due.
 */
export function caseRewardWindow(
  existing: readonly GrantRow[],
  published: number,
  now = new Date()
): { months: number; startsAt: Date; endsAt: Date } | null {
  const given = existing.filter((g) => g.reason === "case_published").reduce((sum, g) => sum + g.months, 0);
  const months = monthsEarned(published) - given;
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
