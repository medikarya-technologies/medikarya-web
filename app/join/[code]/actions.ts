"use server"

// Joining a workshop through its link (medikarya.in/join/<code>). The account is read from the session, never from
// what the browser sends.

import { auth } from "@clerk/nextjs/server"
import { accountEmail } from "@/lib/plans/account-email"
import { joinWithLink, type JoinResult } from "@/lib/plans/join-links"
import { cleanJoinCode } from "@/lib/plans/passes"

export async function joinWorkshopAction(rawCode: string): Promise<JoinResult> {
  try {
    const { userId } = await auth()
    if (!userId) return { ok: false, state: "missing", error: "Sign in first, then tap Join." }
    const code = cleanJoinCode(rawCode)
    if (!code) return { ok: false, state: "missing", error: "There is no workshop link like this one." }
    const email = await accountEmail(userId)
    if (!email) return { ok: false, state: "missing", error: "Your account has no email address, so the pass cannot be added. Ask the organisers for help." }
    return await joinWithLink(code, userId, email)
  } catch (error) {
    console.error("Could not join a workshop:", error)
    return { ok: false, state: "missing", error: "Something went wrong. Please try again in a moment." }
  }
}
