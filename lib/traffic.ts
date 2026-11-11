/**
 * Who a visit is, for analytics: our own testing or a real visitor, and whether they came from a Meta ad. Pure
 * functions (no window), so they are tested; lib/meta-pixel.ts and the cookie banner keep the answers in the browser.
 */

export type TrafficType = "internal" | "visitor"

/** utm_source values that mean Facebook, Instagram, Messenger or the Audience Network. */
const META_SOURCES = new Set(["facebook", "fb", "instagram", "ig", "meta", "messenger", "an", "audience_network"])

/**
 * "meta" when the landing URL carries Meta's click id (fbclid, added to every ad click) or a utm_source naming a Meta
 * app; otherwise null. A plain link shared on Instagram has neither, so it is not counted as an ad.
 */
export function adSourceFromSearch(search: string): "meta" | null {
  const params = new URLSearchParams(search)
  if (params.get("fbclid")) return "meta"
  const source = params.get("utm_source")?.trim().toLowerCase()
  return source && META_SOURCES.has(source) ? "meta" : null
}

/**
 * The founder's switch for a browser: ?mk_internal=1 marks it as ours (its events say traffic_type=internal from then
 * on), ?mk_internal=0 clears that. null when the URL says neither.
 */
export function internalFlagFromSearch(search: string): boolean | null {
  const value = new URLSearchParams(search).get("mk_internal")
  if (value === "1") return true
  if (value === "0") return false
  return null
}

/** Keeps the newest ids, so the list of events already sent from this browser cannot grow without end. */
export function rememberId(ids: string[], id: string, max = 200): string[] {
  const next = ids.filter((x) => x !== id)
  next.push(id)
  return next.slice(-max)
}
