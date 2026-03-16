"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Check, Loader2, ArrowLeft, Building2, Mail } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import Link from "next/link"

export default function ContactClient() {
    const [email, setEmail] = useState("")
    const [name, setName] = useState("")
    const [institution, setInstitution] = useState("")
    const [message, setMessage] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_INSTITUTION;
            if (!endpoint) {
                console.warn("Formspree endpoint not set. Simulating success.");
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ name, institution, email, message, source: "medikarya_institution_contact" })
                });
                if (!response.ok) throw new Error("Form submission failed");
            }
            setIsSubmitted(true);
            toast({ title: "Inquiry Sent!", description: "Our team will get back to you within 24 hours." });
        } catch {
            toast({ title: "Error", description: "Something went wrong. Please try again or email us.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[600px] h-[600px] bg-brand-200/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[500px] h-[500px] bg-accent-200/20 rounded-full blur-[100px]" />
            </div>
            <header className="absolute top-0 left-0 w-full p-6 z-20">
                <div className="container mx-auto flex items-center justify-between">
                    <div />
                    <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600 hover:bg-slate-200">
                        <Link href="/" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />Back to Home
                        </Link>
                    </Button>
                </div>
            </header>
            <div className="container mx-auto px-4 flex-grow flex items-center justify-center relative z-10 py-12">
                <div className="w-full max-w-lg">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-md mb-6 ring-1 ring-slate-100">
                                <div className="flex h-12 w-12 items-center justify-center">
                                    <img src="https://www.medikarya.in/medikarya.svg" alt="MediKarya Logo" className="h-full w-full object-contain" />
                                </div>
                            </div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl mb-3">
                                Partner with <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600">MediKarya</span>
                            </h1>
                            <p className="text-base text-slate-600">Empower your institution with next-gen clinical training.</p>
                        </div>
                        <Card className="overflow-hidden border-0 shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-slate-200/50 rounded-3xl p-8 sm:p-10">
                            {isSubmitted ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in duration-500">
                                    <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4 ring-1 ring-green-100">
                                        <Check className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">Request Received!</h3>
                                    <p className="text-slate-600 mb-6 max-w-xs mx-auto text-sm">
                                        Thank you for your interest. We'll be in touch shortly to discuss a custom plan for <strong>{institution}</strong>.
                                    </p>
                                    <Button asChild variant="outline" className="w-full"><Link href="/">Return to Homepage</Link></Button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-slate-700 ml-1">Full Name</label>
                                        <Input required placeholder="Dr. Rajesh Gupta" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl border-slate-200 bg-white/50 focus:border-brand-500 focus:ring-brand-500/20" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-slate-700 ml-1">Institution Name</label>
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                            <Input required placeholder="AIIMS Delhi / Apollo Hospitals" value={institution} onChange={(e) => setInstitution(e.target.value)} className="h-11 pl-10 rounded-xl border-slate-200 bg-white/50 focus:border-brand-500 focus:ring-brand-500/20" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-slate-700 ml-1">Work Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                            <Input required type="email" placeholder="rajesh.gupta@apollo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-10 rounded-xl border-slate-200 bg-white/50 focus:border-brand-500 focus:ring-brand-500/20" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-slate-700 ml-1">Message (Optional)</label>
                                        <Textarea placeholder="Tell us about your requirements..." value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[100px] rounded-xl border-slate-200 bg-white/50 focus:border-brand-500 focus:ring-brand-500/20 resize-none" />
                                    </div>
                                    <Button type="submit" disabled={isLoading} className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 shadow-lg text-white transition-all hover:-translate-y-0.5">
                                        {isLoading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Sending...</> : "Request Demo & Pricing"}
                                    </Button>
                                    <p className="text-xs text-slate-400 text-center pt-2">
                                        Prefer email? <a href="mailto:medikarya.in@gmail.com" className="text-brand-600 hover:underline">medikarya.in@gmail.com</a>
                                    </p>
                                </form>
                            )}
                        </Card>
                        <div className="mt-8 text-center text-sm text-slate-500">Trusted by educators for realistic AI simulations</div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
