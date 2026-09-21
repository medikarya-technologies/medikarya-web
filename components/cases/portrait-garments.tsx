"use client"

// What the patient is wearing, and what is on their head. Everything here is a flat shape in the
// colours the persona chose (see lib/simulation/persona.ts): the garments are drawn on the shoulders
// only, because the portrait is a head-and-shoulders crop, so what has to read is the colour-blocking
// and one or two details each garment is known by: the saree's pallu and border, the dupatta's two
// hanging bands, the kurta's band collar and placket.
//
// Everything is clipped to the body's outline, so a border can never spill out of the sleeve.

import type { Figure } from "@/lib/simulation/appearance"
import type { Attire } from "@/lib/simulation/persona"
import { mixHex } from "@/lib/simulation/portrait-palette"

// ── The body ────────────────────────────────────────────────────────────────

/** Half the width of the shoulders at the bottom of the crop, and the y of the base of the neck. */
export const TORSO: Record<Figure, { half: number; top: number }> = {
  adult_m: { half: 88, top: 153 },
  adult_f: { half: 84, top: 153 },
  child: { half: 80, top: 157 },
  toddler: { half: 72, top: 160 },
  infant: { half: 94, top: 138 },
}

/** The shoulders and chest, running past the bottom of the frame so a scaled crop never shows a gap. */
export function torsoPath(figure: Figure): string {
  const { half, top } = TORSO[figure]
  const L = 100 - half
  const R = 100 + half
  return `M ${L} 250 L ${L} 200 C ${L} ${top + 21} ${L + 30} ${top + 5} 78 ${top} L 122 ${top} C ${R - 30} ${top + 5} ${R} ${top + 21} ${R} 200 L ${R} 250 Z`
}

const dark = (c: string, t: number) => mixHex(c, "#000000", t)
const light = (c: string, t: number) => mixHex(c, "#ffffff", t)

// A faint edge on every garment, so a pale kurta still reads against the pale backdrop.
const EDGE = { stroke: "#1b2733", strokeOpacity: 0.16, strokeWidth: 1 } as const

interface P {
  figure: Figure
  a: Attire
  skin: string
  uid: string
  torso: string
  top: number
}

// ── Kurta ───────────────────────────────────────────────────────────────────

function Buttons({ x, from, count, gap, colour, r = 1.9 }: { x: number; from: number; count: number; gap: number; colour: string; r?: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <g key={i}>
          <circle cx={x} cy={from + i * gap} r={r} fill={colour} />
          <circle cx={x - 0.5} cy={from + i * gap - 0.5} r={r * 0.35} fill="#fff" opacity={0.5} />
        </g>
      ))}
    </g>
  )
}

/** The band collar, the little opening at the throat, the placket with its buttons. */
function KurtaFront({ a, skin, top, buttons }: { a: Attire; skin: string; top: number; buttons: string }) {
  return (
    <g>
      {/* the opening at the throat */}
      <path d={`M 94.6 ${top - 3} L 100 ${top + 17} L 105.4 ${top - 3} Z`} fill={skin} />
      {/* the collar band: it stands around the neck and parts at the front */}
      <path d={`M 83 ${top - 10} Q 100 ${top + 1} 117 ${top - 10} L 121.5 ${top - 1} Q 100 ${top + 13} 78.5 ${top - 1} Z`} fill={dark(a.base, 0.06)} stroke={a.trim} strokeWidth={1.2} strokeOpacity={0.85} strokeLinejoin="round" />
      <path d={`M 94.6 ${top - 2} L 100 ${top + 17} L 105.4 ${top - 2}`} fill="none" stroke={a.trim} strokeWidth={1.1} strokeOpacity={0.85} strokeLinejoin="round" />
      {/* the placket */}
      <path d={`M 97.4 ${top + 14} L 97.4 260 M 102.6 ${top + 14} L 102.6 260`} stroke={a.trim} strokeWidth={1.3} strokeOpacity={0.9} />
      <Buttons x={100} from={top + 24} count={4} gap={13} colour={buttons} />
    </g>
  )
}

