import "server-only"

import { currentUser } from "@clerk/nextjs/server"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * The email a signed-in account's plan is read by (lib/plans/server.ts): the one on its MediKarya profile, or, for an
 * account so new it has no profile yet, the first email on its sign-in (the profile is made from that same one).
 * Only ever called with the session's own user id.
 */
export async function accountEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseServer.from("user_profiles").select("email").eq("clerk_user_id", userId).maybeSingle()
  if (data?.email) return String(data.email).toLowerCase()
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? null
}
