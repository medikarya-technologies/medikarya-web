// The Medventure room's started_at is the line every score is measured against: Round 1 rows and Round 2 starts made
// before it belong to an earlier room (the organisers' preflight the day before) and never count. These rules are pure
// so the desk, the challenge and the leaderboard agree on them.

import { indiaDay } from "../plans/limits"

/**
 * Whether opening the room should start a fresh clock. Closing and reopening on the same day must keep the clock, or
 * everyone who had already played would drop off the leaderboard and could not play again. A room last opened on an
 * earlier India day (the preflight) starts fresh.
 */
export function opensFreshRoom(previousStartedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!previousStartedAt) return true
  const previous = new Date(previousStartedAt)
  if (Number.isNaN(previous.getTime())) return true
  return indiaDay(previous) !== indiaDay(now)
}

/** A row started before the current room opened belongs to an earlier room. */
export function startedBeforeRoom(rowStartedAt: string | null | undefined, roomStartedAt: string | null | undefined): boolean {
  if (!roomStartedAt || !rowStartedAt) return false
  const row = new Date(rowStartedAt).getTime()
  const room = new Date(roomStartedAt).getTime()
  return Number.isFinite(row) && Number.isFinite(room) && row < room
}