function Kurta({ a, skin, uid, torso, top }: P) {
  return (
    <g>
      <path d={torso} fill={a.base} {...EDGE} />
      <path d={torso} fill={`url(#${uid}-fabric)`} />
      <KurtaFront a={a} skin={skin} top={top} buttons={a.accent} />
    </g>
  )
}

/** A kurta under a Nehru jacket: the jacket's two panels, a V of kurta between them. */
function KurtaJacket({ a, skin, uid, torso, top }: P) {
  const jacket = a.accent
  return (
    <g>
      <path d={torso} fill={jacket} {...EDGE} />
      <path d={torso} fill={`url(#${uid}-fabric)`} />
      {/* the V of the kurta showing between the panels */}
      <path d={`M 84 ${top - 1} L 116 ${top - 1} L 107.5 260 L 92.5 260 Z`} fill={a.base} />
      <KurtaFront a={a} skin={skin} top={top} buttons={a.trim} />
      {/* the jacket's edges, with a lapel line */}
      <path d={`M 84 ${top - 1} L 92.5 260 M 116 ${top - 1} L 107.5 260`} stroke={dark(jacket, 0.35)} strokeWidth={1.6} fill="none" strokeOpacity={0.8} />
      <path d={`M 78 ${top} L 86 ${top + 26} M 122 ${top} L 114 ${top + 26}`} stroke={light(jacket, 0.22)} strokeWidth={1} fill="none" strokeOpacity={0.6} />
    </g>
  )
}

// ── Shirt and tee ───────────────────────────────────────────────────────────

function Shirt({ a, skin, uid, torso, top }: P) {
  const collar = light(a.base, 0.1)
  return (
    <g>
      <path d={torso} fill={a.base} {...EDGE} />
      <path d={torso} fill={`url(#${uid}-fabric)`} />
      <path d={`M 90.5 ${top - 1} L 109.5 ${top - 1} L 100 ${top + 19} Z`} fill={skin} />
      <path d={`M 84 ${top - 10} L 100 ${top + 16} L 89 ${top + 23} L 71 ${top + 3} Z`} fill={collar} stroke={a.trim} strokeWidth={1} strokeOpacity={0.7} strokeLinejoin="round" />
      <path d={`M 116 ${top - 10} L 100 ${top + 16} L 111 ${top + 23} L 129 ${top + 3} Z`} fill={collar} stroke={a.trim} strokeWidth={1} strokeOpacity={0.7} strokeLinejoin="round" />
      <path d={`M 100 ${top + 17} L 100 260`} stroke={a.trim} strokeWidth={1.2} strokeOpacity={0.8} />
      <Buttons x={100} from={top + 30} count={4} gap={13} colour={a.accent} r={1.8} />
    </g>
  )
}

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 === 0 ? r : r * 0.42
    const ang = (Math.PI / 5) * i - Math.PI / 2
    return `${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`
  }).join(" ")
  return <polygon points={pts} fill={fill} />
}

function Tee({ figure, a, skin, uid, torso, top }: P) {
  const kid = figure === "child" || figure === "toddler"
  return (
    <g>
      <path d={torso} fill={a.base} {...EDGE} />
      <path d={torso} fill={`url(#${uid}-fabric)`} />
      <path d={`M 77 ${top} Q 100 ${top + 24} 123 ${top} Z`} fill={skin} />
      <path d={`M 77 ${top} Q 100 ${top + 24} 123 ${top}`} stroke={a.trim} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      {kid && <Star cx={100} cy={top + 42} r={9} fill={a.accent} />}
    </g>
  )
}

// ── Frock ───────────────────────────────────────────────────────────────────

