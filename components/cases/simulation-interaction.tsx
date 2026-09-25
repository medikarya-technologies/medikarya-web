"use client"

// The simulation encounter: the orchestrator for cases that carry the
// simulation core. Legacy cases never reach this file — CaseInteraction only
// delegates here when `isSimulationCase(caseData)`.
//
//   Triage → History → Examination → Vitals → ECG (interpret first) → Labs
//   → Deterioration → Intervene → Ranked Differential → Management
//   → Debrief (Clinical + Independent) → Reinforcement
//
// The bedside rail (vitals + Lead II + clock) stays on screen throughout; the
// event log is the single source of truth for everything that happens.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { AlertTriangle, ClipboardList, FlaskConical, Loader2, MessageSquare, Siren, Stethoscope, X, Activity, Brain, Hand } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { cn, formatPatientAge } from "@/lib/utils"

import { evaluateSimulation } from "@/app/actions/evaluate"
import { scoreEncounter } from "@/engine/evaluation/DualScorer"
import { selectReinforcement } from "@/lib/simulation/reinforcement"
import { formatClock, type ClinicalEvent, type EventOf } from "@/lib/simulation/encounter-events"
import type { SimulationCaseConfig } from "@/lib/simulation/case-schema"
import { markTourSeen, type EncounterTourConfig } from "@/lib/tour/tour-storage"
import { interventionsForCase } from "@/lib/simulation/intervention-catalog"
import { assessVitals } from "@/lib/simulation/vitals-assess"
import { alarmLabel } from "@/lib/simulation/vitals-assess"
import { interpretationFor, isResultReady, isRevealed, listOrders } from "@/lib/simulation/case-resolvers"

import { AIPatientChat } from "./ai-patient-chat"
import { BedsidePatientRail, useLiveVitals } from "./bedside-patient-rail"
import { CaseFeedback } from "./case-feedback"
import { CaseQuiz } from "./case-quiz"
import { ClinicalEventProvider, useClinicalEvents } from "./clinical-event-manager"
import { DiagnosisSubmission, DifferentialSlots, type RankedAssessment } from "./diagnosis-submission"
import { EmergencyInterveneModal } from "./emergency-intervene-modal"
import { EncounterTour } from "./encounter-tour"
import { ReportProblemDialog } from "./report-problem"
import { MonitorSoundDriver } from "./monitor-sound"
import { EncounterTopBar, MobileTabBar, WorkspaceHeader, type TabDef, type TabId } from "./encounter-chrome"
import { PatientPortrait } from "./patient-portrait"
import { usePatientAppearance } from "./use-patient-appearance"
import { NurseAlertBanner } from "./nurse-alert-banner"
import { SimulationExamConsole } from "./simulation-exam-console"
import { SimulationInvestigations } from "./simulation-investigations"

type Tab = TabId

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const TABS: TabDef[] = [
  { id: "history", label: "History", icon: MessageSquare },
  { id: "exam", label: "Examine", icon: Hand },
  { id: "tests", label: "Investigations", short: "Tests", icon: FlaskConical },
  { id: "diagnose", label: "Diagnose", icon: Stethoscope },
]

// ── Small hooks ─────────────────────────────────────────────────────────────

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", notify)
      return () => mq.removeEventListener("change", notify)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

/** ?simSpeed=10 fast-forwards the clock. Inert in production builds. */
function readSimSpeed(): number | undefined {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return undefined
  const raw = new URLSearchParams(window.location.search).get("simSpeed")
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120) : undefined
}

interface UiSaved {
  chat: ChatMessage[]
  feedback: any | null
  showQuiz: boolean
  /** Generated quiz for classically scored cases; rubric cases derive theirs from the result. */
  quizData?: any
}

function readUi(key: string): UiSaved {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null")
    if (parsed && Array.isArray(parsed.chat)) {
      return { chat: parsed.chat, feedback: parsed.feedback ?? null, showQuiz: !!parsed.showQuiz, quizData: parsed.quizData }
    }
  } catch {
    /* fall through */
  }
  return { chat: [], feedback: null, showQuiz: false }
}

// ── Public entry ────────────────────────────────────────────────────────────

interface SimulationInteractionProps {
  caseData: any
  onExit: () => void
  guestId?: string
  /** How to walk the student through this screen (see lib/tour/tour-storage.ts). */
  tour?: EncounterTourConfig
}

