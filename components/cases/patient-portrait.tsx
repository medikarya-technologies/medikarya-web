"use client"

// The patient, drawn. A head-and-shoulders illustration in two halves that never disagree:
//
//   WHO they are (`persona`): how old they look, what they are wearing, how their hair is done.
//     Chosen from the patient's age and gender and the case (lib/simulation/persona.ts), so a
//     2-year-old is a toddler, a 72-year-old has white hair and lines, and the same case looks
//     the same on every screen.
//   HOW they are (`look`): pallor, jaundice, sweat, the tired face, sunken eyes. Resolved from the
//     case against the live patient state, and worded by the same description as the observation
//     line ("Face is very pale and yellow."). A deterioration changes the face, not the person.
//
// The chest rises and falls at the patient's real respiratory rate and the eyes blink.
//
// Flat and restrained on purpose: soft neutral backdrop, natural skin tones, one line weight, and
// clothes in real fabric colours. It is meant to read as a clinical illustration, not a cartoon.

import { memo, useId } from "react"
import type { Expression, Figure, ResolvedLook } from "@/lib/simulation/appearance"
import { hairColourFor, type Persona } from "@/lib/simulation/persona"
import { mixHex, portraitPalette } from "@/lib/simulation/portrait-palette"
import { cn } from "@/lib/utils"
import { Garment, HeadCoverBack, HeadCoverFront, torsoPath } from "./portrait-garments"
import { Braid, FacialHair, Hair } from "./portrait-hair"

// ── Geometry per figure ─────────────────────────────────────────────────────

interface Geometry {
  head: string
  eyeY: number
  eyeDX: number
  eyeRx: number
  eyeRy: number
  iris: number
  browY: number
  browW: number
  noseY: number
  mouthY: number
  mouthW: number
  cheekY: number
  cheekDX: number
  earY: number
  earDX: number
  earRx: number
  earRy: number
  /** How far the body is raised toward the head: a child's neck is short. */
  lift: number
  neck: boolean
  /** How much of the frame the figure fills. A small child is drawn smaller in the frame, with a big head on narrow shoulders. */
  scale: number
  /** The square (x, y, size) the avatar crop shows. */
  crop: [number, number, number]
}

const GEOMETRY: Record<Figure, Geometry> = {
  adult_m: {
    head: "M 63 86 C 63 54, 137 54, 137 86 C 137 114, 122 136, 100 136 C 78 136, 63 114, 63 86 Z",
    eyeY: 90, eyeDX: 17, eyeRx: 8, eyeRy: 4.8, iris: 3.6, browY: 79.5, browW: 3.2,
    noseY: 101, mouthY: 119, mouthW: 11, cheekY: 108, cheekDX: 19, earY: 95, earDX: 37, earRx: 5, earRy: 8,
    lift: 0, neck: true, scale: 0.97, crop: [50, 44, 100],
  },
  adult_f: {
    head: "M 65 86 C 65 55, 135 55, 135 86 C 135 112, 121 134, 100 134 C 79 134, 65 112, 65 86 Z",
    eyeY: 90, eyeDX: 16.5, eyeRx: 8, eyeRy: 5, iris: 3.6, browY: 79.5, browW: 2.6,
    noseY: 101, mouthY: 118, mouthW: 10.5, cheekY: 107, cheekDX: 19, earY: 95, earDX: 35, earRx: 5, earRy: 8,
    lift: 0, neck: true, scale: 0.97, crop: [50, 44, 100],
  },
  child: {
    head: "M 61 95 C 61 58, 139 58, 139 95 C 139 122, 122 139, 100 139 C 78 139, 61 122, 61 95 Z",
    eyeY: 100, eyeDX: 18, eyeRx: 8.6, eyeRy: 5.9, iris: 4.4, browY: 90, browW: 2.3,
    noseY: 110, mouthY: 125, mouthW: 9.5, cheekY: 113, cheekDX: 22, earY: 103, earDX: 39, earRx: 5.4, earRy: 8,
    lift: 7, neck: true, scale: 0.92, crop: [53, 49, 94],
  },
  toddler: {
    head: "M 56 97 C 56 57, 144 57, 144 97 C 144 126, 125 142, 100 142 C 75 142, 56 126, 56 97 Z",
    eyeY: 105, eyeDX: 19, eyeRx: 9.2, eyeRy: 6.6, iris: 5, browY: 93, browW: 1.7,
    noseY: 116, mouthY: 128, mouthW: 8.5, cheekY: 117, cheekDX: 25, earY: 108, earDX: 44, earRx: 6, earRy: 8.6,
    lift: 12, neck: true, scale: 0.9, crop: [52, 50, 96],
  },
  infant: {
    head: "M 57 98 C 57 60, 143 60, 143 98 C 143 128, 124 142, 100 142 C 76 142, 57 128, 57 98 Z",
    eyeY: 103, eyeDX: 19, eyeRx: 9, eyeRy: 6.2, iris: 4.8, browY: 92, browW: 1.1,
    noseY: 113, mouthY: 127, mouthW: 8, cheekY: 116, cheekDX: 26, earY: 106, earDX: 43, earRx: 6, earRy: 8,
    lift: 0, neck: false, scale: 1, crop: [44, 41, 112],
  },
}

