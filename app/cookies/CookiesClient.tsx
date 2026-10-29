"use client"

import Link from "next/link"
import { ArrowLeft, Cookie } from "lucide-react"
import { Button } from "@/components/ui/button"
import { openCookieSettings } from "@/components/privacy/cookie-consent"

export default function CookiesClient() {
    return <div className="min-h-screen bg-studio-50 font-sans text-slate-600">
        <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl"><div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-800"><img src="/medikarya.svg" alt="" className="h-8 w-8" />MediKarya</Link>
            <Button asChild variant="ghost" size="sm"><Link href="/" className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Back to Home</Link></Button>
        </div></header>
        <main className="container mx-auto max-w-4xl px-4 py-12">
            <div className="mb-10 text-center"><h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Cookie Policy</h1><p className="text-lg">Last updated: October 29, 2026</p></div>
            <article className="prose prose-slate prose-lg max-w-none rounded-3xl border border-slate-100 bg-white p-8 shadow-sm sm:p-12">
                <p>We use essential browser storage and cookies to provide MediKarya. Optional analytics are off unless you choose to allow them. You can change your decision at any time using the button below.</p>
                <div className="not-prose my-8 rounded-2xl border border-brand-100 bg-brand-50 p-6"><Cookie className="mb-3 h-6 w-6 text-brand-600"/><h2 className="font-bold text-slate-900">Manage your choice</h2><p className="mt-1 text-sm text-slate-700">Your current choice is stored in this browser. Removing site data in your browser also resets it.</p><button onClick={openCookieSettings} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Change cookie choice</button></div>
                <h2>Essential storage</h2><p>Authentication and security cookies are needed for sign-in, account sessions, and protection against misuse. Theme, tutorial, and case interface preferences may be saved in local storage on your device. These are not used for advertising.</p>
                <h2>Optional analytics</h2><p>Only after you select “Accept analytics,” we load Microsoft Clarity to understand how visitors interact with pages and Vercel Speed Insights to measure page performance. These providers may use cookies or similar identifiers and receive technical information such as device, browser, pages visited, and interaction/performance events. We do not load these analytics when you select “Essential only.”</p>
                <h2>Managing browser storage</h2><p>You can remove or block cookies and local storage using your browser settings. Blocking essential cookies can prevent sign-in or other features from working. You can withdraw analytics permission using the control above; the new choice prevents future analytics loading in this browser. You can also clear site data to remove locally stored preferences.</p>
                <h2>More information</h2><p>See our <Link href="/privacy">Privacy Policy</Link> for details about the personal data we process, purposes, providers, retention, and how to contact us. Questions: <a href="mailto:privacy@medikarya.in">privacy@medikarya.in</a>.</p>
            </article>
        </main>
        <footer className="border-t bg-white py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} MediKarya. All rights reserved.</footer>
    </div>
}
