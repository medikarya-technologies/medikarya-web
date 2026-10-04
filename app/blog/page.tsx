import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react"
import type { Metadata } from "next"
import ArticleGrid from "./ArticleGrid"

export const metadata: Metadata = {
    alternates: { canonical: "https://www.medikarya.in/blog" },
    title: "Blog: Clinical Reasoning for Medical Students",
    description: "The MediKarya blog explores clinical reasoning training, simulation-based medical education, and AI in healthcare. Written for medical students, educators, and clinicians.",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "MediKarya Blog: Clinical Reasoning & Medical Education",
        description: "Deep dives into clinical reasoning, AI-driven medical education, diagnostic thinking, and the future of healthcare simulation.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "MediKarya Blog" }],
    },
    twitter: {
        card: "summary_large_image",
        images: ["https://www.medikarya.in/og-image.png"],
    },
}

// Featured pillar article (first article)
const featured = {
    slug: "ai-revolutionizing-medical-education",
    title: "What AI Patient Cases Can (and Can't) Teach a Medical Student",
    excerpt: "Ward exposure is shrinking for many students. Here is what working through simulated patient cases can build, what it cannot, and how to use it alongside real patients.",
    category: "AI in Medicine",
    categoryColor: "bg-blue-50 text-blue-700 border-blue-100",
}

// Remaining articles shown in the grid
const articles = [
    {
        slug: "feynman-technique-clinical-reasoning",
        title: "The Feynman Technique for Clinical Reasoning",
        excerpt: "If you can't explain a diagnosis simply, you probably don't understand it yet. A ten-minute end-of-day routine that shows you where your understanding has gaps.",
        category: "Study Tips",
        categoryColor: "bg-emerald-50 text-emerald-700 border-emerald-100",
        author: "MediKarya Team",
        date: "April 2026",
        readTime: "7 min read",
    },
    {
        slug: "sepsis-case-based-approach",
        title: "Understanding Sepsis: A Case-Based Approach",
        excerpt: "Sepsis kills millions annually and remains one of medicine's most time-critical diagnoses. Walk through how a case-based lens sharpens early recognition.",
        category: "Clinical Reasoning",
        categoryColor: "bg-red-50 text-red-700 border-red-100",
        author: "MediKarya Team",
        date: "April 2026",
        readTime: "10 min read",
    },
    {
        slug: "why-medical-students-need-simulation",
        title: "Why Medical Students Need Simulation Training",
        excerpt: "The transition from classroom to clinic is one of the hardest leaps in medical education. Practising on simulated patients lets you make your first mistakes where they cost nothing.",
        category: "Medical Education",
        categoryColor: "bg-purple-50 text-purple-700 border-purple-100",
        author: "MediKarya Team",
        date: "April 2026",
        readTime: "7 min read",
    },
    {
        slug: "breaking-down-diagnostic-process",
        title: "Breaking Down the Diagnostic Process",
        excerpt: "How do experienced clinicians arrive at a diagnosis so quickly? We break down the cognitive heuristics, pattern matching, and systematic frameworks they use.",
        category: "Clinical Reasoning",
        categoryColor: "bg-red-50 text-red-700 border-red-100",
        author: "MediKarya Team",
        date: "April 2026",
        readTime: "9 min read",
    },
    {
        slug: "future-ai-assisted-diagnosis",
        title: "AI-Assisted Diagnosis: What It Means for Today's Medical Students",
        excerpt: "AI already reads scans and flags deteriorating patients. The skill it makes more valuable, not less, is knowing when to trust it.",
        category: "AI in Medicine",
        categoryColor: "bg-blue-50 text-blue-700 border-blue-100",
        author: "MediKarya Team",
        date: "April 2026",
        readTime: "6 min read",
    },
]

export default function BlogPage() {
    return (
        <main className="min-h-screen flex flex-col bg-white">
            <div className="flex-1 relative">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-cyan-50" />

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
                    <div className="py-16 md:py-24 text-center space-y-5 max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-800">
                            <BookOpen className="w-4 h-4" />
                            <span>MediKarya Insights</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                            Ideas on{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                                Medicine &amp; Learning
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            The MediKarya blog explores how medical students develop clinical reasoning,
                            how simulation training changes medical education, and how artificial
                            intelligence is shaping the future of healthcare training. These articles are
                            written for medical students, educators, and clinicians interested in
                            case-based learning and diagnostic thinking.
                        </p>
                    </div>

                    {/* Featured pillar article */}
                    <div className="mb-16 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <Link href={`/blog/${featured.slug}`} className="block group">
                            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 w-full" />
                            <div className="p-8 md:p-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                                        Featured Article
                                    </span>
                                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${featured.categoryColor}`}>
                                        {featured.category}
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 group-hover:text-blue-700 transition-colors leading-tight">
                                    {featured.title}
                                </h2>
                                <p className="text-slate-600 max-w-2xl leading-relaxed">
                                    {featured.excerpt}
                                </p>
                                <div className="mt-5 text-blue-600 font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                                    Read the full article <ArrowRight className="w-4 h-4" />
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* More articles with category filter */}
                    <div className="pb-24">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">More Articles</h2>
                        <ArticleGrid articles={articles} />
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    )
}
