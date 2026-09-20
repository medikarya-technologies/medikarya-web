"use client"

import { useMemo } from "react"
import * as React from "react"
import { AlertCircle, Activity } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

export interface ECGParameters {
  rhythm: string
  atrialRate?: number
  ventricularRate?: number
  prInterval?: string
  qrsDuration?: number
  qrsMorphology?: string
  pWaves?: string
  finding?: string
  axis?: string
  stChanges?: string
}

interface ECGStripProps {
  params: ECGParameters
  criticalFindings?: boolean | string[]
}

// ── ECG Paper constants ───────────────────────────────────────────────────────
// Standard ECG: 25 mm/sec, 10 mm/mV
// We render 10 seconds in a 600px wide viewBox.
// 10 sec × 25 mm/sec = 250 mm → 600px / 250mm = 2.4 px/mm

const STRIP_W   = 600          // viewBox width  (px)
const STRIP_H   = 160          // viewBox height (px)
const PX_PER_MM = 2.4          // 2.4 px per mm
const MV_TO_PX  = 10 * PX_PER_MM   // 10 mm/mV → 24 px/mV
const BASELINE  = 110          // y-baseline in px (leaves ~110px above for positives)
const DURATION  = 10_000       // 10 000 ms of ECG
const PX_PER_MS = STRIP_W / DURATION   // 0.06 px/ms

// Grid
const SM_PX = 1  * PX_PER_MM  // small square = 1 mm  = 2.4 px
const LG_PX = 5  * PX_PER_MM  // large square = 5 mm  = 12 px

// ── Waveform generator ────────────────────────────────────────────────────────

/**
 * Generates SVG polyline point string for an ECG waveform.
 * Supports: normal sinus, sinus bradycardia, complete AV block, atrial fibrillation.
 */
