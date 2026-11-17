"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { currentPathwayState, stateFrom, type RoundOneState } from "@/lib/events/pathways"
import { medventureParticipant, medventurePathways, medventureRoom, MEDVENTURE } from "@/lib/events/medventure"
import { supabaseServer } from "@/lib/supabase/server"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function player() {
  const { userId } = await auth()
  const participant = await medventureParticipant(userId)
  const { room } = await medventureRoom()
  if (!participant) throw new Error("Join Medventure with the room link before starting the challenge.")
  if (!room || room.status !== "live") throw new Error("The Medventure challenge room is not open yet.")
  return { participant, room }
}

async function attemptFor(userId: string, email: string) {
  const { data, error } = await supabaseServer.from("event_round1_attempts").select("state, score, completed_at").eq("event_key", MEDVENTURE.key).eq("clerk_user_id", userId).maybeSingle()
  if (error) throw error
  if (data) return { state: stateFrom(data.state), score: Number(data.score) || 0, completedAt: data.completed_at as string | null }
  const state = stateFrom(null)
  const { error: insertError } = await supabaseServer.from("event_round1_attempts").insert({ event_key: MEDVENTURE.key, clerk_user_id: userId, email, state, score: 0 })
  if (insertError) throw insertError
  return { state, score: 0, completedAt: null }
}

/** Records one answer against the server's copy of the published pathway. Browser-provided points are never accepted. */
export async function answerMedventurePathwayAction(answerId: string): Promise<Result<{ state: RoundOneState; score: number; complete: boolean }>> {
  try {
    const { participant } = await player()
    const { pathways } = await medventurePathways({ publishedOnly: true })
    if (pathways.length === 0) return { ok: false, error: "The organiser has not published Round 1 yet." }
    const attempt = await attemptFor(participant.userId, participant.email)
    if (attempt.completedAt) return { ok: true, state: attempt.state, score: attempt.score, complete: true }
    const state = currentPathwayState(pathways, attempt.state)
    const pathway = pathways.find((item) => item.id === state.currentPathwayId)
    const node = pathway?.nodes.find((item) => item.id === state.currentNodeId)
    const answer = node?.answers.find((item) => item.id === answerId)
    if (!pathway || !node || !answer) return { ok: false, error: "That answer is no longer available. Refresh the page." }

    const steps = [...state.steps, { pathwayId: pathway.id, nodeId: node.id, answerId: answer.id, points: answer.points, at: new Date().toISOString() }]
    let next: RoundOneState
    if (answer.nextNodeId) next = { ...state, currentNodeId: answer.nextNodeId, steps }
    else {
      const completedPathwayIds = [...state.completedPathwayIds, pathway.id]
      next = currentPathwayState(pathways, { ...state, currentPathwayId: null, currentNodeId: null, completedPathwayIds, steps })
    }
    const score = attempt.score + answer.points
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
    const { data: roundOne } = await supabaseServer.from("event_round1_attempts").select("completed_at").eq("event_key", MEDVENTURE.key).eq("clerk_user_id", participant.userId).maybeSingle()
    if (!roundOne?.completed_at) return { ok: false, error: "Finish Round 1 before starting the MediKarya patient." }
    const { error } = await supabaseServer.from("event_round2_starts").upsert({ event_key: MEDVENTURE.key, clerk_user_id: participant.userId, case_id: room.roundTwoCaseId }, { onConflict: "event_key,clerk_user_id", ignoreDuplicates: true })
    if (error) throw error
    revalidatePath("/medventure/results")
    return { ok: true, caseId: room.roundTwoCaseId }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not start Round 2." }
  }
}