export function SimulationInteraction({ caseData, onExit, guestId, tour }: SimulationInteractionProps) {
  const caseId: string = caseData.id
  const storageKey = `medikarya-sim-${caseId}`
  const uiKey = `medikarya-sim-ui-${caseId}`

  const [ui, setUi] = useState<UiSaved>(() => readUi(uiKey))
  const speed = useMemo(readSimSpeed, [])
  // The walkthrough starts open when it is due, from the first render: the clock below never starts before it is done.
  const [tourOpen, setTourOpen] = useState(() => !!tour?.auto && readUi(uiKey).feedback === null)
  // Reporting a problem never costs time either: the clock waits while the dialog is open.
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(uiKey, JSON.stringify(ui))
    } catch {
      /* ignore */
    }
  }, [ui, uiKey])

  return (
    <ClinicalEventProvider
      config={caseData as SimulationCaseConfig}
      caseData={caseData}
      storageKey={storageKey}
      timeScaleOverride={speed}
      frozen={ui.feedback !== null || tourOpen || reportOpen}
    >
      <Encounter caseData={caseData} onExit={onExit} guestId={guestId} ui={ui} setUi={setUi} uiKey={uiKey} speed={speed} onTour={() => setTourOpen(true)} reportOpen={reportOpen} onReportOpenChange={setReportOpen} />
      <EncounterTour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false)
          if (tour?.who) markTourSeen(tour.who)
        }}
      />
    </ClinicalEventProvider>
  )
}

// ── The encounter ───────────────────────────────────────────────────────────

interface EncounterProps extends SimulationInteractionProps {
  ui: UiSaved
  setUi: React.Dispatch<React.SetStateAction<UiSaved>>
  uiKey: string
  speed?: number
  onTour: () => void
  reportOpen: boolean
  onReportOpenChange: (open: boolean) => void
}