function generateWaveform(params: ECGParameters): string {
  const {
    rhythm = "",
    atrialRate   = 75,
    ventricularRate = 75,
    qrsDuration  = 100,
  } = params

  const isCompleteBlock = /complete|third.degree|3rd.degree|third degree/i.test(rhythm)
  const isAFib          = /fibril|afib|a\.fib/i.test(rhythm)
  const isWideQRS       = qrsDuration > 120

  // ── Beat schedule ────────────────────────────────────────────────────────
  // P-wave onsets (ms)
  const pTimes: number[] = []
  // QRS onsets (ms)
  const qrsTimes: number[] = []

  if (!isAFib && atrialRate > 0) {
    const pInt = 60_000 / atrialRate
    for (let t = 80; t < DURATION - 200; t += pInt) pTimes.push(t)
  }

  if (ventricularRate > 0) {
    const qrsInt = 60_000 / ventricularRate
    // For normal rhythm: QRS follows P by PR interval; for complete block: independent start
    const firstQRS = isCompleteBlock ? 350 : 80 + 160  // ~160 ms PR for normal
    for (let t = firstQRS; t < DURATION - 400; t += qrsInt) qrsTimes.push(t)
  }

  // ── AFib fibrillatory wave times ─────────────────────────────────────────
  // Irregular QRS with meandering baseline (no organised P waves)
  const afibQRSTimes: number[] = []
  if (isAFib && ventricularRate > 0) {
    const baseInt = 60_000 / ventricularRate
    let t = 200
    while (t < DURATION - 400) {
      afibQRSTimes.push(t)
      // Irregular RR: ±25% variation
      const variation = (Math.random() - 0.5) * 0.5 * baseInt
      t += baseInt + variation
    }
  }

  // ── Point generation (sample every 4 ms) ─────────────────────────────────
  const STEP = 4
  const pts: string[] = []

  for (let t = 0; t <= DURATION; t += STEP) {
    let amp = 0  // mV

    // ── P waves ───────────────────────────────────────────────────────────
    for (const pt of pTimes) {
      const PDur = 80
      if (t >= pt && t <= pt + PDur) {
        const rel = (t - pt) / PDur
        amp += 0.15 * Math.sin(Math.PI * rel)
      }
    }

    // ── QRS complexes (normal or wide) ────────────────────────────────────
    const beats = isAFib ? afibQRSTimes : qrsTimes
    for (const qt of beats) {
      if (isWideQRS) {
        // Wide (LBBB-like): notched broad R, deep S, inverted T
        const qDur = 20, rDur = Math.round(qrsDuration * 0.55), sDur = Math.round(qrsDuration * 0.3)
        const tStart = qt + qrsDuration + 30
        const tDur   = 200

        if (t >= qt && t < qt + qDur) {
          const rel = (t - qt) / qDur
          amp -= 0.15 * Math.sin(Math.PI * rel)
        } else if (t >= qt + qDur && t < qt + qDur + rDur) {
          // Broad notched R (two humps for LBBB look)
          const rel = (t - qt - qDur) / rDur
          const notch = 0.1 * Math.sin(4 * Math.PI * rel)
          amp += (1.1 - notch) * Math.sin(Math.PI * rel)
        } else if (t >= qt + qDur + rDur && t < qt + qDur + rDur + sDur) {
          const rel = (t - qt - qDur - rDur) / sDur
          amp -= 0.5 * Math.sin(Math.PI * rel)
        } else if (t >= tStart && t < tStart + tDur) {
          const rel = (t - tStart) / tDur
          // Inverted T wave for LBBB (discordant)
          amp -= 0.3 * Math.sin(Math.PI * rel)
        }

      } else {
        // Narrow normal QRS
        const qDur = 20, rDur = 40, sDur = 30
        const tStart = qt + 100
        const tDur   = 140

        if (t >= qt && t < qt + qDur) {
          const rel = (t - qt) / qDur
          amp -= 0.1 * Math.sin(Math.PI * rel)
        } else if (t >= qt + qDur && t < qt + qDur + rDur) {
          const rel = (t - qt - qDur) / rDur
          amp += 1.5 * Math.sin(Math.PI * rel)
        } else if (t >= qt + qDur + rDur && t < qt + qDur + rDur + sDur) {
          const rel = (t - qt - qDur - rDur) / sDur
          amp -= 0.3 * Math.sin(Math.PI * rel)
        } else if (t >= tStart && t < tStart + tDur) {
          const rel = (t - tStart) / tDur
          amp += 0.35 * Math.sin(Math.PI * rel)
        }
      }
    }

    // ── AFib baseline fibrillatory wander ─────────────────────────────────
    if (isAFib) {
      amp += 0.06 * Math.sin(2 * Math.PI * t / 110)
           + 0.04 * Math.sin(2 * Math.PI * t / 85 + 1.1)
           + 0.03 * Math.sin(2 * Math.PI * t / 70 + 2.3)
    }

    const x = (t * PX_PER_MS).toFixed(2)
    const y = (BASELINE - amp * MV_TO_PX).toFixed(2)
    pts.push(`${x},${y}`)
  }

  return pts.join(" ")
}

// ── Grid generator ────────────────────────────────────────────────────────────

function ECGGrid() {
  const smallLines: React.ReactElement[] = []
  const largeLines: React.ReactElement[] = []

  // Vertical
  for (let x = 0; x <= STRIP_W; x += SM_PX) {
    const isLarge = Math.abs((x / LG_PX) - Math.round(x / LG_PX)) < 0.01
    const el = (
      <line
        key={`v${x.toFixed(1)}`}
        x1={x} y1={0} x2={x} y2={STRIP_H}
        stroke={isLarge ? "#e8a0a0" : "#f5c8c8"}
        strokeWidth={isLarge ? 0.5 : 0.3}
      />
    )
    isLarge ? largeLines.push(el) : smallLines.push(el)
  }

  // Horizontal
  for (let y = 0; y <= STRIP_H; y += SM_PX) {
    const isLarge = Math.abs((y / LG_PX) - Math.round(y / LG_PX)) < 0.01
    const el = (
      <line
        key={`h${y.toFixed(1)}`}
        x1={0} y1={y} x2={STRIP_W} y2={y}
        stroke={isLarge ? "#e8a0a0" : "#f5c8c8"}
        strokeWidth={isLarge ? 0.5 : 0.3}
      />
    )
    isLarge ? largeLines.push(el) : smallLines.push(el)
  }

  return <>{smallLines}{largeLines}</>
}

