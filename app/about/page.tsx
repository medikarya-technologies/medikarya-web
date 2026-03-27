import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Stethoscope, Brain, BookOpen, Heart } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "About MediKarya",
    description: "MediKarya is an AI-powered clinical simulation platform built for medical students in India. Learn about our mission, what we're building, and the problem we're solving.",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "About MediKarya — AI Clinical Simulation for Medical Students",
        description: "We're building the practice environment that medical education has always needed — realistic, affordable, and available before your first real patient.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "MediKarya Platform Preview" }],
    },
}

const values = [
    {
        Icon: Stethoscope,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-500",
        title: "Practice-first learning",
        desc: "The best way to learn medicine is to do medicine. We build environments where students can attempt, fail, and improve — before the stakes are real.",
    },
    {
        Icon: Brain,
        iconBg: "bg-purple-50",
        iconColor: "text-purple-500",
        title: "Diagnostic reasoning over recall",
        desc: "Knowing facts isn't enough. We train the clinical thought process — differentials, investigation strategies, management decisions — not just what the answer is.",
    },
    {
        Icon: BookOpen,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-500",
        title: "Honest feedback",
        desc: "No vague scores. Students deserve to know exactly where their reasoning broke down and what a better approach looks like.",
    },
    {
        Icon: Heart,
        iconBg: "bg-rose-50",
        iconColor: "text-rose-500",
        title: "Built for India",
        desc: "Our cases are grounded in the Indian clinical context — the diseases, presentations, and resource constraints that matter for the students using this platform.",
    },
]

export default function AboutPage() {
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
                            <span>About MediKarya</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-tight">
                            Medical students deserve a place to{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                                practise before they practise.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            Aviation has flight simulators. Surgery has procedure labs. But for most clinical reasoning decisions — the ones that determine diagnoses, investigations, and management — medical students have only textbooks and hope. MediKarya is trying to change that.
                        </p>
                    </div>

                    {/* The problem */}
                    <section className="mb-20">
                        <div className="bg-slate-900 rounded-2xl p-8 md:p-12 text-white">
                            <h2 className="text-2xl font-bold mb-6">The problem we're solving</h2>
                            <div className="space-y-4 text-slate-300 leading-relaxed">
                                <p>
                                    Medical students in India spend years learning anatomy, physiology, and pathology. Then they step into a ward and are expected to translate all of that into real-time clinical decisions — often with minimal supervision, on patients they've never seen before.
                                </p>
                                <p>
                                    The supervised bedside learning that used to fill this gap is shrinking. Patient loads are high, attending time is limited, and students observe more than they do. The consequence isn't just slower skill development — it's clinical decisions made with incomplete confidence.
                                </p>
                                <p className="text-white font-medium">
                                    We believe a structured simulation environment, built around realistic Indian clinical cases, can change this. Not by replacing clinical experience — but by preparing students to use it better.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* What we're building */}
                    <section className="mb-20">
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">What MediKarya is</h2>
                        <p className="text-slate-600 leading-relaxed mb-8">
                            MediKarya is an AI patient simulation platform. Students interact with a virtual patient presented with a chief complaint. They take a history, order investigations, interpret results, and submit a diagnosis and management plan. The AI evaluates their reasoning at each step — not just whether the final diagnosis was right, but whether the clinical thinking was sound.
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                            Cases are built around real clinical presentations — the kinds seen at district hospitals and tertiary centres across India. Paediatrics, obstetrics, neurology, medicine. Each case comes with evidence-based learning objectives, structured differentials, and teaching points grounded in current guidelines.
                        </p>
                    </section>

                    {/* Values */}
                    <section className="mb-20">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8">What we believe</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {values.map(({ Icon, iconBg, iconColor, title, desc }) => (
                                <div key={title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex gap-4">
                                    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                                        <Icon className={`w-5 h-5 ${iconColor}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Where we are */}
                    <section className="mb-20">
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">Where we are right now</h2>
                        <p className="text-slate-600 leading-relaxed mb-4">
                            MediKarya is in early development. We currently have 4 published clinical cases and are actively building the case library and platform features. If you're a medical student, clinician, or educator who wants to help shape what this becomes — we'd genuinely like to hear from you.
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                            We're based in India and building this for the Indian medical education context, with a longer-term goal of expanding to other LMIC settings where the same gap exists.
                        </p>
                    </section>

                    {/* CTA */}
                    <section className="pb-24 flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild size="lg" className="rounded-full bg-slate-900 text-white hover:bg-slate-800">
                            <Link href="/login">
                                Try a Patient Case <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="rounded-full">
                            <Link href="/contact">Partner with us</Link>
                        </Button>
                        <Button asChild size="lg" variant="ghost" className="rounded-full">
                            <Link href="mailto:contact@medikarya.in">contact@medikarya.in</Link>
                        </Button>
                    </section>

                </div>
            </div>
            <Footer />
        </main>
    )
}
