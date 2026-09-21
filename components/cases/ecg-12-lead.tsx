"use client"

// A 12-lead ECG on standard paper: 25 mm/s, 10 mm/mV, the usual 3 × 4 lead
// layout (I aVR V1 V4 / II aVL V2 V5 / III aVF V3 V6) plus a 10-second Lead II
// rhythm strip. Waveforms come from the same ecg-synth model as the telemetry
// monitor, so a repeat ECG always agrees with the patient's rhythm.
//
// Deliberately carries no diagnostic wording: the student interprets it.

import { useMemo } from "react"
import { buildRhythm, resolveLeads, sampleLead } from "@/lib/simulation/ecg-synth"
import type { LeadName } from "@/lib/simulation/case-schema"
import type { ResolvedEcg } from "@/lib/simulation/case-resolvers"
import { cn } from "@/lib/utils"

// Paper geometry, in millimetres (the SVG viewBox unit).
const LEFT = 9 // margin for the calibration pulse
const TRACE_W = 250 // 10 s at 25 mm/s
const WIDTH = LEFT + TRACE_W
const ROW_H = 30
const TOP = 4
const HEIGHT = TOP + 4 * ROW_H + 2 // three lead rows + the rhythm strip
const SEGMENT_SECONDS = 2.5
const MM_PER_SECOND = 25
const MM_PER_MV = 10
const STEP_SECONDS = 0.005 // sample every 5 ms

const LAYOUT: LeadName[][] = [
  ["I", "aVR", "V1", "V4"],
  ["II", "aVL", "V2", "V5"],
  ["III", "aVF", "V3", "V6"],
]

// More room above the baseline than below: R waves outrank S waves.
const BASELINE_IN_ROW = 17
const CLAMP_UP = BASELINE_IN_ROW - 1.5
const CLAMP_DOWN = ROW_H - BASELINE_IN_ROW - 1.5

interface Ecg12LeadViewerProps {
  ecg: ResolvedEcg
  className?: string
}

export function Ecg12LeadViewer({ ecg, className }: Ecg12LeadViewerProps) {
  const drawing = useMemo(() => {
    const model = buildRhythm(ecg.rhythm, ecg.rate, 0, 10.6, 7, {
      pr_ms: ecg.pr_ms,
      qrs_ms: ecg.qrs_ms,
      qt_ms: ecg.qt_ms,
    })
    const shapes = resolveLeads(ecg.leads)

    const trace = (lead: LeadName, from: number, to: number, x0: number, baseline: number): string => {
      const points: string[] = []
      for (let t = from; t <= to + 1e-9; t += STEP_SECONDS) {
        const mv = sampleLead(model, lead, shapes[lead], t)
        const dy = Math.max(-CLAMP_UP, Math.min(CLAMP_DOWN, -mv * MM_PER_MV))
        const x = x0 + (t - from) * MM_PER_SECOND
        points.push(`${x.toFixed(2)},${(baseline + dy).toFixed(2)}`)
      }
      return "M" + points.join("L")
    }

    const segments: Array<{ lead: LeadName; d: string; x: number; rowTop: number }> = []
    LAYOUT.forEach((row, r) => {
      const rowTop = TOP + r * ROW_H
      row.forEach((lead, c) => {
        const from = c * SEGMENT_SECONDS
        const x0 = LEFT + c * SEGMENT_SECONDS * MM_PER_SECOND
        segments.push({ lead, d: trace(lead, from, from + SEGMENT_SECONDS, x0, rowTop + BASELINE_IN_ROW), x: x0, rowTop })
      })
    })

    const stripTop = TOP + 3 * ROW_H
    return { segments, strip: trace("II", 0, 10, LEFT, stripTop + BASELINE_IN_ROW), stripTop }
  }, [ecg])

  // Calibration pulse: 1 mV tall, 5 mm (0.2 s) wide, at the start of each row.
  const calibration = (baseline: number) =>
    `M1,${baseline} L2,${baseline} L2,${baseline - MM_PER_MV} L7,${baseline - MM_PER_MV} L7,${baseline} L${LEFT},${baseline}`

  const conducted = ecg.rhythm.startsWith("sinus") || ecg.rhythm.startsWith("pvc")
  const measurements: Array<[string, string]> = [
    ["Rate", ecg.rhythm === "vf" ? "—" : `${ecg.rate} bpm`],
    ["PR", ecg.pr_ms && conducted ? `${ecg.pr_ms} ms` : "—"],
    ["QRS", ecg.qrs_ms ? `${ecg.qrs_ms} ms` : "—"],
    ["QT", ecg.qt_ms ? `${ecg.qt_ms} ms` : "—"],
    ["Axis", ecg.axis_deg !== undefined ? `${ecg.axis_deg > 0 ? "+" : ""}${ecg.axis_deg}°` : "—"],
  ]

  const ink = { fill: "none", stroke: "#1a1a2e", strokeWidth: 0.32, strokeLinejoin: "round", strokeLinecap: "round" } as const
  const label = { fontSize: 3.4, fontWeight: 700, fill: "#1a1a2e", fontFamily: "ui-sans-serif, system-ui" } as const

  return (
    <figure className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-slate-700 uppercase">12-lead ECG</span>
        <span className="font-mono text-[10px] text-slate-400">25 mm/s · 10 mm/mV</span>
        <dl className="flex w-full flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-600 sm:w-auto">
          {measurements.map(([name, value]) => (
            <div key={name} className="flex gap-1">
              <dt className="text-slate-400">{name}</dt>
              <dd className="font-mono font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </figcaption>

      <div className="overflow-x-auto bg-[#fff8f0]">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block w-full"
          style={{ minWidth: 560 }}
          role="img"
          aria-label="12-lead ECG recording on standard ECG paper"
        >
          <defs>
            <pattern id="ecg-grid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M1 0V5M2 0V5M3 0V5M4 0V5M0 1H5M0 2H5M0 3H5M0 4H5" fill="none" stroke="#f3c6c6" strokeWidth="0.1" />
              <path d="M0 0H5M0 0V5" fill="none" stroke="#e39a9a" strokeWidth="0.22" />
            </pattern>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#ecg-grid)" />

          {[0, 1, 2, 3].map((r) => (
            <path key={`cal-${r}`} d={calibration(TOP + r * ROW_H + BASELINE_IN_ROW)} {...ink} strokeWidth={0.3} />
          ))}

          {drawing.segments.map((s) => (
            <g key={s.lead}>
              <path d={s.d} {...ink} />
              <text x={s.x + 1.5} y={s.rowTop + 3.4} {...label}>
                {s.lead}
              </text>
            </g>
          ))}

          {[1, 2, 3].map((c) => (
            <line
              key={c}
              x1={LEFT + c * SEGMENT_SECONDS * MM_PER_SECOND}
              x2={LEFT + c * SEGMENT_SECONDS * MM_PER_SECOND}
              y1={TOP + 1}
              y2={TOP + 3 * ROW_H - 1}
              stroke="#1a1a2e"
              strokeWidth={0.15}
              opacity={0.35}
            />
          ))}

          <path d={drawing.strip} {...ink} />
          <text x={LEFT + 1.5} y={drawing.stripTop + 3.4} {...label}>
            II
          </text>
        </svg>
      </div>
    </figure>
  )
}
