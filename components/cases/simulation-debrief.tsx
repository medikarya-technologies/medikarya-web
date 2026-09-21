"use client"

// The clinical debrief for simulation cases, in the classic step-by-step format:
// one small card per idea, Back / Next, and the closing actions on the last step.
// Two scores from one event log, a fully explained audit trail, and the learning
// that follows from the mistake, but never all at once.
//
// Renders from the persisted result alone (`feedback.simulation`), so the same
// screen serves a live encounter and a replay of a past attempt.

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  FlaskConical,
  ListChecks,
  Pill,
  Scale,
  ScanSearch,
  Timer,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/clarity"
import { AssistanceAudit, EncounterReview } from "./debrief-parts"
import { Celebration, Nav, ProgressHeader, Section, WalkthroughMarkdown } from "./feedback-steps"

interface SimulationDebriefProps {
  feedback: any
  caseData: any
  onExit: () => void
  onReset?: () => void
  onQuizStart?: () => void
  mode?: "live" | "history"
  guestMode?: boolean
  /** Opens "report a problem with this case". */
  onReport?: () => void
}

interface Step {
  key: string
  title: string
  icon: React.ElementType
  content: React.ReactNode
}

const DOMAINS = [
  { key: "clinical_reasoning", label: "Clinical Reasoning", icon: Brain, bg: "bg-blue-50", text: "text-blue-700" },
  { key: "investigation_accuracy", label: "Investigation Accuracy", icon: FlaskConical, bg: "bg-violet-50", text: "text-violet-700" },
  { key: "management", label: "Management", icon: Pill, bg: "bg-indigo-50", text: "text-indigo-700" },
  { key: "efficiency", label: "Efficiency", icon: Timer, bg: "bg-amber-50", text: "text-amber-700" },
] as const

const barColour = (score: number) =>
  score >= 85 ? "bg-emerald-500" : score >= 70 ? "bg-brand-500" : score >= 50 ? "bg-amber-400" : "bg-rose-400"

