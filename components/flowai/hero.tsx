"use client"

import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion, useMotionTemplate, useMotionValue, useScroll, useTransform, Variants } from "framer-motion"
import { MouseEvent, useRef } from "react"

export function Hero() {
  const containerRef = useRef<HTMLElement>(null)

  // --- Mouse Tracking ---
  let mouseX = useMotionValue(0)
  let mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    let { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  // --- Parallax Exit (scroll out) ---
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })

  const opacity = useTransform(scrollYProgress, [0.4, 0.9], [1, 0])
  const scale = useTransform(scrollYProgress, [0.4, 0.9], [1, 0.95])
  const y = useTransform(scrollYProgress, [0.4, 0.9], [0, -50])

  // Spotlight
  const spotlightBackground = useMotionTemplate`
    radial-gradient(
        800px circle at ${mouseX}px ${mouseY}px,
        rgba(14, 165, 233, 0.05), 
        transparent 80%
    )
  `

  const contentVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: custom * 0.2 + 0.2,
        duration: 1.0,
        ease: [0.25, 0.4, 0.25, 1]
      }
    })
  }

  return (
    <motion.section
      ref={containerRef}
      initial="hidden"
      animate="visible"
      style={{ opacity, scale, y }}
      onMouseMove={handleMouseMove}
      className={cn(
        "relative mt-6 overflow-hidden rounded-[2.5rem] border border-slate-200/60 shadow-2xl shadow-brand-900/5 px-6 py-20 sm:py-24 md:py-32 group origin-top",
        "bg-white"
      )}
    >
      {/* Subtle spotlight that follows mouse */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[2.5rem] opacity-0 transition duration-500 group-hover:opacity-100"
        style={{ background: spotlightBackground }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">

        {/* Badge: Value Prop with Shimmer */}
        <motion.div
          variants={contentVariants}
          custom={0}
          className="mb-8 flex flex-col sm:flex-row items-center justify-center gap-3 relative inline-block"
        >
          <div className="relative overflow-hidden rounded-full border border-brand-200 bg-white/60 backdrop-blur-md px-4 py-1.5 shadow-sm">
            <span className="relative z-10 text-xs font-bold tracking-wide text-brand-700 uppercase">
              AI-Powered Simulation
            </span>
            {/* Shimmer Effect */}
            <motion.div
              className="absolute inset-0 -translate-x-full"
              animate={{ translateX: ["100%", "-100%"] }}
              transition={{
                repeat: Infinity,
                duration: 3,
                repeatDelay: 3,
                ease: "linear"
              }}
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)"
              }}
            />
          </div>
        </motion.div>

        {/* Headline: The Challenge — plain element for instant LCP paint */}
        <h1
          className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-7xl text-slate-900 mb-8 leading-[1.05]"
        >
          Gain Clinical Confidence <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-500 to-accent-600">
            Before The First Patient
          </span>
        </h1>

        {/* Description: The Solution */}
        <p
          className="text-pretty text-lg leading-relaxed text-slate-600 sm:text-xl max-w-2xl mx-auto px-4 mb-10"
        >
          Simulate patient consults, order diagnostics, and interpret results in a risk-free environment.
          <strong className="font-semibold text-slate-800"> Bridge the gap between textbooks and the wards.</strong>
        </p>

        {/* Buttons: The Action */}
        <motion.div
          variants={contentVariants}
          custom={3}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4 mb-16"
        >
          <Button
            asChild
            size="lg"
            className={cn(
              "group rounded-full px-8 py-6 text-base font-semibold w-full sm:w-auto",
              "bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/10",
              "hover:scale-[1.02] transition-all duration-300 ease-out border border-slate-800",
            )}
          >
            <Link href="/login" className="flex items-center justify-center gap-2">
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full px-8 py-6 text-base font-medium border-slate-200 bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all duration-300 w-full sm:w-auto hover:scale-[1.02]"
          >
            <Link href="#video-demo" aria-label="Watch MediKarya in action" className="flex items-center justify-center gap-2 text-slate-700">
              <Play className="h-4 w-4 fill-slate-700" />
              Watch Demo
            </Link>
          </Button>
        </motion.div>

        {/* Story Bridge: The Connection */}
        <motion.div
          variants={contentVariants}
          custom={4}
          className="flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={() => {
            window.scrollTo({ top: window.innerHeight * 0.8, behavior: 'smooth' })
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
            The Problem
          </span>
          <div className="w-px h-8 bg-slate-300 relative overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 w-full h-1/2 bg-brand-500"
              animate={{ y: ["-100%", "200%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>

      </div>
    </motion.section>
  )
}

export default Hero
