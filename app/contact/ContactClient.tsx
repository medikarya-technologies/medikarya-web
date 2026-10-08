"use client"

// Contact, in the site's own look (the enc-* theme of the home page). Three reasons to write, picked at the top:
// joining the Clinical Advisory Board (its own short application, so a professor knows exactly what they are applying
// for), a college or workshop, or anything else. All go to the same inbox (Formspree, NEXT_PUBLIC_FORMSPREE_INSTITUTION),
// marked with `source` so they can be told apart. A link can open a topic directly: /contact?topic=advisor.
// WhatsApp is offered beside the form for people who would rather message.

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Loader2, MessageCircle, Stethoscope, GraduationCap, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/cases/encounter-ui"
import { Footer } from "@/components/flowai/footer"

export type ContactTopic = "advisor" | "college" | "other"

/** The company's WhatsApp number, as wa.me wants it (country code, no + or spaces), and as people read it. */
const WHATSAPP = { link: "918796502901", shown: "+91 87965 02901" }

const TOPICS: Array<{ id: ContactTopic; label: string; icon: typeof Stethoscope }> = [
    { id: "advisor", label: "Clinical Advisory Board", icon: Stethoscope },
    { id: "college", label: "College or workshop", icon: GraduationCap },
    { id: "other", label: "Something else", icon: Mail },
]

const COPY: Record<ContactTopic, { eyebrow: string; title: string; lead: string; points: string[]; whatsapp: string; button: string; done: string }> = {
    advisor: {
        eyebrow: "MediKarya advisor programme",
        title: "Join the Clinical Advisory Board",
        lead: "You are applying to become an honorary member of MediKarya's Clinical Advisory Board: the senior clinicians who check that what our students practise on is right.",
        points: [
            "Verify our live cases: how each patient deteriorates, and what treats them",
            "Review cases in your specialty, by private link, with no sign-up",
            "Try new features first, and help decide what we build",
            "Honorary membership, a verifiable certificate, and your name on our contributors page",
        ],
        whatsapp: "Hello, I am interested in joining the MediKarya Clinical Advisory Board.",
        button: "Send my application",
        done: "Thank you. We will write to you within two working days, usually with a sample case so you can see exactly what reviewing involves.",
    },
    college: {
        eyebrow: "For colleges and faculty",
        title: "Bring MediKarya to your students",
        lead: "Run a workshop or a pilot, or give a whole batch access for a term. Tell us what you have in mind and we will work it out with you.",
        points: [
            "A session with your students on their own phones or laptops",
            "Access for a batch, for a workshop or a term",
            "What the batch found hard, case by case, afterwards",
        ],
        whatsapp: "Hello, I would like to discuss MediKarya for our college.",
        button: "Send",
        done: "Thank you. We will write to you within two working days.",
    },
    other: {
        eyebrow: "Contact",
        title: "Write to us",
        lead: "A question, a suggestion, or something that is not working. The founding team reads every message.",
        points: [],
        whatsapp: "Hello, I have a question about MediKarya.",
        button: "Send",
        done: "Thank you. We will reply within two working days.",
    },
}

const field =
    "h-11 w-full rounded-lg border border-enc-line-strong bg-enc-sheet px-3.5 text-[15px] text-enc-ink outline-none transition-colors placeholder:text-enc-ink-3 focus:border-brand-500"

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-[13.5px] font-semibold text-enc-ink">
                {label}
                {optional && <span className="font-normal text-enc-ink-3"> (optional)</span>}
            </span>
            {children}
        </label>
    )
}

