import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, PlayCircle, Clock, ChevronRight, Zap, BookOpen, Target } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Tutorials — MediKarya Visual Learning Center",
    description: "Step-by-step video guides for mastering clinical reasoning, diagnostic workflow, and AI patient simulation on MediKarya. Built for medical students.",
    openGraph: {
        title: "MediKarya Tutorials — Learn Clinical Simulation",
        description: "Step-by-step guides to mastering the MediKarya platform, improving your diagnostic workflow, and building clinical confidence.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "MediKarya Tutorials" }],
    },
    twitter: {
        card: "summary_large_image",
        images: ["https://www.medikarya.in/og-image.png"],
    },
}

const gettingStarted = [
    {
        title: "Getting Started with MediKarya",
        description: "A complete walkthrough of the platform — logging in, navigating the dashboard, and starting your first patient simulation.",
        duration: "5 min",
        difficulty: "Beginner",
        difficultyColor: "bg-green-50 text-green-700 border-green-100",
        gradient: "from-blue-400 to-cyan-400",
    },
    {
        title: "How to Navigate a Patient Case",
        description: "Learn how to take a history, order investigations, and arrive at a diagnosis inside a MediKarya simulation environment.",
        duration: "8 min",
        difficulty: "Beginner",
        difficultyColor: "bg-green-50 text-green-700 border-green-100",
        gradient: "from-emerald-400 to-teal-400",
    },
    {
        title: "Ordering Investigations Effectively",
        description: "Not every test is the right test. This tutorial covers how to think about investigations — what to order, when, and why.",
        duration: "10 min",
        difficulty: "Beginner",
        difficultyColor: "bg-green-50 text-green-700 border-green-100",
        gradient: "from-violet-400 to-purple-400",
    },
]

const advanced = [
    {
        title: "Advanced Diagnostic Reasoning",
        description: "Go beyond textbook differentials. Learn to build problem representations and narrow diagnoses under time pressure.",
        duration: "15 min",
        difficulty: "Intermediate",
        difficultyColor: "bg-yellow-50 text-yellow-700 border-yellow-100",
        gradient: "from-orange-400 to-red-400",
    },
    {
        title: "Reading ECGs in Simulation",
        description: "A structured approach to ECG interpretation — rhythm, axis, intervals, morphology — applied to real simulation cases.",
        duration: "12 min",
        difficulty: "Intermediate",
        difficultyColor: "bg-yellow-50 text-yellow-700 border-yellow-100",
        gradient: "from-pink-400 to-rose-400",
    },
    {
        title: "Approaching Rare Clinical Presentations",
        description: "When the obvious diagnosis doesn't fit — how to widen your differential and think through uncommon conditions methodically.",
        duration: "20 min",
        difficulty: "Advanced",
        difficultyColor: "bg-red-50 text-red-700 border-red-100",
        gradient: "from-slate-500 to-slate-700",
    },
]

function TutorialCard({ title, description, duration, difficulty, difficultyColor, gradient }: typeof gettingStarted[0]) {
    return (
        <div className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden">
            {/* Thumbnail */}
            <div className={`relative h-40 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <PlayCircle className="w-8 h-8 text-white" />
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                    <Clock className="w-3 h-3" />{duration}
                </div>
            </div>
            <div className="p-5 space-y-3">
                <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${difficultyColor}`}>
                    {difficulty}
                </span>
                <h3 className="font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
                <button className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:gap-2 transition-all">
                    Watch tutorial <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

export default function TutorialsPage() {
    return (
        <main className="min-h-screen flex flex-col bg-white">
            <div className="flex-1 relative">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-50 via-white to-teal-50" />

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

                <div className="mx-auto max-w-6xl px-4">

                    {/* Hero */}
                    <div className="py-16 md:py-20 text-center space-y-5 max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800">
                            <PlayCircle className="w-4 h-4" />
                            <span>Visual Learning Center</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                            Learn by{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                                Doing, Not Watching
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            Step-by-step guides to mastering the MediKarya platform, improving your diagnostic workflow, and building clinical confidence before your first real patient.
                        </p>
                    </div>

                    {/* Why simulation matters */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-12 mb-16 max-w-5xl mx-auto">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Why simulation-based learning works</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="flex flex-col items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-emerald-600" />
                                </div>
                                <h3 className="font-semibold text-slate-900">Immediate feedback loops</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    In real clinical placements, you often don't see the outcome of a decision for days. Simulation compresses that feedback to seconds — you see exactly where your reasoning diverged, while it's still fresh.
                                </p>
                            </div>
                            <div className="flex flex-col items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-blue-600" />
                                </div>
                                <h3 className="font-semibold text-slate-900">Practice without consequence</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Aviation and surgery both rely on simulation because errors in those fields are unacceptable. Medical students deserve the same rehearsal space — a place to make mistakes, learn, and repeat before the stakes are real.
                                </p>
                            </div>
                            <div className="flex flex-col items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                                    <Target className="w-5 h-5 text-purple-600" />
                                </div>
                                <h3 className="font-semibold text-slate-900">Targeted skill building</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Clinical attachments are unpredictable — you see what comes in. Simulation lets you specifically target your weak areas: ECG interpretation, differential generation, investigation ordering, and more.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Getting Started */}
                    <section className="mb-14">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                <span className="text-green-700 font-bold text-sm">1</span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Getting Started</h2>
                            <span className="text-sm text-slate-400">Essential tutorials for new users</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {gettingStarted.map((t) => <TutorialCard key={t.title} {...t} />)}
                        </div>
                    </section>

                    {/* Advanced */}
                    <section className="mb-16">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                <span className="text-orange-700 font-bold text-sm">2</span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Advanced Skills</h2>
                            <span className="text-sm text-slate-400">For students who've completed a few cases</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {advanced.map((t) => <TutorialCard key={t.title} {...t} />)}
                        </div>
                    </section>

                    {/* CTA */}
                    <div className="text-center pb-20">
                        <p className="text-slate-500 mb-4">Ready to put it into practice?</p>
                        <Button asChild size="lg" className="rounded-full bg-slate-900 text-white hover:bg-slate-800">
                            <Link href="/case-studies">Browse Patient Simulations →</Link>
                        </Button>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    )
}