// ── Expressions ─────────────────────────────────────────────────────────────

interface ExpressionSpec {
  /** 1 wide open, 0 shut. */
  open: number
  /** Inner end of the brows: negative raised (worry), positive lowered and drawn together (pain). */
  browInner: number
  /** Mouth corners: negative up, positive down. */
  corner: number
  /** How far the mouth is open, 0–1. */
  mouthOpen: number
  bags: number
  furrow: number
}

const EXPRESSION: Record<Expression, ExpressionSpec> = {
  calm: { open: 0.93, browInner: 0, corner: -0.6, mouthOpen: 0, bags: 0, furrow: 0 },
  tired: { open: 0.7, browInner: -1, corner: 1, mouthOpen: 0, bags: 0.8, furrow: 0 },
  anxious: { open: 1, browInner: -4, corner: 0.6, mouthOpen: 0, bags: 0.2, furrow: 0.3 },
  pain: { open: 0.52, browInner: 3.4, corner: 2.4, mouthOpen: 0.15, bags: 0.2, furrow: 1 },
  distress: { open: 1, browInner: -3, corner: 2, mouthOpen: 0.5, bags: 0.3, furrow: 0.7 },
  breathless: { open: 0.94, browInner: -2, corner: 1, mouthOpen: 0.55, bags: 0.4, furrow: 0.2 },
  drowsy: { open: 0.42, browInner: -0.5, corner: 1.2, mouthOpen: 0.25, bags: 1, furrow: 0 },
  irritable: { open: 0.5, browInner: 3, corner: 2.6, mouthOpen: 0.9, bags: 0.2, furrow: 0.8 },
  photophobic: { open: 0.42, browInner: 3, corner: 2, mouthOpen: 0, bags: 0.3, furrow: 0.9 },
}

