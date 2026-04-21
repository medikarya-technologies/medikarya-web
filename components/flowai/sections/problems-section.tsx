"use client"

import { cn } from "@/lib/utils"
import { useRef, useState } from "react"
import { motion, useScroll, useMotionValueEvent, AnimatePresence, Variants } from "framer-motion"
import {
    AlertCircle, Activity,
    Calendar, Lock, User,
    MoreVertical, Battery, Signal
} from "lucide-react"

export default function ProblemsSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    })

    const [activeCard, setActiveCard] = useState(0)

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        // Adjusted thresholds for deep scrolling
        if (latest < 0.3) {
            setActiveCard(0)
        } else if (latest < 0.6) {
            setActiveCard(1)
        } else {
            setActiveCard(2)
        }
    })

    const content = [
        {
            title: "Limited Clinical Exposure",
            description: "Students struggle to encounter a wide enough variety of cases. You might see 50 diabetes cases but never see a rare cardiac condition until your first shift as a doctor.",
            highlight: "The Gap",
            color: "brand",
            bg: "bg-slate-50"
        },
        {
            title: "Fragmented Feedback",
            description: "In a busy hospital, doctors don't have time to grade every interaction. Mistakes go unnoticed, and bad habits form silently over years of training.",
            highlight: "The Risk",
            color: "red",
            bg: "bg-red-50/50"
        },
        {
            title: "Resource Constraints",
            description: "Simulation labs are expensive and booked months in advance. Most students get less than 10 hours of high-fidelity practice per semester.",
            highlight: "The Variable",
            color: "amber",
            bg: "bg-amber-50/50"
        }
    ]

    // Cinematic Text Variants
    const textVariants: Variants = {
        hidden: { opacity: 0, y: 50 },
        visible: (custom: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: custom * 0.2,
                duration: 1.2, // Cinematic Slow Drift 
                ease: [0.25, 0.4, 0.25, 1] // Custom refined ease (Quart-like)
            }
        })
    }

    return (
        <motion.section
            ref={containerRef}
            className="relative transition-colors duration-1000 ease-in-out"
            animate={{
                backgroundColor: activeCard === 0 ? "#f8fafc" : // slate-50
                    activeCard === 1 ? "#fef2f2" : // red-50
                        "#fffbeb" // amber-50
            }}
        >
            {/* Medical Grid Pattern for Texture */}
            <div className="absolute inset-0 z-0 opacity-[0.4] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />

            {/* Sticky Container */}
            <div className="mx-auto max-w-7xl px-4 md:px-8 relative z-10">
                <div className="flex flex-col lg:flex-row">

                    {/* LEFT: Scrolling Text Narrative */}
                    <div className="flex-1 lg:py-0 relative snap-y snap-mandatory h-full">
                        {/* Connecting Dashed Line */}
                        <div className="absolute left-0 top-0 bottom-0 w-px border-l-2 border-dashed border-slate-200 hidden lg:block" style={{ left: '1.5rem' }} />

                        <div className="lg:h-[50vh]" /> {/* Deep Spacer Top */}

                        {content.map((item, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex flex-col justify-center min-h-[90vh] lg:min-h-[100vh] snap-center snap-always transition-all duration-500 pl-4 lg:pl-16 relative py-12 lg:py-20", // Reduced padding for mobile
                                    activeCard === index ? "opacity-100" : "opacity-30 blur-sm"
                                )}
                            >
                                {/* Timeline Dot */}
                                <div className={cn(
                                    "absolute left-0 lg:left-6 lg:-translate-x-1/2 w-1 h-full lg:w-4 lg:h-4 lg:rounded-full lg:border-4 border-white shadow-sm transition-colors duration-500", // Bar on mobile, Dot on desktop
                                    activeCard === index ?
                                        (item.color === "brand" ? "bg-brand-500" : item.color === "red" ? "bg-red-500" : "bg-amber-500")
                                        : "bg-slate-200"
                                )} />

                                <div className="pl-4 lg:pl-0">
                                    <motion.span
                                        className={cn(
                                            "text-xs md:text-sm font-bold tracking-wider uppercase mb-4 block",
                                            item.color === "brand" ? "text-brand-600" :
                                                item.color === "red" ? "text-red-500" : "text-amber-500"
                                        )}
                                        custom={0}
                                        variants={textVariants}
                                        initial="hidden"
                                        animate={activeCard === index ? "visible" : "hidden"}
                                    >
                                        0{index + 1} — {item.highlight}
                                    </motion.span>

                                    <motion.h2
                                        className="text-2xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight"
                                        custom={1}
                                        variants={textVariants}
                                        initial="hidden"
                                        animate={activeCard === index ? "visible" : "hidden"}
                                    >
                                        {item.title}
                                    </motion.h2>

                                    <motion.p
                                        className="text-base md:text-lg text-slate-600 leading-relaxed max-w-lg mb-8"
                                        custom={2}
                                        variants={textVariants}
                                        initial="hidden"
                                        animate={activeCard === index ? "visible" : "hidden"}
                                    >
                                        {item.description}
                                    </motion.p>
                                </div>
                            </div>
                        ))}

                        <div className="lg:h-[80vh]" /> {/* Spacer bottom */}
                    </div>

                    {/* RIGHT: Sticky Visuals */}
                    <div className="hidden lg:block flex-1 relative h-screen sticky top-0">
                        <div className="absolute inset-0 flex items-center justify-center py-10 px-8">
                            <div className="relative w-full h-full max-h-[85vh] bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-slate-200/80 border border-slate-800 ring-1 ring-slate-900/5 overflow-hidden flex flex-col group transition-all duration-700">
                                {/* Tablet Header/Status Bar */}
                                <div className="h-8 bg-slate-950 flex items-center justify-between px-6 text-[10px] text-slate-400 font-mono tracking-widest uppercase border-b border-slate-800 z-20">
                                    <div className="flex gap-2 items-center">
                                        <Signal className="w-3 h-3" /> MED-OS v4.2
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        100% <Battery className="w-3 h-3" />
                                    </div>
                                </div>

                                <div className="relative flex-1 bg-slate-50 overflow-hidden">
                                    <AnimatePresence mode="wait">
                                        {activeCard === 0 && <VisualPatientChart key="chart" />}
                                        {activeCard === 1 && <VisualPager key="pager" />}
                                        {activeCard === 2 && <VisualScheduler key="scheduler" />}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </motion.section>
    )
}

