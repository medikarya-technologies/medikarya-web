"use client"

// The ClinicalEventManager: React's binding to the EncounterEngine.
//
//   Any ClinicalEvent dispatched
//        ↓
//   engine.dispatch()  →  PatientState.due()  (time + action + physiology)
//        ↓
//   STATE_TRANSITION / PATIENT_DETERIORATED appended to the same log
//        ↓
//   vitals rail · telemetry · nurse alert · intervene tray all re-render
//
// This file owns three things the pure engine deliberately doesn't: the
// simulation CLOCK (real time × the case's time_scale, paused while the tab is
// hidden), PERSISTENCE (the event log survives a refresh), and the ACTION
// helpers UI components call. Nothing here derives clinical truth — that all
// comes from the log.

import * as React from "react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { EncounterEngine, type AssistResult, type InterventionResult } from "@/lib/simulation/encounter-engine"
import { sanitizeEvents, type AssistType, type ClinicalEvent } from "@/lib/simulation/encounter-events"
import { hardLimitSeconds, type SimulationCaseConfig } from "@/lib/simulation/case-schema"
import type { PatientSnapshot } from "@/lib/simulation/patient-state"
import type { AssistPolicy } from "@/lib/simulation/assist-policy"
import {
  HINT_TARGET_PREFIX,
  demographicsOf,
  listOrders,
  patientAtEvent,
  resolveExamFindings,
  resolveInvestigation,
  selectSocraticHint,
  shownHintIds,
  type InvestigationOrder,
  type ResolvedResult,
} from "@/lib/simulation/case-resolvers"
import { assistTypeForTest } from "@/lib/clinical-catalog"
import { getTestDef } from "@/lib/simulation/test-catalog"

// ── Public shape ────────────────────────────────────────────────────────────

export interface NurseAlert {
  narrative: string
  ruleId: string
  timestamp: number
}

export interface ClinicalEventContextValue {
  config: SimulationCaseConfig
  caseData: any
  engine: EncounterEngine
  policy: AssistPolicy
  events: readonly ClinicalEvent[]
  patient: PatientSnapshot
  /** Simulation seconds since the encounter began; updates ~4×/second. */
  now: number
  /** Precise simulation time, for stamping events. */
  getNow: () => number
  limitSeconds: number
  isExpired: boolean
  /** The latest un-dismissed deterioration alert. */
  alert: NurseAlert | null
  dismissAlert: () => void
  /** Present when the encounter was restored from a previous session. */
  resumedAt: number | null
  actions: {
    takeHistory: (question: string, response: string) => void
    performExam: (manoeuvreId: string) => string | null
    orderTest: (testId: string) => InvestigationOrder | null
    interpretResult: (order: InvestigationOrder, text: string) => void
    revealResult: (order: InvestigationOrder) => AssistResult
    requestAssist: (type: AssistType, target?: string) => AssistResult
    requestHint: () => { ok: true; hint: string; cost: number } | { ok: false; reason: string }
    giveIntervention: (action: string) => InterventionResult | null
    submitDifferential: (ranked: string[]) => void
    submitAssessment: (args: { ranked: string[]; primary: string; reasoning: string; steps: string[] }) => void
  }
  /** Resolve the result of an order against the patient as they were when it was placed. */
  resolveResult: (order: InvestigationOrder) => ResolvedResult | null
  reset: () => void
}

const Ctx = createContext<ClinicalEventContextValue | null>(null)

export function useClinicalEvents(): ClinicalEventContextValue {
  const value = useContext(Ctx)
  if (!value) throw new Error("useClinicalEvents must be used inside <ClinicalEventProvider>")
  return value
}

// ── Persistence ─────────────────────────────────────────────────────────────

interface Saved {
  v: 1
  events: unknown
  elapsedSeconds: number
  /** ms since the epoch: lets the library say how long ago a case was left. */
  savedAt?: number
}

function readSaved(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && parsed.v === 1 ? (parsed as Saved) : null
  } catch {
    return null
  }
}

function writeSaved(key: string, saved: Saved) {
  try {
    localStorage.setItem(key, JSON.stringify(saved))
  } catch {
    /* storage full or unavailable — the encounter still runs, it just won't resume */
  }
}

// ── Provider ────────────────────────────────────────────────────────────────

