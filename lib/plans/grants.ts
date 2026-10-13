// Free plan time given outside Razorpay (table plan_grants, scripts/create_reviews_and_grants.sql): the reward for
// publishing cases, by milestone (1 month of Intern at the 1st published case, 2 months of Resident at the 5th), and
// workshop passes (lib/plans/passes.ts). Pure, so it is tested; lib/plans/server.ts reads the rows and admin actions
// write them.

import type { Plan } from "./limits";
import { PASS_REASON_PREFIX } from "./passes";

type Tier = "intern" | "resident";

/**
 * What a writer gets when their published cases reach `at`; the 1st and 5th line up with the first two titles. Must
 * stay the same as FREE_PLAN_MILESTONES in the Case Studio's lib/rewards/config.ts, which shows it to writers.
 */
export const CASE_REWARD: { milestones: ReadonlyArray<{ at: number; tier: Tier; months: number }> } = {
  milestones: [
    { at: 1, tier: "intern", months: 1 },
    { at: 5, tier: "resident", months: 2 },
  ],
};

/** The next milestone after this many published cases, or null after the last. */
export const nextCaseReward = (published: number) => CASE_REWARD.milestones.find((m) => m.at > published) ?? null;

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

export interface CaseReward {
  at: number;
  tier: Tier;
  months: number;
  startsAt: Date;
  endsAt: Date;
}

/**
 * The milestone rewards due now that the author has `published` cases: those reached, less those already given. Each
 * milestone is one case_published grant, so publishing again or republishing a case never gives twice. Each starts
 * when the free time it would only overlap ends: Resident after Resident still running; Intern after any Intern or
 * Resident still running (under Resident it would be wasted). Usually one, empty when nothing is due.
 */
export function caseRewardsDue(existing: readonly GrantRow[], published: number, now = new Date()): CaseReward[] {
  const given = existing.filter((g) => g.reason === "case_published").length;
  const due = CASE_REWARD.milestones.filter((m) => published >= m.at).slice(given);
  const running = existing.map((g) => ({ tier: g.tier, end: new Date(g.ends_at) })).filter((r) => r.end > now);
  const out: CaseReward[] = [];
  for (const m of due) {
    const overlaps = running.filter((r) => r.tier === "resident" || (m.tier === "intern" && r.tier === "intern")).map((r) => r.end.getTime());
    const startsAt = overlaps.length ? new Date(Math.max(...overlaps)) : now;
    const reward = { ...m, startsAt, endsAt: addMonths(startsAt, m.months) };
    out.push(reward);
    running.push({ tier: m.tier, end: reward.endsAt });
  }
  return out;
}

export interface ActiveGrant {
  plan: Plan;
  endsAt: string;
  /** Why the student has it, for the line under their plan: a published case, a workshop pass, or anything else. */
  from: "case" | "pass" | "other";
  /** The workshop, when it is a pass. */
  pass: string | null;
}

/** The best plan any grant gives right now, and until when (the latest end among grants of that plan). */
export function activeGrant(grants: readonly GrantRow[], now = new Date()): ActiveGrant | null {
  const live = grants.filter((g) => (g.tier === "intern" || g.tier === "resident") && new Date(g.starts_at) <= now && new Date(g.ends_at) > now);
  if (live.length === 0) return null;
  const plan: Plan = live.some((g) => g.tier === "resident") ? "resident" : "intern";
  // Stacked grants run back to back, so the plan lasts until the last of them ends.
  const ends = grants.filter((g) => g.tier === plan && new Date(g.ends_at) > now).map((g) => g.ends_at).sort();
  const giving = live.filter((g) => g.tier === plan);
  const pass = giving.find((g) => g.reason.startsWith(PASS_REASON_PREFIX));
  const from = giving.some((g) => g.reason === "case_published") ? "case" : pass ? "pass" : "other";
  return { plan, endsAt: ends[ends.length - 1], from, pass: from === "pass" && pass ? pass.reason.slice(PASS_REASON_PREFIX.length) : null };
}
