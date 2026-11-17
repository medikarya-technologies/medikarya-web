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
export const roundOnePoints = (rawPathwayPoints: number) => Math.round(Math.max(0, Math.min(MEDVENTURE_SCORING.roundOneMax, rawPathwayPoints)) * MEDVENTURE_SCORING.roundOneDisplayMax / MEDVENTURE_SCORING.roundOneMax)

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

/** Complete results first; highest points win. A faster total time breaks a points tie. */
export function rankChallenge(results: readonly ChallengeResult[]): RankedChallengeResult[] {
  const ranked = results
    .map((result) => ({ ...result, roundOne: roundOnePoints(result.roundOne), roundTwo: roundTwoPoints(result.roundTwoRaw), total: roundOnePoints(result.roundOne) + roundTwoPoints(result.roundTwoRaw), totalSeconds: result.roundOneSeconds + result.roundTwoSeconds, place: 0 }))
    .sort((a, b) => b.total - a.total || a.totalSeconds - b.totalSeconds || a.completedAt.localeCompare(b.completedAt))
  return ranked.map((result, index) => ({ ...result, place: index > 0 && ranked[index - 1].total === result.total && ranked[index - 1].totalSeconds === result.totalSeconds ? ranked[index - 1].place : index + 1 }))
}
