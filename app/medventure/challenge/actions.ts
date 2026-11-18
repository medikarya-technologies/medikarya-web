"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { currentPathwayState, pointsForAnswer, type RoundOneState } from "@/lib/events/pathways"
import { roundOneAttemptInRoom } from "@/lib/events/medventure-attempts"
import { startedBeforeRoom } from "@/lib/events/room-clock"
import { medventureParticipant, medventurePathways, medventureRoom, MEDVENTURE } from "@/lib/events/medventure"
import { supabaseServer } from "@/lib/supabase/server"
import { medventureResults } from "@/lib/events/medventure-results"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function player() {
  const { userId } = await auth()
  const participant = await medventureParticipant(userId)
  const { room } = await medventureRoom()
  if (!participant) throw new Error("Join Medventure with the room link before starting the challenge.")
  if (!room || room.status !== "live") throw new Error("The Medventure challenge room is not open yet.")
  return { participant, room }
}

/** Records one answer against the server's copy of the published pathway. Browser-provided points are never accepted. */
export async function answerMedventurePathwayAction(answerId: string): Promise<Result<{ state: RoundOneState; score: number; complete: boolean }>> {
  try {
    const { participant, room } = await player()
    const { pathways } = await medventurePathways({ publishedOnly: true })
    if (pathways.length === 0) return { ok: false, error: "The organiser has not published Round 1 yet." }
    const attempt = await roundOneAttemptInRoom(participant.userId, participant.email, room.startedAt)
    if (attempt.completedAt) return { ok: true, state: attempt.state, score: attempt.score, complete: true }
    const state = currentPathwayState(pathways, attempt.state)
    const pathway = pathways.find((item) => item.id === state.currentPathwayId)
    const node = pathway?.nodes.find((item) => item.id === state.currentNodeId)
    const answer = node?.answers.find((item) => item.id === answerId)
    if (!pathway || !node || !answer) return { ok: false, error: "That answer is no longer available. Refresh the page." }

    // Only the first answer at a decision scores; a loop back to it scores nothing the second time (pointsForAnswer)
    const points = pointsForAnswer(state.steps, pathway.id, node.id, answer.points)
    const steps = [...state.steps, { pathwayId: pathway.id, nodeId: node.id, answerId: answer.id, points, at: new Date().toISOString() }]
    let next: RoundOneState
    if (answer.nextNodeId) next = { ...state, currentNodeId: answer.nextNodeId, steps }
    else {
      const completedPathwayIds = [...state.completedPathwayIds, pathway.id]
      next = currentPathwayState(pathways, { ...state, currentPathwayId: null, currentNodeId: null, completedPathwayIds, steps })
    }
    const score = attempt.score + points
    const complete = next.currentPathwayId === null
    const { error } = await supabaseServer.from("event_round1_attempts").update({ state: next, score, ...(complete ? { completed_at: new Date().toISOString() } : {}) }).eq("event_key", MEDVENTURE.key).eq("clerk_user_id", participant.userId)
    if (error) throw error
    revalidatePath("/medventure/challenge")
    revalidatePath("/medventure/results")
    revalidatePath("/medventure/admin/results")
    return { ok: true, state: next, score, complete }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save that answer." }
  }
}

export async function beginMedventureRoundTwoAction(): Promise<Result<{ caseId: string }>> {
  try {
    const { participant, room } = await player()
    if (!room.roundTwoCaseId) return { ok: false, error: "The organiser has not selected the Round 2 patient." }
    const { data: roundOne } = await supabaseServer.from("event_round1_attempts").select("started_at, completed_at").eq("event_key", MEDVENTURE.key).eq("clerk_user_id", participant.userId).maybeSingle()
    if (!roundOne?.completed_at || startedBeforeRoom(roundOne.started_at, room.startedAt)) return { ok: false, error: "Finish Round 1 before starting the MediKarya patient." }
    // The first start in this room is kept (pressing the button again must not restart the Round 2 clock); a start
    // from an earlier room, or for another case, is replaced, or a preflight play of the case would count here.
    const { data: existing, error: existingError } = await supabaseServer.from("event_round2_starts").select("case_id, started_at").eq("event_key", MEDVENTURE.key).eq("clerk_user_id", participant.userId).maybeSingle()
    if (existingError) throw existingError
    if (!existing || existing.case_id !== room.roundTwoCaseId || startedBeforeRoom(existing.started_at, room.startedAt)) {
      const { error } = await supabaseServer.from("event_round2_starts").upsert({ event_key: MEDVENTURE.key, clerk_user_id: participant.userId, case_id: room.roundTwoCaseId, started_at: new Date().toISOString() }, { onConflict: "event_key,clerk_user_id" })
      if (error) throw error
    }
    revalidatePath("/medventure/results")
    return { ok: true, caseId: room.roundTwoCaseId }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not start Round 2." }
  }
}

/**
 * Whether this case's debrief is a student's scored MedVenture Round 2, so the debrief can point back to the event
 * result (a student who left the case and came back through the library lands on the debrief, not the result).
 * Cheapest checks first: after the event the room is closed and this stops at one read.
 */
export async function medventureRoundTwoScoredAction(caseId: string): Promise<boolean> {
  try {
    const { room } = await medventureRoom()
    if (!room || room.status !== "live" || room.roundTwoCaseId !== caseId) return false
    const { userId } = await auth()
    const participant = await medventureParticipant(userId)
    if (!participant) return false
    const results = await medventureResults()
    return results.progress.some((row) => row.userId === participant.userId && row.roundTwoRaw !== null)
  } catch {
    return false
  }
}
