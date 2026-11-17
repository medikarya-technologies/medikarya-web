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
