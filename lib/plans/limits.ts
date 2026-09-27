// What each plan lets a student open, as the pricing page states it. Pure: the server (lib/plans/server.ts) reads
// the student's plan and today's usage from the database, and this decides; the library uses the same rules to
// show which cases are locked.
//
//   Student (free)  Beginner cases, 2 a day; one live case, once ever
//   Intern          Beginner + Intermediate, 15 a day; 5 live cases a day
//   Resident        everything, unlimited; 10 live cases a day
//
// Live cases (the real-time simulations) are counted against the live allowance, not the case allowance, and are
// not gated by difficulty: a live case is the thing each plan buys a number of, whatever its difficulty.
// A "day" is the calendar day in India. A case counts once per day however often it is opened, resumed or retried.

import { difficultyLevel } from "../library/case-library";

export type Plan = "student" | "intern" | "resident";

/** The case a visitor can play without an account (/try). Free for everyone, and never counted against a plan. */
export const GUEST_CASE_IDS: readonly string[] = ["viral-gastroenteritis"];

export interface PlanLimits {
  /** Highest difficulty level (1 Beginner, 2 Intermediate, 3 Advanced) a normal case can have. */
  maxDifficulty: 1 | 2 | 3;
  casesPerDay: number;
  livePerDay: number;
  /** Live cases over the whole life of the account; only the free plan has a cap. */
  liveEver: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  student: { maxDifficulty: 1, casesPerDay: 2, livePerDay: 0, liveEver: 1 },
  intern: { maxDifficulty: 2, casesPerDay: 15, livePerDay: 5, liveEver: Infinity },
  resident: { maxDifficulty: 3, casesPerDay: Infinity, livePerDay: 10, liveEver: Infinity },
};

export const PLAN_NAME: Record<Plan, string> = { student: "Student", intern: "Intern", resident: "Resident" };

const ORDER: Plan[] = ["student", "intern", "resident"];

export function higherPlan(a: Plan, b: Plan): Plan {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

export interface CaseKind {
  live: boolean;
  /** 1 Beginner, 2 Intermediate, 3 Advanced. */
  difficulty: 1 | 2 | 3;
}

export interface Usage {
  /** Distinct normal cases opened today. */
  casesToday: number;
  /** Distinct live cases opened today. */
  liveToday: number;
  /** Distinct live cases ever opened (per day), for the free plan's one-time live case. */
  liveEver: number;
  /** This case was already opened today, so opening it again costs nothing. */
  openedToday: boolean;
}

export type Decision =
  | { ok: true }
  | { ok: false; reason: "locked"; needs: Plan }
  | { ok: false; reason: "cases_today" | "live_today" | "live_trial_used"; limit: number; needs?: Plan };

/**
 * A full case (as getCaseById returns it) as the limits see it. Live = authored deterioration rules. Not
 * isSimulationCase(): getCaseById adapts every classic case onto the bedside engine, which gives it the same
 * fields, just empty (see lib/simulation/legacy-adapter.ts).
 */
export function caseKindOf(caseData: { difficulty?: string; event_rules?: unknown; live?: unknown; briefingOnly?: unknown }): CaseKind {
  // The briefing-only copy (lib/plans/access.ts) has its rules taken out, and says whether it is live instead.
  const live = caseData.briefingOnly === true ? caseData.live === true : Array.isArray(caseData.event_rules) && caseData.event_rules.length > 0;
  return { live, difficulty: difficultyLevel(caseData.difficulty) };
}

/** The cheapest plan whose normal-case access reaches this difficulty. */
function planFor(difficulty: 1 | 2 | 3): Plan {
  return ORDER.find((p) => PLAN_LIMITS[p].maxDifficulty >= difficulty) ?? "resident";
}

function next(plan: Plan): Plan | undefined {
  return ORDER[ORDER.indexOf(plan) + 1];
}

/** May this student open this case now? */
// Opening a case again the same day skips the daily COUNT, never the plan itself: a case opened today as an
// Intern stays locked if the plan lapses to Student later that day.
export function decide(plan: Plan, kind: CaseKind, usage: Usage): Decision {
  const limits = PLAN_LIMITS[plan];

  if (kind.live) {
    if (plan === "student") {
      // The one free live case may be resumed the day it was opened; any other live case is not in the plan.
      const resumingTrial = usage.openedToday && usage.liveEver <= limits.liveEver;
      if (!resumingTrial && usage.liveEver >= limits.liveEver) {
        return { ok: false, reason: "live_trial_used", limit: limits.liveEver, needs: "intern" };
      }
      return { ok: true };
    }
    if (!usage.openedToday && usage.liveToday >= limits.livePerDay) {
      return { ok: false, reason: "live_today", limit: limits.livePerDay, needs: next(plan) };
    }
    return { ok: true };
  }

  if (kind.difficulty > limits.maxDifficulty) return { ok: false, reason: "locked", needs: planFor(kind.difficulty) };
  if (usage.openedToday) return { ok: true };
  if (usage.casesToday >= limits.casesPerDay) {
    return { ok: false, reason: "cases_today", limit: limits.casesPerDay, needs: next(plan) };
  }
  return { ok: true };
}

/** For the library: the plan a case needs, if this student's plan can never open it (daily limits aside). */
export function lockedFor(plan: Plan, kind: CaseKind, liveEver: number): Plan | null {
  if (kind.live) return liveEver >= PLAN_LIMITS[plan].liveEver ? "intern" : null;
  return kind.difficulty > PLAN_LIMITS[plan].maxDifficulty ? planFor(kind.difficulty) : null;
}

/** What to tell the student when a case will not open. */
export function explain(decision: Exclude<Decision, { ok: true }>): string {
  const upgrade = decision.needs ? ` Upgrade to ${PLAN_NAME[decision.needs]} for more.` : "";
  switch (decision.reason) {
    case "locked":
      return `This case is part of the ${PLAN_NAME[decision.needs]} plan.`;
    case "cases_today":
      return `You have opened all ${decision.limit} of today's cases. More open tomorrow.${upgrade}`;
    case "live_today":
      return `You have used all ${decision.limit} of today's live cases. More open tomorrow.${upgrade}`;
    case "live_trial_used":
      return "You have had your free live case. Live cases are part of the Intern and Resident plans.";
  }
}

/** The calendar day in India, as YYYY-MM-DD. */
export function indiaDay(at: Date = new Date()): string {
  return new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
