import "server-only"

import { emptyRoundOneState, stateFrom, type RoundOneState } from "./pathways"
import { MEDVENTURE } from "./medventure"
import { startedBeforeRoom } from "./room-clock"
import { supabaseServer } from "@/lib/supabase/server"

export type RoundOneRow = { state: RoundOneState; score: number; startedAt: string; completedAt: string | null }

/**
 * The student's Round 1 row in the open room, made when they first see a question so their time counts from there
 * (not from their first answer). A row from an earlier room (the preflight) is started again from nothing: otherwise
 * it would show Round 1 as done here while the leaderboard leaves it out.
 */
export async function roundOneAttemptInRoom(userId: string, email: string, roomStartedAt: string | null): Promise<RoundOneRow> {
  const { data, error } = await supabaseServer.from("event_round1_attempts").select("state, score, started_at, completed_at").eq("event_key", MEDVENTURE.key).eq("clerk_user_id", userId).maybeSingle()
  if (error) throw error
  const fresh = { state: emptyRoundOneState(), score: 0, started_at: new Date().toISOString(), completed_at: null }

  if (!data) {
    // Two tabs opening at once: the second insert hits the primary key, so read the row the first one made.
    const { error: insertError } = await supabaseServer.from("event_round1_attempts").insert({ event_key: MEDVENTURE.key, clerk_user_id: userId, email, ...fresh })
    if (insertError && insertError.code !== "23505") throw insertError
    if (insertError) return roundOneAttemptInRoom(userId, email, roomStartedAt)
    return { state: fresh.state, score: 0, startedAt: fresh.started_at, completedAt: null }
  }

  if (startedBeforeRoom(data.started_at, roomStartedAt)) {
    const { error: resetError } = await supabaseServer.from("event_round1_attempts").update({ email, ...fresh }).eq("event_key", MEDVENTURE.key).eq("clerk_user_id", userId)
    if (resetError) throw resetError
    return { state: fresh.state, score: 0, startedAt: fresh.started_at, completedAt: null }
  }

  return { state: stateFrom(data.state), score: Number(data.score) || 0, startedAt: String(data.started_at), completedAt: (data.completed_at as string | null) ?? null }
}
