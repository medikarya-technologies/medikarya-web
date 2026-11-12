/**
 * Browser side of the /try funnel (lib/try-funnel.ts): sends a step once per guest, play and step. Only on /try, so
 * signed-in students' plays on the dashboard are left alone. Fire and forget: nothing here may slow or break the case.
 */
import { type TryStep } from "./try-funnel"
import { adSource, noteVisit, trafficType } from "./meta-pixel"

/** The id /try already keeps for a guest's plays (app/try/TryClient.tsx), made here if the page has not yet. */
export const GUEST_ID_KEY = "medikarya-guest-id"

function guestId(): string | null {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(GUEST_ID_KEY, id)
    return id
  } catch {
    return null
  }
}

const sent = new Set<string>()

/**
 * Records a step. `anywhere` is for the one step that happens off /try: the play moving into a new account.
 */
export function recordTryStep(step: TryStep, playId = "", { anywhere = false } = {}) {
  if (typeof window === "undefined") return
  if (!anywhere && !window.location.pathname.startsWith("/try")) return
  // The page may record before the cookie banner has read the address (?fbclid=, ?mk_internal=): read it now.
  noteVisit()
  const id = guestId()
  if (!id) return
  const key = `${id}:${playId}:${step}`
  if (sent.has(key)) return
  sent.add(key)
  const body = JSON.stringify({ guestId: id, step, playId, adSource: adSource(), internal: trafficType() === "internal" })
  void fetch("/api/try-funnel", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {})
}
