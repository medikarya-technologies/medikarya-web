"use client"

import Link from "next/link"
import { ArrowLeft, Cookie } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function CookiesClient() {
    return (
        <div className="min-h-screen bg-studio-50 font-sans text-slate-600 selection:bg-brand-100 selection:text-brand-900">
            <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                        <div className="flex h-8 w-8 items-center justify-center">
                            <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
                        </div>
                        MediKarya
                    </Link>
                    <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600">
                        <Link href="/" className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Back to Home</Link>
                    </Button>
                </div>
            </header>
            <main className="container mx-auto px-4 py-12 max-w-4xl">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">Cookie Policy</h1>
                    <p className="text-lg text-slate-600">Last updated: December 10, 2025</p>
                </div>
                <div className="prose prose-slate prose-lg max-w-none bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-100">
                    <p className="lead">This Cookie Policy explains how MediKarya uses cookies and similar technologies to recognize you when you visit our website.</p>
                    <div className="not-prose my-10 bg-brand-50 border border-brand-100 rounded-2xl p-6 flex gap-4">
                        <Cookie className="h-8 w-8 text-brand-600 flex-shrink-0" />
                        <div>
                            <h3 className="font-bold text-brand-900 text-lg mb-1">What are cookies?</h3>
                            <p className="text-brand-800 text-sm">Cookies are small data files placed on your device when you visit a website. They help websites work efficiently and provide reporting information.</p>
                        </div>
                    </div>
                    <h3>1. Essential Cookies</h3>
                    <p>These cookies are strictly necessary to provide you with services available through our website, such as access to secure areas like the Dashboard.</p>
                    <ul>
                        <li><strong>Authentication:</strong> We use cookies to verify your account and determine when you&apos;re logged in.</li>
                        <li><strong>Security:</strong> We use cookies to help keep your account and data safe and secure.</li>
                    </ul>
                    <h3>2. Analytics and Performance Cookies</h3>
                    <p>These cookies enhance performance and functionality. We may use tools like Vercel Analytics to understand how users use the website.</p>
                    <h3>3. Functionality Cookies</h3>
                    <p>These cookies allow our website to remember choices you make to provide enhanced, more personal features.</p>
                    <Separator className="my-8" />
                    <h3>4. Managing Cookies</h3>
                    <p>You can exercise your cookie preferences by setting your browser controls to block or delete cookies. Note that blocking cookies may restrict access to some features.</p>
                    <h3>5. Updates to this Policy</h3>
                    <p>We may update this Cookie Policy from time to time. Please re-visit regularly to stay informed.</p>
                    <div className="not-prose mt-8">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Questions?</h3>
                        <Button variant="outline" asChild><a href="mailto:contact@medikarya.in">contact@medikarya.in</a></Button>
                    </div>
                </div>
            </main>
            <footer className="border-t py-8 bg-white">
                <div className="container mx-auto px-4 text-center text-sm text-slate-500">
                    &copy; {new Date().getFullYear()} MediKarya. All rights reserved.
                </div>
            </footer>
        </div>
    )
}
