import "server-only"

import { rankChallenge, type RankedChallengeResult } from "./medventure-scoring"
import { medventurePathways, medventureRoom, MEDVENTURE } from "./medventure"
import { roundOneMaximum } from "./pathways"
import { supabaseServer } from "@/lib/supabase/server"

export type ChallengeProgress = {
  userId: string
  email: string
  name: string | null
  roundOneRaw: number
  roundOneSeconds: number | null
  roundOneCompletedAt: string | null
  roundTwoRaw: number | null
  roundTwoSeconds: number | null
  roundTwoCompletedAt: string | null
}

const secondsBetween = (from: string, to: string | null) => to ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000)) : null

/** The one server-side read used by the organiser board and each student's result. */
export async function medventureResults(): Promise<{ available: boolean; roundOneMaximum: number; progress: ChallengeProgress[]; ranked: RankedChallengeResult[] }> {
  const [{ available: roomAvailable, room }, { pathways }] = await Promise.all([medventureRoom(), medventurePathways({ publishedOnly: true })])
  if (!roomAvailable || !room) return { available: false, roundOneMaximum: 0, progress: [], ranked: [] }
  const { data: roundOneRows, error: roundOneError } = await supabaseServer.from("event_round1_attempts").select("clerk_user_id, email, score, started_at, completed_at").eq("event_key", MEDVENTURE.key)
  if (roundOneError) {
    console.error("Could not read Medventure results:", roundOneError.message)
    return { available: false, roundOneMaximum: 0, progress: [], ranked: [] }
  }
  const userIds = (roundOneRows ?? []).map((row) => String(row.clerk_user_id))
  if (userIds.length === 0) return { available: true, roundOneMaximum: roundOneMaximum(pathways), progress: [], ranked: [] }
  const [profilesResult, startsResult] = await Promise.all([
    supabaseServer.from("user_profiles").select("clerk_user_id, full_name, email").in("clerk_user_id", userIds),
    supabaseServer.from("event_round2_starts").select("clerk_user_id, case_id, started_at").eq("event_key", MEDVENTURE.key).in("clerk_user_id", userIds),
  ])
  if (profilesResult.error || startsResult.error) {
    console.error("Could not read Medventure participant records:", profilesResult.error?.message ?? startsResult.error?.message)
    return { available: false, roundOneMaximum: 0, progress: [], ranked: [] }
  }
  const starts = (startsResult.data ?? []).filter((row) => !room.roundTwoCaseId || row.case_id === room.roundTwoCaseId)
  const startsByUser = new Map(starts.map((row) => [String(row.clerk_user_id), String(row.started_at)]))
  const startedIds = [...startsByUser.keys()]
  const attemptsResult = room.roundTwoCaseId && startedIds.length
    ? await supabaseServer.from("case_attempts").select("user_id, score, time_taken, completed_at").eq("case_id", room.roundTwoCaseId).in("user_id", startedIds).not("completed_at", "is", null).order("completed_at")
    : { data: [], error: null }
  if (attemptsResult.error) {
    console.error("Could not read Medventure Round 2 attempts:", attemptsResult.error.message)
    return { available: false, roundOneMaximum: 0, progress: [], ranked: [] }
  }
  const firstRoundTwo = new Map<string, { score: number; seconds: number; completedAt: string }>()
  for (const row of attemptsResult.data ?? []) {
    const userId = String(row.user_id)
    const startedAt = startsByUser.get(userId)
    if (!startedAt || firstRoundTwo.has(userId) || !row.completed_at || new Date(row.completed_at).getTime() < new Date(startedAt).getTime() || typeof row.score !== "number") continue
    firstRoundTwo.set(userId, { score: row.score, seconds: typeof row.time_taken === "number" && row.time_taken >= 0 ? Math.round(row.time_taken) : secondsBetween(startedAt, row.completed_at) ?? 0, completedAt: row.completed_at })
  }
  const names = new Map((profilesResult.data ?? []).map((row) => [String(row.clerk_user_id), typeof row.full_name === "string" && row.full_name.trim() ? row.full_name.trim() : null]))
  const progress = (roundOneRows ?? []).map((row): ChallengeProgress => {
    const userId = String(row.clerk_user_id)
    const roundTwo = firstRoundTwo.get(userId)
    return { userId, email: String(row.email).toLowerCase(), name: names.get(userId) ?? null, roundOneRaw: Number(row.score) || 0, roundOneSeconds: secondsBetween(String(row.started_at), row.completed_at), roundOneCompletedAt: row.completed_at ?? null, roundTwoRaw: roundTwo?.score ?? null, roundTwoSeconds: roundTwo?.seconds ?? null, roundTwoCompletedAt: roundTwo?.completedAt ?? null }
  })
  const maximum = roundOneMaximum(pathways)
  const ranked = rankChallenge(progress.filter((row) => row.roundOneCompletedAt && row.roundOneSeconds !== null && row.roundTwoRaw !== null && row.roundTwoSeconds !== null && row.roundTwoCompletedAt).map((row) => ({ userId: row.userId, roundOne: row.roundOneRaw, roundOneSeconds: row.roundOneSeconds as number, roundTwoRaw: row.roundTwoRaw as number, roundTwoSeconds: row.roundTwoSeconds as number, completedAt: row.roundTwoCompletedAt as string })), maximum || 1)
  return { available: true, roundOneMaximum: maximum, progress, ranked }
}
