// The Medventure feedback form: what it asks, how an answer is checked, and how the organiser's summary is worked
// out. Pure, so the form, the server action and the organiser page agree.

export const STUDY_YEARS = ["1st year", "2nd year", "3rd year", "Final year", "Intern", "Other"] as const

export const RATINGS = [
  { key: "overall", label: "Overall, how was the challenge?", required: true },
  { key: "roundOne", label: "Round 1: the decision pathways", required: false },
  { key: "roundTwo", label: "Round 2: the MediKarya patient", required: false },
  { key: "realism", label: "How real did the patient feel?", required: false },
] as const

export type RatingKey = (typeof RATINGS)[number]["key"]

export const TEXT_LIMIT = 1000

export type Feedback = {
  overall: number
  roundOne: number | null
  roundTwo: number | null
  realism: number | null
  recommend: number | null
  studyYear: (typeof STUDY_YEARS)[number] | null
  liked: string
  improve: string
  contactOk: boolean
}

const rating = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null

const text = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, TEXT_LIMIT) : "")

/** Checks what the browser sent. Only the overall rating is required; anything out of range counts as not answered. */
export function cleanFeedback(input: unknown): { ok: true; feedback: Feedback } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Something went wrong. Please try again." }
  const row = input as Record<string, unknown>
  const overall = rating(row.overall, 1, 5)
  if (overall === null) return { ok: false, error: "Choose a rating for the challenge overall." }
  const year = STUDY_YEARS.find((y) => y === row.studyYear) ?? null
  return {
    ok: true,
    feedback: {
      overall,
      roundOne: rating(row.roundOne, 1, 5),
      roundTwo: rating(row.roundTwo, 1, 5),
      realism: rating(row.realism, 1, 5),
      recommend: rating(row.recommend, 0, 10),
      studyYear: year,
      liked: text(row.liked),
      improve: text(row.improve),
      contactOk: row.contactOk === true,
    },
  }
}

export type FeedbackSummary = {
  count: number
  averages: Record<RatingKey, number | null>
  /** Share of answers 9-10 minus share of 0-6, out of 100: the usual "would you recommend" score. */
  recommendScore: number | null
  recommendCount: number
}

const average = (values: (number | null)[]) => {
  const given = values.filter((v): v is number => v !== null)
  return given.length ? Math.round((given.reduce((a, b) => a + b, 0) / given.length) * 10) / 10 : null
}

export function summariseFeedback(rows: readonly Feedback[]): FeedbackSummary {
  const recommends = rows.map((r) => r.recommend).filter((v): v is number => v !== null)
  const promoters = recommends.filter((v) => v >= 9).length
  const detractors = recommends.filter((v) => v <= 6).length
  return {
    count: rows.length,
    averages: {
      overall: average(rows.map((r) => r.overall)),
      roundOne: average(rows.map((r) => r.roundOne)),
      roundTwo: average(rows.map((r) => r.roundTwo)),
      realism: average(rows.map((r) => r.realism)),
    },
    recommendScore: recommends.length ? Math.round(((promoters - detractors) / recommends.length) * 100) : null,
    recommendCount: recommends.length,
  }
}
