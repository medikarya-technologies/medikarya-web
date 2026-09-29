"use client"

// The patient as a cloud of points: a stippled body, drawn on a canvas, turning slowly beside
// the examination list. It is a map, not a model — nothing clinical is decided here:
//
//   hover a region    it lights up, with how many manoeuvres the case offers there
//   click a region    the list below jumps to it
//   drag              turns the patient
//   examine           the region you just examined flashes
//
// The heart beats at the patient's heart rate and the chest rises at their respiratory rate,
// but only when those are measured: an unmeasured vital is never given away by the picture.
//
// Every point is sampled once, from simple solids (ellipsoids, tubes, a torso of stacked rings),
// with a seeded random so the body is the same on every render. Each frame rotates and projects
// them by hand; there is no 3D library and no mesh.

import { useEffect, useMemo, useRef, useState } from "react"
import type { ExamRegion } from "@/lib/simulation/case-schema"
import { cn } from "@/lib/utils"

// ── The body, as points ─────────────────────────────────────────────────────

const REGION_INDEX: ExamRegion[] = ["general", "cardiovascular", "respiratory", "abdomen", "neuro", "extremities"]
const KIND = { skin: 0, heart: 1, lung: 2 } as const
type Kind = (typeof KIND)[keyof typeof KIND]

