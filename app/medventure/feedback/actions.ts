"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { cleanFeedback } from "@/lib/events/feedback"
import { medventureParticipant } from "@/lib/events/medventure"
import { saveMedventureFeedback } from "@/lib/events/medventure-feedback"

/** Saves the signed-in participant's feedback. The account comes from the session, never from the browser. */
export async function sendMedventureFeedbackAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { userId } = await auth()
    const participant = await medventureParticipant(userId)
    if (!participant) return { ok: false, error: "Sign in with the account you joined Medventure with." }
    const checked = cleanFeedback(input)
    if (!checked.ok) return checked
    await saveMedventureFeedback(participant.userId, participant.email, checked.feedback)
    revalidatePath("/medventure/admin/feedback")
    return { ok: true }
  } catch (error) {
    console.error("Could not save Medventure feedback:", error)
    return { ok: false, error: "That did not send. Check your connection and try again." }
  }
}