export default function ContactClient({ initialTopic = "other" }: { initialTopic?: ContactTopic }) {
    const [topic, setTopic] = useState<ContactTopic>(initialTopic)
    const [f, setF] = useState({ name: "", designation: "", specialty: "", institution: "", email: "", whatsapp: "", message: "" })
    const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
    const copy = COPY[topic]
    const advisor = topic === "advisor"
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setState("sending")
        try {
            const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_INSTITUTION
            // No inbox connected: never tell someone their message was sent when it was not.
            if (!endpoint) throw new Error("This form is not connected")
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    ...f,
                    topic: TOPICS.find((t) => t.id === topic)?.label,
                    source: advisor ? "medikarya_advisor_application" : topic === "college" ? "medikarya_institution_contact" : "medikarya_contact",
                }),
            })
            if (!res.ok) throw new Error("Form submission failed")
            setState("sent")
        } catch {
            setState("error")
        }
    }

    const wa = `https://wa.me/${WHATSAPP.link}?text=${encodeURIComponent(copy.whatsapp)}`

    return (
        <main className="flex min-h-screen flex-col bg-enc-desk">
            <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-20 sm:px-6">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-enc-ink-2 hover:text-enc-ink">
                    <ArrowLeft className="h-4 w-4" /> Back to home
                </Link>

                {/* what are you writing about */}
                <div role="tablist" aria-label="What are you writing about?" className="mt-8 flex flex-wrap gap-2">
                    {TOPICS.map((t) => {
                        const on = t.id === topic
                        return (
                            <button
                                key={t.id}
                                role="tab"
                                aria-selected={on}
                                onClick={() => {
                                    setTopic(t.id)
                                    setState("idle")
                                }}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors",
                                    on ? "border-brand-600 bg-brand-600 text-white" : "border-enc-line-strong bg-enc-sheet text-enc-ink-2 hover:text-enc-ink"
                                )}
                            >
                                <t.icon className="h-4 w-4" />
                                {t.label}
                            </button>
                        )
                    })}
                </div>

                <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
                    {/* left: what this is */}
                    <div>
                        <Eyebrow className="text-brand-600">{copy.eyebrow}</Eyebrow>
                        <h1 className="mt-3 text-[2.2rem] leading-[1.1] font-bold tracking-tight text-enc-ink sm:text-[2.6rem]">{copy.title}</h1>
                        <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-enc-ink-2">{copy.lead}</p>

                        {copy.points.length > 0 && (
                            <ul className="mt-6 max-w-lg space-y-3">
                                {copy.points.map((p) => (
                                    <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-enc-ink">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                                            <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                                        </span>
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {advisor && (
                            <p className="mt-5 max-w-lg text-[14px] text-enc-ink-3">Membership is honorary. A few cases a month, about 15 minutes each, whenever suits you.</p>
                        )}

                        {/* prefer to message */}
                        <div className="mt-8 max-w-lg rounded-xl border border-enc-line-strong bg-enc-sheet p-5">
                            <p className="text-[15px] font-semibold text-enc-ink">Rather message us?</p>
                            <p className="mt-1 text-[14px] text-enc-ink-2">WhatsApp {WHATSAPP.shown}, or email collab@medikarya.in.</p>
                            <div className="mt-4 flex flex-wrap gap-2.5">
                                <a
                                    href={wa}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg bg-[#1FA855] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#178C46]"
                                >
                                    <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
                                </a>
                                <a
                                    href="mailto:collab@medikarya.in"
                                    className="inline-flex items-center gap-2 rounded-lg border border-enc-line-strong px-4 py-2.5 text-[14px] font-semibold text-enc-ink hover:bg-enc-desk"
                                >
                                    <Mail className="h-4 w-4" /> Email us
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* right: the form */}
                    <div className="rounded-2xl border border-enc-line-strong bg-enc-sheet p-6 shadow-enc-lift sm:p-8">
                        {state === "sent" ? (
                            <div className="flex flex-col items-start py-4">
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                                    <Check className="h-6 w-6" strokeWidth={2.4} />
                                </span>
                                <h2 className="mt-4 text-[1.4rem] font-bold text-enc-ink">{advisor ? "Application received" : "Message received"}</h2>
                                <p className="mt-2 text-[15px] leading-relaxed text-enc-ink-2">{copy.done}</p>
                                <Link href={advisor ? "/contributors#advisors" : "/"} className="mt-6 text-[15px] font-semibold text-brand-600 hover:underline">
                                    {advisor ? "Meet the people already involved" : "Back to the home page"}
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={submit} className="space-y-4">
                                <p className="text-[1.15rem] font-bold text-enc-ink">{advisor ? "Your application" : "Your message"}</p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Full name">
                                        <input required className={field} value={f.name} onChange={set("name")} placeholder={advisor ? "Dr. Anjali Mehra" : "Your name"} />
                                    </Field>
                                    {advisor ? (
                                        <Field label="Designation">
                                            <input required className={field} value={f.designation} onChange={set("designation")} placeholder="Professor of Medicine" />
                                        </Field>
                                    ) : (
                                        <Field label="College or institution" optional={topic !== "college"}>
                                            <input required={topic === "college"} className={field} value={f.institution} onChange={set("institution")} placeholder="e.g. MAMC, New Delhi" />
                                        </Field>
                                    )}
                                </div>
                                {advisor && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Specialty">
                                            <input required className={field} value={f.specialty} onChange={set("specialty")} placeholder="e.g. Cardiology" />
                                        </Field>
                                        <Field label="Institution">
                                            <input required className={field} value={f.institution} onChange={set("institution")} placeholder="e.g. MAMC, New Delhi" />
                                        </Field>
                                    </div>
                                )}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Email">
                                        <input required type="email" className={field} value={f.email} onChange={set("email")} placeholder="you@college.ac.in" />
                                    </Field>
                                    <Field label="WhatsApp number" optional>
                                        <input type="tel" inputMode="tel" className={field} value={f.whatsapp} onChange={set("whatsapp")} placeholder="e.g. 98765 43210" />
                                    </Field>
                                </div>
                                <Field label={advisor ? "Anything you would like us to know" : "Message"} optional={advisor}>
                                    <textarea
                                        required={!advisor}
                                        rows={4}
                                        className={cn(field, "h-auto resize-none py-2.5")}
                                        value={f.message}
                                        onChange={set("message")}
                                        placeholder={advisor ? "e.g. the kinds of cases you would like to review" : topic === "college" ? "e.g. a workshop for our final-year batch before their clinical postings" : "How can we help?"}
                                    />
                                </Field>

                                {state === "error" && (
                                    <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-[14px] text-red-800">
                                        That did not go through. Please try again, or message us on WhatsApp.
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    disabled={state === "sending"}
                                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                                >
                                    {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {state === "sending" ? "Sending…" : copy.button}
                                </button>
                                <p className="text-center text-[12.5px] text-enc-ink-3">We reply ourselves, usually within two working days.</p>
                            </form>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    )
}
