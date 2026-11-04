// What each plan costs and what it includes, in words: one place for the landing page's pricing section and the
// in-app upgrade dialog. The numbers here must match lib/plans/limits.ts (what is enforced) and the Razorpay plans
// (what is charged); the annual price is about 16% under twelve months.

import type { Plan } from "./limits";

export interface PlanOffer {
  plan: Plan;
  name: string;
  /** The familiar word for a first-time visitor. */
  sub: string;
  tagline: string;
  /** Rupees. */
  monthly: number;
  yearly: number;
  features: readonly string[];
}

export const PLAN_OFFERS: Record<Plan, PlanOffer> = {
  student: {
    plan: "student",
    name: "Student",
    sub: "Free",
    tagline: "The full case experience, at a gentler pace.",
    monthly: 0,
    yearly: 0,
    features: ["2 cases a day, Beginner difficulty", "History, examination, tests, diagnosis and the full debrief on every case", "One live emergency case, free to try", "One case to try without an account"],
  },
  intern: {
    plan: "intern",
    name: "Intern",
    sub: "Basic",
    tagline: "For students who want to practise most days.",
    monthly: 199,
    yearly: 1999,
    features: ["Everything in Student", "Beginner and Intermediate cases, 15 a day", "5 live emergency cases a day"],
  },
  resident: {
    plan: "resident",
    name: "Resident",
    sub: "Pro",
    tagline: "For students who want every case, including Advanced.",
    monthly: 399,
    yearly: 3999,
    features: ["Everything in Intern", "All cases including Advanced, with no daily limit", "10 live emergency cases a day"],
  },
};

export const PAID_PLANS = [PLAN_OFFERS.intern, PLAN_OFFERS.resident] as const;

export function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
