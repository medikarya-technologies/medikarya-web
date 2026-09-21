"use client"

// Telemetry: state output, not decoration.
//
//   PatientState.rhythm → Telemetry Renderer → Waveform
//
// Never the other direction. This component takes the patient's current rhythm
// and rate as props and sweeps a Lead II trace across a canvas in real time,
// like a bedside monitor. When the rhythm changes (a PVC run, VT) the trace
// changes with it because both come from the same patient.

import { useEffect, useRef } from "react"
import { NORMAL_LEADS, buildRhythm, sampleLead, type RhythmModel } from "@/lib/simulation/ecg-synth"
import type { RhythmType } from "@/lib/simulation/case-schema"
import { rhythmLabel } from "@/lib/simulation/patient-state"
import { cn } from "@/lib/utils"

interface TelemetryMonitorProps {
  rhythm: RhythmType
  rate: number
  /** A lethal-rhythm / critical alarm is active: the trace turns red. */
  alarming?: boolean
  /** Seconds of trace across the screen (a real monitor shows about 6). */
  seconds?: number
  /** Called each time the trace draws a heartbeat, so the monitor's sound lands on the QRS that can be seen. */
  onBeat?: () => void
  className?: string
}

const TRACE_OK = "#4ade80" // green-400
const TRACE_ALARM = "#f87171" // red-400
const ERASE_GAP_PX = 14

export function TelemetryMonitor({ rhythm, rate, alarming = false, seconds = 6, onBeat, className }: TelemetryMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // The animation loop reads the latest props from a ref so it never restarts on a state change.
  const live = useRef({ rhythm, rate, alarming, onBeat })
  live.current = { rhythm, rate, alarming, onBeat }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let cssW = 0
    let cssH = 0
    let raf = 0

    // Waveform clock (real seconds), cursor and the previous plotted point.
    let tWave = 0
    let x = 0
    let prevX = 0
    let prevY: number | null = null
    let last = performance.now()
    // True while the screen is being filled in at the start: those beats are not happening now, so they make no sound.
    let filling = false

    // Beat schedule for the current rhythm; rebuilt when the rhythm/rate changes or it runs low.
    let model: RhythmModel | null = null
    let modelKey = ""
    let modelEnd = 0
    const lead = NORMAL_LEADS.II

    const ensureModel = () => {
      const s = live.current
      const key = `${s.rhythm}|${Math.round(s.rate)}`
      if (!model || key !== modelKey || tWave > modelEnd - 2) {
        modelKey = key
        model = buildRhythm(s.rhythm, s.rate, tWave - 0.7, tWave + 60, 11)
        modelEnd = tWave + 60
      }
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      cssW = r.width
      cssH = r.height
      canvas.width = Math.max(1, Math.round(cssW * dpr))
      canvas.height = Math.max(1, Math.round(cssH * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)
      x = 0
      prevY = null
      prefill()
    }

    /** Advance the trace by `dtSeconds` of real time, one sample per pixel. */
    const advance = (dtSeconds: number) => {
      if (cssW === 0 || cssH === 0) return // not laid out (e.g. display:none): nothing to draw
      ensureModel()
      const pxPerSec = cssW / seconds
      const mvToPx = cssH * 0.3
      const baseline = cssH * 0.64
      const steps = Math.max(1, Math.ceil(dtSeconds * pxPerSec))
      const stepDt = dtSeconds / steps

      ctx.strokeStyle = live.current.alarming ? TRACE_ALARM : TRACE_OK
      ctx.lineWidth = 1.6
      ctx.lineJoin = "round"
      ctx.lineCap = "round"

      for (let i = 0; i < steps; i++) {
        const before = tWave
        tWave += stepDt
        x += pxPerSec * stepDt
        if (!filling && live.current.onBeat && model!.beats.some((b) => b.t > before && b.t <= tWave)) live.current.onBeat()
        if (x >= cssW) {
          x = 0
          prevY = null
        }
        ctx.clearRect(x, 0, ERASE_GAP_PX, cssH) // the sweep bar erases the old trace ahead of the cursor
        const y = baseline - sampleLead(model!, "II", lead, tWave) * mvToPx
        if (prevY !== null) {
          ctx.beginPath()
          ctx.moveTo(prevX, prevY)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
        prevX = x
        prevY = y
      }
    }

    /** Fill the screen so it looks like a monitor that has been running, not one that just started. */
    function prefill() {
      if (cssW === 0) return
      const chunk = 1 / 60
      filling = true
      for (let s = 0; s < seconds - 0.1; s += chunk) advance(chunk)
      filling = false
    }

    const frame = (nowMs: number) => {
      const dt = Math.min(0.1, (nowMs - last) / 1000) // clamp: a backgrounded tab must not lurch
      last = nowMs
      if (dt > 0) advance(dt)
      raf = requestAnimationFrame(frame)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [seconds])

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg bg-black/80", className)}
      style={{
        backgroundImage:
          "linear-gradient(rgba(74,222,128,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.07) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label={`Lead II: ${rhythmLabel(rhythm)}${rhythm === "vf" ? "" : `, ${rate} beats per minute`}`}
      />
    </div>
  )
}