// ── Pieces ──────────────────────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function Eye({ side, g, skin, skinShade, sclera, spec, sunken, lines, uid, blinkPeriod, animate }: { side: -1 | 1; g: Geometry; skin: string; skinShade: string; sclera: string; spec: ExpressionSpec; sunken: number; lines: number; uid: string; blinkPeriod: number; animate: boolean }) {
  const cx = 100 + side * g.eyeDX
  const cy = g.eyeY
  const clip = `${uid}-eye${side}`
  // Older eyes are a little more hooded.
  const ry = g.eyeRy * (1 - 0.1 * lines)
  const lid = round1((1 - spec.open) * (ry * 2 + 1))
  const bags = Math.min(1.4, spec.bags + sunken * 0.3)
  return (
    <g>
      {/* sunken eyes: the socket falls into shadow */}
      {sunken > 0 && <ellipse cx={cx} cy={cy + 1.2} rx={g.eyeRx + 3.6} ry={ry + 4.8} fill={skinShade} opacity={0.11 * sunken} />}
      {/* under-eye bags */}
      {bags > 0 && (
        <>
          <ellipse cx={cx} cy={cy + ry + 3} rx={g.eyeRx} ry={2.6} fill={skinShade} opacity={Math.min(0.5, bags * 0.2)} />
          <path d={`M ${cx - g.eyeRx + 1} ${cy + ry + 1.6} Q ${cx} ${cy + ry + 4.6} ${cx + g.eyeRx - 1} ${cy + ry + 1.6}`} stroke={skinShade} strokeWidth={1.2} fill="none" opacity={Math.min(0.85, bags * 0.55)} strokeLinecap="round" />
        </>
      )}
      <clipPath id={clip}>
        <ellipse cx={cx} cy={cy} rx={g.eyeRx} ry={ry} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={g.eyeRx} ry={ry} fill={sclera} />
      <g clipPath={`url(#${clip})`}>
        <circle cx={cx + side * -0.4} cy={cy + 0.2} r={g.iris} fill="#3a2a20" />
        <circle cx={cx + side * -0.4} cy={cy + 0.2} r={g.iris * 0.46} fill="#120d0b" />
        <circle cx={cx + side * -0.4 + 1.3} cy={cy - 1.2} r={0.95} fill="#fff" opacity={0.9} />
        {/* the lid: skin over the top of the eye, more of it the more tired the patient */}
        <rect x={cx - g.eyeRx - 1} y={cy - ry - 1} width={g.eyeRx * 2 + 2} height={lid + 1} fill={skin} />
        {/* the blink: the same lid, closing all the way and opening again */}
        {animate && <rect className="enc-blink" style={{ animationDuration: `${blinkPeriod}s` }} x={cx - g.eyeRx - 1} y={cy - ry - 1} width={g.eyeRx * 2 + 2} height={ry * 2 + 2} fill={skin} />}
      </g>
      {/* lid edge and lashes */}
      <path d={`M ${cx - g.eyeRx} ${cy + 0.2} Q ${cx} ${cy - ry - 1.2 + lid} ${cx + g.eyeRx} ${cy + 0.2}`} stroke={skinShade} strokeWidth={1.1} fill="none" opacity={0.55} strokeLinecap="round" />
      <path d={`M ${cx - g.eyeRx - 0.2} ${cy - ry + lid * 0.55} L ${cx + g.eyeRx + 0.2} ${cy - ry + lid * 0.55}`} stroke="#2a1d17" strokeWidth={1} opacity={lid > 0.3 ? 0.55 : 0} strokeLinecap="round" />
      {/* the fold above an older eye */}
      {lines > 0.35 && <path d={`M ${cx - g.eyeRx + 0.5} ${cy - ry - 2.4} Q ${cx} ${cy - ry - 4.8} ${cx + g.eyeRx - 0.5} ${cy - ry - 2.4}`} stroke={skinShade} strokeWidth={0.9} fill="none" opacity={0.25 + lines * 0.3} strokeLinecap="round" />}
    </g>
  )
}

function Brows({ g, spec, colour }: { g: Geometry; spec: ExpressionSpec; colour: string }) {
  const one = (side: -1 | 1) => {
    const outerX = 100 + side * (g.eyeDX + 11)
    const innerX = 100 + side * (g.eyeDX - 8.5)
    const yOuter = g.browY + 1.6
    const yInner = g.browY + spec.browInner
    const midX = (outerX + innerX) / 2
    const ctrlY = Math.min(yInner, yOuter) - 2.1 - (spec.browInner < 0 ? 0.6 : 0)
    return <path key={side} d={`M ${outerX} ${round1(yOuter)} Q ${midX} ${round1(ctrlY)} ${innerX} ${round1(yInner)}`} stroke={colour} strokeWidth={g.browW} strokeLinecap="round" fill="none" opacity={Math.min(0.92, Math.max(0.3, g.browW / 3.2))} />
  }
  return (
    <g>
      {one(-1)}
      {one(1)}
      {/* the frown line between the brows */}
      {spec.furrow > 0 && <path d={`M 98.4 ${g.browY - 3} L 98.4 ${g.browY + 4} M 101.6 ${g.browY - 3} L 101.6 ${g.browY + 4}`} stroke="#3b2418" strokeWidth={0.9} opacity={spec.furrow * 0.3} strokeLinecap="round" />}
    </g>
  )
}

function Mouth({ g, spec, lips }: { g: Geometry; spec: ExpressionSpec; lips: string }) {
  const w = g.mouthW
  const y = g.mouthY
  const c = spec.corner
  const drop = 4.4 + spec.mouthOpen * 4
  const open = spec.mouthOpen
  const outline = `M ${100 - w} ${y + c} Q ${100 - w / 2} ${y - 1.8} 100 ${y - 1.2} Q ${100 + w / 2} ${y - 1.8} ${100 + w} ${y + c} Q ${100 + w / 2} ${y + drop} 100 ${y + drop} Q ${100 - w / 2} ${y + drop} ${100 - w} ${y + c} Z`
  return (
    <g>
      <path d={outline} fill={lips} />
      {open > 0.05 && <ellipse cx={100} cy={y + 1.2 + open * 1.4} rx={w * 0.66} ry={0.8 + open * 3.2} fill="#4a1f1c" />}
      <path d={`M ${100 - w + 0.6} ${y + c} Q 100 ${y + (open > 0.05 ? -0.2 : 1)} ${100 + w - 0.6} ${y + c}`} stroke="#3b1a16" strokeWidth={0.9} fill="none" opacity={open > 0.05 ? 0 : 0.55} strokeLinecap="round" />
    </g>
  )
}

