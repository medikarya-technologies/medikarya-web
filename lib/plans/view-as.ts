import "server-only";

import { cookies } from "next/headers";
import type { Plan } from "./limits";

// "View as student": an admin can have the site treat them as a Student, Intern or Resident, to see exactly what
// those students see: the same locks, the same daily limits, enforced by the server, not just drawn. Stored in a
// cookie, which only counts for an admin (lib/plans/server.ts checks the role first), so a student setting it by
// hand gains nothing. Drafts stay visible to the admin either way.

export const VIEW_AS_COOKIE = "mk_view_as";

const PLANS: readonly Plan[] = ["student", "intern", "resident"];

export async function readViewAs(): Promise<Plan | null> {
  try {
    const value = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    return PLANS.includes(value as Plan) ? (value as Plan) : null;
  } catch {
    // Outside a request (no cookies to read): nobody is viewing as anything.
    return null;
  }
}
