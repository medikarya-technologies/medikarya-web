import "server-only";

import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";
import { GUEST_COOKIE, GUEST_ID, claimable, guestOwner } from "./guest-claim";

/**
 * The id a guest's attempt is filed under (see guest-claim.ts). The server's cookie wins; a first-time guest keeps the
 * id their browser made, unless plays are already filed under it (then someone is naming another person's id, so they
 * get a fresh one). Sets the cookie, so call it only where cookies can be set (a server action or route).
 */
export async function guestIdForSave(browserId: string | undefined): Promise<string> {
  const jar = await cookies();
  const kept = jar.get(GUEST_COOKIE)?.value;
  if (kept && GUEST_ID.test(kept)) return kept;

  let id = crypto.randomUUID();
  if (browserId && GUEST_ID.test(browserId)) {
    const { count, error } = await supabaseServer
      .from("case_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", guestOwner(browserId));
    if (!error && count === 0) id = browserId;
  }
  try {
    jar.set(GUEST_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  } catch {
    /* not settable here: the play is still saved, it just cannot follow them into an account */
  }
  return id;
}

/**
 * Moves this browser's recent guest plays onto the signed-in account. Run on the dashboard before the first-patient
 * check, so a guest who just played the free case is not sent to it again. Costs one count once the plays are moved;
 * anything that goes wrong leaves the plays where they were and the dashboard as it was.
 */
export async function claimGuestAttempts(): Promise<number> {
  try {
    const guestId = (await cookies()).get(GUEST_COOKIE)?.value;
    if (!guestId || !GUEST_ID.test(guestId)) return 0;
    const { userId } = await auth();
    if (!userId) return 0;

    const { data: plays, error } = await supabaseServer
      .from("case_attempts")
      .select("id, created_at")
      .eq("user_id", guestOwner(guestId));
    if (error || !plays?.length) return 0;

    const user = await currentUser();
    if (!user?.createdAt) return 0;
    const ids = plays.filter((p) => claimable(p.created_at, user.createdAt)).map((p) => p.id);
    if (!ids.length) return 0;

    const { error: moveError } = await supabaseServer
      .from("case_attempts")
      .update({ user_id: userId })
      .in("id", ids)
      .eq("user_id", guestOwner(guestId)); // a play already moved by a second tab is left alone
    if (moveError) return 0;
    return ids.length;
  } catch {
    return 0;
  }
}