export function SimulationDebrief({ feedback, caseData, onExit, onReset, onQuizStart, mode = "live", guestMode = false, onReport }: SimulationDebriefProps) {
  const sim = feedback.simulation
  const [step, setStep] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)

  const clinical: number = sim.clinicalScore
  const independent: number = sim.independentScore
  const cost: number = sim.assistanceCost
  const didWell: string[] = sim.didWell ?? []
  const missed: Array<{ text: string; critical: boolean }> = sim.missed ?? []
  const assistance: Array<{ label: string; clock: string; cost: number }> = sim.assistance ?? []
  const safetyCount: number = sim.safetyIssues?.length ?? 0
  const takeaways: string[] = sim.keyLearningPoints?.length ? sim.keyLearningPoints : (caseData?.discussion?.keyPoints ?? [])
  const references: string[] = caseData?.discussion?.references ?? []

  const examLabels: Record<string, string> = Object.fromEntries(
    (caseData?.examination ?? []).map((m: { id: string; label: string }) => [m.id, m.label])
  )

  useEffect(() => {
    trackEvent("Evaluation_Viewed")
  }, [])

  // A small celebration on the first screen when the encounter went well.
  useEffect(() => {
    if (clinical >= 70 && step === 0) {
      setShowCelebration(true)
      const timer = setTimeout(() => setShowCelebration(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [clinical, step])

  // Each step starts at the top of the page, so a long card never leaves the next one half-scrolled.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [step])

  const steps: Step[] = [
    {
      key: "outcome",
      title: "Case Outcome",
      icon: Activity,
      content: (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-1">You Suspected</p>
            <p className="text-xl font-medium text-slate-900">{sim.diagnosis?.studentDiagnosis || "No diagnosis provided"}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-1">Actual Diagnosis</p>
            <p className="text-xl font-medium text-brand-600 flex items-center gap-2">
              {sim.diagnosis?.groundTruth}
              {sim.diagnosis?.isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </p>
          </div>
          <p className="text-slate-500 italic mt-4">
            Let’s calmly walk through how your reasoning unfolded and identify key decision points.
          </p>
        </div>
      ),
    },
    {
      key: "did-well",
      title: "What You Did Well",
      icon: CheckCircle2,
      content: didWell.length > 0 ? (
        <ul className="space-y-4">
          {didWell.map((text, i) => (
            <li key={i} className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
              <span className="text-slate-700">{text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No specific strengths noted, but that's okay! We learn from every case.</p>
      ),
    },
    {
      key: "missed",
      title: "What You Missed",
      icon: ListChecks,
      content: missed.length > 0 ? (
        <ul className="space-y-4">
          {missed.map((m, i) => (
            <li key={i} className="flex gap-3">
              <XCircle className={cn("w-5 h-5 mt-1 shrink-0", m.critical ? "text-rose-500" : "text-rose-300")} />
              <span className="text-slate-700">
                {m.text}
                {m.critical && (
                  <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-wider text-rose-700 uppercase">
                    critical
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-6 bg-emerald-50 rounded-xl border border-emerald-100">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-emerald-800 font-medium">Great job! Nothing important was missed.</p>
        </div>
      ),
    },
    ...(sim.reasoningError
      ? [
          {
            key: "reasoning-error",
            title: "Your Reasoning Error",
            icon: AlertTriangle,
            content: (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-rose-900 mb-1">{sim.reasoningError.title}</h4>
                      <p className="text-sm text-rose-700 leading-relaxed">{sim.reasoningError.error}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-1">Why It Mattered</p>
                  <p className="text-slate-700 leading-relaxed text-base">{sim.reasoningError.whyItMattered}</p>
                </div>
                {sim.otherErrors?.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-2 text-sm font-semibold text-slate-500">Also worth reviewing</p>
                    <ul className="space-y-2">
                      {sim.otherErrors.map((e: { id: string; title: string; error: string }) => (
                        <li key={e.id} className="text-sm leading-relaxed text-slate-600 pl-3 border-l-2 border-slate-200">
                          <span className="font-semibold text-slate-800">{e.title}.</span> {e.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ),
          } satisfies Step,
        ]
      : []),
    ...(sim.expertImpressions?.length > 0
      ? [
          {
            key: "expert-reads",
            title: "Expert Interpretations",
            icon: ScanSearch,
            content: (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 italic">Shown to every student, whether or not you asked for an interpretation during the case.</p>
                {sim.expertImpressions.map((x: { testId: string; title: string; text: string }) => (
                  <div key={x.testId} className="p-4 rounded-xl bg-brand-50/50 border border-brand-100">
                    <h4 className="font-semibold text-brand-900 mb-1 flex items-center gap-2 text-base">
                      <ScanSearch className="w-4 h-4 shrink-0" /> {x.title}
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed">{x.text}</p>
                  </div>
                ))}
              </div>
            ),
          } satisfies Step,
        ]
      : []),
    ...(takeaways.length > 0
      ? [
          {
            key: "takeaway",
            title: "Clinical Takeaway",
            icon: BookOpen,
            content: (
              <ul className="space-y-3">
                {takeaways.map((point, i) => (
                  <li key={i} className="flex gap-3 text-slate-700 leading-relaxed">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2.5 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            ),
          } satisfies Step,
        ]
      : []),
    {
      key: "summary",
      title: "Performance Summary",
      icon: Award,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col items-center text-center relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-3 opacity-5">
                <Award className="w-16 h-16 text-slate-900" />
              </div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Clinical Score</span>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-slate-900 tracking-tighter tabular-nums">{clinical}</span>
                <span className="text-slate-300 text-lg font-medium">/100</span>
              </div>
              <span className="mt-2 text-[11px] text-slate-400">What you did</span>
            </div>
            <div className="bg-brand-600 p-6 rounded-2xl flex flex-col items-center text-center relative overflow-hidden shadow-md shadow-brand-100">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-white">
                <Activity className="w-16 h-16" />
              </div>
              <span className="text-brand-200 text-[10px] font-bold uppercase tracking-widest mb-2">Independent Score</span>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-white tracking-tighter tabular-nums">{independent}</span>
                <span className="text-brand-200 text-lg font-medium">/100</span>
              </div>
              <span className="mt-2 text-[11px] text-brand-200">{cost > 0 ? `Without help (−${cost})` : "No assistance used"}</span>
            </div>
          </div>

          {feedback.xpEarned !== undefined && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Award className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-slate-800">+{feedback.xpEarned} XP</span> earned from your Clinical score
            </div>
          )}

          <div className="mt-6 bg-slate-50/50 rounded-2xl border border-slate-100/80 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-white">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Performance Metrics</h4>
            </div>
            <div className="p-2 space-y-1">
              {DOMAINS.map(({ key, label, icon: Icon, bg, text }) => {
                const score: number = sim.domains?.[key] ?? 0
                return (
                  <div key={key} className="p-3 rounded-xl hover:bg-white transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${bg} ${text}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-slate-900 tabular-nums">{score}</span>
                        <span className="text-[10px] text-slate-400 font-medium uppercase">/ 100</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full", barColour(score))} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                )
              })}

              {safetyCount > 0 && (
                <div className="mt-1 p-3 rounded-xl bg-rose-50 border border-rose-100/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-rose-700">Unsafe interventions</span>
                  </div>
                  <span className="font-black text-rose-600">{safetyCount}</span>
                </div>
              )}
            </div>
          </div>

          {references.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" />
                References
              </h4>
              <ul className="space-y-2">
                {references.slice(0, 2).map((ref, i) => (
                  <li key={i} className="text-xs text-slate-500 leading-normal pl-2 border-l-2 border-slate-200">
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ),
    },
    ...(assistance.length > 0
      ? [
          {
            key: "difference",
            title: "Why the Difference?",
            icon: Scale,
            content: <AssistanceAudit clinical={clinical} independent={independent} cost={cost} assistance={assistance} />,
          } satisfies Step,
        ]
      : []),
    {
      key: "review",
      title: "Review the Encounter",
      icon: Clock,
      content: <EncounterReview sim={sim} examLabels={examLabels} />,
    },
    ...(caseData?.walkthrough
      ? [
          {
            key: "walkthrough",
            title: "Expert Walkthrough",
            icon: Brain,
            content: (
              <div className="space-y-4">
                <WalkthroughMarkdown text={caseData.walkthrough} />
              </div>
            ),
          } satisfies Step,
        ]
      : []),
  ]

  const totalSteps = steps.length
  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1))
  const prev = () => setStep((s) => Math.max(s - 1, 0))
  const current = steps[step]

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center p-4 md:p-8 relative">
      <AnimatePresence>{showCelebration && <Celebration key="celebration" />}</AnimatePresence>

      <div className="w-full max-w-2xl relative z-10 pt-4 md:pt-8">
        <ProgressHeader step={step} total={totalSteps} onReport={onReport} />

        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <Section icon={current.icon} title={current.title}>
              {current.content}
            </Section>
          </motion.div>
        </AnimatePresence>

        <Nav
          onPrev={prev}
          onNext={next}
          isFirst={step === 0}
          isLast={step === totalSteps - 1}
          onExit={onExit}
          onReset={onReset}
          onQuizStart={onQuizStart}
          mode={mode}
          guestMode={guestMode}
        />
      </div>
    </div>
  )
}
