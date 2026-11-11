/**
 * Meta (Facebook) Pixel, for measuring and targeting ads. It is advertising tracking, so it loads only after the
 * visitor accepts in the cookie banner (components/privacy/cookie-consent.tsx), and only on the real site: page views
 * from localhost or a Vercel preview would fill the ad audiences with ourselves.
 *
 * What we send is chosen here, never by Meta's script: automatic events are off (they sent button text, which at the
 * bedside can be a test or a question to the patient), and no event carries a case, a diagnosis or anything a student
 * typed. Every event says whether it came from our own testing (traffic_type).
 */
import { isProductionHost } from "./production-host"
import { internalFlagFromSearch, rememberId, adSourceFromSearch, type TrafficType } from "./traffic"

export const META_PIXEL_ID = "2130210390921009"

type Fbq = (...args: unknown[]) => void

const fbq = (): Fbq | undefined =>
  typeof window === "undefined" ? undefined : (window as Window & { fbq?: Fbq }).fbq

// Storage can throw (private windows, blocked site data); analytics must never break the page.
function read(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key)
  } catch {
    return null
  }
}
function write(storage: "local" | "session", key: string, value: string | null) {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage
    if (value === null) s.removeItem(key)
    else s.setItem(key, value)
  } catch {}
}

const INTERNAL_KEY = "mk_internal_traffic"
const AD_SOURCE_KEY = "mk_ad_source"
const SENT_KEY = "mk_meta_sent"

/** Marks this browser as ours (an admin signed in, or ?mk_internal=1), or clears it. */
export function setInternalTraffic(on: boolean) {
  if (typeof window === "undefined") return
  write("local", INTERNAL_KEY, on ? "1" : null)
  // Clarity may have started this session already, labelled as a visitor.
  ;(window as Window & { clarity?: (...args: unknown[]) => void }).clarity?.("set", "traffic_type", on ? "internal" : "visitor")
}

export function trafficType(): TrafficType {
  if (typeof window === "undefined") return "visitor"
  return read("local", INTERNAL_KEY) === "1" ? "internal" : "visitor"
}

/**
 * Run once per page load, before any event: applies ?mk_internal=, and remembers for this tab's session that the
 * visitor arrived from a Meta ad (the fbclid is gone from the URL after the first click inside the site).
 */
export function noteVisit() {
  if (typeof window === "undefined") return
  const flag = internalFlagFromSearch(window.location.search)
  if (flag !== null) setInternalTraffic(flag)
  if (adSourceFromSearch(window.location.search) === "meta") write("session", AD_SOURCE_KEY, "meta")
}

/** "meta" when this session began with a Meta ad click. */
export function adSource(): "meta" | null {
  if (typeof window === "undefined") return null
  return read("session", AD_SOURCE_KEY) === "meta" ? "meta" : null
}

/**
 * Meta's base code, run once; then the first PageView. Before init it turns off automatic events (button clicks) and
 * Meta's own PageView on every history change (it went out without traffic_type), and lets more than one PageView
 * through per full page load, which Meta's script otherwise drops: each page view is sent by trackMetaPageView only.
 */
export function loadMetaPixel() {
  if (typeof window === "undefined" || fbq() || !isProductionHost(window.location.hostname)) return
  const script = document.createElement("script")
  script.id = "meta-pixel-script"
  script.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq.disablePushState=true;fbq.allowDuplicatePageViews=true;fbq('set','autoConfig',false,'${META_PIXEL_ID}');fbq('init','${META_PIXEL_ID}');`
  document.head.appendChild(script)
  trackMetaPageView()
}

/**
 * A PageView: the first one from loadMetaPixel, then one per in-app navigation (the App Router changes pages without
 * a full load). The banner sends it only when the path changes, so a re-render cannot double count.
 */
export function trackMetaPageView() {
  fbq()?.("track", "PageView", { traffic_type: trafficType() })
}

/** Meta's own event names; anything else goes as a custom event. */
const STANDARD = new Set(["CompleteRegistration", "InitiateCheckout", "Purchase"])

export type MetaEvent = "CompleteRegistration" | "InitiateCheckout" | "Purchase" | "CaseStarted" | "CaseCompleted"

/**
 * Sends one event, at most once per eventId from this browser (a refresh, a resumed case or React running an effect
 * twice does not count it again); Meta also drops repeats of the same eventID. Nothing is sent, or remembered as
 * sent, while the pixel is not loaded (no consent, or not the real site). Params must never hold clinical content.
 */
export function trackMetaEvent(event: MetaEvent, eventId: string, params: Record<string, string | number> = {}) {
  const send = fbq()
  if (!send) return
  let sent: string[] = []
  try {
    const parsed = JSON.parse(read("local", SENT_KEY) ?? "[]")
    if (Array.isArray(parsed)) sent = parsed.filter((x): x is string => typeof x === "string")
  } catch {}
  const key = `${event}:${eventId}`
  if (sent.includes(key)) return
  write("local", SENT_KEY, JSON.stringify(rememberId(sent, key)))
  send(STANDARD.has(event) ? "track" : "trackCustom", event, { ...params, traffic_type: trafficType() }, { eventID: key })
}