// Visual 1: The Incomplete Patient Chart
function VisualPatientChart() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col bg-slate-50"
        >
            {/* Header */}
            <div className="bg-white p-6 border-b border-slate-200 flex justify-between items-start shadow-sm z-10">
                <div className="flex gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">Patient #8942-A</h3>
                            <span className="bg-red-100 text-red-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">High Priority</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-1">DOB: 12/05/1984 | ID: 44291</div>
                    </div>
                </div>
                <Activity className="text-brand-500 h-6 w-6" />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 p-6 space-y-6 overflow-hidden relative">

                {/* Vitals Section - VISIBLE */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Vitals Monitor</div>
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: "HR", value: "88", unit: "bpm" },
                            { label: "BP", value: "120/80", unit: "mmHg" },
                            { label: "O2", value: "98", unit: "%" },
                            { label: "TEMP", value: "37.2", unit: "°C" }
                        ].map((v, i) => (
                            <div key={i} className="text-center">
                                <div className="text-lg font-bold text-slate-900">{v.value}</div>
                                <div className="text-[10px] text-slate-500">{v.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* History Section - BLURRED/REDACTED */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden group">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex justify-between">
                        <span>Medical History</span>
                        <Lock className="w-3 h-3 text-red-400" />
                    </div>
                    <div className="space-y-3 blur-[4px] opacity-60 select-none">
                        <div className="h-3 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 rounded w-full" />
                        <div className="h-3 bg-slate-200 rounded w-5/6" />
                        <div className="h-3 bg-slate-200 rounded w-2/3" />
                    </div>

                    {/* Overlay Warning */}
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center gap-2 border border-slate-700"
                        >
                            <AlertCircle className="w-8 h-8 text-red-500 mb-1" />
                            <span className="text-sm font-bold tracking-widest text-red-100">ACCESS RESTRICTED</span>
                            <span className="text-[10px] uppercase font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                                Error: Insufficient Experience Level
                            </span>
                        </motion.div>
                    </div>
                </div>

                {/* Lab Results - PARTIAL */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Lab Results</div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs py-2 border-b border-slate-50">
                            <span className="text-slate-600">Hemoglobin</span>
                            <span className="font-mono text-slate-900">14.2 g/dL</span>
                        </div>
                        <div className="flex justify-between text-xs py-2 border-b border-slate-50">
                            <span className="text-slate-600">WBC Count</span>
                            <span className="font-mono text-red-500 font-bold">MISSING</span>
                        </div>
                        <div className="flex justify-between text-xs py-2">
                            <span className="text-slate-600">Platelets</span>
                            <span className="font-mono text-red-500 font-bold">PENDING</span>
                        </div>
                    </div>
                </div>

            </div>
        </motion.div>
    )
}

// Visual 2: The Ghosted Pager
function VisualPager() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col bg-slate-100"
        >
            {/* App Header */}
            <div className="bg-white p-4 border-b border-slate-200 flex items-center gap-3 shadow-sm z-10">
                <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    DR
                </div>
                <div>
                    <div className="font-bold text-sm text-slate-900">Dr. Sharma (Attending)</div>
                    <div className="text-xs text-brand-600 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-brand-500 rounded-full" /> Online
                    </div>
                </div>
                <MoreVertical className="ml-auto text-slate-400 w-5 h-5" />
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-6 space-y-4 overflow-hidden flex flex-col justify-end">
                {/* Previous Messages */}
                <div className="flex flex-col gap-1 items-start opacity-60">
                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl rounded-tl-sm text-xs text-slate-600 shadow-sm max-w-[85%]">
                        Patient in Bed 4 is complaining of chest pain. ECG shows ST elevation?
                    </div>
                    <div className="text-[10px] text-slate-500 pl-2">Yesterday 2:40 PM</div>
                </div>

                {/* The "Ghosted" Message Sequence */}
                <div className="flex flex-col gap-2 items-end mt-4">
                    <div className="bg-brand-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-xs shadow-md max-w-[85%] leading-relaxed">
                        Dr. Sharma, I'm unsure about the dosage for Mrs. Gupta. Can you review?
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-brand-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-xs shadow-md max-w-[85%] leading-relaxed opacity-90"
                    >
                        BP is dropping to 90/60. Should I start fluids?
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.5 }}
                        className="bg-brand-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-xs shadow-md max-w-[85%] leading-relaxed opacity-80"
                    >
                        Sir? Please advise.
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.5 }}
                        className="flex items-center gap-1 text-[10px] text-slate-400 pr-2 font-medium mt-1"
                    >
                        Read 10:42 AM <span className="text-brand-600">✓✓</span>
                    </motion.div>
                </div>
            </div>

            {/* Input Area (Disabled) */}
            <div className="bg-white p-4 border-t border-slate-200">
                <div className="bg-slate-100 rounded-full h-10 px-4 flex items-center text-slate-400 text-sm">
                    Typing disabled...
                </div>
            </div>
        </motion.div>
    )
}

