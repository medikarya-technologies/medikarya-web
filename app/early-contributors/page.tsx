import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, GraduationCap, Stethoscope, Heart } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Early Contributors",
    description: "The people who helped build MediKarya from the ground up — validating cases, contributing clinical content, and shaping what the platform became.",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "Early Contributors — MediKarya",
        description: "Meet the people who believed in MediKarya before it was anything. Their contributions shaped the foundation of the platform.",
        images: [{ url: "https://www.medikarya.in/og-image.png", width: 1200, height: 630, alt: "MediKarya Platform Preview" }],
    },
}

const contributors = [
    {
        name: "Dr. Apoorva Nagar",
        role: "Clinical Advisor & Case Validator",
        institution: "Doon University",
        tag: "Faculty",
        Icon: Stethoscope,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-500",
        contribution:
            "Reviewed and validated MediKarya's initial four clinical cases, ensuring they were medically accurate, educationally sound, and grounded in real-world Indian clinical practice. Her guidance gave the platform its clinical credibility from day one.",
    },
    {
        name: "Shani Dangwal",
        role: "Case Contributor",
        institution: "Doon University",
        tag: "Student",
        Icon: GraduationCap,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-500",
        contribution:
            "Provided the initial four to five medical case scenarios that became the foundation of MediKarya's case library. These cases are at the heart of the platform's current pilot — and it wouldn't exist in its current form without this early contribution.",
    },
]

export default function EarlyContributorsPage() {
    return (
        <main className="min-h-screen flex flex-col bg-white">
            <div className="flex-1 relative">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-blue-50" />

                {/* Header */}
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

                <div className="mx-auto max-w-3xl px-4">

                    {/* Hero */}
                    <div className="py-20 md:py-28 text-center space-y-5 max-w-2xl mx-auto">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-600">
                            <Heart className="h-3.5 w-3.5 text-rose-400" />
                            <span>Early Contributors</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-tight">
                            The people who helped{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                                build this from scratch.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            MediKarya is still in its earliest days — running a pilot on four clinical cases. These are the people who made those four cases possible.
                        </p>
                    </div>

                    {/* Contributor Cards */}
                    <section className="pb-24 space-y-6">
                        {contributors.map(({ name, role, institution, tag, Icon, iconBg, iconColor, contribution }) => (
                            <div
                                key={name}
                                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 flex flex-col sm:flex-row gap-5"
                            >
                                {/* Icon */}
                                <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-6 h-6 ${iconColor}`} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h2 className="text-lg font-bold text-slate-900">{name}</h2>
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                            {tag}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">{role}</p>
                                    <p className="text-xs text-slate-400 mb-4">{institution}</p>
                                    <p className="text-sm text-slate-600 leading-relaxed">{contribution}</p>
                                </div>
                            </div>
                        ))}
                    </section>

                </div>
            </div>
            <Footer />
        </main>
    )
}
