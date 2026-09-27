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
    tagline: "A simple way to experience MediKarya.",
    monthly: 0,
    yearly: 0,
    features: ["2 cases a day, Beginner difficulty", "One live emergency case, on us — try it once", "No account needed"],
  },
  intern: {
    plan: "intern",
    name: "Intern",
    sub: "Basic",
    tagline: "For regular clinical reasoning practice.",
    monthly: 199,
    yearly: 1999,
    features: ["Beginner & Intermediate cases, 15 a day", "5 live emergency cases a day", "AI patient conversations", "Diagnosis, management & debrief", "Progress tracking"],
  },
  resident: {
    plan: "resident",
    name: "Resident",
    sub: "Pro",
    tagline: "For deeper simulation and advanced clinical scenarios.",
    monthly: 399,
    yearly: 3999,
    features: ["Everything in Intern", "All cases, including Advanced — unlimited a day", "10 live emergency cases a day", "Real-time vitals & telemetry", "Advanced performance analytics"],
  },
};

export const PAID_PLANS = [PLAN_OFFERS.intern, PLAN_OFFERS.resident] as const;

export function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