/** Lines that come with age, each from the age it starts: nothing is drawn on a young face. */
function AgeLines({ g, shade, lines, hollow }: { g: Geometry; shade: string; lines: number; hollow: number }) {
  if (lines < 0.1 && hollow < 0.05) return null
  const strength = (from: number) => clamp01((lines - from) / (1 - from))
  const on = (from: number, base = 0.14, gain = 0.3) => (lines >= from ? base + gain * strength(from) : 0)
  return (
    <g stroke={shade} strokeWidth={0.9} fill="none" strokeLinecap="round">
      {/* cheeks that have hollowed */}
      {hollow > 0.05 && (
        <g fill={shade} stroke="none">
          <ellipse cx={100 - g.cheekDX - 2} cy={g.cheekY + 9} rx={7} ry={11} opacity={hollow * 0.2} />
          <ellipse cx={100 + g.cheekDX + 2} cy={g.cheekY + 9} rx={7} ry={11} opacity={hollow * 0.2} />
        </g>
      )}
      {/* the forehead */}
      <path d={`M 84 ${g.browY - 12.5} Q 100 ${g.browY - 16.5} 116 ${g.browY - 12.5}`} opacity={on(0.22)} />
      <path d={`M 86 ${g.browY - 7.5} Q 100 ${g.browY - 10.5} 114 ${g.browY - 7.5}`} opacity={on(0.3)} />
      <path d={`M 88 ${g.browY - 17} Q 100 ${g.browY - 20} 112 ${g.browY - 17}`} opacity={on(0.62)} />
      {/* crow's feet */}
      <path d={`M ${100 - g.eyeDX - g.eyeRx - 1.5} ${g.eyeY - 1} l -3.5 -1.5 M ${100 - g.eyeDX - g.eyeRx - 1.5} ${g.eyeY + 1.5} l -3.5 1.5`} opacity={on(0.2)} />
      <path d={`M ${100 + g.eyeDX + g.eyeRx + 1.5} ${g.eyeY - 1} l 3.5 -1.5 M ${100 + g.eyeDX + g.eyeRx + 1.5} ${g.eyeY + 1.5} l 3.5 1.5`} opacity={on(0.2)} />
      {/* under the eyes */}
      <path d={`M ${100 - g.eyeDX - 6} ${g.eyeY + g.eyeRy + 4.6} Q ${100 - g.eyeDX} ${g.eyeY + g.eyeRy + 6.6} ${100 - g.eyeDX + 6} ${g.eyeY + g.eyeRy + 4.6}`} opacity={on(0.45, 0.14, 0.25)} />
      <path d={`M ${100 + g.eyeDX - 6} ${g.eyeY + g.eyeRy + 4.6} Q ${100 + g.eyeDX} ${g.eyeY + g.eyeRy + 6.6} ${100 + g.eyeDX + 6} ${g.eyeY + g.eyeRy + 4.6}`} opacity={on(0.45, 0.14, 0.25)} />
      {/* nose to mouth */}
      <path d={`M 90 ${g.noseY + 3} Q 85 ${g.noseY + 12} 87 ${g.mouthY + 3}`} opacity={on(0.12, 0.12, 0.34)} />
      <path d={`M 110 ${g.noseY + 3} Q 115 ${g.noseY + 12} 113 ${g.mouthY + 3}`} opacity={on(0.12, 0.12, 0.34)} />
      {/* mouth to chin */}
      <path d={`M ${100 - g.mouthW - 1.5} ${g.mouthY + 4} Q ${100 - g.mouthW - 2.5} ${g.mouthY + 10} ${100 - g.mouthW + 0.5} ${g.mouthY + 15}`} opacity={on(0.55, 0.14, 0.3)} />
      <path d={`M ${100 + g.mouthW + 1.5} ${g.mouthY + 4} Q ${100 + g.mouthW + 2.5} ${g.mouthY + 10} ${100 + g.mouthW - 0.5} ${g.mouthY + 15}`} opacity={on(0.55, 0.14, 0.3)} />
    </g>
  )
}

