"use client"

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Play, Pause, Maximize2, Volume2 } from "lucide-react"

export function DashboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)

  // Gradient placeholder — replaces the 470 KiB Unsplash external image fetch
  const videoThumbnail = null

  return (
    <section id="video-demo" className="py-24 sm:py-32 bg-slate-50 relative overflow-hidden flex flex-col items-center">

      {/* Aurora Background Atmosphere (Light) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-50/50 via-slate-50 to-slate-50 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:linear-gradient(to_bottom,transparent,black,transparent)] pointer-events-none" />

      {/* Header Content */}
      <div className="relative z-10 text-center max-w-3xl px-6 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-3 py-1 mb-6 text-xs font-semibold text-brand-600 uppercase tracking-widest"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          Simulation Demo
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6"
        >
          Train with <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600">Clinical Precision</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-slate-600 leading-relaxed"
        >
          See how our AI patients help students master diagnostic reasoning before they ever touch a real patient.
        </motion.p>
      </div>

      {/* THE HOLOGRAPHIC THEATER (Light Mode) */}
      <div className="w-full max-w-6xl px-6 relative z-10" ref={containerRef}>

        {/* Soft Glow (Behind - Light Mode) */}
        <div
          className="absolute inset-0 bg-brand-500/20 blur-[100px] -z-10 rounded-full mix-blend-multiply opacity-50"
        />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative aspect-video w-full rounded-[2rem] bg-slate-900 border border-slate-200/50 shadow-2xl overflow-hidden group cursor-pointer ring-1 ring-slate-900/5"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {/* Glass Reflection Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent z-20 pointer-events-none" />

          {/* Video / Thumbnail */}
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden">
            {!isPlaying ? (
              <>
                <div
                  className="absolute inset-0 transition-transform duration-1000 group-hover:scale-105"
                  style={{
                    background: videoThumbnail
                      ? `url(${videoThumbnail}) center/cover no-repeat`
                      : "linear-gradient(135deg, #0f172a 0%, #1e3a5f 30%, #1a4a6e 60%, #0f172a 100%)"
                  }}
                />
                <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/10 transition-colors duration-500" />

                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center z-40">
                  <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                    <Play className="w-8 h-8 text-white fill-current ml-1" />
                  </div>
                </div>
              </>
            ) : (
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/k_K8HfMhAIw?autoplay=1"
                title="Demo Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          {/* Controls Overlay (Fake) */}
          {!isPlaying && (
            <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-between items-end z-30 bg-gradient-to-t from-slate-900/80 to-transparent">
              <div className="text-white">
                <h3 className="text-xl font-bold mb-1">Clinical Scenario Demo</h3>
                <p className="text-sm text-slate-300">02:14 • Diagnosis Simulation</p>
              </div>
              <div className="flex gap-4">
                <button
                  aria-label="Toggle volume"
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white transition-colors"
                >
                  <Volume2 className="w-5 h-5" aria-hidden="true" />
                </button>
                <button
                  aria-label="Fullscreen"
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white transition-colors"
                >
                  <Maximize2 className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

        </motion.div>

        {/* Reflection on floor (Light Mode) */}
        <div
          className="absolute -bottom-10 left-[5%] right-[5%] h-12 bg-brand-600/10 blur-xl rounded-[100%] z-0 opacity-50"
        />
      </div>
    </section>
  )
}
