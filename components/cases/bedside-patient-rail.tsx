"use client"

// The bedside patient rail: WHO you are treating. Downstream of PatientState only:
// it displays what the engine reports and never drives it.
//
//   Patient      the portrait and what you see on walking up to the bed
//   Monitor      the one dark surface: a live trace and the numbers, like a real monitor
//   Encounter    the clock and, where the case has them, the critical window and order budget
//   Support      the paid assists, each with its cost stated up front
//
// Vitals are plain numbers, like a real monitor. The abnormality badges (TACHY,
// HYPO, HYPOXIC…) are an ASSIST: they appear only after the student spends
// `highlight_abnormal`, and tapping one to see why it matters spends
// `explain_abnormal`. Monitor ALARMS (the case's state_thresholds) are not assists
// and are always shown.
//
// The numbers are alive: heart rate, saturation and respiratory rate wander by a
// beat or a point, blood pressure is a cuff reading taken every few minutes (and
// straight away when the patient changes). That variation is display only and
// never crosses a threshold the state has not crossed (lib/simulation/live-vitals.ts).

import { useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronDown, ChevronUp, Eye, Lightbulb, ListOrdered, Sparkles } from "lucide-react"
import { cn, formatPatientAge } from "@/lib/utils"
import { formatClock, countBudgetedActions, type EventOf } from "@/lib/simulation/encounter-events"
import { alarmLabel, assessVitals, type VitalKey, type VitalSeverity } from "@/lib/simulation/vitals-assess"
import { liveReading, nextMeasurementTime, nibpReading } from "@/lib/simulation/live-vitals"
import { useClinicalEvents } from "./clinical-event-manager"
import { TelemetryMonitor } from "./telemetry-monitor"
import { monitorSound, SoundToggle } from "./monitor-sound"
import { Eyebrow, Paper, StatusPill } from "./encounter-ui"
import { PatientPortrait } from "./patient-portrait"
import { usePatientAppearance } from "./use-patient-appearance"
import { useToast } from "@/hooks/use-toast"

// ── The channels: colour is a function, as on a real monitor ────────────────

const CHANNEL: Record<VitalKey, { label: string; unit: string; text: string }> = {
  hr: { label: "HR", unit: "bpm", text: "text-enc-ecg" },
  spo2: { label: "SpO₂", unit: "%", text: "text-enc-spo2" },
  bp: { label: "NIBP", unit: "mmHg", text: "text-enc-nibp" },
  rr: { label: "RR", unit: "/min", text: "text-enc-rr" },
  temperature: { label: "Temp", unit: "°C", text: "text-enc-nibp" },
}

// Once the abnormality assist is paid for, a vital that is off its range takes the warning colour.
const SEVERITY_TEXT: Record<VitalSeverity, string | null> = { normal: null, warning: "text-enc-scope-warn", critical: "text-enc-scope-crit" }
const SEVERITY_BADGE: Record<VitalSeverity, string> = {
  normal: "bg-white/10 text-enc-scope-dim",
  warning: "bg-enc-scope-warn/15 text-enc-scope-warn",
  critical: "bg-enc-scope-crit/20 text-enc-scope-crit",
}

// ── Live values ─────────────────────────────────────────────────────────────

/** The most a displayed number may move per simulation second when the true value jumps. */
const GLIDE_PER_SECOND = { hr: 10, spo2: 1.5, rr: 2, sbp: 8, dbp: 6 } as const

interface Shown {
  hr: number
  spo2: number
  rr: number
  systolic: number
  diastolic: number
  measuredAt: number
}

