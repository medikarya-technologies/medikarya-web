/**
 * The free case on /try, step by step: how far each guest gets, to see where the case loses people (most visitors
 * from ads never finish it). Only which steps were reached, never what anyone typed or chose. Pure (no window), so it
 * is tested; lib/try-funnel-client.ts records from the browser and app/api/try-funnel/route.ts saves.
 */

/** In the order a guest reaches them. */
export const TRY_STEPS = [
  "viewed", //       the /try briefing loaded
  "started", //      the encounter opened (a play begins)
  "asked", //        the patient answered a first question
  "examined", //     a first examination
  "ordered", //      a first test ordered
  "submitted", //    the diagnosis and plan sent for scoring
  "finished", //     the debrief is on screen
  "signed_up", //    the play moved into a new account
] as const

export type TryStep = (typeof TRY_STEPS)[number]

const GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PLAY_ID = /^[A-Za-z0-9-]{1,64}$/

export interface TryStepRow {
  guest_id: string
  play_id: string
  step: TryStep
  ad_source: "meta" | null
  internal: boolean
}

/**
 * A row to save from what the browser sent, or null if anything is off. "viewed" and "signed_up" belong to no play;
 * a play's steps need its id (the same random id the encounter keeps), so one guest's second play is counted apart.
 */
export function parseTryStep(body: unknown): TryStepRow | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  if (typeof b.guestId !== "string" || !GUEST_ID.test(b.guestId)) return null
  if (typeof b.step !== "string" || !(TRY_STEPS as readonly string[]).includes(b.step)) return null
  const step = b.step as TryStep
  const needsPlay = step !== "viewed" && step !== "signed_up"
  let playId = ""
  if (needsPlay) {
    if (typeof b.playId !== "string" || !PLAY_ID.test(b.playId)) return null
    playId = b.playId
  }
  return {
    guest_id: b.guestId.toLowerCase(),
    play_id: playId,
    step,
    ad_source: b.adSource === "meta" ? "meta" : null,
    internal: b.internal === true,
  }
}

/** The step an encounter event means, or null for events that are not a first-of-kind milestone. */
export function stepForEvent(type: string): TryStep | null {
  if (type === "HISTORY_TAKEN") return "asked"
  if (type === "EXAM_PERFORMED") return "examined"
  if (type === "TEST_ORDERED") return "ordered"
  return null
}

export interface FunnelCount {
  step: TryStep
  guests: number
}

/**
 * How many different guests reached each step (a guest counts once per step, however many plays). Steps are not
 * forced into order: someone may order a test before asking anything.
 */
export function countFunnel(rows: ReadonlyArray<{ guest_id: string; step: string }>): FunnelCount[] {
  const seen = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!seen.has(r.step)) seen.set(r.step, new Set())
    seen.get(r.step)!.add(r.guest_id)
  }
  return TRY_STEPS.map((step) => ({ step, guests: seen.get(step)?.size ?? 0 }))
}