interface Cloud {
  n: number
  x: Float32Array
  y: Float32Array
  z: Float32Array
  region: Uint8Array
  kind: Uint8Array
  /** 0..1 per point: desynchronises the shimmer. */
  phase: Float32Array
  heart: [number, number, number]
  lungs: Array<[number, number, number]>
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type V3 = [number, number, number]

/** The body stands in its own units: feet at y = 0, crown at y ≈ 8. */
function buildCloud(female: boolean, child: boolean): Cloud {
  const rand = mulberry32(female ? 7331 : 1337)
  const pts: Array<{ p: V3; region: ExamRegion; kind: Kind }> = []
  const push = (p: V3, region: ExamRegion, kind: Kind = KIND.skin) => pts.push({ p, region, kind })

  const gauss = () => {
    const u = Math.max(rand(), 1e-9)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  const direction = (): V3 => {
    const d: V3 = [gauss(), gauss(), gauss()]
    const l = Math.hypot(...d) || 1
    return [d[0] / l, d[1] / l, d[2] / l]
  }

  // More, finer points read as a drawing rather than as dots: every count below is scaled by this.
  const density = 1.7
  // A child's head is a larger share of their height.
  const head = child ? 1.35 : 1

  const ellipsoid = (count: number, c: V3, r: V3, region: ExamRegion, kind: Kind = KIND.skin, fill = 0) => {
    for (let i = 0; i < count * density; i++) {
      const d = direction()
      // `fill` of the points go inside, so organs read as solid rather than as shells.
      const k = rand() < fill ? Math.cbrt(rand()) : 1
      push([c[0] + d[0] * r[0] * k, c[1] + d[1] * r[1] * k, c[2] + d[2] * r[2] * k], region, kind)
    }
  }

  // A tube through joints, its radius eased between them.
  const tube = (count: number, joints: V3[], radii: number[], region: ExamRegion) => {
    const lens = joints.slice(1).map((j, i) => Math.hypot(j[0] - joints[i][0], j[1] - joints[i][1], j[2] - joints[i][2]))
    const total = lens.reduce((a, b) => a + b, 0)
    for (let i = 0; i < count * density; i++) {
      let s = rand() * total
      let seg = 0
      while (seg < lens.length - 1 && s > lens[seg]) s -= lens[seg++]
      const t = s / lens[seg]
      const a = joints[seg]
      const b = joints[seg + 1]
      const c: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
      const r = radii[seg] + (radii[seg + 1] - radii[seg]) * t
      // Two directions across the tube.
      const d: V3 = [(b[0] - a[0]) / lens[seg], (b[1] - a[1]) / lens[seg], (b[2] - a[2]) / lens[seg]]
      let n1: V3 = [d[1], -d[0], 0]
      const l1 = Math.hypot(...n1) || 1
      n1 = [n1[0] / l1, n1[1] / l1, 0]
      const n2: V3 = [d[1] * n1[2] - d[2] * n1[1], d[2] * n1[0] - d[0] * n1[2], d[0] * n1[1] - d[1] * n1[0]]
      const th = rand() * Math.PI * 2
      const co = Math.cos(th)
      const si = Math.sin(th)
      push([c[0] + r * (co * n1[0] + si * n2[0]), c[1] + r * (co * n1[1] + si * n2[1]), c[2] + r * (co * n1[2] + si * n2[2])], region)
    }
  }

  // ── Head and neck ──
  const headC: V3 = [0, 7.45 - (head - 1) * 0.35, 0]
  ellipsoid(420, headC, [0.4 * head, 0.52 * head, 0.46 * head], "neuro")
  ellipsoid(26, [0, headC[1] - 0.06, 0.45 * head], [0.05, 0.1, 0.07], "neuro") // the nose: which way they face
  tube(90, [[0, 6.72, 0], [0, headC[1] - 0.4 * head, 0.02]], [0.19, 0.17], "cardiovascular") // the neck, for the JVP and carotids

  // ── Torso: rings stacked from the hips to the shoulders ──
  // [height, half-width, half-depth]
  const profile: Array<[number, number, number]> = female
    ? [[3.85, 0.86, 0.44], [4.25, 0.9, 0.44], [4.75, 0.6, 0.35], [5.2, 0.63, 0.37], [5.75, 0.76, 0.46], [6.3, 0.82, 0.4], [6.58, 0.8, 0.34], [6.74, 0.5, 0.26], [6.84, 0.21, 0.19]]
    : [[3.85, 0.78, 0.42], [4.25, 0.8, 0.42], [4.75, 0.66, 0.37], [5.2, 0.7, 0.39], [5.8, 0.86, 0.44], [6.3, 0.94, 0.42], [6.58, 0.93, 0.36], [6.74, 0.56, 0.28], [6.84, 0.22, 0.2]]
  const lo = profile[0][0]
  const hi = profile[profile.length - 1][0]
  for (let i = 0; i < 1500 * density; i++) {
    const y = lo + rand() * (hi - lo)
    let k = 0
    while (k < profile.length - 2 && y > profile[k + 1][0]) k++
    const t = (y - profile[k][0]) / (profile[k + 1][0] - profile[k][0])
    const w = profile[k][1] + (profile[k + 1][1] - profile[k][1]) * t
    const d = profile[k][2] + (profile[k + 1][2] - profile[k][2]) * t
    const th = rand() * Math.PI * 2
    // A superellipse: squarer than an oval, as a trunk is.
    const e = 2 / 2.6
    const cx = Math.cos(th)
    const sz = Math.sin(th)
    const x = w * Math.sign(cx) * Math.abs(cx) ** e
    const z = d * Math.sign(sz) * Math.abs(sz) ** e
    push([x, y, z], y >= 5.05 ? "respiratory" : "abdomen")
  }

  // ── Organs, seen through the chest ──
  const heart: V3 = [0.14, 5.82, 0.06]
  ellipsoid(300, heart, [0.2, 0.25, 0.18], "cardiovascular", KIND.heart, 0.35)
  const lungs: V3[] = [[-0.42, 5.98, -0.02], [0.44, 5.98, -0.02]]
  for (const c of lungs) ellipsoid(170, c, [0.28, 0.52, 0.27], "respiratory", KIND.lung, 0.6)

  // ── Arms and hands ──
  const shoulderX = female ? 0.86 : 0.96
  for (const s of [-1, 1]) {
    tube(270, [[s * shoulderX, 6.52, 0], [s * (shoulderX + 0.24), 5.05, -0.04], [s * (shoulderX + 0.4), 3.85, 0.06]], [0.18, 0.14, 0.11], "extremities")
    ellipsoid(70, [s * (shoulderX + 0.45), 3.5, 0.08], [0.1, 0.27, 0.07], "extremities")
  }

  // ── Legs and feet ──
  for (const s of [-1, 1]) {
    tube(400, [[s * 0.4, 4.05, 0], [s * 0.36, 2.1, 0.02], [s * 0.32, 0.32, -0.02]], [0.31, 0.19, 0.12], "extremities")
    ellipsoid(55, [s * 0.34, 0.12, 0.14], [0.12, 0.1, 0.28], "extremities")
  }

  const n = pts.length
  const cloud: Cloud = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    region: new Uint8Array(n),
    kind: new Uint8Array(n),
    phase: new Float32Array(n),
    heart,
    lungs,
  }
  pts.forEach(({ p, region, kind }, i) => {
    cloud.x[i] = p[0]
    cloud.y[i] = p[1]
    cloud.z[i] = p[2]
    cloud.region[i] = REGION_INDEX.indexOf(region)
    cloud.kind[i] = kind
    cloud.phase[i] = rand()
  })
  return cloud
}

// ── Colours, read from the theme ────────────────────────────────────────────

interface Palette {
  ink: string
  faint: string
  accent: string
  heart: string
  done: string
}

function readPalette(el: HTMLElement): Palette {
  const s = getComputedStyle(el)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  return {
    ink: v("--color-enc-ink-2", "#5b6474"),
    faint: v("--color-enc-ink-3", "#8b93a3"),
    accent: v("--brand-500", "#2f7fd6"),
    heart: v("--color-enc-crit", "#d9483b"),
    done: v("--color-enc-ok", "#2e9a62"),
  }
}

// ── The component ───────────────────────────────────────────────────────────

export interface BodyFlash {
  region: ExamRegion
  /** Changes on every examination, so the same region can flash twice. */
  key: number
}

interface BodyPointCloudProps {
  /** Regions the case lets the student examine; the rest of the body is drawn quieter and cannot be picked. */
  regions: ReadonlySet<ExamRegion>
  /** Regions already examined. */
  examined: ReadonlySet<ExamRegion>
  /** The region to show lit from outside (the list is hovered). */
  active: ExamRegion | null
  flash: BodyFlash | null
  /** Beats and breaths per minute to animate at; null when unmeasured. */
  heartRate: number | null
  respiratoryRate: number | null
  female: boolean
  child: boolean
  labelFor: (region: ExamRegion) => string
  countFor: (region: ExamRegion) => number
  onHover: (region: ExamRegion | null) => void
  onSelect: (region: ExamRegion) => void
  className?: string
}

export function BodyPointCloud(props: BodyPointCloudProps) {
  const { female, child, className } = props
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cloud = useMemo(() => buildCloud(female, child), [female, child])

  // The draw loop reads the latest props through a ref, so it is started once and never torn down by a re-render.
  const live = useRef(props)
  live.current = props
  const flashAt = useRef<{ region: number; at: number } | null>(null)
  useEffect(() => {
    if (props.flash) flashAt.current = { region: REGION_INDEX.indexOf(props.flash.region), at: performance.now() }
  }, [props.flash])

  const [hover, setHover] = useState<{ region: ExamRegion; x: number; y: number } | null>(null)
  const hoverRegion = useRef<number>(-1)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let palette = readPalette(wrap)
    let frame = 0
    let raf = 0
    let visible = true
    let W = 0
    let H = 0
    let dpr = 1
    const sx = new Float32Array(cloud.n)
    const sy = new Float32Array(cloud.n)
    const sd = new Float32Array(cloud.n)

    // Turning: a slow sway either side of facing you (side-on, a body is too thin to read), by hand
    // when dragged, and swaying again, about wherever it was left, after a pause.
    let rest = 0
    let sway = 0
    let yaw = 0
    let dragging: { x: number; yaw: number; moved: boolean } | null = null
    let lastTouch = -Infinity

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = r.width
      H = r.height
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !raf) raf = requestAnimationFrame(draw)
    })
    io.observe(wrap)

    // A lub and a dub, then quiet: the heart's squeeze, 0..1.
    const beatAt = (t: number, rate: number) => {
      const ph = (t * rate) / 60 % 1
      const bump = (c: number, w: number, h: number) => (Math.abs(ph - c) < w ? h * Math.cos(((ph - c) / w) * (Math.PI / 2)) ** 2 : 0)
      return bump(0.06, 0.07, 1) + bump(0.22, 0.06, 0.55)
    }

    let last = performance.now()
    function draw(nowMs: number) {
      raf = 0
      if (!visible || document.hidden) return
      const dt = Math.min(0.05, (nowMs - last) / 1000)
      last = nowMs
      const t = nowMs / 1000
      const p = live.current
      if (++frame % 60 === 0) palette = readPalette(wrap!)
      if (!dragging && !reduced && nowMs - lastTouch > 2500) {
        sway += dt * 0.35
        yaw = rest + 0.6 * Math.sin(sway)
      }

      const beat = reduced || p.heartRate === null ? 0 : beatAt(t, p.heartRate)
      const breath = reduced || p.respiratoryRate === null ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * t * p.respiratoryRate) / 60)
      const shimmer = reduced ? 0 : 0.006

      const cy = Math.cos(yaw)
      const syaw = Math.sin(yaw)
      const pitch = 0.1
      const cp = Math.cos(pitch)
      const sp = Math.sin(pitch)
      const scale = Math.min((H * 0.92) / 8.2, (W * 0.9) / 3.4)
      const camera = 14
      const midY = 4.05

      const available = REGION_INDEX.map((r) => p.regions.has(r))
      const examined = REGION_INDEX.map((r) => p.examined.has(r))
      const lit = p.active !== null ? REGION_INDEX.indexOf(p.active) : hoverRegion.current
      const general = lit === 0
      const fl = flashAt.current
      const flashLeft = fl ? Math.max(0, 1 - (nowMs - fl.at) / 1400) : 0

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.clearRect(0, 0, W, H)

      // The floor the patient stands on, so the body is grounded: two soft ellipses.
      ctx!.fillStyle = palette.faint
      for (const [rw, a] of [[1.25, 0.06], [0.75, 0.08]] as const) {
        ctx!.globalAlpha = a
        ctx!.beginPath()
        ctx!.ellipse(W / 2, H / 2 + midY * scale * 0.97, scale * rw, scale * rw * 0.18, 0, 0, Math.PI * 2)
        ctx!.fill()
      }

      // fillStyle reads back normalised, so the last colour set is tracked here instead.
      let current = ""
      const [hx, hy, hz] = cloud.heart
      for (let i = 0; i < cloud.n; i++) {
        let x = cloud.x[i]
        let y = cloud.y[i]
        let z = cloud.z[i]
        const kind = cloud.kind[i]
        const region = cloud.region[i]

        if (kind === KIND.heart) {
          const k = 1 + 0.13 * beat
          x = hx + (x - hx) * k
          y = hy + (y - hy) * k
          z = hz + (z - hz) * k
        } else if (kind === KIND.lung) {
          const c = cloud.lungs[x < 0 ? 0 : 1]
          const k = 1 + 0.07 * breath
          x = c[0] + (x - c[0]) * k
          y = c[1] + (y - c[1]) * (1 + 0.035 * breath)
          z = c[2] + (z - c[2]) * k
        } else if (region === 2 /* chest wall */) {
          const k = 1 + 0.028 * breath * Math.min(1, (y - 5.05) / 0.6)
          x *= k
          z *= k
        } else if (region === 3 /* abdomen */) {
          z *= 1 + 0.02 * breath
        }
        if (shimmer) {
          const ph = cloud.phase[i] * 6.283
          x += shimmer * Math.sin(t * 1.3 + ph)
          y += shimmer * Math.cos(t * 1.1 + ph * 1.7)
        }

        // Turn, tip forward a little, then perspective.
        const rx = x * cy + z * syaw
        const rz = -x * syaw + z * cy
        const ry = (y - midY) * cp - rz * sp
        const rz2 = (y - midY) * sp + rz * cp
        const f = camera / (camera - rz2)
        const px = W / 2 + rx * f * scale
        const py = H / 2 - ry * f * scale
        sx[i] = px
        sy[i] = py
        sd[i] = rz2

        // Nearer points are darker and larger, as in a stipple drawing.
        const depth = Math.max(0, Math.min(1, (rz2 + 1) / 2))
        let alpha = kind === KIND.lung ? 0.1 + 0.25 * depth : kind === KIND.heart ? 0.4 + 0.5 * depth : 0.18 + 0.66 * depth
        let size = 0.7 + 0.8 * depth
        let colour = kind === KIND.heart ? palette.heart : kind === KIND.lung ? palette.faint : palette.ink

        if (!available[region]) alpha *= 0.55
        else if (examined[region] && kind === KIND.skin) colour = palette.done
        if (general || lit === region) {
          if (available[region] || general) {
            colour = kind === KIND.heart ? palette.heart : palette.accent
            alpha = Math.min(1, alpha * 1.5 + 0.15)
            size += 0.45
          }
        } else if (lit > 0) {
          alpha *= 0.6
        }
        if (fl && flashLeft > 0 && (fl.region === region || fl.region === 0)) {
          const wave = flashLeft * (0.6 + 0.4 * Math.sin(cloud.phase[i] * 6.283 + t * 10))
          alpha = Math.min(1, alpha + wave * 0.6)
          size += wave * 1.2
          colour = palette.accent
        }

        ctx!.globalAlpha = alpha
        if (current !== colour) ctx!.fillStyle = current = colour
        ctx!.fillRect(px - size / 2, py - size / 2, size, size)
      }
      ctx!.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const onVisibility = () => {
      if (!document.hidden && !raf) {
        last = performance.now()
        raf = requestAnimationFrame(draw)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    // ── Picking: the nearest pickable point under the pointer, front first ──
    const pick = (clientX: number, clientY: number): number => {
      const r = canvas.getBoundingClientRect()
      const x = clientX - r.left
      const y = clientY - r.top
      const regions = live.current.regions
      let best = -1
      let bestScore = Infinity
      for (let i = 0; i < cloud.n; i++) {
        const region = cloud.region[i]
        if (!regions.has(REGION_INDEX[region])) continue
        const d2 = (sx[i] - x) ** 2 + (sy[i] - y) ** 2
        if (d2 > 196) continue
        const score = d2 - sd[i] * 40
        if (score < bestScore) {
          bestScore = score
          best = region
        }
      }
      return best
    }

    const setHovered = (region: number, clientX: number, clientY: number) => {
      if (region !== hoverRegion.current) {
        hoverRegion.current = region
        live.current.onHover(region >= 0 ? REGION_INDEX[region] : null)
      }
      const r = wrap.getBoundingClientRect()
      setHover(region >= 0 ? { region: REGION_INDEX[region], x: clientX - r.left, y: clientY - r.top } : null)
      canvas.style.cursor = dragging?.moved ? "grabbing" : region >= 0 ? "pointer" : "grab"
    }

    const onDown = (e: PointerEvent) => {
      dragging = { x: e.clientX, yaw, moved: false }
      lastTouch = performance.now()
    }
    const onMove = (e: PointerEvent) => {
      if (dragging && e.buttons) {
        const dx = e.clientX - dragging.x
        if (Math.abs(dx) > 4) dragging.moved = true
        if (dragging.moved) {
          yaw = dragging.yaw + dx * 0.012
          lastTouch = performance.now()
          setHovered(-1, e.clientX, e.clientY)
          return
        }
      }
      setHovered(pick(e.clientX, e.clientY), e.clientX, e.clientY)
    }
    const onUp = (e: PointerEvent) => {
      const wasDrag = dragging?.moved
      dragging = null
      lastTouch = performance.now()
      rest = yaw
      sway = 0
      if (!wasDrag) {
        const region = pick(e.clientX, e.clientY)
        if (region >= 0) live.current.onSelect(REGION_INDEX[region])
      }
    }
    const onLeave = () => {
      if (dragging?.moved) {
        rest = yaw
        sway = 0
      }
      dragging = null
      setHovered(-1, 0, 0)
    }
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointerleave", onLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointerleave", onLeave)
    }
  }, [cloud])

  return (
    <div ref={wrapRef} className={cn("relative select-none", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 touch-pan-y" role="img" aria-label="The patient's body. Pick a region below to jump to it." />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-enc-line bg-enc-sheet px-2 py-1 text-[12px] whitespace-nowrap text-enc-ink shadow-enc-lift"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          <span className="font-semibold">{props.labelFor(hover.region)}</span>
          <span className="text-enc-ink-3"> · {props.countFor(hover.region)} to examine</span>
        </div>
      )}
    </div>
  )
}
