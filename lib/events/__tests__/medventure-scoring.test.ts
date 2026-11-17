import test from "node:test"
import assert from "node:assert/strict"
import { MEDVENTURE_SCORING, rankChallenge, roundOnePoints, roundTwoPoints } from "../medventure-scoring"

test("Medventure keeps source pathway points but displays an even 10 + 10 score out of 20", () => {
  assert.equal(roundOnePoints(42), MEDVENTURE_SCORING.roundOneDisplayMax)
  assert.equal(roundOnePoints(21), 5)
  assert.equal(roundTwoPoints(100), MEDVENTURE_SCORING.roundTwoMax)
  assert.equal(roundTwoPoints(80), 8)
  assert.equal(roundTwoPoints(0), 0)
})

test("Medventure ranks by total, then faster combined completion time", () => {
  const ranked = rankChallenge([
    { userId: "slower", roundOne: 35, roundOneSeconds: 900, roundTwoRaw: 80, roundTwoSeconds: 900, completedAt: "2026-11-18T10:00:00Z" },
    { userId: "faster", roundOne: 35, roundOneSeconds: 800, roundTwoRaw: 80, roundTwoSeconds: 800, completedAt: "2026-11-18T10:02:00Z" },
    { userId: "lower", roundOne: 34, roundOneSeconds: 300, roundTwoRaw: 80, roundTwoSeconds: 300, completedAt: "2026-11-18T09:00:00Z" },
  ])
  assert.deepEqual(ranked.map((row) => [row.userId, row.total, row.place]), [["lower", 16, 1], ["faster", 16, 2], ["slower", 16, 3]])
})

test("Medventure never shares a place: equal points and time go to whoever finished both rounds first", () => {
  const ranked = rankChallenge([
    { userId: "later", roundOne: 42, roundOneSeconds: 600, roundTwoRaw: 90, roundTwoSeconds: 900, completedAt: "2026-11-18T10:05:00.000Z" },
    { userId: "earlier", roundOne: 42, roundOneSeconds: 600, roundTwoRaw: 90, roundTwoSeconds: 900, completedAt: "2026-11-18T10:01:00Z" },
    { userId: "top", roundOne: 42, roundOneSeconds: 900, roundTwoRaw: 100, roundTwoSeconds: 900, completedAt: "2026-11-18T10:30:00Z" },
    { userId: "fourth", roundOne: 42, roundOneSeconds: 600, roundTwoRaw: 90, roundTwoSeconds: 900, completedAt: "2026-11-18T10:09:00Z" },
  ])
  assert.deepEqual(ranked.map((row) => [row.userId, row.place]), [["top", 1], ["earlier", 2], ["later", 3], ["fourth", 4]])
  assert.equal(new Set(ranked.map((row) => row.place)).size, ranked.length)
})
