/**
 * Meta (Facebook) Pixel, for measuring and targeting ads. It is advertising tracking, so it loads only after the
 * visitor accepts in the cookie banner (components/privacy/cookie-consent.tsx), and only on the real site: page views
 * from localhost or a Vercel preview would fill the ad audiences with ourselves.
 */
import { isProductionHost } from "./production-host"

export const META_PIXEL_ID = "2130210390921009"

type Fbq = (...args: unknown[]) => void

const fbq = (): Fbq | undefined =>
  typeof window === "undefined" ? undefined : (window as Window & { fbq?: Fbq }).fbq

/**
 * Meta's base code, run once. It queues calls until fbevents.js arrives, and its init sends the first PageView;
 * later page changes in the app are sent by trackMetaPageView.
 */
export function loadMetaPixel() {
  if (typeof window === "undefined" || fbq() || !isProductionHost(window.location.hostname)) return
  const script = document.createElement("script")
  script.id = "meta-pixel-script"
  script.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`
  document.head.appendChild(script)
}

/** Sends a PageView after an in-app navigation (the App Router changes pages without a full load). */
export function trackMetaPageView() {
  fbq()?.("track", "PageView")
}

/**
 * A Meta standard event (CompleteRegistration, InitiateCheckout, Subscribe...). Does nothing when the pixel is not
 * loaded: no consent, or not the real site.
 */
export function trackMetaEvent(event: string, params?: Record<string, string | number>) {
  fbq()?.("track", event, params)
}
