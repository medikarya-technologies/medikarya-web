"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { AnalyticsIdentity } from "@/components/privacy/analytics-identity"
import { adSource, loadMetaPixel, noteVisit, trackMetaPageView, trafficType } from "@/lib/meta-pixel"

// v2 added the Meta Pixel (advertising). A "yes" to v1 covered analytics only, so those visitors are asked again; a
// "no" to v1 still stands.
const KEY = "medikarya-analytics-consent-v2"
const OLD_KEY = "medikarya-analytics-consent-v1"
const SETTINGS_EVENT = "medikarya:cookie-settings"
/** Sent when a case opens (components/cases/simulation-interaction.tsx); see hideCookieBannerForCase. */
const CASE_OPEN_EVENT = "medikarya:case-open"

export function CookieConsent() {
    const [choice, setChoice] = useState<"accepted" | "rejected" | null>(null)
    const [show, setShow] = useState(false)

    useEffect(() => {
        noteVisit()
        const saved = localStorage.getItem(KEY)
        if (saved === "accepted" || saved === "rejected") setChoice(saved)
        else if (localStorage.getItem(OLD_KEY) === "rejected") setChoice("rejected")
        else setShow(true)
        const open = () => setShow(true)
        // A case fills the screen and keeps its question box and tabs at the bottom, where the banner sits: it steps
        // aside without an answer. Nothing optional loads without one, and it asks again on the next page load.
        const hide = () => setShow(false)
        window.addEventListener(SETTINGS_EVENT, open)
        window.addEventListener(CASE_OPEN_EVENT, hide)
        return () => {
            window.removeEventListener(SETTINGS_EVENT, open)
            window.removeEventListener(CASE_OPEN_EVENT, hide)
        }
    }, [])

    const save = (value: "accepted" | "rejected") => {
        const wasAccepted = choice === "accepted"
        localStorage.setItem(KEY, value)
        if (wasAccepted && value === "rejected") {
            window.location.reload()
            return
        }
        setChoice(value)
        setShow(false)
    }

    useEffect(() => {
        if (choice === "rejected") {
            const clarity = (window as Window & { clarity?: (...args: unknown[]) => void }).clarity
            if (clarity) clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" })
            return
        }
        if (choice !== "accepted") return
        const clarity = (window as Window & { clarity?: (...args: unknown[]) => void }).clarity
        if (clarity) clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" })
        loadMetaPixel()
        if (document.getElementById("clarity-script")) return
        // Clarity sessions carry the same labels as the Meta events, so its funnels can leave out our own testing and
        // look at visitors from Meta ads on their own.
        const tags = `c[a]("set","traffic_type","${trafficType()}");${adSource() ? `c[a]("set","ad_source","meta");` : ""}`
        const script = document.createElement("script")
        script.id = "clarity-script"
        script.async = true
        script.text = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};c[a]("consentv2",{ad_Storage:"denied",analytics_Storage:"granted"});${tags}t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","vhuxiqi1u5");`
        document.head.appendChild(script)
    }, [choice])

    // The pixel's own code sends the first PageView; the App Router changes pages without a reload, so each later
    // page is sent from here. (Does nothing while the pixel is not loaded.)
    const pathname = usePathname()
    const lastPath = useRef(pathname)
    useEffect(() => {
        if (lastPath.current === pathname) return
        lastPath.current = pathname
        // On the next tick, once the router has put the new address in the bar: the event reports location.href.
        const timer = window.setTimeout(trackMetaPageView, 0)
        return () => window.clearTimeout(timer)
    }, [pathname])

    // The banner floats over the bottom of the screen. While it is up, the page gets as much room below its end as the
    // banner is tall, so everything can be scrolled above it: on a phone it used to sit on /try's Start button, the last
    // thing on the page, and visitors who had not answered it could not begin the case.
    const bannerRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const banner = bannerRef.current
        if (!show || !banner) return
        const body = document.body
        const before = body.style.paddingBottom
        const fit = () => { body.style.paddingBottom = `${Math.ceil(banner.getBoundingClientRect().height) + 24}px` }
        fit()
        const observer = new ResizeObserver(fit)
        observer.observe(banner)
        return () => {
            observer.disconnect()
            body.style.paddingBottom = before
        }
    }, [show])

    return <>
        {choice === "accepted" && <><SpeedInsights /><AnalyticsIdentity /></>}
        {show && <div ref={bannerRef} role="dialog" aria-label="Cookie preferences" aria-modal="false" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-5">
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">Your privacy choices</h2>
            {/* The same choice in fewer words on a phone, where the full text took half the screen. */}
            <p className="mt-1 text-[13px] leading-snug text-slate-600 sm:hidden">With your permission we use Microsoft Clarity, Vercel Speed Insights and the Meta Pixel to improve the site and see which ads bring people here. <a className="underline" href="/cookies">Cookie Policy</a></p>
            <p className="mt-1 hidden text-sm leading-relaxed text-slate-600 sm:block">Essential storage keeps sign-in and the site working. With your permission, Microsoft Clarity and Vercel Speed Insights help us understand site use and performance, and the Meta Pixel tells us which of our Facebook and Instagram ads bring people here. You can change your choice anytime in <a className="underline" href="/cookies">Cookie Policy</a>.</p>
            <div className="mt-3 flex justify-end gap-2 sm:mt-4">
                <button onClick={() => save("rejected")} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 sm:flex-none">Essential only</button>
                <button onClick={() => save("accepted")} className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:flex-none">Accept</button>
            </div>
        </div>}
    </>
}

/** A case has opened: the cookie banner, if it is up, gets out of the way for this page view. */
export function hideCookieBannerForCase() {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CASE_OPEN_EVENT))
}

export function openCookieSettings() {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SETTINGS_EVENT))
}