interface ProviderProps {
  config: SimulationCaseConfig
  caseData: any
  storageKey: string
  /** Test/dev hook: overrides the case's time_scale (e.g. ?simSpeed=10 to fast-forward). */
  timeScaleOverride?: number
  /** Stop the clock (e.g. once the assessment has been submitted). */
  frozen?: boolean
  children: React.ReactNode
}

export function ClinicalEventProvider({
  config,
  caseData,
  storageKey,
  timeScaleOverride,
  frozen = false,
  children,
}: ProviderProps) {
  const timeScale = timeScaleOverride ?? config.clinical_constraints?.time_scale ?? 1
  const limitSeconds = hardLimitSeconds(config)

  // Created once. Restoring from storage happens in the initializer so the very
  // first render already shows the resumed encounter.
  const [boot] = useState(() => {
    const saved = typeof window !== "undefined" ? readSaved(storageKey) : null
    const events = saved ? sanitizeEvents(saved.events) : []
    const elapsed = saved && Number.isFinite(saved.elapsedSeconds) ? Math.max(0, saved.elapsedSeconds) : 0
    return {
      engine: new EncounterEngine(config, events),
      elapsed: Math.max(elapsed, events.length ? events[events.length - 1].timestamp : 0),
      resumed: events.length > 0,
    }
  })
  const engine = boot.engine

  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)

  // ── Clock ───────────────────────────────────────────────────────────────
  // `accumulated` = simulation seconds banked before the current running
  // segment; `segmentStart` = performance.now() when it began (null = paused).
  const accumulatedRef = useRef(boot.elapsed)
  const segmentStartRef = useRef<number | null>(null)
  const [now, setNow] = useState(boot.elapsed)
  const [expired, setExpired] = useState(boot.elapsed >= limitSeconds)
  const frozenRef = useRef(frozen)
  frozenRef.current = frozen

  const getNow = useCallback((): number => {
    const running = segmentStartRef.current
    const raw =
      accumulatedRef.current + (running === null ? 0 : ((performance.now() - running) / 1000) * timeScale)
    return Math.min(raw, limitSeconds)
  }, [timeScale, limitSeconds])

  useEffect(() => {
    const start = () => {
      if (segmentStartRef.current === null && !frozenRef.current && !document.hidden) {
        segmentStartRef.current = performance.now()
      }
    }
    const stop = () => {
      if (segmentStartRef.current !== null) {
        accumulatedRef.current = getNow()
        segmentStartRef.current = null
      }
    }
    start()

    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener("visibilitychange", onVisibility)

    const tick = window.setInterval(() => {
      if (frozenRef.current) stop()
      else start()

      const t = getNow()
      setNow(t)
      engine.advanceTo(t) // fires any rule that became true
      if (t >= limitSeconds) {
        stop()
        accumulatedRef.current = limitSeconds
        setExpired(true)
      }
    }, 250)

    return () => {
      window.clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisibility)
      stop()
    }
  }, [engine, getNow, limitSeconds])

  // ── Persist ─────────────────────────────────────────────────────────────
  // Once a reset has started, nothing may write the old encounter back: the
  // page-hide handler fires during the reload that a reset triggers.
  const resettingRef = useRef(false)
  const persist = useCallback(() => {
    if (resettingRef.current) return
    writeSaved(storageKey, { v: 1, events: [...engine.events], elapsedSeconds: getNow(), savedAt: Date.now() })
  }, [engine, getNow, storageKey])

  useEffect(() => {
    persist()
  }, [snapshot.version, persist])

  useEffect(() => {
    const id = window.setInterval(persist, 10_000)
    const onHide = () => persist()
    window.addEventListener("pagehide", onHide)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("pagehide", onHide)
    }
  }, [persist])

  // ── Nurse alert ─────────────────────────────────────────────────────────
  // Derived from the log: the latest PATIENT_DETERIORATED, until dismissed.
  const [dismissedAt, setDismissedAt] = useState<number>(() => {
    // A restored encounter shouldn't re-shout an alert the student already saw.
    const last = [...snapshot.events].reverse().find((e) => e.type === "PATIENT_DETERIORATED")
    return boot.resumed && last ? last.timestamp : -1
  })
  const alert = useMemo<NurseAlert | null>(() => {
    for (let i = snapshot.events.length - 1; i >= 0; i--) {
      const e = snapshot.events[i]
      if (e.type === "PATIENT_DETERIORATED") {
        return e.timestamp > dismissedAt ? { narrative: e.narrative, ruleId: e.ruleId, timestamp: e.timestamp } : null
      }
    }
    return null
  }, [snapshot.events, dismissedAt])
  const dismissAlert = useCallback(() => {
    const last = [...engine.events].reverse().find((e) => e.type === "PATIENT_DETERIORATED")
    if (last) setDismissedAt(last.timestamp)
  }, [engine])

  // ── Actions ─────────────────────────────────────────────────────────────
  const demographics = useMemo(() => demographicsOf(caseData), [caseData])

  const actions = useMemo<ClinicalEventContextValue["actions"]>(() => {
    const at = () => Math.min(getNow(), limitSeconds)

    const requestAssist = (type: AssistType, target?: string) => engine.requestAssist(type, at(), target)

    return {
      takeHistory: (question, response) => {
        engine.takeHistory(question, response, at())
      },

      performExam: (manoeuvreId) => {
        const t = at()
        // Findings are resolved against the patient right now, then recorded — the log holds what the student saw.
        const findings = resolveExamFindings(config, manoeuvreId, engine.state.snapshot(), t)
        if (findings === null) return null
        engine.performExam(manoeuvreId, findings, t)
        return findings
      },

      orderTest: (testId) => {
        const test = getTestDef(config, testId)
        if (!test) return null
        const t = at()
        engine.orderTest(testId, test.name, t)
        return listOrders(engine.events).at(-1) ?? null
      },

      interpretResult: (order, text) => {
        engine.interpretResult(order.testId, text, at(), order.orderedAt)
      },

      revealResult: (order) => {
        const test = getTestDef(config, order.testId)
        if (!test) return { ok: false, reason: "not_allowed" }
        return engine.revealResult({
          testId: order.testId,
          orderTimestamp: order.orderedAt,
          revealType: test.kind === "imaging" ? "impression" : "hint",
          assistType: assistTypeForTest(test),
          timestamp: at(),
        })
      },

      requestAssist,

      requestHint: () => {
        const t = at()
        const availability = engine.policy.availability("socratic_hint")
        if (!availability.available) return { ok: false, reason: "Hints are not available in this case." }
        const hint = selectSocraticHint(config, engine.state.snapshot(), t, shownHintIds(engine.events))
        if (!hint) return { ok: false, reason: "No new hint right now — keep working the case." }
        const result = engine.requestAssist("socratic_hint", t, `${HINT_TARGET_PREFIX}${hint.id}`)
        return result.ok ? { ok: true, hint: hint.hint, cost: result.cost } : { ok: false, reason: "Hints are not available." }
      },

      giveIntervention: (action) => engine.giveIntervention(action, at()),

      submitDifferential: (ranked) => {
        engine.submitDifferential(ranked, at())
      },

      submitAssessment: ({ ranked, primary, reasoning, steps }) => {
        const t = at()
        engine.submitDifferential(ranked, t)
        engine.submitDiagnosis(primary, reasoning, t)
        engine.submitManagement(steps, t)
      },
    }
  }, [engine, config, getNow, limitSeconds])

  const resolveResult = useCallback(
    (order: InvestigationOrder): ResolvedResult | null => {
      const patient = patientAtEvent(config, snapshot.events, order.eventIndex)
      return resolveInvestigation(config, order.testId, patient, order.orderedAt, demographics)
    },
    [config, snapshot.events, demographics]
  )

  const reset = useCallback(() => {
    resettingRef.current = true
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
    window.location.reload()
  }, [storageKey])

  const value = useMemo<ClinicalEventContextValue>(
    () => ({
      config,
      caseData,
      engine,
      policy: engine.policy,
      events: snapshot.events,
      patient: snapshot.patient,
      now,
      getNow,
      limitSeconds,
      isExpired: expired,
      alert,
      dismissAlert,
      resumedAt: boot.resumed ? boot.elapsed : null,
      actions,
      resolveResult,
      reset,
    }),
    [config, caseData, engine, snapshot, now, getNow, limitSeconds, expired, alert, dismissAlert, boot, actions, resolveResult, reset]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
