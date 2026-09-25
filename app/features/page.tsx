import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, ArrowRight, HeartPulse, ListChecks, Scale, AlertTriangle, FlaskConical, ClipboardCheck, Brain, Users, Unlock, Sparkles } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Features",
    description: "A live bedside monitor, a ranked differential instead of one guess, dual Clinical and Independent scoring, and a real-time cardiac emergency — what's actually built into MediKarya.",
    openGraph: {
        title: "MediKarya Features — What's Actually Built",
        description: "A live bedside monitor, a ranked differential, dual scoring, and a real-time deteriorating patient. See what's actually in the platform.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "MediKarya Features" }],
    },
    twitter: {
        card: "summary_large_image",
        images: ["https://www.medikarya.in/og-image.png"],
    },
}

const features = [
    {
        Icon: HeartPulse,
        iconBg: "bg-red-50",
        iconColor: "text-red-500",
        title: "A real bedside monitor",
        desc: "Heart rate, blood pressure, oxygen saturation and a live Lead II ECG trace, running for the whole encounter — not a static vitals table printed once at the top of the case.",
    },
    {
        Icon: ListChecks,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-500",
        title: "A ranked differential",
        desc: "You commit to three things, in order: your working diagnosis, a real alternative, and the one you can't afford to miss. Not a single guess in a text box.",
    },
    {
        Icon: Scale,
        iconBg: "bg-purple-50",
        iconColor: "text-purple-500",
        title: "Two scores, not one",
        desc: "A Clinical score for what you did, and a separate Independent score for what you did without any paid-for help — so using an assist has a visible, honest cost.",
    },
    {
        Icon: AlertTriangle,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        title: "A patient who can get worse",
        desc: "In our real-time cardiac emergency case, the monitor doesn't wait for you — delay or mismanage it and the patient deteriorates, exactly like it would at the bedside.",
    },
    {
        Icon: FlaskConical,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-500",
        title: "Investigations that take real time",
        desc: "Order from a real test catalogue and results come back on a realistic delay, with their own 12-lead ECG interpretation view — not an instant answer key.",
    },
    {
        Icon: ClipboardCheck,
        iconBg: "bg-indigo-50",
        iconColor: "text-indigo-500",
        title: "A debrief with real structure",
        desc: "What you did well and the consequences of what you missed, side by side. Then the full encounter record, an expert walkthrough, and a real performance breakdown.",
    },
    {
        Icon: Brain,
        iconBg: "bg-cyan-50",
        iconColor: "text-cyan-600",
        title: "A quiz built from your own gaps",
        desc: "Five questions generated from what this specific attempt showed you missed — not a static bank of generic questions everyone gets.",
    },
    {
        Icon: Users,
        iconBg: "bg-pink-50",
        iconColor: "text-pink-500",
        title: "Patients who look like your patients",
        desc: "Age-accurate portraits in Indian attire, drawn to match each case — not a stock photo or a cartoon avatar that could belong to any patient anywhere.",
    },
    {
        Icon: Unlock,
        iconBg: "bg-slate-100",
        iconColor: "text-slate-600",
        title: "One case, free, no signup",
        desc: "Run a full case end to end — history, monitor, investigations, differential, debrief — before you decide whether to create an account.",
    },
]

export default function FeaturesPage() {
    return (
        <main className="min-h-screen flex flex-col bg-white">
            <div className="flex-1 relative">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-blue-50" />

                {/* Simple header */}
                <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
                    <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                            <div className="flex h-8 w-8 items-center justify-center">
                                <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
                            </div>
                            MediKarya
                        </Link>
                        <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600">
                            <Link href="/" className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" /> Back to Home
                            </Link>
                        </Button>
                    </div>
                </header>

                <div className="mx-auto max-w-5xl px-4">

                    {/* Hero */}
                    <div className="py-20 md:py-28 text-center space-y-6 max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-600">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Features</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-tight">
                            What's actually{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                                built in.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            Nothing below is a mockup. Every one of these is in the live platform today — try the free case and you'll see each of them yourself.
                        </p>
                    </div>

                    {/* Features grid */}
                    <section className="mb-16">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {features.map(({ Icon, iconBg, iconColor, title, desc }) => (
                                <div key={title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
                                    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
                                        <Icon className={`w-5 h-5 ${iconColor}`} />
                                    </div>
                                    <h2 className="font-bold text-slate-900">{title}</h2>
                                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Note on scope */}
                    <section className="mb-20 bg-slate-900 rounded-2xl p-8 md:p-10 text-white">
                        <h2 className="text-xl font-bold mb-3">What's not built yet</h2>
                        <p className="text-slate-300 leading-relaxed">
                            Real-time deterioration currently runs on our cardiac emergency case only — the rest of the library shares the same live monitor, ranked differential and dual scoring, but doesn't yet deteriorate if mismanaged. We're building that out case by case with clinical review, not all at once.
                        </p>
                    </section>

                    {/* CTA */}
                    <section className="pb-24 flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild size="lg" className="rounded-full bg-slate-900 text-white hover:bg-slate-800">
                            <Link href="/try">
                                Try a Case Free <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="rounded-full">
                            <Link href="/how-it-works">See How It Works</Link>
                        </Button>
                    </section>

                </div>
            </div>
            <Footer />
        </main>
    )
}