// Visual 3: The Booked Scheduler
function VisualScheduler() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col bg-white"
        >
            {/* Calendar Header */}
            <div className="p-6 border-b border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800">Sim Lab Booking</h3>
                    <Calendar className="text-slate-400 w-5 h-5" />
                </div>
                <div className="flex gap-2 text-sm border-b border-slate-100 pb-2">
                    <div className="px-3 py-1 bg-slate-900 text-white rounded-md font-medium">Today</div>
                    <div className="px-3 py-1 text-slate-500">Tomorrow</div>
                    <div className="px-3 py-1 text-slate-500">Next Week</div>
                </div>
            </div>

            {/* Time Slots Grid */}
            <div className="flex-1 p-4 overflow-hidden">
                <div className="space-y-2">
                    {[
                        { time: "09:00 AM", status: "booked" },
                        { time: "10:00 AM", status: "booked" },
                        { time: "11:00 AM", status: "tech" },
                        { time: "12:00 PM", status: "booked" },
                        { time: "01:00 PM", status: "booked" },
                        { time: "02:00 PM", status: "booked" },
                    ].map((slot, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex gap-4 items-center group"
                        >
                            <div className="w-16 text-xs text-slate-500 font-mono text-right">{slot.time}</div>
                            <div className={cn(
                                "flex-1 h-12 rounded-lg border flex items-center px-4 justify-between transition-all",
                                slot.status === "booked" ? "bg-red-50 border-red-100 opacity-60" : "bg-slate-50 border-slate-100"
                            )}>
                                <span className={cn(
                                    "text-xs font-bold uppercase",
                                    slot.status === "booked" ? "text-red-600" : "text-slate-500"
                                )}>
                                    {slot.status === "booked" ? "Occupied" : "Maintenance"}
                                </span>
                                {slot.status === "booked" ? (
                                    <Lock className="w-3 h-3 text-red-300" />
                                ) : (
                                    <Activity className="w-3 h-3 text-slate-300" />
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Error Banner */}
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-6 bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3"
                >
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                        <div className="text-xs font-bold text-amber-900">No Slots Available</div>
                        <div className="text-[10px] text-amber-700 mt-1">
                            Next available high-fidelity slot: <span className="font-bold underline">3 Weeks</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
