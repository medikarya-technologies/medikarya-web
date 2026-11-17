// The Medventure challenge uses source points for the pathway round, then deliberately gives the first-time
// MediKarya simulation a smaller share of the final score. These functions are pure so the student view, organiser
// desk and prize action always agree.

export const MEDVENTURE_SCORING = {
  roundOneMax: 42,
  roundOneDisplayMax: 10,
  roundTwoMax: 10,
  totalMax: 20,
  roundOneCases: ["Placenta previa", "Severe symptomatic hyponatremia", "Organophosphorus poisoning"],
  roundOneWeights: [10, 11, 21],
  tieBreak: "Lower combined completion time, then earlier completion.",
} as const

/** Raw pathway points stay faithful to the supplied cases, then become a 10-point leaderboard score. */
/** `rawMaximum` comes from the published pathways. The 42-point default keeps the supplied three pathways' scoring stable. */
export const roundOnePoints = (rawPathwayPoints: number, rawMaximum: number = MEDVENTURE_SCORING.roundOneMax) => {
  const maximum = Math.max(1, rawMaximum)
  return Math.round(Math.max(0, Math.min(maximum, rawPathwayPoints)) * MEDVENTURE_SCORING.roundOneDisplayMax / maximum)
}

/** MediKarya receives an equal 10-point share of the 20-point event total. */
export const roundTwoPoints = (rawCaseScore: number) => Math.round(Math.max(0, Math.min(100, rawCaseScore)) * MEDVENTURE_SCORING.roundTwoMax / 100)

export interface ChallengeResult {
  userId: string
  roundOne: number
  roundOneSeconds: number
  roundTwoRaw: number
  roundTwoSeconds: number
  completedAt: string
}

export interface RankedChallengeResult extends ChallengeResult {
  roundTwo: number
  total: number
  totalSeconds: number
  place: number
}

/**
 * Complete results only; highest points win. A points tie goes to the faster combined time, and if that is equal too,
 * to whoever finished both rounds first. Places are never shared: there is exactly one 1st, 2nd and 3rd, because each
 * place carries its own prize.
 */
export function rankChallenge(results: readonly ChallengeResult[], roundOneMaximum: number = MEDVENTURE_SCORING.roundOneMax): RankedChallengeResult[] {
  const finishedAt = (iso: string) => {
    const time = new Date(iso).getTime()
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
  }
  return results
    .map((result) => ({ ...result, roundOne: roundOnePoints(result.roundOne, roundOneMaximum), roundTwo: roundTwoPoints(result.roundTwoRaw), total: roundOnePoints(result.roundOne, roundOneMaximum) + roundTwoPoints(result.roundTwoRaw), totalSeconds: result.roundOneSeconds + result.roundTwoSeconds, place: 0 }))
    // compared as times, not text: "…10:00:00Z" and "…10:00:00.000Z" are the same moment
    .sort((a, b) => b.total - a.total || a.totalSeconds - b.totalSeconds || finishedAt(a.completedAt) - finishedAt(b.completedAt) || a.userId.localeCompare(b.userId))
    .map((result, index) => ({ ...result, place: index + 1 }))
}