const BEADS: Array<[number, number]> = [
  [-4, -1], [9, 1], [-16, 4], [16, 5], [3, 4], [-9, 6], [-21, 2], [22, 3], [-1, -3],
]

function Sweat({ g, level }: { g: Geometry; level: number }) {
  if (level <= 0) return null
  const foreheadY = g.browY - 8
  const count = Math.min(BEADS.length, level * 3)
  return (
    <g>
      <ellipse cx={100} cy={foreheadY + 4} rx={26} ry={9} fill="#fff" opacity={0.1 + level * 0.05} />
      {BEADS.slice(0, count).map(([dx, dy], i) => (
        <g key={i} transform={`translate(${100 + dx} ${foreheadY + dy})`}>
          <path d="M 0 -2.6 C 1.9 -0.4 2.3 1 0 2.3 C -2.3 1 -1.9 -0.4 0 -2.6 Z" fill="#eaf5fb" stroke="#a9cbe0" strokeWidth={0.5} opacity={0.92} />
          <circle cx={-0.6} cy={0.2} r={0.5} fill="#fff" />
        </g>
      ))}
    </g>
  )
}

function Glasses({ g }: { g: Geometry }) {
  const w = g.eyeRx + 4.6
  const h = g.eyeRy + 5.4
  const ink = "#4a423d"
  const frame = (side: -1 | 1) => (
    <g key={side}>
      <rect x={100 + side * g.eyeDX - w} y={g.eyeY - h} width={w * 2} height={h * 2} rx={h * 0.6} fill="#cfe0ee" fillOpacity={0.14} stroke={ink} strokeWidth={1.15} />
      <path d={`M ${100 + side * g.eyeDX - w + 3.4} ${g.eyeY - h + 3} Q ${100 + side * g.eyeDX - w + 3.4} ${g.eyeY - h + 1.6} ${100 + side * g.eyeDX - w + 6.6} ${g.eyeY - h + 1.8}`} stroke="#fff" strokeWidth={1} fill="none" opacity={0.55} strokeLinecap="round" />
    </g>
  )
  return (
    <g>
      {frame(-1)}
      {frame(1)}
      <path d={`M ${100 - g.eyeDX + w} ${g.eyeY - 2} Q 100 ${g.eyeY - 5.6} ${100 + g.eyeDX - w} ${g.eyeY - 2}`} stroke={ink} strokeWidth={1.3} fill="none" />
      <path d={`M ${100 - g.eyeDX - w} ${g.eyeY - 1.5} L ${100 - g.earDX + 1.5} ${g.earY - 4} M ${100 + g.eyeDX + w} ${g.eyeY - 1.5} L ${100 + g.earDX - 1.5} ${g.earY - 4}`} stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </g>
  )
}

const GOLD = "#dcae42"

function Earrings({ g, small }: { g: Geometry; small: boolean }) {
  const k = small ? 0.72 : 1
  const y = g.earY + g.earRy - 1.4
  return (
    <g>
      {[-1, 1].map((side) => {
        const x = 100 + side * g.earDX
        return (
          <g key={side}>
            <circle cx={x} cy={y} r={1.8 * k} fill={GOLD} />
            <path d={`M ${x - 2.1 * k} ${y + 1.8 * k} Q ${x} ${y + 10 * k} ${x + 2.1 * k} ${y + 1.8 * k} Z`} fill={GOLD} stroke="#a97c1f" strokeWidth={0.45} />
            <circle cx={x - 0.6 * k} cy={y - 0.5 * k} r={0.6 * k} fill="#fff" opacity={0.6} />
          </g>
        )
      })}
    </g>
  )
}

// ── Neck swelling ───────────────────────────────────────────────────────────

