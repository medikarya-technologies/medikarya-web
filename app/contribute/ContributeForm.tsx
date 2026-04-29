"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Check, Loader2, ArrowLeft, PenTool } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

export default function ContributeForm() {
    const [email, setEmail] = useState("")
    const [name, setName] = useState("")
    const [experience, setExperience] = useState("")
    const [specialty, setSpecialty] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) {
            toast({ title: "Email is required", description: "Please enter your professional email address.", variant: "destructive" })
            return
        }
        setIsLoading(true)
        try {
            const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_WRITER
            if (!endpoint) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            } else {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({ email, name, experience, specialty, role: "writer", source: "medikarya_contribute_page" }),
                })
                if (!res.ok) throw new Error("Submission failed")
            }
            setIsSubmitted(true)
            toast({ title: "Application Received! 🎓", description: "Our clinical board will review your profile shortly." })
        } catch {
            toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30 flex flex-col">
            {/* Decorative blobs */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-200/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-200/20 rounded-full blur-[120px]" />
            </div>

            {/* Back nav */}
            <header className="relative z-10 px-4 sm:px-8 pt-6">
                <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-brand-600 hover:bg-slate-100 cursor-pointer">
                    <Link href="/" className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </header>

            {/* Main content */}
            <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
                <div className="w-full max-w-md">
                    <div
                        className="space-y-6 animate-fade-in-up"
                    >
                        {/* Header */}
                        <div className="text-center space-y-3">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/30 mb-1">
                                <PenTool className="h-6 w-6" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                                Join as a{" "}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600">
                                    Case Contributor
                                </span>
                            </h1>
                            <p className="text-sm sm:text-base text-slate-500 max-w-sm mx-auto">
                                Craft clinical scenarios, share your expertise, and help train the next generation of doctors.
                            </p>
                        </div>

                        {/* Card */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl ring-1 ring-slate-200/60 p-6 sm:p-8">
                            {isSubmitted ? (
                                <div className="flex flex-col items-center text-center py-4 space-y-4">
                                    <div className="w-14 h-14 rounded-full bg-green-50 ring-1 ring-green-100 flex items-center justify-center text-green-600">
                                        <Check className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Application Sent!</h3>
                                        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                                            Our clinical board will review your profile and reach out shortly.
                                        </p>
                                    </div>
                                    <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                        <Link href="/">Return to Homepage</Link>
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label htmlFor="name" className="text-sm font-medium text-slate-700">
                                            Name &amp; Title
                                        </label>
                                        <Input
                                            id="name"
                                            type="text"
                                            placeholder="e.g. Dr. Rahul Verma (PG Resident)"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="h-10 rounded-lg border-slate-200 bg-white focus:border-brand-500 focus:ring-brand-500/20"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="email" className="text-sm font-medium text-slate-700">
                                            Professional Email <span className="text-red-400">*</span>
                                        </label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="priya.sharma@hospital.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                            className="h-10 rounded-lg border-slate-200 bg-white focus:border-brand-500 focus:ring-brand-500/20"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">Current Role</label>
                                            <Select value={experience} onValueChange={setExperience}>
                                                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white">
                                                    <SelectValue placeholder="Your role..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="student_4_5">4th/5th Year Student</SelectItem>
                                                    <SelectItem value="intern">Intern / HO</SelectItem>
                                                    <SelectItem value="resident">PG Resident</SelectItem>
                                                    <SelectItem value="fellow">Fellow</SelectItem>
                                                    <SelectItem value="attending">Consultant</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">Specialty</label>
                                            <Select value={specialty} onValueChange={setSpecialty}>
                                                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white">
                                                    <SelectValue placeholder="Specialty..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="internal_medicine">Internal Medicine</SelectItem>
                                                    <SelectItem value="family_medicine">Family Medicine</SelectItem>
                                                    <SelectItem value="pediatrics">Pediatrics</SelectItem>
                                                    <SelectItem value="surgery">Surgery</SelectItem>
                                                    <SelectItem value="cardiology">Cardiology</SelectItem>
                                                    <SelectItem value="neurology">Neurology</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full h-11 font-semibold rounded-lg bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white shadow-md hover:-translate-y-0.5 transition-all duration-200 mt-2 cursor-pointer"
                                    >
                                        {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> : "Submit Application"}
                                    </Button>

                                    <p className="text-xs text-slate-400 text-center">
                                        Join a community of clinical educators building the future of medical training.
                                    </p>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
