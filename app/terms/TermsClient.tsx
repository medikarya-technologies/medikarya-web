"use client"

import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function TermsClient() {
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
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">Terms of Service</h1>
                    <p className="text-lg text-slate-600">Last updated: December 10, 2025</p>
                </div>
                <div className="prose prose-slate prose-lg max-w-none bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-100">
                    <div className="rounded-2xl bg-amber-50 p-6 border border-amber-100 flex gap-4 not-prose mb-10">
                        <ShieldAlert className="h-8 w-8 text-amber-600 flex-shrink-0" />
                        <div>
                            <h3 className="text-lg font-bold text-amber-900 mb-1">Medical Education Disclaimer</h3>
                            <p className="text-amber-800 text-sm leading-relaxed">MediKarya is strictly an <strong>educational simulation platform</strong>. Content is for training purposes only and does <strong>NOT</strong> constitute professional medical advice, diagnosis, or treatment.</p>
                        </div>
                    </div>
                    <h3>1. Agreement to Terms</h3>
                    <p>By accessing or using MediKarya, you agree to be bound by these Terms of Service.</p>
                    <h3>2. Educational Use Only</h3>
                    <p>MediKarya is designed solely to facilitate medical education through simulation. Always consult standard medical literature and guidelines for real-world clinical decision-making.</p>
                    <h3>3. User Accounts & Conduct</h3>
                    <ul>
                        <li><strong>Eligibility:</strong> You must be at least 18 years old and a current medical student, resident, or healthcare professional.</li>
                        <li><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials.</li>
                        <li><strong>Prohibited Actions:</strong> No misuse, account sharing, reverse engineering of AI models, or illegal use.</li>
                    </ul>
                    <Separator className="my-8" />
                    <h3>4. For Case Writers & Contributors</h3>
                    <ul>
                        <li><strong>No PHI:</strong> Contributions must NOT contain any Protected Health Information. All cases must be fully anonymized or fictional.</li>
                        <li><strong>License Grant:</strong> By submitting a case, you grant MediKarya a worldwide, non-exclusive, royalty-free license to use, reproduce, and display the content.</li>
                        <li><strong>Attribution:</strong> We will provide appropriate attribution to accepted case authors within the platform.</li>
                    </ul>
                    <h3>5. Intellectual Property</h3>
                    <p>The MediKarya platform is the proprietary property of MediKarya and is protected by copyright and intellectual property laws.</p>
                    <h3>6. Limitation of Liability</h3>
                    <p>In no event shall MediKarya be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of the service.</p>
                    <h3>7. Governing Law</h3>
                    <p>These Terms shall be governed by the laws of India.</p>
                    <h3>8. Changes to Terms</h3>
                    <p>We reserve the right to modify these Terms at any time with at least 30 days notice.</p>
                    <Separator className="my-8" />
                    <div className="not-prose mt-8">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Contact Us</h3>
                        <Button variant="outline" asChild><a href="mailto:privacy@medikarya.in">privacy@medikarya.in</a></Button>
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
