"use client"

import { useState } from "react"
import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { ArrowLeft, Database, BarChart2, BookCopy, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

const features = [
    { Icon: Database, iconBg: "bg-blue-50", iconColor: "text-blue-600", title: "Patient Simulator Engine", description: "Embed lifelike AI patient simulations directly inside your institution's LMS or clinical training platform. Students interact with realistic patient presentations, order investigations, and receive immediate structured feedback." },
    { Icon: BookCopy, iconBg: "bg-purple-50", iconColor: "text-purple-600", title: "Case Library Access", description: "Integrate our library of 50+ clinical case scenarios — covering cardiology, neurology, pulmonology, emergency medicine, and more — mapped directly to your curriculum's learning objectives." },
    { Icon: BarChart2, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", title: "Analytics & Reporting", description: "Track diagnostic reasoning performance at the individual student and cohort level. See where students commonly anchor on incorrect diagnoses and how clinical confidence develops over time." },
]

const faqs = [
    { q: "How is pricing structured for institutions?", a: "Institutional pricing is based on enrolled student count and access tier. We offer annual agreements with flexible payment terms. Contact us for a custom quote." },
    { q: "How is student data handled and protected?", a: "All student performance data is encrypted at rest and in transit. We are GDPR-compliant and do not share or sell institutional data. Your institution retains full ownership of its students' data." },
    { q: "What technical support is included?", a: "All institutional plans include a dedicated integration engineer during onboarding, documentation access, and ongoing technical support via email. Enterprise plans include a dedicated account manager." },
]

export default function ApiDocsClient() {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [institution, setInstitution] = useState("")
    const [useCase, setUseCase] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !institution) {
            toast({ title: "Required fields missing", description: "Please provide your email and institution name.", variant: "destructive" })
            return
        }
        setIsLoading(true)
        try {
            const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_API
            if (endpoint) {
                const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ name, email, institution, useCase, source: "medikarya_api_page" }) })
                if (!res.ok) throw new Error("Submission failed")
            } else {
                await new Promise(r => setTimeout(r, 800))
            }
            setIsSubmitted(true)
            toast({ title: "Request received!", description: "Our team will be in touch within 2 business days." })
        } catch {
            toast({ title: "Something went wrong", description: "Please try again or email us directly.", variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="min-h-screen flex flex-col bg-white">
            <div className="flex-1 relative">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-blue-50" />
                <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
                    <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                            <div className="flex h-8 w-8 items-center justify-center">
                                <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
                            </div>
                            MediKarya
                        </Link>
                        <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600">
                            <Link href="/" className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Back to Home</Link>
                        </Button>
                    </div>
                </header>
                <div className="mx-auto max-w-6xl px-4">
                    <div className="py-16 md:py-20 text-center space-y-5 max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700">
                            <span className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded">API</span>
                            <span>For Institutions & Developers</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                            MediKarya{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-blue-700">for Institutions</span>
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">Integrate our AI patient simulation engine, case library, and performance analytics directly into your medical school, hospital training programme, or institutional LMS.</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-20">
                        <div className="space-y-8">
                            <h2 className="text-xl font-bold text-slate-900">What you can integrate</h2>
                            {features.map(({ Icon, iconBg, iconColor, title, description }) => (
                                <div key={title} className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-5 h-5 ${iconColor}`} /></div>
                                    <div><h3 className="font-semibold text-slate-900 mb-1">{title}</h3><p className="text-sm text-slate-500 leading-relaxed">{description}</p></div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 mb-4">Sample API response</h2>
                            <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl">
                                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-700">
                                    <span className="w-3 h-3 rounded-full bg-red-500" /><span className="w-3 h-3 rounded-full bg-yellow-500" /><span className="w-3 h-3 rounded-full bg-green-500" />
                                    <span className="ml-3 text-xs text-slate-400 font-mono">GET /v1/cases/{"{case_id}"}/summary</span>
                                </div>
                                <pre className="p-5 text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">{`{\n  "case_id": "mk_case_001",\n  "title": "Chest Pain in a 55-Year-Old Male",\n  "specialty": "Cardiology",\n  "difficulty": "Hard",\n  "student_session": {\n    "final_diagnosis": "NSTEMI",\n    "correct": true,\n    "score": 87\n  }\n}`}</pre>
                            </div>
                            <p className="text-xs text-slate-400 mt-3 text-center">Full API reference provided after access approval.</p>
                        </div>
                    </div>
                    <div className="max-w-2xl mx-auto mb-20">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-1">Request API Access</h2>
                            <p className="text-slate-500 text-sm mb-6">We review all institutional requests within 2 business days.</p>
                            {isSubmitted ? (
                                <div className="flex flex-col items-center text-center py-6 space-y-3">
                                    <div className="w-12 h-12 rounded-full bg-green-50 ring-1 ring-green-100 flex items-center justify-center text-green-600"><Check className="h-6 w-6" /></div>
                                    <h3 className="font-bold text-slate-900">Request received!</h3>
                                    <p className="text-sm text-slate-500">Our team will reach out to <strong>{email}</strong> within 2 business days.</p>
                                    <Button asChild variant="ghost" size="sm" className="text-slate-400"><Link href="/">Back to Home</Link></Button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Your Name</label><Input placeholder="Dr. Jane Smith" value={name} onChange={e => setName(e.target.value)} className="rounded-lg" /></div>
                                        <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Work Email <span className="text-red-400">*</span></label><Input type="email" placeholder="jane@university.edu" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-lg" /></div>
                                    </div>
                                    <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Institution / Organisation <span className="text-red-400">*</span></label><Input placeholder="e.g. AIIMS New Delhi" value={institution} onChange={e => setInstitution(e.target.value)} required className="rounded-lg" /></div>
                                    <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">How would you use MediKarya?</label><Textarea placeholder="e.g. Embedding case simulations into our 3rd year clinical rotations..." value={useCase} onChange={e => setUseCase(e.target.value)} rows={3} className="rounded-lg resize-none" /></div>
                                    <Button type="submit" disabled={isLoading} className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white">
                                        {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Request Access"}
                                    </Button>
                                    <p className="text-xs text-slate-400 text-center">Or email us directly at <a href="mailto:contact@medikarya.in" className="text-blue-600 hover:underline">contact@medikarya.in</a></p>
                                </form>
                            )}
                        </div>
                    </div>
                    <div className="max-w-2xl mx-auto pb-20">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Frequently Asked Questions</h2>
                        <div className="space-y-3">
                            {faqs.map((faq, i) => (
                                <div key={i} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-slate-900 hover:bg-slate-50 transition-colors">
                                        <span>{faq.q}</span>
                                        {openFaq === i ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                                    </button>
                                    {openFaq === i && <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3">{faq.a}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    )
}
