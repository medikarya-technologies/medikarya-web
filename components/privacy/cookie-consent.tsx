"use client"

import { useEffect, useState } from "react"
import { SpeedInsights } from "@vercel/speed-insights/next"

const KEY = "medikarya-analytics-consent-v1"
const SETTINGS_EVENT = "medikarya:cookie-settings"

export function CookieConsent() {
    const [choice, setChoice] = useState<"accepted" | "rejected" | null>(null)
    const [show, setShow] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem(KEY)
        if (saved === "accepted" || saved === "rejected") setChoice(saved)
        else setShow(true)
        const open = () => setShow(true)
        window.addEventListener(SETTINGS_EVENT, open)
        return () => window.removeEventListener(SETTINGS_EVENT, open)
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
        if (document.getElementById("clarity-script")) return
        const script = document.createElement("script")
        script.id = "clarity-script"
        script.async = true
        script.text = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};c[a]("consentv2",{ad_Storage:"denied",analytics_Storage:"granted"});t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","vhuxiqi1u5");`
        document.head.appendChild(script)
    }, [choice])

    return <>
        {choice === "accepted" && <SpeedInsights />}
        {show && <div role="dialog" aria-label="Cookie preferences" aria-modal="false" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:inset-x-6 sm:bottom-6">
            <h2 className="text-base font-bold text-slate-900">Your privacy choices</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Essential storage keeps sign-in and the site working. With your permission, Microsoft Clarity analytics and Vercel Speed Insights help us understand site use and performance. You can change your choice anytime in <a className="underline" href="/cookies">Cookie Policy</a>.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button onClick={() => save("rejected")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Essential only</button>
                <button onClick={() => save("accepted")} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Accept analytics</button>
            </div>
        </div>}
    </>
}

export function openCookieSettings() {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SETTINGS_EVENT))
}