export function useLiveVitals(): Shown {
  const { patient, now, config, caseData } = useClinicalEvents()
  const seed: string = String(caseData.id ?? caseData.patient?.name ?? "case")
  const age: number | undefined = caseData.patient?.age
  const opts = { seed, age, thresholds: config.state_thresholds }

  const target = liveReading(patient, now, opts)

  // The cuff: cycles on the clock, and straight away when the patient's pressure changes.
  const cuff = useRef<{ measuredAt: number; base: { systolic: number; diastolic: number } } | null>(null)
  const truePressure = { systolic: patient.systolic, diastolic: patient.diastolic }
  const measuredAt = nextMeasurementTime(cuff.current, now, truePressure)
  if (cuff.current === null || cuff.current.measuredAt !== measuredAt) cuff.current = { measuredAt, base: truePressure }
  const reading = nibpReading(truePressure, measuredAt, opts)

  // A true change (a deterioration, a treatment) glides to its new value over a few seconds
  // instead of jumping, like a monitor averaging; the small wander passes straight through.
  const shown = useRef<{ at: number; v: Record<keyof typeof GLIDE_PER_SECOND, number> } | null>(null)
  const goal = { hr: target.hr, spo2: target.spo2, rr: target.rr, sbp: reading.systolic, dbp: reading.diastolic }
  if (shown.current === null || now < shown.current.at) {
    shown.current = { at: now, v: { ...goal } }
  } else if (now > shown.current.at) {
    const dt = now - shown.current.at
    for (const key of Object.keys(goal) as Array<keyof typeof goal>) {
      const step = GLIDE_PER_SECOND[key] * dt
      const gap = goal[key] - shown.current.v[key]
      shown.current.v[key] += Math.max(-step, Math.min(step, gap))
    }
    shown.current.at = now
  }
  const v = shown.current.v
  return { hr: Math.round(v.hr), spo2: Math.round(v.spo2), rr: Math.round(v.rr), systolic: Math.round(v.sbp), diastolic: Math.round(v.dbp), measuredAt }
}

// ── One channel of the monitor ──────────────────────────────────────────────

interface ChannelProps {
  vital: VitalKey
  value: string
  severity: VitalSeverity
  highlighted: boolean
  badge: string | null
  direction: "up" | "down" | null
  canExplain: boolean
  explainCost: number
  explained: boolean
  open: boolean
  explanation: string
  onBadge: () => void
  sub?: string
  className?: string
}

