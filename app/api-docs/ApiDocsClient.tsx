"use client"

import { useState } from "react"
import { Footer } from "@/components/flowai/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { ArrowLeft, BookCopy, Check, Loader2, ChevronDown, ChevronUp, PenLine, Users } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// Only what MediKarya does today. There is no public API: this page is for colleges and faculty who want to use
// MediKarya with a batch of students, and its address (/api-docs) is kept so old links still work.
const features = [
    { Icon: Users, iconBg: "bg-brand-50", iconColor: "text-brand-600", title: "A workshop or a pilot", description: "We run a session with your students on their own phones or laptops, working real cases end to end, and share what the batch found hard. Our first pilot was with 4th-year MBBS students at Maulana Azad Medical College in May 2026." },
    { Icon: BookCopy, iconBg: "bg-brand-50", iconColor: "text-brand-600", title: "Access for a batch", description: "We can open MediKarya for a whole batch for a workshop or a term, so every student works the same cases and sees their own debrief after each one." },
    { Icon: PenLine, iconBg: "bg-brand-50", iconColor: "text-brand-600", title: "Cases from your own wards", description: "Your students can write up patients they have seen, and your faculty can review cases in their specialty. Published cases carry their names, with certificates anyone can verify." },
]

const faqs = [
    { q: "What does it cost for a college?", a: "It depends on the size of the batch and how long you want access. Write to us with your batch size and dates and we will send you a quote." },
    { q: "How is student data handled?", a: "We keep only what is needed to run a student's account and show them their results, and we do not sell data. Our privacy policy has the details." },
    { q: "Who do we talk to?", a: "The founding team, directly. We reply to every message ourselves, usually within two working days." },
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
            // Goes to the same inbox as the Contact page's form (its own address, if one is ever set, wins). The
            // `source` below says which form a message came from.
            const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_API || process.env.NEXT_PUBLIC_FORMSPREE_INSTITUTION
            if (endpoint) {
                const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ name, email, institution, useCase, source: "medikarya_api_page" }) })
                if (!res.ok) throw new Error("Submission failed")
            } else {
                // No inbox is connected to this form: never tell someone their request was received when it was not.
                throw new Error("This form is not connected")
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
                            <span>For colleges and faculty</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                            MediKarya{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-blue-700">for Institutions</span>
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">Use MediKarya with your students: a workshop, a pilot, or access for a whole batch. Tell us what you have in mind and we will work it out with you.</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-20">
                        <div className="space-y-8">
                            <h2 className="text-xl font-bold text-slate-900">What we can do with you</h2>
                            {features.map(({ Icon, iconBg, iconColor, title, description }) => (
                                <div key={title} className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-5 h-5 ${iconColor}`} /></div>
                                    <div><h3 className="font-semibold text-slate-900 mb-1">{title}</h3><p className="text-sm text-slate-500 leading-relaxed">{description}</p></div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 mb-4">How a pilot works</h2>
                            <ol className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                {[
                                    "You tell us the batch, the year and the subjects you want covered.",
                                    "We pick cases that fit, and set up access for every student.",
                                    "Students work the cases in the session, each on their own device, and get a debrief after every case.",
                                    "Afterwards we share what the batch found hard, case by case, and what they told us in a short survey.",
                                ].map((step, i) => (
                                    <li key={step} className="flex gap-3 text-[15px] leading-relaxed text-slate-700">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{i + 1}</span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                    <div className="max-w-2xl mx-auto mb-20">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-1">Get in touch</h2>
                            <p className="text-slate-500 text-sm mb-6">We reply to every message ourselves, usually within two working days.</p>
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
                                        <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Your Name</label><Input placeholder="Dr. Anjali Mehra" value={name} onChange={e => setName(e.target.value)} className="rounded-lg" /></div>
                                        <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Work Email <span className="text-red-400">*</span></label><Input type="email" placeholder="anjali.mehra@college.ac.in" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-lg" /></div>
                                    </div>
                                    <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Institution / Organisation <span className="text-red-400">*</span></label><Input placeholder="e.g. AIIMS New Delhi" value={institution} onChange={e => setInstitution(e.target.value)} required className="rounded-lg" /></div>
                                    <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">What do you have in mind?</label><Textarea placeholder="e.g. A workshop for our final-year batch before their clinical postations..." value={useCase} onChange={e => setUseCase(e.target.value)} rows={3} className="rounded-lg resize-none" /></div>
                                    <Button type="submit" disabled={isLoading} className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white">
                                        {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Send"}
                                    </Button>
                                    <p className="text-xs text-slate-400 text-center">Or email us directly at <a href="mailto:support@medikarya.in" className="text-blue-600 hover:underline">support@medikarya.in</a></p>
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