// ── Scale bars ─────────────────────────────────────────────────────────────────
// 1 mV calibration pulse at the left edge
function CalibrationPulse() {
  const x = 8
  const pulseW = 200 * PX_PER_MS  // 200 ms wide = one large square
  const pulseH = MV_TO_PX         // 1 mV tall
  return (
    <path
      d={`M ${x} ${BASELINE} L ${x} ${BASELINE - pulseH} L ${x + pulseW} ${BASELINE - pulseH} L ${x + pulseW} ${BASELINE}`}
      fill="none"
      stroke="#1a1a2e"
      strokeWidth={1.0}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ECGStrip({ params, criticalFindings }: ECGStripProps) {
  const polylinePoints = useMemo(() => generateWaveform(params), [params])

  const isCritical =
    criticalFindings === true ||
    (Array.isArray(criticalFindings) && criticalFindings.length > 0)

  const {
    atrialRate,
    ventricularRate,
    qrsDuration,
    rhythm,
    finding,
  } = params

  const vRateColor =
    ventricularRate && ventricularRate < 50
      ? "text-red-600 font-bold"
      : ventricularRate && ventricularRate > 100
      ? "text-amber-600 font-bold"
      : "text-slate-800 font-semibold"

  const qrsDurColor =
    qrsDuration && qrsDuration > 120
      ? "text-amber-600 font-bold"
      : "text-slate-800 font-semibold"

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">

      {/* Header */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-600" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            ECG Rhythm Strip — Lead II
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          25 mm/sec · 10 mm/mV · 10 sec
        </span>
      </div>

      {/* Critical finding banner */}
      {isCritical && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span className="text-xs font-semibold text-red-700 leading-snug">
            CRITICAL: {finding ?? "Abnormal cardiac rhythm — see interpretation"}
          </span>
        </div>
      )}

      {/* SVG ECG strip */}
      <div
        className="overflow-x-auto bg-[#fff8f0]"
        style={{ padding: "8px 4px" }}
      >
        <svg
          viewBox={`0 0 ${STRIP_W} ${STRIP_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ minWidth: "420px", display: "block" }}
          aria-label={`ECG strip showing ${rhythm}`}
          role="img"
        >
          {/* ECG paper grid */}
          <ECGGrid />

          {/* Calibration pulse */}
          <CalibrationPulse />

          {/* Baseline */}
          <line
            x1={0} y1={BASELINE} x2={STRIP_W} y2={BASELINE}
            stroke="#c8a0a0"
            strokeWidth={0.4}
            strokeDasharray="2 4"
          />

          {/* Waveform */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#1a1a2e"
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 bg-white">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Atrial Rate</div>
          <div className="text-sm text-slate-700 font-semibold">
            {atrialRate != null ? `${atrialRate} bpm` : "—"}
          </div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Ventricular Rate</div>
          <div className={`text-sm ${vRateColor}`}>
            {ventricularRate != null ? `${ventricularRate} bpm` : "—"}
          </div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">QRS Duration</div>
          <div className={`text-sm ${qrsDurColor}`}>
            {qrsDuration != null ? `${qrsDuration} ms` : "—"}
          </div>
        </div>
      </div>

      {/* Rhythm label */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Rhythm:</span>
        <span className="text-xs font-semibold text-slate-800">{rhythm}</span>
      </div>

    </div>
  )
}
