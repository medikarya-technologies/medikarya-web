"use server"

// What someone with an advisor link can do (no account: the link's token is the permission). Saying who they are
// puts the token in a cookie on their browser, and that cookie is what opens the invited cases (lib/advisors/invites.ts).

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { INVITE_COOKIE, inviteForToken, inviteOpen, saveDetails, saveFeedback, type AdvisorDetails } from "@/lib/advisors/invites"

export type AdvisorResult = { ok: true } | { ok: false; error: string }

export async function enterAdvisorLink(token: string, details: AdvisorDetails): Promise<AdvisorResult> {
  try {
    const problem = await saveDetails(token, details)
    if (problem) return { ok: false, error: problem }
    const invite = await inviteForToken(token)
    if (!invite || !inviteOpen(invite)) return { ok: false, error: "This link is not valid." }
    ;(await cookies()).set(INVITE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(invite.expires_at),
    })
    revalidatePath(`/advisor/${token}`)
    return { ok: true }
  } catch (error) {
    console.error("Could not open advisor link:", error)
    return { ok: false, error: "Something went wrong. Please try again." }
  }
}

export async function sendAdvisorFeedback(token: string, feedback: string): Promise<AdvisorResult> {
  try {
    const problem = await saveFeedback(token, feedback)
    if (problem) return { ok: false, error: problem }
    return { ok: true }
  } catch (error) {
    console.error("Could not save advisor feedback:", error)
    return { ok: false, error: "Something went wrong saving your feedback. Please try again." }
  }
}
