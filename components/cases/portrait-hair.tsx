"use client"

// Hair, plaits and moustaches. The colour is the persona's greyness (black through salt-and-pepper
// to white), so an older person's hair is drawn in the same shapes as a younger one's, only greyer.

import type { Figure } from "@/lib/simulation/appearance"
import type { HairStyle, Moustache } from "@/lib/simulation/persona"
import { mixHex } from "@/lib/simulation/portrait-palette"

interface HairProps {
  style: HairStyle
  figure: Figure
  colour: string
  grey: number
  part: "back" | "front"
  /** A ribbon or hair tie on a little girl's plaits. */
  tie?: string
}

const dark = (c: string, t: number) => mixHex(c, "#000000", t)
const light = (c: string, t: number) => mixHex(c, "#ffffff", t)

// The hairline of each head: where the hair sits on it.
const FRONT = {
  adult_f: "M 64 96 C 60 50, 140 50, 136 96 C 134 82, 124 70, 110 66 C 104 64.4, 96 64.4, 90 66 C 76 70, 66 82, 64 96 Z",
  adult_m: "M 62 92 C 56 48, 144 48, 138 92 C 137 82, 133 73, 124 68 C 116 72, 108 69, 100 68 C 92 69, 84 72, 76 68 C 67 73, 63 82, 62 92 Z",
  child: "M 60 100 C 54 54, 146 54, 140 100 C 139 88, 133 78, 123 72 C 115 76, 108 74, 100 73 C 92 74, 85 76, 77 72 C 67 78, 61 88, 60 100 Z",
  toddler: "M 55 104 C 50 54, 150 54, 145 104 C 144 90, 137 79, 126 73 C 117 77, 110 75, 100 74 C 90 75, 83 77, 74 73 C 63 79, 56 90, 55 104 Z",
} as const

// A few light strands where grey comes first: the temples and the parting. Only for salt-and-pepper.
function Strands({ colour, grey }: { colour: string; grey: number }) {
  if (grey < 0.08 || grey > 0.78) return null
  const s = light(colour, 0.55)
  return (
    <g stroke={s} strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={0.35 + grey * 0.5}>
      <path d="M 66.5 94 Q 66 82 71 74" />
      <path d="M 133.5 94 Q 134 82 129 74" />
      <path d="M 70 88 Q 70.5 79 75 72" />
      <path d="M 130 88 Q 129.5 79 125 72" />
    </g>
  )
}