function Frock({ a, skin, uid, torso, top }: P) {
  return (
    <g>
      <defs>
        <pattern id={`${uid}-frockdots`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.5" fill={a.trim} opacity={0.55} />
          <circle cx="10.5" cy="10.5" r="1.5" fill={a.trim} opacity={0.55} />
        </pattern>
      </defs>
      <path d={torso} fill={a.base} {...EDGE} />
      <path d={torso} fill={`url(#${uid}-frockdots)`} />
      <path d={torso} fill={`url(#${uid}-fabric)`} />
      <path d={`M 83 ${top - 2} Q 100 ${top + 13} 117 ${top - 2} Z`} fill={skin} />
      {/* a round collar and a bow */}
      <ellipse cx={89} cy={top + 5.5} rx={13} ry={6.4} transform={`rotate(24 89 ${top + 5.5})`} fill={a.trim} stroke={dark(a.trim, 0.12)} strokeWidth={0.8} />
      <ellipse cx={111} cy={top + 5.5} rx={13} ry={6.4} transform={`rotate(-24 111 ${top + 5.5})`} fill={a.trim} stroke={dark(a.trim, 0.12)} strokeWidth={0.8} />
      <path d={`M 100 ${top + 12} L 88.5 ${top + 6.5} L 88.5 ${top + 18.5} Z M 100 ${top + 12} L 111.5 ${top + 6.5} L 111.5 ${top + 18.5} Z`} fill={a.accent} />
      <circle cx={100} cy={top + 12} r={2.6} fill={dark(a.accent, 0.15)} />
    </g>
  )
}

// ── Salwar kameez with a dupatta ────────────────────────────────────────────

function Salwar({ a, skin, uid, torso, top }: P) {
  const band = (side: -1 | 1) => {
    const x = (dx: number) => 100 + side * dx
    return (
      <g key={side}>
        <path d={`M ${x(31)} ${top - 4} C ${x(23)} ${top - 9} ${x(13)} ${top - 6} ${x(7)} ${top + 1} L ${x(5)} 260 L ${x(37)} 260 C ${x(39)} ${top + 44} ${x(35)} ${top + 14} ${x(31)} ${top - 4} Z`} fill={a.trim} stroke={dark(a.trim, 0.2)} strokeWidth={0.8} strokeOpacity={0.5} />
        {/* the border along the outer edge, and a soft fold down the middle */}
        <path d={`M ${x(34.5)} ${top + 4} C ${x(35.5)} ${top + 30} ${x(37)} ${top + 60} ${x(38)} 260`} stroke={a.accent} strokeWidth={3} fill="none" opacity={0.9} />
        <path d={`M ${x(34.5)} ${top + 4} C ${x(35.5)} ${top + 30} ${x(37)} ${top + 60} ${x(38)} 260`} stroke={dark(a.trim, 0.35)} strokeWidth={0.8} fill="none" strokeDasharray="1.5 3.5" opacity={0.6} transform={`translate(${side * -5} 0)`} />
        <path d={`M ${x(20)} ${top + 2} C ${x(21)} ${top + 30} ${x(22)} ${top + 60} ${x(21)} 260`} stroke={light(a.trim, 0.3)} strokeWidth={1.4} fill="none" opacity={0.45} />
      </g>
    )
  }
  return (
    <g>
      <path d={torso} fill={a.base} {...EDGE} />
      <path d={torso} fill={`url(#${uid}-fabric)`} />
      <path d={`M 80 ${top - 1} Q 100 ${top + 18} 120 ${top - 1} Z`} fill={skin} />
      <path d={`M 80 ${top - 1} Q 100 ${top + 18} 120 ${top - 1}`} stroke={a.accent} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {band(-1)}
      {band(1)}
    </g>
  )
}

// ── Saree ───────────────────────────────────────────────────────────────────

/** The blouse, and the pallu coming over the shoulder and across the chest, with its border and its pleats. */
function Saree({ a, skin, uid, torso, top }: P) {
  const edge = `M 118 ${top - 1} C 113 ${top + 30} 90 ${top + 54} 62 260`
  return (
    <g>
      <path d={torso} fill={a.accent} {...EDGE} />
      <path d={`M 79 ${top - 1} C 84 ${top + 20} 116 ${top + 20} 121 ${top - 1} Z`} fill={skin} />
      <path d={`M 79 ${top - 1} C 84 ${top + 20} 116 ${top + 20} 121 ${top - 1}`} stroke={a.trim} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <g clipPath={`url(#${uid}-torso)`}>
        {/* the pallu */}
        <path d={`M 117 ${top - 3} C 134 ${top - 2} 164 ${top + 8} 200 ${top + 26} L 200 260 L 62 260 C 90 ${top + 54} 113 ${top + 30} 117 ${top - 3} Z`} fill={a.base} />
        <path d={`M 117 ${top - 3} C 134 ${top - 2} 164 ${top + 8} 200 ${top + 26} L 200 260 L 62 260 C 90 ${top + 54} 113 ${top + 30} 117 ${top - 3} Z`} fill={`url(#${uid}-fabric)`} />
        {/* the pleats falling from the shoulder */}
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M ${131 + i * 12} ${top + 3 + i * 4} Q ${138 + i * 12} ${top + 34} ${131 + i * 12} 260`} stroke={dark(a.base, 0.4)} strokeWidth={1} fill="none" opacity={0.3} />
        ))}
        {/* the border along the pallu's edge: a wide band, a thin line, and a row of small motifs */}
        <path d={edge} transform="translate(9 3)" stroke={a.trim} strokeWidth={7.5} fill="none" />
        <path d={edge} transform="translate(9 3)" stroke={dark(a.trim, 0.3)} strokeWidth={1} fill="none" opacity={0.6} />
        <path d={edge} transform="translate(9 3)" stroke={a.base} strokeWidth={2.4} fill="none" strokeDasharray="0.1 5.2" strokeLinecap="round" opacity={0.95} />
        <path d={edge} transform="translate(15.5 5)" stroke={a.trim} strokeWidth={1.4} fill="none" opacity={0.85} />
        <path d={edge} transform="translate(-1 -1)" stroke={dark(a.accent, 0.3)} strokeWidth={2} fill="none" opacity={0.25} />
      </g>
    </g>
  )
}

// ── Swaddle ─────────────────────────────────────────────────────────────────

function Swaddle({ a, uid }: P) {
  const wrap = "M 0 250 L 0 196 C 34 168 86 150 128 148 L 160 156 C 120 180 80 214 56 250 Z"
  return (
    <g>
      <defs>
        <pattern id={`${uid}-print`} width="13" height="13" patternUnits="userSpaceOnUse">
          <circle cx="3.2" cy="3.2" r="1.7" fill={a.trim} opacity={0.6} />
          <circle cx="9.7" cy="9.7" r="1.7" fill={a.trim} opacity={0.6} />
        </pattern>
      </defs>
      <path d="M 4 250 L 4 192 C 4 166 40 146 72 138 Q 100 153 128 138 C 160 146 196 166 196 192 L 196 250 Z" fill={a.base} {...EDGE} />
      <path d="M 4 250 L 4 192 C 4 166 40 146 72 138 Q 100 153 128 138 C 160 146 196 166 196 192 L 196 250 Z" fill={`url(#${uid}-print)`} />
      {/* the overlapping fold of the wrap */}
      <path d={wrap} fill={dark(a.base, 0.07)} />
      <path d={wrap} fill={`url(#${uid}-print)`} opacity={0.8} />
      <path d="M 0 196 C 34 168 86 150 128 148 L 160 156" stroke={light(a.base, 0.45)} strokeWidth={2} fill="none" />
      <path d="M 160 156 C 120 180 80 214 56 250" stroke={dark(a.base, 0.22)} strokeWidth={1.4} fill="none" opacity={0.5} />
      <path d="M 20 218 Q 100 178 180 218" stroke={dark(a.base, 0.2)} strokeWidth={1} fill="none" opacity={0.3} />
    </g>
  )
}

// ── Hospital gown: only if a case asks for it ───────────────────────────────

function Gown({ a, skin, uid, torso, top }: P) {
  return (
    <g>
      <path d={torso} fill={a.base} {...EDGE} />
      <path d={torso} fill={`url(#${uid}-fabric)`} />
      <path d={`M 78 ${top} L 100 ${top + 27} L 122 ${top} Z`} fill={skin} />
      <path d={`M 78 ${top} L 100 ${top + 28} L 122 ${top}`} stroke={a.trim} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
      <path d={`M 40 ${top + 25} Q 58 ${top + 13} 78 ${top + 10} M 160 ${top + 25} Q 142 ${top + 13} 122 ${top + 10}`} stroke={a.accent} strokeWidth={1.2} fill="none" />
    </g>
  )
}

// ── The garment ─────────────────────────────────────────────────────────────

export function Garment({ figure, attire, skin, uid }: { figure: Figure; attire: Attire; skin: string; uid: string }) {
  const p: P = { figure, a: attire, skin, uid, torso: torsoPath(figure), top: TORSO[figure].top }
  switch (attire.garment) {
    case "saree":
      return <Saree {...p} />
    case "salwar":
      return <Salwar {...p} />
    case "kurta":
      return <Kurta {...p} />
    case "kurta_jacket":
      return <KurtaJacket {...p} />
    case "shirt":
      return <Shirt {...p} />
    case "tee":
      return <Tee {...p} />
    case "frock":
      return <Frock {...p} />
    case "swaddle":
      return <Swaddle {...p} />
    case "gown":
      return <Gown {...p} />
  }
}

// ── On the head ─────────────────────────────────────────────────────────────

/** Behind the head: the pallu of a saree drawn up over the head, falling to both shoulders. */
export function HeadCoverBack({ attire }: { attire: Attire }) {
  if (attire.head !== "pallu") return null
  return (
    <g>
      <path d="M 54 104 C 42 34, 158 34, 146 104 C 148 130, 162 150, 190 172 L 10 172 C 38 150, 52 130, 54 104 Z" fill={attire.base} stroke="#1b2733" strokeOpacity={0.14} strokeWidth={1} />
      <path d="M 54 104 C 42 34, 158 34, 146 104 C 148 130, 162 150, 190 172 L 10 172 C 38 150, 52 130, 54 104 Z" fill="#000" opacity={0.08} />
      <path d="M 66 112 C 60 130 46 150 24 168 M 134 112 C 140 130 154 150 176 168" stroke={attire.base} strokeWidth={1} fill="none" opacity={0.6} />
      <path d="M 62 108 C 56 130 44 148 22 166 M 138 108 C 144 130 156 148 178 166" stroke="#000" strokeWidth={1} fill="none" opacity={0.14} />
    </g>
  )
}

/** In front of the head: the pallu's edge across the forehead with its border (or an infant's cap). */
export function HeadCoverFront({ attire, figure }: { attire: Attire; figure: Figure }) {
  if (attire.head === "pallu") {
    return (
      <g>
        <path d="M 55 100 C 50 46, 150 46, 145 100 C 143 84, 132 72, 118 67 C 108 64 92 64 82 67 C 68 72, 57 84, 55 100 Z" fill={attire.base} stroke="#1b2733" strokeOpacity={0.14} strokeWidth={1} />
        <path d="M 61 96 C 60 80 70 70 84 66 C 92 63.5 108 63.5 116 66 C 130 70 140 80 139 96" stroke={attire.trim} strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M 61 96 C 60 80 70 70 84 66 C 92 63.5 108 63.5 116 66 C 130 70 140 80 139 96" stroke={attire.base} strokeWidth={1.8} fill="none" strokeDasharray="0.1 4.6" strokeLinecap="round" />
        <path d="M 66 101 C 64 84 74 73 86 69.4" stroke={attire.trim} strokeWidth={1.2} fill="none" opacity={0.85} />
      </g>
    )
  }
  if (attire.head === "cap" && figure === "infant") {
    return (
      <g>
        <path d="M 56 101 C 52 52, 148 52, 144 101 C 134 91, 120 85, 100 85 C 80 85, 66 91, 56 101 Z" fill={attire.accent} stroke="#1b2733" strokeOpacity={0.14} strokeWidth={1} />
        <path d="M 56 101 C 66 91 80 85 100 85 C 120 85 134 91 144 101" stroke={dark(attire.accent, 0.14)} strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M 58 99 C 68 89.5 82 83.5 100 83.5 C 118 83.5 132 89.5 142 99" stroke={light(attire.accent, 0.4)} strokeWidth={1} fill="none" opacity={0.7} />
        <path d="M 74 60 Q 100 52 126 60" stroke={light(attire.accent, 0.35)} strokeWidth={1.4} fill="none" opacity={0.6} strokeLinecap="round" />
        <circle cx={100} cy={55} r={5.6} fill={light(attire.accent, 0.12)} stroke={dark(attire.accent, 0.15)} strokeWidth={0.8} />
      </g>
    )
  }
  return null
}
