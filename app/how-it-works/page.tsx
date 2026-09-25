import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, ArrowRight, MessageSquare, Activity, FlaskConical, ListChecks, Scale, ClipboardCheck, Brain, Workflow } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "How MediKarya Works",
    description: "From a live AI patient to a scored debrief: the real step-by-step flow of a MediKarya case, and what happens at each stage.",
    openGraph: {
        title: "How MediKarya Works — From First History to Debrief",
        description: "See exactly what happens in a MediKarya case: a live patient, real-time vitals, a ranked differential, dual scoring, and a full debrief.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "How MediKarya Works" }],
    },
    twitter: {
        card: "summary_large_image",
        images: ["https://www.medikarya.in/og-image.png"],
    },
}

const steps = [
    {
        step: "01",
        Icon: MessageSquare,
        title: "Take a history from a live patient",
        desc: "Every case opens on a real chief complaint. You ask questions in your own words and the patient — or their parent, when they can't speak for themselves — answers in character. Nothing is pre-scripted multiple choice; it's a conversation.",
    },
    {
        step: "02",
        Icon: Activity,
        title: "Work from a real bedside monitor",
        desc: "Heart rate, blood pressure, oxygen saturation and a live Lead II ECG trace run the whole time you're at the bedside, wandering the way real vitals do. In the cases built to deteriorate, how you manage the patient changes what that monitor shows next.",
    },
    {
        step: "03",
        Icon: FlaskConical,
        title: "Order investigations, on the clock",
        desc: "Pick from a real test catalogue and results come back on a realistic delay, not instantly. A 12-lead ECG gets its own interpretation view. Ordering everything isn't free — it costs time, and in some cases, score.",
    },
    {
        step: "04",
        Icon: ListChecks,
        title: "Rank a differential, not just name one",
        desc: "You commit to three things: your working diagnosis, a real alternative, and the one you can't afford to miss — in that order — then write the reasoning and management plan that go with it.",
    },
    {
        step: "05",
        Icon: Scale,
        title: "Get scored two ways",
        desc: "A Clinical score for everything you did, and a separate Independent score for what you did without any paid-for help. Using a hint doesn't quietly inflate your result — it shows up as the exact gap between the two numbers.",
    },
    {
        step: "06",
        Icon: ClipboardCheck,
        title: "Walk through a real debrief",
        desc: "What you did well and the consequences of what you missed, side by side. Then the full encounter record and an expert walkthrough, and finally your performance breakdown — nothing is a single opaque percentage.",
    },
    {
        step: "07",
        Icon: Brain,
        title: "Close the loop with a reinforcement quiz",
        desc: "Five questions generated from the specific gaps this attempt actually showed — not a generic quiz bank. It's the same mistake, asked a different way, while it's still fresh.",
    },
]

export default function HowItWorksPage() {
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

                <div className="mx-auto max-w-4xl px-4">

                    {/* Hero */}
                    <div className="py-20 md:py-28 text-center space-y-6 max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-600">
                            <Workflow className="h-3.5 w-3.5" />
                            <span>How It Works</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-tight">
                            One patient, one attempt,{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                                seven real steps.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            Every case runs through the same flow, start to finish. This is exactly what happens — no step skipped or simplified for the sake of the pitch.
                        </p>
                    </div>

                    {/* Steps */}
                    <section className="mb-20 space-y-4">
                        {steps.map(({ step, Icon, title, desc }) => (
                            <div key={step} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col sm:flex-row gap-5 sm:gap-6">
                                <div className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 shrink-0">
                                    <span className="text-3xl font-bold text-slate-200 tabular-nums">{step}</span>
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-blue-600" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg text-slate-900 mb-1.5">{title}</h2>
                                    <p className="text-slate-600 leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </section>

                    {/* Note on scope */}
                    <section className="mb-20 bg-slate-900 rounded-2xl p-8 md:p-10 text-white">
                        <h2 className="text-xl font-bold mb-3">Worth knowing before you start</h2>
                        <p className="text-slate-300 leading-relaxed">
                            Real-time deterioration — a patient who gets worse if you don't act in time — currently runs on our cardiac emergency case. The rest of the library uses the same live monitor, history, investigations, ranked differential and dual scoring, without that deterioration mechanic. We're building it out case by case, not claiming it everywhere at once.
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
                            <Link href="/features">See What's Built In</Link>
                        </Button>
                    </section>

                </div>
            </div>
            <Footer />
        </main>
    )
}