function Encounter({ caseData, onExit, guestId, ui, setUi, uiKey, speed, onTour, reportOpen, onReportOpenChange }: EncounterProps) {
  const { config, engine, events, now, getNow, actions, isExpired, patient, resumedAt, reset } = useClinicalEvents()
  const { toast } = useToast()
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  // A case only shows what it defines: no examination findings means no Examine tab, and no
  // bedside treatments means no INTERVENE button, rather than controls that lead nowhere.
  const isClassic = config.scoring_mode === "classic"
  const hasTray = useMemo(() => interventionsForCase(config).length > 0, [config])
  const tabs = useMemo(() => TABS.filter((t) => t.id !== "exam" || (config.examination?.length ?? 0) > 0), [config])
  const appearance = usePatientAppearance()

  const [tab, setTab] = useState<Tab>("history")
  const [interveneOpen, setInterveneOpen] = useState(false)
  const [differentialOpen, setDifferentialOpen] = useState(false)
  const [monitorOpen, setMonitorOpen] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const pendingQuestion = useRef<string | null>(null)

  // ── Diagnosis form state — lifted here so it survives tab switches ──────
  // If the student types their differential, switches to History, then comes
  // back, their work must still be there. Keeping it in a child that
  // unmounts on every tab change loses it.
  const [diagSlots, setDiagSlots] = useState<string[]>(["", "", ""])
  const [diagReasoning, setDiagReasoning] = useState("")
  const [diagManagement, setDiagManagement] = useState("")

  // The LIVE encounter sizes itself to exactly `100dvh` and every panel scrolls internally —
  // the page itself is never meant to scroll there. Some browser/OS combinations compute
  // `100dvh` a little tall against nested flex layouts (most visible on the Diagnose tab,
  // which nests a scrollable region plus a sticky footer inside it), leaving the outer page
  // a few dozen pixels taller than the real viewport and scrollable into blank space below
  // the UI. Locking body scroll while the live encounter is showing makes that impossible
  // regardless of the exact `dvh` rounding a given browser produces.
  //
  // This component never unmounts when the encounter ends — `feedback` just flips from null
  // to set and the SAME `Encounter` instance renders the debrief screens below instead. Those
  // screens are NOT `dvh`-constrained (they're a normal `min-h-screen` page that's often
  // taller than one viewport, e.g. "Tests You Should Have Considered" near the bottom of a
  // long step), so they need the page to scroll normally. The lock has to release the moment
  // `feedback` is set, not just on unmount, or a debrief step taller than the viewport
  // becomes permanently unreachable.
  useEffect(() => {
    if (ui.feedback) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [ui.feedback])

  const feedback = ui.feedback
  const p = caseData.patient
  const speaksForSelf: boolean = caseData.ai_role?.can_speak_for_self !== false
  const speaker: string = caseData.ai_role?.speaker ?? "parent"

  // ── Resume notice ─────────────────────────────────────────────────────
  useEffect(() => {
    if (resumedAt !== null && !feedback) {
      toast({ title: "Encounter resumed", description: `Picking up at ${formatClock(resumedAt)}.`, duration: 3500 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Results becoming ready ────────────────────────────────────────────
  const orders = useMemo(() => listOrders(events), [events])
  const notified = useRef<Set<string> | null>(null)
  if (notified.current === null) {
    // Anything already ready when we mount (a resumed encounter) is not news.
    notified.current = new Set(orders.filter((o) => isResultReady(config, o, now)).map((o) => o.key))
  }
  useEffect(() => {
    for (const order of orders) {
      if (!notified.current!.has(order.key) && isResultReady(config, order, now)) {
        notified.current!.add(order.key)
        toast({ title: "Result ready", description: order.testName, duration: 4000 })
      }
    }
  }, [orders, now, config, toast])

  const readyUnread = orders.filter((o) => isResultReady(config, o, now) && interpretationFor(events, o) === undefined && !isRevealed(events, o)).length
  const pending = orders.filter((o) => !isResultReady(config, o, now)).length
  const tabDefs = useMemo<TabDef[]>(
    () =>
      tabs.map((t) =>
        t.id !== "tests"
          ? t
          : readyUnread > 0
            ? { ...t, badge: { count: readyUnread, tone: "ok", title: "Results ready to read" } }
            : pending > 0
              ? { ...t, badge: { count: pending, tone: "warn", title: "Results pending" } }
              : t
      ),
    [tabs, readyUnread, pending]
  )

  // ── Milestones this attempt just earned ───────────────────────────────
  // Said once: the list is emptied afterwards, so opening the debrief again later does not repeat it.
  useEffect(() => {
    const earned: Array<{ id: string; title: string; detail: string }> | undefined = ui.feedback?.milestones
    if (!earned || earned.length === 0) return
    toast({
      title: earned.length === 1 ? "Milestone reached" : "Milestones reached",
      description: earned.length === 1 ? `${earned[0].title}. ${earned[0].detail}` : earned.map((m) => m.title).join(" · "),
      duration: 7000,
    })
    setUi((prev) => (prev.feedback ? { ...prev, feedback: { ...prev.feedback, milestones: [] } } : prev))
  }, [ui.feedback, toast, setUi])

  // ── Time is up: only the assessment is left ───────────────────────────
  useEffect(() => {
    if (isExpired && !feedback) {
      setTab("diagnose")
      setInterveneOpen(false)
    }
  }, [isExpired, feedback])

  // ── Chat → HISTORY_TAKEN ──────────────────────────────────────────────
  const handleChatMessage = useCallback(
    (message: ChatMessage) => {
      setUi((prev) => (prev.chat.some((m) => m.id === message.id) ? prev : { ...prev, chat: [...prev.chat, message] }))
      if (message.role === "user") {
        pendingQuestion.current = message.content
      } else if (message.id !== "welcome" && pendingQuestion.current !== null) {
        // The information is obtained when the patient answers.
        actions.takeHistory(pendingQuestion.current, message.content)
        pendingQuestion.current = null
      }
    },
    [actions, setUi]
  )

  // ── Submission ────────────────────────────────────────────────────────
  const submit = async (assessment: RankedAssessment) => {
    if (evaluating) return
    setEvaluating(true)
    actions.submitAssessment(assessment)
    const finalEvents = [...engine.events]
    const timeTaken = Math.round(getNow())

    let result: any
    try {
      result = await evaluateSimulation(finalEvents, caseData, timeTaken, guestId)
    } catch (error) {
      if (isClassic) {
        // The classic evaluator runs on the server only, so there is no honest local score to fall back to.
        // The encounter is saved on this device: the student can simply submit again.
        console.error("Server scoring failed", error)
        toast({
          title: "Couldn't score your encounter",
          description: "Check your connection and submit again. Your progress is saved.",
          variant: "destructive",
          duration: 6000,
        })
        setEvaluating(false)
        return
      }
      // The server couldn't be reached: score locally so the student still gets their debrief.
      console.error("Server scoring failed; scoring locally", error)
      const scored = scoreEncounter(finalEvents, config)
      result = {
        score: scored.clinicalScore,
        xpEarned: 0,
        unsaved: true,
        simulation: { version: 1, ...scored, events: finalEvents, timeTaken },
      }
    }
    setUi((prev) => ({ ...prev, feedback: result }))
    setEvaluating(false)
    // Start the classic quiz in the background, as the classic flow does, so it is ready by the time it is wanted.
    if (isClassic) startClassicQuiz(result, 3000)
  }

  // ── Reinforcement ─────────────────────────────────────────────────────
  // Rubric cases draw their questions from the case's own bank, by knowledge gap. A classic case
  // gets generated questions from its result, exactly as the classic flow does.
  const quiz = useMemo(() => {
    const sim = feedback?.simulation
    if (!sim || isClassic) return null
    const labels: Record<string, string> = {}
    for (const e of [sim.reasoningError, ...(sim.otherErrors ?? [])]) if (e) labels[e.knowledgeGap] = e.title
    return selectReinforcement(caseData, sim.knowledgeGaps ?? [], labels, 5)
  }, [feedback, caseData, isClassic])
  // One stable promise: CaseQuiz subscribes to it in an effect keyed on identity.
  const quizPromise = useMemo(() => (quiz ? Promise.resolve(quiz) : null), [quiz])

  const classicQuizRef = useRef<Promise<any> | null>(null)
  const startClassicQuiz = useCallback(
    (result: any, delayMs = 0) => {
      if (classicQuizRef.current) return classicQuizRef.current
      const { simulation: _omitted, ...forQuiz } = result
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 45_000)
      classicQuizRef.current = new Promise((resolve) => setTimeout(resolve, delayMs))
        .then(() =>
          fetch("/api/quiz/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback: forQuiz, caseData, orderedTestNames: orders.map((o) => o.testName) }),
            signal: controller.signal,
          })
        )
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Quiz API returned ${r.status}`))))
        .then((data) => {
          clearTimeout(timeout)
          setUi((prev) => ({ ...prev, quizData: data }))
          return data
        })
        .catch((err) => {
          clearTimeout(timeout)
          console.error("Background quiz generation failed:", err)
          return { questions: [], knowledgeGaps: [] }
        })
      return classicQuizRef.current
    },
    [caseData, orders, setUi]
  )

  const clearAndReload = () => {
    try {
      localStorage.removeItem(uiKey)
    } catch {
      /* ignore */
    }
    reset()
  }

  // ── Debrief & quiz ────────────────────────────────────────────────────
  if (feedback && ui.showQuiz && (quiz || isClassic)) {
    // A refresh can land straight on the quiz: reuse the saved questions, or generate them now.
    // The ref guard makes this safe to reach more than once.
    const classicPromise = isClassic
      ? (classicQuizRef.current ??
        (ui.quizData ? (classicQuizRef.current = Promise.resolve(ui.quizData)) : startClassicQuiz(feedback)))
      : null
    return (
      <CaseQuiz
        quizPromise={isClassic ? classicPromise : quizPromise}
        caseData={caseData}
        caseScore={feedback.score ?? 0}
        caseTitle={caseData.displayTitle || caseData.title}
        onComplete={async (results) => {
          try {
            await fetch("/api/quiz/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ caseId: caseData.id, quizResults: results }),
            })
          } catch (e) {
            console.error("Failed to save quiz results:", e)
          }
        }}
        onSkip={() => setUi((prev) => ({ ...prev, showQuiz: false }))}
        onExit={onExit}
        onViewFeedback={() => setUi((prev) => ({ ...prev, showQuiz: false }))}
        onReset={clearAndReload}
        guestMode={!!guestId}
      />
    )
  }

  const reportDialog = (
    <ReportProblemDialog open={reportOpen} onOpenChange={onReportOpenChange} caseId={caseData.id} place={feedback ? "debrief" : "encounter"} clockSeconds={now} tab={tab} guestId={guestId} />
  )

  if (feedback) {
    return (
      <>
        {feedback.unsaved && (
          <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
            We couldn&apos;t reach the server, so this result was scored on your device and hasn&apos;t been saved.
          </div>
        )}
        <CaseFeedback
          feedback={feedback}
          caseData={caseData}
          orderedTests={[]}
          onExit={onExit}
          onReset={clearAndReload}
          onQuizStart={() => {
            if (isClassic && !ui.quizData) startClassicQuiz(feedback)
            setUi((prev) => ({ ...prev, showQuiz: true }))
          }}
          guestMode={!!guestId}
          onReport={() => onReportOpenChange(true)}
        />
        {reportDialog}
      </>
    )
  }

  // ── The encounter ─────────────────────────────────────────────────────
  const objective =
    caseData.objective ??
    `Evaluate a ${formatPatientAge(p.age)} ${String(p.gender).toLowerCase()} presenting with ${String(p.chiefComplaint).toLowerCase()}`
  const initialDifferential = ((): string[] => {
    const last = [...events].reverse().find((e): e is EventOf<"DIFFERENTIAL_SUBMITTED"> => e.type === "DIFFERENTIAL_SUBMITTED")
    return last?.ranked ?? []
  })()

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-enc-desk font-sans text-enc-ink">
      <EncounterTopBar
        title={caseData.displayTitle || caseData.title}
        subtitle={[caseData.category, caseData.setting].filter(Boolean).join(" · ")}
        portrait={
          <PatientPortrait
            persona={appearance.persona}
            look={appearance.look}
            variant="face"
            label={p.name}
            className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-enc-line-strong"
          />
        }
        showIntervene={hasTray}
        critical={patient.stability === "critical"}
        disabled={isExpired}
        onIntervene={() => setInterveneOpen(true)}
        onExit={onExit}
        onTour={onTour}
        onReport={() => onReportOpenChange(true)}
      />

      <NurseAlertBanner onIntervene={hasTray ? () => setInterveneOpen(true) : undefined} />

      {isExpired && (
        <div className="flex shrink-0 items-center gap-2 border-b border-enc-warn/30 bg-enc-warn-soft px-5 py-2 text-[13px] text-enc-warn">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Time is up.</span> The encounter has ended: commit to your assessment.
          </span>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isDesktop && (
          <div className="w-[340px] shrink-0 overflow-y-auto border-r border-enc-line-strong bg-enc-console" style={{ scrollbarWidth: "thin" }} data-lenis-prevent>
            <BedsidePatientRail onOpenDifferential={() => setDifferentialOpen(true)} />
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!isDesktop && <CompactVitals onOpen={() => setMonitorOpen(true)} />}

          <WorkspaceHeader brief={objective} tabs={tabDefs} active={tab} onChange={setTab} isExpired={isExpired} />

          <div className="min-h-0 flex-1 overflow-hidden">
            {/* All tab panels stay mounted. Toggling visibility (not unmounting) means:
                1. The Diagnose scroll container always has correct flex height.
                2. Typed form values are not lost when the student switches tabs. */}
            <div className={cn("h-full", tab !== "history" && "hidden")}>
              <AIPatientChat
                variant="bedside"
                caseData={caseData}
                onMessageSent={handleChatMessage as any}
                chatHistory={ui.chat as any}
                currentCondition={{ observation: appearance.observation, consciousness: patient.consciousness }}
                patientName={speaksForSelf ? p.name : `${String(speaker).charAt(0).toUpperCase()}${String(speaker).slice(1)} of ${p.name}`}
                patientAvatar={
                  speaksForSelf ? (
                    <PatientPortrait
                      persona={appearance.persona}
                      look={appearance.look}
                      variant="face"
                      label={p.name}
                      className="h-8 w-8 overflow-hidden rounded-full ring-1 ring-enc-line-strong"
                    />
                  ) : undefined
                }
              />
            </div>
            {tab === "exam" && <div className="h-full"><SimulationExamConsole /></div>}
            <div className={cn("h-full", tab !== "tests" && "hidden")}>
              <SimulationInvestigations />
            </div>
            <div className={cn("h-full", tab !== "diagnose" && "hidden")}>
              <DiagnosisSubmission
                orderedTests={[]}
                testResults={[]}
                chatHistory={[]}
                onSubmit={() => {}}
                ranked={{
                  questionCount: events.filter((e) => e.type === "HISTORY_TAKEN").length,
                  testCount: orders.length,
                  resultCount: orders.filter((o) => isResultReady(config, o, now)).length,
                  initialDifferential,
                  isLoading: evaluating,
                  expired: isExpired,
                  onSubmit: submit,
                  // Persisted form state — survives tab switches
                  slots: diagSlots,
                  setSlots: setDiagSlots,
                  reasoning: diagReasoning,
                  setReasoning: setDiagReasoning,
                  management: diagManagement,
                  setManagement: setDiagManagement,
                }}
              />
            </div>
          </div>
        </main>
      </div>

      <MobileTabBar tabs={tabDefs} active={tab} onChange={setTab} isExpired={isExpired} />

      {/* ── Overlays ────────────────────────────────────────────────── */}
      {reportDialog}
      <MonitorSoundDriver />
      {hasTray && <EmergencyInterveneModal open={interveneOpen} onOpenChange={setInterveneOpen} />}

      <Dialog open={differentialOpen} onOpenChange={setDifferentialOpen}>
        <DifferentialDialogBody
          initial={initialDifferential}
          onSave={(ranked) => {
            actions.submitDifferential(ranked)
            setDifferentialOpen(false)
            toast({ title: "Differential recorded", description: "You can revise it at any time.", duration: 2500 })
          }}
        />
      </Dialog>

      {!isDesktop && (
        <Sheet open={monitorOpen} onOpenChange={setMonitorOpen}>
          <SheetContent side="bottom" className="flex h-[88vh] flex-col overflow-hidden rounded-t-2xl bg-enc-console p-0">
            <SheetHeader className="shrink-0 border-b border-enc-line-strong px-4 py-3">
              <SheetTitle className="text-left text-[15px] font-semibold text-enc-ink">Patient and monitor</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
              {monitorOpen && (
                <BedsidePatientRail
                  onOpenDifferential={() => {
                    setMonitorOpen(false)
                    setDifferentialOpen(true)
                  }}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {speed && (
        <div className="fixed bottom-16 left-2 z-50 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-white md:bottom-2">simSpeed ×{speed}</div>
      )}

      {evaluating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-enc-scrim/50 backdrop-blur-[2px]">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-enc-line bg-enc-sheet p-8 text-center shadow-2xl">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-600" />
            <h3 className="mt-4 text-[17px] font-semibold text-enc-ink">Reviewing your encounter</h3>
            <p className="mt-1 text-[13px] text-enc-ink-2">Replaying every decision against the case…</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compact vitals strip (below lg) ─────────────────────────────────────────

function CompactVitals({ onOpen }: { onOpen: () => void }) {
  const { patient, now, config } = useClinicalEvents()
  const live = useLiveVitals()
  const alarms = patient.alarms
  const unmeasured = new Set<string>(config.initial_state?.unmeasured ?? [])
  const cell = (label: string, value: string, tone: string) => (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold tracking-[0.1em] text-enc-scope-dim uppercase">{label}</span>
      <span className={cn("font-mono text-[19px] leading-none font-medium tabular-nums", tone)}>{value}</span>
    </span>
  )

  return (
    <button type="button" onClick={onOpen} data-tour="patient" className="flex shrink-0 items-center gap-4 bg-enc-scope px-4 py-2.5 text-left" aria-label="Open the patient and monitor">
      <Activity className={cn("h-4 w-4 shrink-0", alarms.length > 0 ? "enc-live-dot text-enc-scope-crit" : "text-enc-ecg")} />
      <span className="flex flex-1 items-baseline gap-4">
        {cell("HR", patient.rhythm === "vf" || unmeasured.has("hr") ? "—" : String(live.hr), "text-enc-ecg")}
        {cell("BP", unmeasured.has("bp") ? "—" : live.systolic + "/" + live.diastolic, "text-enc-nibp")}
        {cell("SpO₂", unmeasured.has("spo2") ? "—" : String(live.spo2), "text-enc-spo2")}
      </span>
      {alarms.length > 0 && <span className="rounded bg-enc-crit px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">{alarmLabel(alarms[0])}</span>}
      <span className="font-mono text-[12px] text-enc-scope-dim tabular-nums">{formatClock(now)}</span>
    </button>
  )
}

// ── Differential dialog ─────────────────────────────────────────────────────

function DifferentialDialogBody({ initial, onSave }: { initial: string[]; onSave: (ranked: string[]) => void }) {
  const [slots, setSlots] = useState<string[]>(() => [0, 1, 2].map((i) => initial[i] ?? ""))
  const canSave = slots.some((s) => s.trim())
  return (
    <DialogContent className="max-w-[96vw] sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-slate-500" /> Your differential
        </DialogTitle>
        <DialogDescription>Commit to a working ranking now. It is part of the record, and you can revise it as the case evolves.</DialogDescription>
      </DialogHeader>
      <DifferentialSlots values={slots} onChange={(i, v) => setSlots((prev) => prev.map((s, j) => (j === i ? v : s)))} />
      <DialogFooter>
        <Button onClick={() => onSave(slots.map((s) => s.trim()))} disabled={!canSave} className="bg-brand-600 hover:bg-brand-700">
          Save differential
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