function NeckSwelling({ kind, skin, shade }: { kind: NonNullable<ResolvedLook["swelling"]>; skin: string; shade: string }) {
  // The patient's right is the viewer's left. A goitre is a bulge along the side of the lower neck,
  // below the jaw, drawn as a lit oval with a shadow crescent on its outer, lower edge.
  if (kind === "neck_front") {
    return (
      <g>
        <ellipse cx={100} cy={143} rx={17} ry={9} fill={shade} opacity={0.35} />
        <ellipse cx={100} cy={141} rx={16} ry={8.5} fill={skin} />
        <ellipse cx={96} cy={138.5} rx={7} ry={3} fill="#fff" opacity={0.16} />
      </g>
    )
  }
  const side = kind === "neck_right" ? -1 : 1
  const cx = 100 + side * 13
  const cy = 141
  const tilt = side * 12
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`}>
      <ellipse cx={cx + side * 1.4} cy={cy + 2.2} rx={11.6} ry={17.6} fill={shade} opacity={0.38} />
      <ellipse cx={cx} cy={cy} rx={10.6} ry={16.4} fill={skin} />
      <ellipse cx={cx - side * 3.2} cy={cy - 5.5} rx={4.2} ry={7.5} fill="#fff" opacity={0.15} />
      <path d={`M ${cx + side * 8.6} ${cy - 8} Q ${cx + side * 11.4} ${cy + 3} ${cx + side * 6} ${cy + 13}`} stroke={shade} strokeWidth={1.2} fill="none" opacity={0.55} strokeLinecap="round" />
    </g>
  )
}

// ── The portrait ────────────────────────────────────────────────────────────

interface PatientPortraitProps {
  persona: Persona
  look: ResolvedLook
  /** Breaths per minute: the chest rises and falls at this rate. */
  rr?: number
  /** "bust" is the whole illustration; "face" crops to the head, for an avatar. */
  variant?: "bust" | "face"
  className?: string
  style?: React.CSSProperties
  /** Read out by assistive technology: the observation. */
  label?: string
  /** False for a still picture (a list of patients): no breathing and no blinking. */
  animate?: boolean
}

// The rail re-renders four times a second for the clock; the portrait only needs to redraw when the patient changes.
export const PatientPortrait = memo(function PatientPortrait({ persona, look, rr = 16, variant = "bust", className, style, label, animate = true }: PatientPortraitProps) {
  const uid = useId().replace(/:/g, "")
  const g = GEOMETRY[persona.figure]
  const spec = EXPRESSION[look.expression]
  const p = portraitPalette(persona.tone, look)

  const hairColour = hairColourFor(persona.grey)
  const browColour = mixHex(hairColour, "#b3aea8", persona.grey * 0.7)
  const tie = persona.attire.accent
  const kid = persona.figure === "child" || persona.figure === "toddler"

  const breathPeriod = round1(Math.min(8, Math.max(1.4, 60 / Math.max(6, rr))))
  const breathRise = rr > 30 ? -1.2 : -2
  const blinkPeriod = look.expression === "drowsy" ? 8 : look.expression === "tired" ? 6.5 : 5

  const [cropX, cropY, cropSize] = g.crop
  const viewBox = variant === "face" ? `${cropX} ${cropY} ${cropSize} ${cropSize}` : "0 0 200 200"
  const framed = `translate(100 96) scale(${g.scale}) translate(-100 -96)`

  return (
    <svg viewBox={viewBox} style={style} className={cn("block", className)} role="img" aria-label={label ?? "Patient"} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9eef4" />
          <stop offset="1" stopColor="#d6dee8" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.42" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-blush`}>
          <stop offset="0" stopColor={p.blush} stopOpacity="1" />
          <stop offset="1" stopColor={p.blush} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-shade`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#2a1208" stopOpacity="0.16" />
        </radialGradient>
        <linearGradient id={`${uid}-fabric`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        <clipPath id={`${uid}-torso`}>
          <path d={torsoPath(persona.figure)} />
        </clipPath>
      </defs>

      <rect width="200" height="200" fill={`url(#${uid}-bg)`} />
      <circle cx="100" cy="92" r="84" fill={`url(#${uid}-glow)`} />

      <g transform={framed}>
        <HeadCoverBack attire={persona.attire} />
        <Hair style={persona.hair} figure={persona.figure} colour={hairColour} grey={persona.grey} part="back" tie={tie} />

        {/* Chest, neck and clothes: they rise and fall with the patient's breathing. */}
        <g transform={`translate(0 ${-g.lift})`}>
          <g className={animate ? "enc-breathe" : undefined} style={{ ["--enc-breath-period" as string]: `${breathPeriod}s`, ["--enc-breath" as string]: `${breathRise}px` }}>
            {g.neck && (
              <>
                <path d="M 87 116 C 87 134, 86 146, 78 158 L 78 176 L 122 176 L 122 158 C 114 146, 113 134, 113 116 Z" fill={p.skinShade} />
                {/* the shadow of the jaw on the neck */}
                <path d="M 87 128 Q 100 146 113 128 L 113 116 L 87 116 Z" fill="#1c0f08" opacity={0.16} />
                {persona.lines > 0.6 && (
                  <g stroke="#3b2418" strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.16 + persona.lines * 0.14}>
                    <path d="M 89 141 Q 100 146 111 141" />
                    <path d="M 90 148 Q 100 153 110 148" />
                  </g>
                )}
              </>
            )}
            <Garment figure={persona.figure} attire={persona.attire} skin={p.skinShade} uid={uid} />
            {persona.hair === "braid" && <Braid colour={hairColour} tie={tie} grey={persona.grey} />}
          </g>
        </g>

        {/* Ears sit behind the head */}
        <ellipse cx={100 - g.earDX} cy={g.earY} rx={g.earRx} ry={g.earRy} fill={p.skin} />
        <ellipse cx={100 + g.earDX} cy={g.earY} rx={g.earRx} ry={g.earRy} fill={p.skin} />
        <ellipse cx={100 - g.earDX} cy={g.earY} rx={g.earRx * 0.48} ry={g.earRy * 0.58} fill={p.skinShade} opacity={0.35} />
        <ellipse cx={100 + g.earDX} cy={g.earY} rx={g.earRx * 0.48} ry={g.earRy * 0.58} fill={p.skinShade} opacity={0.35} />
        {persona.earrings && <Earrings g={g} small={kid} />}

        {/* Head */}
        <path d={g.head} fill={p.skin} />
        <path d={g.head} fill={`url(#${uid}-shade)`} />

        {/* Blush */}
        {p.blushOpacity > 0 && (
          <>
            <circle cx={100 - g.cheekDX} cy={g.cheekY} r={13} fill={`url(#${uid}-blush)`} opacity={Math.min(0.9, p.blushOpacity * 2.2)} />
            <circle cx={100 + g.cheekDX} cy={g.cheekY} r={13} fill={`url(#${uid}-blush)`} opacity={Math.min(0.9, p.blushOpacity * 2.2)} />
          </>
        )}

        <AgeLines g={g} shade={p.skinShade} lines={persona.lines} hollow={persona.hollow} />

        <Brows g={g} spec={spec} colour={browColour} />
        <Eye side={-1} g={g} skin={p.skin} skinShade={p.skinShade} sclera={p.sclera} spec={spec} sunken={look.sunken_eyes} lines={persona.lines} uid={uid} blinkPeriod={blinkPeriod} animate={animate} />
        <Eye side={1} g={g} skin={p.skin} skinShade={p.skinShade} sclera={p.sclera} spec={spec} sunken={look.sunken_eyes} lines={persona.lines} uid={uid} blinkPeriod={blinkPeriod} animate={animate} />

        {/* Nose */}
        <g stroke={p.skinShade} fill="none" strokeLinecap="round" strokeWidth={1.3} opacity={0.75}>
          <path d={`M 98.2 ${g.eyeY + 6} Q 96.6 ${g.noseY} 97.6 ${g.noseY + 2}`} opacity={0.6} />
          <path d={`M 96 ${g.noseY + 2.6} Q 100 ${g.noseY + 5} 104 ${g.noseY + 2.6}`} />
        </g>
        {persona.noseStud && <circle cx={105.6} cy={g.noseY + 3.4} r={1.15} fill={GOLD} stroke="#a97c1f" strokeWidth={0.3} />}

        <Mouth g={g} spec={spec} lips={p.lips} />
        <FacialHair kind={persona.moustache} colour={mixHex(hairColour, "#1a1512", 0.1)} mouthY={g.mouthY} mouthW={g.mouthW} />
        <Sweat g={g} level={look.sweating} />

        <Hair style={persona.hair} figure={persona.figure} colour={hairColour} grey={persona.grey} part="front" tie={tie} />
        <HeadCoverFront attire={persona.attire} figure={persona.figure} />

        {persona.glasses && <Glasses g={g} />}
        {persona.bindi && (
          <g>
            <circle cx={100} cy={g.browY - 5.6} r={2.3} fill="#b3202a" />
            <circle cx={99.3} cy={g.browY - 6.3} r={0.7} fill="#fff" opacity={0.45} />
          </g>
        )}

        {/* A visible swelling in the neck, on the side the case documents. */}
        {look.swelling && <NeckSwelling kind={look.swelling} skin={p.skin} shade={p.skinShade} />}
      </g>
    </svg>
  )
})
