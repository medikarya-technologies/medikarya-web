import "server-only";

import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";
import { WELCOMED_COOKIE, sendToFirstCase } from "./first-case";

/**
 * Whether this dashboard visit should go to the first patient instead (see first-case.ts). Anything that goes wrong
 * means no: the dashboard is never held up by it. Once the cookie is set it costs nothing.
 */
export async function isBrandNewVisit(): Promise<boolean> {
  try {
    if ((await cookies()).get(WELCOMED_COOKIE)) return false;
    const { userId } = await auth();
    if (!userId) return false;
    const [starts, attempts, profile] = await Promise.all([
      supabaseServer.from("case_starts").select("case_id", { count: "exact", head: true }).eq("clerk_user_id", userId),
      supabaseServer.from("case_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseServer.from("user_profiles").select("role").eq("clerk_user_id", userId).maybeSingle(),
    ]);
    // a failed count is not a zero
    if (starts.error || attempts.error || starts.count === null || attempts.count === null) return false;
    return sendToFirstCase({ welcomed: false, admin: profile.data?.role === "admin", starts: starts.count, attempts: attempts.count });
  } catch {
    return false;
  }
}
