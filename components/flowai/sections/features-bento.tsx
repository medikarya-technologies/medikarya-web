"use client"

import { cn } from "@/lib/utils"
import { motion, useScroll, useTransform, useMotionTemplate, useMotionValue, AnimatePresence, useReducedMotion } from "framer-motion"
import { useRef, MouseEvent, useState } from "react"
import { Activity, CheckCircle, MessageSquare, ArrowRight, User, BookOpen, HelpCircle } from "lucide-react"

export default function FeaturesBento() {
    const shouldReduceMotion = useReducedMotion()
    const containerRef = useRef<HTMLElement>(null)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    })

    const y = useTransform(scrollYProgress, [0, 1], [100, -100])

    // Mouse tracking for subtle spotlight effect
    let mouseX = useMotionValue(0)
    let mouseY = useMotionValue(0)

    function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
        let { left, top } = currentTarget.getBoundingClientRect()
        mouseX.set(clientX - left)
        mouseY.set(clientY - top)
    }

    // --- Circuit Connector Logic ---
    const { scrollYProgress: connectorScroll } = useScroll({
        target: containerRef,
        offset: ["start 80%", "start 20%"]
    })

    const pathDraw = useTransform(connectorScroll, [0, 1], [0, 1])
    const pathOpacity = useTransform(connectorScroll, [0, 0.2], [0, 1])

    return (
        <section id="features" ref={containerRef} className="py-24 sm:py-32 bg-slate-50 relative overflow-hidden group" onMouseMove={handleMouseMove}>

            {/* Top Gradient Blend */}
            <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#fffbeb] to-slate-50 z-0 pointer-events-none" />

            {/* Circuit Connector SVG */}
            <div className="absolute top-0 left-0 right-0 h-[200px] z-0 pointer-events-none overflow-visible">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 relative h-full">
                    <svg className="absolute top-0 left-0 w-full h-full text-slate-300" style={{ overflow: 'visible' }}>
                        <defs>
                            <linearGradient id="circuit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#cbd5e1" />
                                <stop offset="100%" stopColor="#3b82f6" />
                            </linearGradient>
                        </defs>
                        {/* Desktop Path */}
                        <motion.path
                            d="M 56.5 -10 V 40 Q 56.5 120 150 120 L 200 120 L 200 180"
                            fill="none"
                            stroke="url(#circuit-gradient)"
                            strokeWidth="2"
                            strokeLinecap="square"
                            className="hidden lg:block"
                            style={{ pathLength: shouldReduceMotion ? 1 : pathDraw, opacity: shouldReduceMotion ? 1 : pathOpacity }}
                        />
                        {/* Mobile Path */}
                        <motion.path
                            d="M 18 -10 V 40 Q 18 120 100 120 L 200 120 L 200 180"
                            fill="none"
                            stroke="url(#circuit-gradient)"
                            strokeWidth="4"
                            strokeLinecap="square"
                            className="lg:hidden"
                            style={{ pathLength: shouldReduceMotion ? 1 : pathDraw, opacity: shouldReduceMotion ? 1 : pathOpacity }}
                        />
                        <motion.circle cx="200" cy="180" r="4" fill="#3b82f6" style={{ scale: shouldReduceMotion ? 1 : pathDraw, opacity: shouldReduceMotion ? 1 : pathOpacity }} />
                    </svg>
                </div>
            </div>

            {/* Aurora Background (Subtle) */}
            <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-multiply">
                <div className={cn("absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-200/40 rounded-full blur-3xl", !shouldReduceMotion && "animate-pulse")} style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent-200/40 rounded-full blur-3xl" />
            </div>

            {/* Interactive Spotlight */}
            <motion.div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-500 group-hover:opacity-100 mix-blend-soft-light"
                style={{
                    background: useMotionTemplate`
                    radial-gradient(
                        600px circle at ${mouseX}px ${mouseY}px,
                        rgba(255, 255, 255, 0.4),
                        transparent 80%
                    )
                  `
                }}
            />

            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10 pt-12">
                <div className="mx-auto max-w-2xl text-center mb-16 relative">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 mb-6 text-xs font-semibold text-slate-600 uppercase tracking-widest relative z-20 shadow-sm hover:border-brand-200 transition-colors"
                    >
                        <Activity className="w-3 h-3 text-brand-500" />
                        Platform Overview
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.4 }}
                        className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl mb-6 leading-tight"
                    >
                        Inside The <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600 font-extrabold relative">
                            Clinical Engine
                            <svg className="absolute w-full h-3 -bottom-1 left-0 text-brand-200/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                            </svg>
                        </span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.4 }}
                        className="text-lg leading-relaxed text-slate-600 font-light"
                    >
                        A unified operating system for medical education.
                        Precision-engineered for clinical fidelity.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

                    {/* BENTO 1: AI Patient Engine (Interactive Scenario) */}
                    <InteractivePatientCard />

                    {/* BENTO 2: Feedback (Premium Report Card) — 1 col */}
                    <div className="md:col-span-1 min-h-[480px] rounded-[2rem] bg-brand-50/50 border border-brand-100 p-2 shadow-lg relative overflow-hidden group hover:border-brand-200 transition-all">
                        <div className="h-full w-full bg-white rounded-[1.5rem] border border-white/50 overflow-hidden flex flex-col items-stretch shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)]">

                            {/* Left Text */}
                            <div className="p-8 md:p-10 flex-1 flex flex-col justify-center relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 bg-brand-50 rounded-xl border border-brand-100 shadow-sm">
                                        <CheckCircle className="w-5 h-5 text-brand-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">Precision Feedback</h3>
                                </div>
                                <p className="text-slate-600 text-sm md:text-base mb-6 max-w-lg leading-relaxed">
                                    Forget generic grades. Get a detailed breakdown of your <span className="text-brand-600 font-semibold">clinical reasoning</span>, missed checks, and diagnostic accuracy in real-time.
                                </p>
                                <div className="flex items-center gap-2 text-brand-600 text-xs font-bold uppercase tracking-widest cursor-pointer hover:underline group/link">
                                    View Full Report <ArrowRight className="w-3 h-3 transition-transform group-hover/link:translate-x-1" />
                                </div>
                            </div>

                            {/* Right Live Report UI (Paper Sheet Style) */}
                            <div className="flex-1 bg-slate-50 relative p-8 flex flex-col justify-center items-center overflow-hidden">
                                {/* Background Pattern */}
                                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(var(--brand-600) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                                {/* Report Card */}
                                <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-100 p-5 max-w-xs w-full rotate-2 group-hover:rotate-0 transition-transform duration-500 relative">
                                    {/* Grade Stamp */}
                                    <div className="absolute -top-3 -right-3 w-14 h-14 bg-brand-600 rounded-full flex items-col items-center justify-center text-white shadow-lg shadow-brand-200 border-4 border-white rotate-12">
                                        <span className="text-2xl font-bold leading-none">A</span>
                                    </div>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="relative w-14 h-14">
                                            <svg className="w-full h-full -rotate-90">
                                                <circle cx="28" cy="28" r="24" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                                                <motion.circle
                                                    cx="28" cy="28" r="24"
                                                    className="stroke-brand-600" strokeWidth="4" fill="none"
                                                    strokeDasharray="150" strokeDashoffset="150"
                                                    whileInView={{ strokeDashoffset: 12 }}
                                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center font-bold text-slate-800 text-sm">92%</div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 text-sm">Diagnosis</div>
                                            <div className="text-[10px] text-slate-500 font-medium bg-accent-50 text-accent-700 px-1.5 py-0.5 rounded inline-block mt-0.5">EXCELLENT</div>
                                        </div>
                                    </div>

                                    {/* Detailed Bars */}
                                    <div className="space-y-3">
                                        {[
                                            { label: "Differential", val: 95, color: "bg-brand-500" },
                                            { label: "Testing", val: 88, color: "bg-brand-400" },
                                            { label: "Empathy", val: 92, color: "bg-brand-300" }
                                        ].map((stat, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mb-1">
                                                    <span>{stat.label}</span>
                                                    <span className="text-slate-700">{stat.val}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        whileInView={{ width: `${stat.val}%` }}
                                                        transition={{ duration: 0.8, delay: 0.2 + (i * 0.1) }}
                                                        className={`h-full ${stat.color} rounded-full`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BENTO 3: Personalized MCQ Quiz Card */}
                    <MockQuizCard />

                    {/* BENTO 4: Curriculum-Aligned Case Library Card */}
                    <CaseLibraryCard />

                </div>
            </div>
        </section>
    )
}

function InteractivePatientCard() {
    const [status, setStatus] = useState<"idle" | "success" | "wrong">("idle")

    const handleChoice = (isCorrect: boolean) => {
        if (isCorrect) {
            setStatus("success")
        } else {
            setStatus("wrong")
            setTimeout(() => setStatus("idle"), 1500)
        }
    }

    return (
        <div className={cn(
            "md:col-span-2 min-h-[480px] rounded-[2rem] border shadow-xl transition-all duration-700 p-3 relative overflow-hidden group",
            status === "success"
                ? "bg-emerald-50/50 border-emerald-200 shadow-emerald-100"
                : "bg-slate-50 border-slate-200 shadow-slate-200/50"
        )}>
            {/* "Hardware" Casing */}
            <div className="relative h-full w-full bg-white rounded-[1.5rem] overflow-hidden border border-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] flex flex-col">

                {/* Window Header */}
                <div className="h-12 bg-slate-50 border-b border-slate-100 flex items-center px-4 justify-between select-none">
                    <div className="flex gap-2 items-center">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm text-slate-400">
                            <User className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-700">Patient Simulator</div>
                            <div className="text-[10px] text-slate-500 font-mono">v4.2.1 • Interactive</div>
                        </div>
                    </div>
                </div>

                {/* Live Chat UI */}
                <div className="flex-1 relative bg-slate-50/50 flex flex-col">
                    <div className="flex-1 p-6 flex flex-col gap-5 overflow-hidden relative">
                        {/* Patient Message */}
                        <div className="flex gap-4 max-w-[90%]">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Patient" className="w-full h-full" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] text-slate-500 ml-1 font-medium">James (Patient)</span>
                                <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm text-sm text-slate-700 leading-relaxed">
                                    Doctor, the pain gets worse when I lie flat. It feels heavy... like someone is sitting on my chest.
                                </div>
                            </div>
                        </div>

                        {/* User Choices / Result */}
                        <AnimatePresence mode="wait">
                            {status === "idle" || status === "wrong" ? (
                                <motion.div
                                    key="choices"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex flex-col gap-2 self-end w-full max-w-[85%]"
                                >
                                    <div className="text-[10px] text-slate-500 text-right font-medium uppercase tracking-wider mb-1">Choose your response</div>

                                    <button
                                        onClick={() => handleChoice(false)}
                                        className={cn(
                                            "w-full text-left p-3 rounded-xl text-sm border transition-all duration-200 bg-white hover:bg-slate-50 hover:border-brand-200",
                                            status === "wrong" ? "border-red-300 bg-red-50 text-red-600 animate-shake" : "border-slate-200 text-slate-600"
                                        )}
                                    >
                                        "I'll prescribe you some painkillers for the heaviness."
                                    </button>

                                    <button
                                        onClick={() => handleChoice(true)}
                                        className="w-full text-left p-3 rounded-xl text-sm border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 hover:shadow-md transition-all duration-200 text-slate-700 font-medium group"
                                    >
                                        <span className="flex items-center justify-between">
                                            "Does the pain radiate anywhere? To your arm or jaw?"
                                            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-brand-500" />
                                        </span>
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col gap-4 w-full"
                                >
                                    {/* The "Right" Question shown as sent */}
                                    <div className="flex gap-4 flex-row-reverse self-end max-w-[90%] opacity-80">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0 border border-white">
                                            <div className="w-6 h-6 rounded-full bg-brand-500" />
                                        </div>
                                        <div className="bg-brand-600 p-3 rounded-2xl rounded-tr-sm text-sm text-white">
                                            Does the pain radiate anywhere? To your arm or jaw?
                                        </div>
                                    </div>

                                    {/* The Breakthrough Response */}
                                    <div className="flex gap-4 max-w-[90%]">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden relative">
                                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Patient" className="w-full h-full" />
                                            <div className="absolute inset-0 bg-emerald-500/20 mix-blend-overlay" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="bg-emerald-50 p-4 rounded-2xl rounded-tl-sm border border-emerald-100 shadow-sm text-sm text-slate-800 leading-relaxed relative overflow-hidden">
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400" />
                                                "Actually... yes. My **left arm feels completely numb**, and my jaw aches."
                                            </div>
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.5 }}
                                                className="inline-flex items-center gap-1.5 bg-emerald-100/50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest self-start"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Clinical Insight Unlocked
                                            </motion.div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Floating Guide */}
            <div className={cn(
                "absolute bottom-6 left-6 right-6 p-4 backdrop-blur-xl rounded-2xl border shadow-lg transition-all duration-500 z-20 flex items-center gap-3",
                status === "success"
                    ? "bg-emerald-50/90 border-emerald-200 translate-y-0 opacity-100"
                    : "bg-white/95 border-slate-200 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
            )}>
                <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", status === "success" ? "bg-emerald-100 border-emerald-200 text-emerald-600" : "bg-brand-50 border-brand-100 text-brand-600")}>
                    {status === "success" ? <CheckCircle className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                </div>
                <div>
                    <h3 className={cn("text-sm font-bold", status === "success" ? "text-emerald-900" : "text-slate-900")}>
                        {status === "success" ? "Critical Symptom Found" : "Natural Language Engine"}
                    </h3>
                    <p className={cn("text-xs", status === "success" ? "text-emerald-700" : "text-slate-500")}>
                        {status === "success" ? "You identified the radiation pattern." : "Dynamic conversations with real patients."}
                    </p>
                </div>
            </div>
        </div>
    )
}

function MockQuizCard() {
    const [selected, setSelected] = useState<number | null>(null)

    return (
        <div className="md:col-span-1 min-h-[480px] rounded-[2rem] bg-indigo-50/50 border border-indigo-100 p-2 shadow-lg relative overflow-hidden group hover:border-indigo-200 transition-all">
            <div className="h-full w-full bg-white rounded-[1.5rem] border border-white/50 overflow-hidden flex flex-col justify-between shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)]">
                
                {/* Content Area */}
                <div className="p-8 flex-1 flex flex-col justify-start relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm">
                            <HelpCircle className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">Adaptive MCQs</h3>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6">
                        Whenever you make a mistake in a case, our generator maps your diagnostic gaps and drafts progressive questions to reinforce the knowledge.
                    </p>
                </div>

                {/* Mock Quiz UI */}
                <div className="px-6 pb-8 bg-slate-50 border-t border-slate-100 p-6 flex flex-col gap-3">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dynamic Assessment</div>
                    <div className="text-xs font-semibold text-slate-800 leading-snug">
                        Which of the following is the most appropriate next step for an inferior wall MI?
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        {[
                            { id: 1, text: "Prescribe oral NSAIDs", correct: false },
                            { id: 2, text: "Emergent coronary angiography", correct: true },
                            { id: 3, text: "Observe in wards for 24h", correct: false }
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setSelected(opt.id)}
                                className={cn(
                                    "w-full text-left p-2.5 rounded-lg text-xs border transition-all duration-200 flex items-center justify-between",
                                    selected === opt.id
                                        ? opt.correct
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 font-medium"
                                            : "border-red-200 bg-red-50 text-red-700"
                                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                    )}
                            >
                                <span>{opt.text}</span>
                                {selected === opt.id && (
                                    opt.correct ? (
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    ) : (
                                        <span className="text-[10px] font-bold text-red-500 uppercase">Incorrect</span>
                                    )
                                )}
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    )
}

function CaseLibraryCard() {
    return (
        <div className="md:col-span-2 min-h-[480px] rounded-[2rem] bg-slate-100 border border-slate-200 p-2 shadow-lg relative overflow-hidden group hover:border-slate-300 transition-all">
            <div className="h-full w-full bg-white rounded-[1.5rem] border border-white/50 overflow-hidden flex flex-col justify-between shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                
                {/* Text Section */}
                <div className="p-8 md:p-10 flex-1 flex flex-col justify-center relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                            <BookOpen className="w-5 h-5 text-slate-700" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">Syllabus-Aligned Library</h3>
                    </div>
                    <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6 max-w-xl">
                        Practice real-world clinical cases mapped to the standard MBBS curriculum. Diagnose and manage conditions across core clinical departments:
                    </p>
                    
                    {/* Departement Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                        {[
                            { name: "Pediatrics", desc: "Neonatal Jaundice, Dehydration", color: "from-blue-500/10 to-cyan-500/10 text-blue-800 border-blue-200" },
                            { name: "Obstetrics & Gynecology", desc: "Pregnancy Anemia, Pre-eclampsia", color: "from-rose-500/10 to-pink-500/10 text-rose-800 border-rose-200" },
                            { name: "General Medicine", desc: "Severe Migraine, Chest Pain", color: "from-indigo-500/10 to-violet-500/10 text-indigo-800 border-indigo-200" },
                            { name: "Gastroenterology", desc: "Viral Gastroenteritis, Colitis", color: "from-emerald-500/10 to-teal-500/10 text-emerald-800 border-emerald-200" }
                        ].map((dept, idx) => (
                            <div key={idx} className={cn("p-3 rounded-xl border bg-gradient-to-r flex flex-col gap-1", dept.color)}>
                                <span className="font-bold text-xs">{dept.name}</span>
                                <span className="text-[10px] opacity-80 leading-tight">{dept.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    )
}