export function Hair({ style, figure, colour, grey, part, tie = "#e0563f" }: HairProps) {
  const shade = dark(colour, 0.28)

  switch (style) {
    case "short":
      return part === "front" ? (
        <g>
          <path d={FRONT.adult_m} fill={colour} />
          <path d="M 80 56 C 92 54.5 104 57 111 66" stroke={shade} strokeWidth={1} fill="none" opacity={0.5} strokeLinecap="round" />
          <Strands colour={colour} grey={grey} />
        </g>
      ) : null

    case "receding":
      return part === "front" ? (
        <g fill={colour}>
          <path d="M 63 100 C 58 72, 64 58, 78 56 C 72 65, 70 80, 70 100 Z" />
          <path d="M 137 100 C 142 72, 136 58, 122 56 C 128 65, 130 80, 130 100 Z" />
          <path d="M 71 64 Q 100 46 129 64 C 118 60 110 58 100 58 C 90 58 82 60 71 64 Z" opacity={0.2} />
          <path d="M 80 60 Q 100 52 120 60" stroke={colour} strokeWidth={1.6} fill="none" opacity={0.7} strokeLinecap="round" />
        </g>
      ) : null

    case "long":
      return part === "back" ? (
        <path d="M 60 90 C 48 40, 152 40, 140 90 C 152 132, 148 174, 134 200 L 66 200 C 52 174, 48 132, 60 90 Z" fill={colour} />
      ) : (
        <g>
          <path d="M 65 92 C 62 52, 138 52, 135 92 C 132 78, 122 69, 108 65 C 102 67, 98 67, 92 65 C 78 69, 68 78, 65 92 Z" fill={colour} />
          <path d="M 100 66 C 98 72, 95 78, 90 82" stroke={shade} strokeWidth={0.8} fill="none" opacity={0.5} />
          <Strands colour={colour} grey={grey} />
        </g>
      )

    case "braid":
    case "pulled_back":
      return part === "front" ? (
        <g>
          <path d={FRONT.adult_f} fill={colour} />
          <path d="M 64 96 C 63.4 101 63.8 106 65 110 C 67.4 105 68.8 99 69 93 Z M 136 96 C 136.6 101 136.2 106 135 110 C 132.6 105 131.2 99 131 93 Z" fill={colour} />
          <path d="M 100 62.8 L 100 65.6" stroke={shade} strokeWidth={1} opacity={0.55} strokeLinecap="round" />
          <Strands colour={colour} grey={grey} />
        </g>
      ) : null

    case "crop":
      return part === "front" ? <path d={figure === "toddler" ? FRONT.toddler : FRONT.child} fill={colour} /> : null

    case "pigtails": {
      const toddler = figure === "toddler"
      const head = toddler ? FRONT.toddler : FRONT.child
      const dx = toddler ? 45 : 40
      const y = toddler ? 92 : 88
      const tuft = (side: -1 | 1) => {
        const x = (v: number) => 100 + side * v
        return `M ${x(dx - 2)} ${y - 4} C ${x(dx + 10)} ${y - 2} ${x(dx + 18)} ${y + 14} ${x(dx + 14)} ${y + 36} C ${x(dx + 6)} ${y + 28} ${x(dx + 1)} ${y + 20} ${x(dx - 4)} ${y + 12} Z`
      }
      return part === "back" ? (
        <g fill={colour}>
          <path d={tuft(-1)} />
          <path d={tuft(1)} />
        </g>
      ) : (
        <g>
          <path d={head} fill={colour} />
          <path d="M 100 68.6 L 100 73.6" stroke={shade} strokeWidth={0.9} opacity={0.5} strokeLinecap="round" />
          {[-1, 1].map((side) => (
            <g key={side}>
              <ellipse cx={100 + side * (dx - 1)} cy={y - 1} rx={4.6} ry={5.6} fill={tie} stroke={dark(tie, 0.2)} strokeWidth={0.7} />
              <ellipse cx={100 + side * (dx - 1) - side * 1.2} cy={y - 2.6} rx={1.2} ry={1.7} fill="#fff" opacity={0.4} />
            </g>
          ))}
        </g>
      )
    }

    case "none":
      // an infant with no cap: a few fine wisps
      return part === "front" ? (
        <g stroke={colour} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.6}>
          <path d="M 91 76 Q 99 70 108 75" />
          <path d="M 97 73 Q 104 68 112 72" />
        </g>
      ) : null
  }
}

/** A plait over the shoulder, drawn in front of the garment. */
export function Braid({ colour, tie, grey }: { colour: string; tie: string; grey: number }) {
  const path = "M 70 110 C 58 132 55 164 60 214"
  return (
    <g>
      <path d={path} stroke={dark(colour, 0.2)} strokeWidth={13.5} fill="none" strokeLinecap="round" opacity={0.35} transform="translate(1.6 1.4)" />
      <path d={path} stroke={colour} strokeWidth={12.5} fill="none" strokeLinecap="round" />
      <path d={path} stroke={dark(colour, grey > 0.6 ? 0.16 : 0.34)} strokeWidth={12.5} fill="none" strokeDasharray="1.2 5.4" opacity={grey > 0.6 ? 0.55 : 1} />
      <path d={path} stroke={light(colour, 0.32)} strokeWidth={3.2} fill="none" strokeDasharray="3 3.6" strokeDashoffset={2} opacity={0.55} />
      <ellipse cx={60.4} cy={196} rx={7.4} ry={3.6} fill={tie} stroke={dark(tie, 0.2)} strokeWidth={0.7} />
    </g>
  )
}

interface FacialHairProps {
  kind: Moustache
  colour: string
  mouthY: number
  mouthW: number
}

export function FacialHair({ kind, colour, mouthY, mouthW }: FacialHairProps) {
  if (kind === "none") return null
  const w = mouthW + 3.2
  const c = dark(colour, 0.06)
  return (
    <g>
      {kind === "stubble" && <path d="M 66 100 C 68 124 82 137 100 137 C 118 137 132 124 134 100 C 128 118 116 125 100 125 C 84 125 72 118 66 100 Z" fill={colour} opacity={0.2} />}
      <path
        d={`M ${100 - w} ${mouthY - 4.6} Q ${100 - w / 2} ${mouthY - 9.6} 100 ${mouthY - 6.6} Q ${100 + w / 2} ${mouthY - 9.6} ${100 + w} ${mouthY - 4.6} Q ${100 + w / 2} ${mouthY - 2.6} 100 ${mouthY - 3.6} Q ${100 - w / 2} ${mouthY - 2.6} ${100 - w} ${mouthY - 4.6} Z`}
        fill={c}
        opacity={kind === "full" ? 0.95 : 0.3}
      />
    </g>
  )
}