function Channel({ vital, value, severity, highlighted, badge, direction, canExplain, explainCost, explained, open, explanation, onBadge, sub, className }: ChannelProps) {
  const c = CHANNEL[vital]
  const tint = highlighted ? SEVERITY_TEXT[severity] : null
  const showBadge = highlighted && badge
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : ""
  return (
    <div className={cn("px-3 py-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-[10.5px] font-semibold tracking-[0.1em] text-enc-scope-dim uppercase">{c.label}</span>
        <span className="text-[10.5px] text-enc-scope-dim">{c.unit}</span>
      </div>
      <p className={cn("font-mono text-[30px] leading-[1.12] font-medium tabular-nums", tint ?? c.text)}>{value}</p>
      <div className="flex min-h-5 items-center gap-1.5">
        {sub && <span className="font-mono text-[10.5px] text-enc-scope-dim tabular-nums">{sub}</span>}
        {showBadge &&
          (canExplain ? (
            <button
              type="button"
              onClick={onBadge}
              title={explained ? "Show explanation" : `Why does this matter? (−${explainCost} Independent)`}
              className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide transition hover:brightness-125", SEVERITY_BADGE[severity])}
            >
              {badge} {arrow}
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 opacity-60" />}
            </button>
          ) : (
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide", SEVERITY_BADGE[severity])}>
              {badge} {arrow}
            </span>
          ))}
      </div>
      {open && <p className="mt-1 rounded-md bg-enc-scope-raised p-2 text-[11px] leading-relaxed text-enc-scope-dim">{explanation}</p>}
    </div>
  )
}

// ── Support button ──────────────────────────────────────────────────────────

function SupportButton({ icon: Icon, label, cost, onClick, disabled, title }: { icon: typeof Sparkles; label: string; cost?: number; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="group flex h-10 w-full items-center gap-2.5 rounded-lg border border-enc-line-strong bg-enc-sheet px-3 text-left text-[13px] font-medium text-enc-ink shadow-enc-sheet transition-colors outline-none hover:border-brand-300 hover:bg-brand-50/60 focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-4 w-4 shrink-0 text-enc-ink-3 group-hover:text-brand-600" />
      <span className="flex-1 truncate">{label}</span>
      {cost !== undefined && <span className="font-mono text-[11px] text-enc-ink-3 tabular-nums">−{cost}</span>}
    </button>
  )
}

// ── The rail ────────────────────────────────────────────────────────────────

interface BedsidePatientRailProps {
  onOpenDifferential: () => void
  className?: string
}

export function BedsidePatientRail({ onOpenDifferential, className }: BedsidePatientRailProps) {
  const { config, caseData, patient, now, events, policy, actions, limitSeconds, isExpired } = useClinicalEvents()
  const { toast } = useToast()
  const appearance = usePatientAppearance()
  const shown = useLiveVitals()

  const [hint, setHint] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<VitalKey | null>(null)

  // What the student has already paid for, read from the log.
  const paid = useMemo(() => {
    const assists = events.filter((e): e is EventOf<"ASSIST_USED"> => e.type === "ASSIST_USED")
    return {
      highlight: assists.some((a) => a.assistType === "highlight_abnormal"),
      explained: new Set(assists.filter((a) => a.assistType === "explain_abnormal" && a.target?.startsWith("vital:")).map((a) => a.target!.slice(6))),
      total: assists.reduce((s, a) => s + a.cost, 0),
    }
  }, [events])

  const vitals = useMemo(() => assessVitals(patient, config), [patient, config])
  const byKey = Object.fromEntries(vitals.map((v) => [v.key, v])) as Record<VitalKey, (typeof vitals)[number]>
  const unmeasured = new Set<string>(config.initial_state?.unmeasured ?? [])

  const highlightPolicy = policy.availability("highlight_abnormal")
  const explainPolicy = policy.availability("explain_abnormal")
  const hintPolicy = policy.availability("socratic_hint")

  const p = caseData.patient
  const constraints = config.clinical_constraints ?? {}

  // A case only shows what it defines: no critical window, no order budget and no authored
  // hints means no bar, no counter and no Hint button, rather than a dead control.
  const budget = constraints.recommended_actions
  const used = countBudgetedActions(events)
  const remaining = budget === undefined ? 0 : Math.max(0, budget - used)

  const windowMinutes = constraints.critical_window_minutes
  const windowSeconds = (windowMinutes ?? 0) * 60
  const hasWindow = windowSeconds > 0
  const windowFraction = hasWindow ? Math.min(1, now / windowSeconds) : 0
  const windowPassed = hasWindow && now >= windowSeconds
  const windowLeft = Math.max(0, windowSeconds - now)
  const hasHints = (config.socratic_hints?.length ?? 0) > 0

  const lethal = patient.alarms.includes("cardiac_arrest_risk")

  const handleHighlight = () => {
    const result = actions.requestAssist("highlight_abnormal", "vitals")
    if (result.ok && result.charged) {
      toast({ title: "Abnormal vitals highlighted", description: `Recorded on your Independent score (−${result.cost}).`, duration: 3000 })
    }
  }

  const handleBadge = (key: VitalKey) => {
    if (!explainPolicy.available) return
    if (expanded === key) return setExpanded(null)
    const result = actions.requestAssist("explain_abnormal", `vital:${key}`)
    if (result.ok) {
      if (result.charged) {
        toast({ title: "Explanation unlocked", description: `Recorded on your Independent score (−${result.cost}).`, duration: 3000 })
      }
      setExpanded(key)
    }
  }

  const handleHint = () => {
    const result = actions.requestHint()
    if (result.ok) {
      setHint(result.hint)
      toast({ title: "Socratic hint", description: `Recorded on your Independent score (−${result.cost}).`, duration: 3000 })
    } else {
      setHint(null)
      toast({ title: "No hint available", description: result.reason, duration: 3500 })
    }
  }

  // Numbers on the screen: live where they are measured, "—" where the case never measured them.
  const display = (key: VitalKey): string => {
    if (unmeasured.has(key)) return "—"
    switch (key) {
      case "hr":
        return patient.rhythm === "vf" ? "—" : String(shown.hr)
      case "spo2":
        return String(shown.spo2)
      case "rr":
        return String(shown.rr)
      case "bp":
        return `${shown.systolic}/${shown.diastolic}`
      default:
        return byKey[key].display
    }
  }

  const channel = (key: VitalKey, className?: string, sub?: string) => {
    const v = byKey[key]
    return (
      <Channel
        vital={key}
        value={display(key)}
        severity={v.severity}
        highlighted={paid.highlight}
        badge={v.badge}
        direction={v.direction}
        canExplain={explainPolicy.available}
        explainCost={explainPolicy.cost}
        explained={paid.explained.has(key)}
        open={expanded === key && paid.explained.has(key)}
        explanation={v.explanation}
        onBadge={() => handleBadge(key)}
        sub={sub}
        className={className}
      />
    )
  }

  const age = formatPatientAge(p.age).replace(/ old/g, "")
  const setting: string | undefined = caseData.setting

  return (
    <aside className={cn("flex flex-col gap-5 p-4", className)} aria-label="Bedside patient monitor" data-tour="patient">
      {/* ── Patient ─────────────────────────────────────────────────── */}
      <section aria-label="Patient">
        <Paper className="overflow-hidden">
          <div className="flex gap-3 p-3">
            <PatientPortrait
              persona={appearance.persona}
              look={appearance.look}
              rr={shown.rr}
              label={appearance.observation || p.name}
              className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg ring-1 ring-enc-line"
            />
            <div className="min-w-0 pt-0.5">
              <h2 className="text-[16px] leading-tight font-semibold text-enc-ink">{p.name}</h2>
              <p className="mt-0.5 text-[13px] text-enc-ink-2">
                {age} · {p.gender}
              </p>
              {p.mrn && <p className="mt-1 font-mono text-[11px] text-enc-ink-3">{/^mrn/i.test(String(p.mrn).trim()) ? String(p.mrn).trim() : `MRN ${String(p.mrn).trim()}`}</p>}
              {setting && <p className="mt-0.5 truncate text-[12px] text-enc-ink-3">{setting}</p>}
            </div>
          </div>
          {appearance.observation && (
            <div className="flex gap-2 border-t border-enc-line bg-enc-desk px-3 py-2.5">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-enc-ink-3" />
              <p className="text-[13px] leading-snug text-enc-ink-2 italic">{appearance.observation}</p>
            </div>
          )}
        </Paper>
      </section>

      {/* ── Monitor ─────────────────────────────────────────────────── */}
      <section aria-label="Bedside monitor" className="overflow-hidden rounded-xl bg-enc-scope text-enc-nibp shadow-[inset_0_0_0_1px_var(--color-enc-scope-line)]">
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <span className="text-[10.5px] font-semibold tracking-[0.12em] text-enc-scope-dim uppercase">Bedside monitor</span>
          <span className="flex items-center gap-2">
            <SoundToggle />
            <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-enc-ecg">
              <span className="enc-live-dot h-1.5 w-1.5 rounded-full bg-enc-ecg" /> LIVE
            </span>
          </span>
        </div>

        {/* Alarms: a monitor alarms, it doesn't diagnose, so these are always on */}
        {patient.alarms.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2" role="alert">
            {patient.alarms.map((a) => (
              <span key={a} className="enc-live-dot inline-flex items-center gap-1 rounded bg-enc-crit px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
                <AlertTriangle className="h-3 w-3" />
                {alarmLabel(a)}
              </span>
            ))}
          </div>
        )}

        <div className="relative border-y border-enc-scope-line">
          <TelemetryMonitor rhythm={patient.rhythm} rate={patient.rate} alarming={lethal} onBeat={monitorSound.onBeat} className="h-[84px] w-full rounded-none bg-transparent" />
          <span className="pointer-events-none absolute top-1.5 left-2.5 text-[10px] font-semibold tracking-wider text-enc-scope-dim">II</span>
          <span className="pointer-events-none absolute top-1.5 right-2.5 font-mono text-[10px] text-enc-scope-dim">25 mm/s</span>
        </div>

        <div className="grid grid-cols-2">
          {channel("hr")}
          {channel("spo2", "border-l border-enc-scope-line")}
          {channel("bp", "col-span-2 border-t border-enc-scope-line", unmeasured.has("bp") ? undefined : `measured ${formatClock(shown.measuredAt)}`)}
          {channel("rr", "border-t border-enc-scope-line")}
          {channel("temperature", "border-t border-l border-enc-scope-line")}
        </div>
      </section>

      {/* ── Encounter ───────────────────────────────────────────────── */}
      <section aria-label="Encounter" className="space-y-3">
        <Eyebrow>Encounter</Eyebrow>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[24px] leading-none font-medium text-enc-ink tabular-nums">{formatClock(now)}</span>
          <span className="text-[12px] text-enc-ink-3">elapsed</span>
          {!constraints.untimed && <span className="ml-auto font-mono text-[12px] text-enc-ink-3 tabular-nums">of {formatClock(limitSeconds)}</span>}
        </div>

        {hasWindow && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className={cn("font-medium", windowPassed ? "text-enc-crit" : "text-enc-ink-2")}>{windowPassed ? "Critical window passed" : "Critical window"}</span>
              <span className="font-mono text-enc-ink-3 tabular-nums">{windowPassed ? `${windowMinutes} min` : `${formatClock(windowLeft)} left`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-enc-line-strong">
              <div
                className={cn("h-full rounded-full transition-all", windowFraction > 0.85 ? "bg-enc-crit" : windowFraction > 0.55 ? "bg-enc-warn" : "bg-enc-ok")}
                style={{ width: `${windowFraction * 100}%` }}
              />
            </div>
          </div>
        )}

        {budget !== undefined && (
          <p className="text-[12px] text-enc-ink-2" title="Investigations and interventions count against the recommended budget.">
            {remaining === 0 ? (
              <span className="font-medium text-enc-warn">Recommended order budget used</span>
            ) : (
              <>
                <span className="font-mono font-semibold text-enc-ink tabular-nums">{remaining}</span> of {budget} recommended orders remaining
              </>
            )}
          </p>
        )}
      </section>

      {/* ── Support ─────────────────────────────────────────────────── */}
      <section aria-label="Support" className="space-y-2.5">
        <div>
          <Eyebrow>Support</Eyebrow>
          <p className="mt-1 text-[12px] leading-snug text-enc-ink-3">Anything you use here is recorded against your Independent score.</p>
        </div>

        {highlightPolicy.available && !paid.highlight && (
          <SupportButton icon={Sparkles} label="Highlight abnormal vitals" cost={highlightPolicy.cost} onClick={handleHighlight} />
        )}
        {paid.highlight && (
          <p className="flex items-center gap-1.5 text-[12px] text-enc-ink-2">
            <Check className="h-3.5 w-3.5 text-enc-ok" /> Abnormal vitals are highlighted on the monitor.
          </p>
        )}
        <SupportButton icon={ListOrdered} label="Differential" onClick={onOpenDifferential} />
        {hasHints && (
          <SupportButton
            icon={Lightbulb}
            label="Hint"
            cost={hintPolicy.available ? hintPolicy.cost : undefined}
            onClick={handleHint}
            disabled={!hintPolicy.available || isExpired}
            title={hintPolicy.available ? "A nudge, never the answer" : "Hints are not available in this case"}
          />
        )}

        {hint && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-[13px] leading-relaxed text-brand-900">
            {hint}
            <button className="ml-2 text-[11px] text-brand-700 underline" onClick={() => setHint(null)}>
              dismiss
            </button>
          </div>
        )}

        {paid.total > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-enc-console-hover px-3 py-2 text-[12px] text-enc-ink-2">
            <span>Assistance used</span>
            <StatusPill tone="neutral" className="bg-enc-sheet">
              −{paid.total}
            </StatusPill>
          </div>
        )}
      </section>
    </aside>
  )
}
