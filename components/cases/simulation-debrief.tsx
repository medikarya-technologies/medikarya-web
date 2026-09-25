"use client"

// The clinical debrief for simulation cases, in the classic step-by-step format:
// one small card per idea, Back / Next, and the closing actions on the last step.
// Two scores from one event log, a fully explained audit trail, and the learning
// that follows from the mistake, but never all at once.
//
// Renders from the persisted result alone (`feedback.simulation`), so the same
// screen serves a live encounter and a replay of a past attempt.
//
// Restructured this round — 8 sections was too many. What You Did Well, What You
// Missed, and Your Reasoning Error are now one step ("decisions": everything
// evaluative about your choices, together). Review the Encounter, Expert
// Interpretations, and Expert Walkthrough are now one step ("review": everything
// that's just the objective record plus expert-authored reference material).
// Performance Summary and Clinical Takeaway moved out of the step flow entirely
// into a collapsed-by-default InfoAccordion — real optional reading, not another
// forced step. Also: enc-* tokens throughout (was slate-*/emerald-*/rose-* fixed
// colours with no dark-mode counterpart) and scoreBand() for the domain bars
// instead of a bespoke barColour() with its own, slightly different thresholds —
// one scoring-to-colour rule across the whole app, not two.

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
import { scoreBand } from "@/lib/library/case-library"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AssistanceAudit, EncounterReview, InfoAccordion, type InfoAccordionItem } from "./debrief-parts"
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

const BAND_BAR: Record<string, string> = { ok: "bg-enc-ok", warn: "bg-enc-warn", crit: "bg-enc-crit" }

function SubHeading({ children, icon: Icon, tone = "text-enc-ink-3" }: { children: React.ReactNode; icon: React.ElementType; tone?: string }) {
  return (
    <p className={cn("mb-3 mt-6 flex items-center gap-1.5 border-t border-enc-line pt-6 text-[11px] font-bold uppercase tracking-widest", tone)}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </p>
  )
}

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
  const expertImpressions: Array<{ testId: string; title: string; text: string }> = sim.expertImpressions ?? []

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

  // Only Clinical Takeaway goes in the accordion — Performance Summary is shown inline always.
  const takeawayAccordion: InfoAccordionItem[] = takeaways.length > 0
    ? [
        {
          id: "takeaway",
          icon: BookOpen,
          title: "Clinical Takeaway",
          teaser: "Key points to remember from this case",
          content: (
            <ul className="space-y-3">
              {takeaways.map((point, i) => (
                <li key={i} className="flex gap-3 text-enc-ink-2 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          ),
        },
      ]
    : []

  const steps: Step[] = [
    {
      key: "outcome",
      title: "Case Outcome",
      icon: Activity,
      content: (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-enc-desk border border-enc-line">
            <p className="text-enc-ink-3 text-xs uppercase tracking-wide font-semibold mb-1">You Suspected</p>
            <p className="text-base font-medium text-enc-ink">{sim.diagnosis?.studentDiagnosis || "No diagnosis provided"}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-enc-desk border border-enc-line">
            <p className="text-enc-ink-3 text-xs uppercase tracking-wide font-semibold mb-1">Actual Diagnosis</p>
            <p className="text-base font-medium text-brand-600 flex items-center gap-2">
              {sim.diagnosis?.groundTruth}
              {sim.diagnosis?.isCorrect && <CheckCircle2 className="w-4 h-4 text-enc-ok" />}
            </p>
          </div>
          <p className="text-enc-ink-3 italic text-sm">
            Let's calmly walk through how your reasoning unfolded and identify key decision points.
          </p>
        </div>
      ),
    },
    {
      key: "decisions",
      title: "What You Did Well & Decision Consequences",
      icon: Scale,
      content: (
        <div>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_1.6fr]">
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-enc-ok">
                <CheckCircle2 className="h-3.5 w-3.5" /> What you did well
              </p>
              {didWell.length > 0 ? (
                <div className="space-y-2.5">
                  {didWell.map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl bg-enc-ok-soft p-3.5">
                      <CheckCircle2 className="w-4 h-4 text-enc-ok mt-0.5 shrink-0" />
                      <span className="text-sm font-medium text-enc-ok">{text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-enc-ink-2">No specific strengths noted, but that's okay! We learn from every case.</p>
              )}
            </div>

            <div>
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-enc-crit">
                <XCircle className="h-3.5 w-3.5" /> What you missed
              </p>
              {missed.length > 0 ? (
                <div className="space-y-2.5">
                  {missed.map((m, i) => (
                    <div key={i} className={cn("rounded-xl p-3.5", m.critical ? "bg-enc-crit-soft" : "bg-enc-warn-soft")}>
                      <div className="flex items-start gap-2.5">
                        <XCircle className={cn("w-4 h-4 mt-0.5 shrink-0", m.critical ? "text-enc-crit" : "text-enc-warn")} />
                        <span className={cn("text-sm", m.critical ? "text-enc-crit" : "text-enc-warn")}>
                          {m.text}
                          {m.critical && (
                            <span className="ml-2 rounded bg-enc-sheet px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-wider text-enc-crit uppercase">
                              critical
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="flex items-start gap-2.5 text-sm text-enc-ok">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  Nothing important was missed.
                </p>
              )}
            </div>
          </div>

          {sim.reasoningError && (
            <>
              <SubHeading icon={AlertTriangle} tone="text-enc-crit">Your reasoning error</SubHeading>
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-enc-crit-soft">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-enc-crit shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-enc-ink mb-0.5 text-sm">{sim.reasoningError.title}</h4>
                      <p className="text-sm text-enc-ink-2 leading-relaxed">{sim.reasoningError.error}</p>
                    </div>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-enc-desk border border-enc-line">
                  <p className="text-enc-ink-3 text-xs uppercase tracking-wide font-semibold mb-1">Why It Mattered</p>
                  <p className="text-enc-ink-2 leading-relaxed text-sm">{sim.reasoningError.whyItMattered}</p>
                </div>
                {sim.otherErrors?.length > 0 && (
                  <div className="pt-1">
                    <p className="mb-2 text-xs font-semibold text-enc-ink-3">Also worth reviewing</p>
                    <ul className="space-y-2">
                      {sim.otherErrors.map((e: { id: string; title: string; error: string }) => (
                        <li key={e.id} className="text-sm leading-relaxed text-enc-ink-2 pl-3 border-l-2 border-enc-line-strong">
                          <span className="font-semibold text-enc-ink">{e.title}.</span> {e.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
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
      content: (
        <div className="space-y-5">
          <EncounterReview sim={sim} examLabels={examLabels} />

          {/* Expert Interpretations — always shown inline */}
          {expertImpressions.length > 0 && (
            <>
              <SubHeading icon={ScanSearch} tone="text-brand-700">Expert interpretations</SubHeading>
              <p className="text-xs text-enc-ink-3 italic -mt-1 mb-2">Shown to every student, whether or not you asked for an interpretation during the case.</p>
              <div className="space-y-2.5">
                {expertImpressions.map((x) => (
                  <div key={x.testId} className="p-3.5 rounded-xl bg-brand-50 border border-brand-100">
                    <h4 className="font-semibold text-brand-900 mb-1 flex items-center gap-2 text-sm">
                      <ScanSearch className="w-3.5 h-3.5 shrink-0" /> {x.title}
                    </h4>
                    <p className="text-sm text-enc-ink-2 leading-relaxed">{x.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Expert Walkthrough — collapsed by default in an accordion */}
          {caseData?.walkthrough && (
            <Accordion type="single" collapsible className="mt-2">
              <AccordionItem value="walkthrough" className="overflow-hidden rounded-xl border border-enc-line bg-enc-desk px-4 border-b-0">
                <AccordionTrigger className="py-3.5 hover:no-underline focus-visible:ring-brand-300">
                  <div className="flex items-center gap-3 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-enc-line bg-enc-sheet text-enc-ink-2">
                      <BookOpen className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-enc-ink">Expert Walkthrough</p>
                      <p className="text-xs font-normal text-enc-ink-3">How an expert would approach this case</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-1 pb-4">
                    <WalkthroughMarkdown text={caseData.walkthrough} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      ),
    },
    {
      key: "additional",
      title: "Performance Summary",
      icon: Award,
      content: (
        <div className="space-y-5">
          {/* Scores — always shown inline, never collapsed */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-enc-desk p-4 rounded-xl border border-enc-line flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-5">
                <Award className="w-12 h-12 text-enc-ink" />
              </div>
              <span className="text-enc-ink-3 text-[10px] font-bold uppercase tracking-widest mb-1.5">Clinical Score</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-4xl font-bold text-enc-ink tracking-tighter tabular-nums">{clinical}</span>
                <span className="text-enc-ink-3 text-base font-medium">/100</span>
              </div>
              <span className="mt-1.5 text-[11px] text-enc-ink-3">What you did</span>
            </div>
            <div className="bg-brand-600 p-4 rounded-xl flex flex-col items-center text-center relative overflow-hidden shadow-md shadow-brand-600/20">
              <div className="absolute top-0 right-0 p-2 opacity-10 text-white">
                <Activity className="w-12 h-12" />
              </div>
              <span className="text-brand-200 text-[10px] font-bold uppercase tracking-widest mb-1.5">Independent Score</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-4xl font-bold text-white tracking-tighter tabular-nums">{independent}</span>
                <span className="text-brand-200 text-base font-medium">/100</span>
              </div>
              <span className="mt-1.5 text-[11px] text-brand-200">{cost > 0 ? `Without help (−${cost})` : "No assistance used"}</span>
            </div>
          </div>

          {feedback.xpEarned !== undefined && (
            <div className="flex items-center justify-center gap-2 text-sm text-enc-ink-3">
              <Award className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-semibold text-enc-ink">+{feedback.xpEarned} XP</span> earned from your Clinical score
            </div>
          )}

          {/* Domain bars — always inline */}
          <div className="bg-enc-desk rounded-xl border border-enc-line overflow-hidden">
            <div className="px-4 py-2.5 border-b border-enc-line bg-enc-sheet">
              <h4 className="text-[10px] font-bold text-enc-ink-3 uppercase tracking-widest">Performance by area</h4>
            </div>
            <div className="p-1.5 space-y-0.5">
              {DOMAINS.map(({ key, label, icon: Icon, bg, text }) => {
                const score: number = sim.domains?.[key] ?? 0
                return (
                  <div key={key} className="p-2.5 rounded-lg hover:bg-enc-sheet transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1 rounded-md ${bg} ${text}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-medium text-enc-ink-2">{label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-enc-ink tabular-nums text-sm">{score}</span>
                        <span className="text-[10px] text-enc-ink-3 font-medium uppercase">/ 100</span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-enc-line">
                      <div className={cn("h-full rounded-full", BAND_BAR[scoreBand(score)])} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                )
              })}

              {safetyCount > 0 && (
                <div className="mt-1 p-2.5 rounded-lg bg-enc-crit-soft flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1 rounded-md bg-enc-sheet text-enc-crit">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-bold text-enc-crit">Unsafe interventions</span>
                  </div>
                  <span className="font-black text-enc-crit">{safetyCount}</span>
                </div>
              )}
            </div>
          </div>

          {references.length > 0 && (
            <div className="pt-4 border-t border-enc-line">
              <h4 className="text-sm font-semibold text-enc-ink mb-2.5 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-enc-ink-3" />
                References
              </h4>
              <ul className="space-y-2">
                {references.slice(0, 2).map((ref, i) => (
                  <li key={i} className="text-xs text-enc-ink-3 leading-normal pl-2 border-l-2 border-enc-line-strong">
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Clinical Takeaway — only this goes in accordion */}
          {takeawayAccordion.length > 0 && (
            <InfoAccordion items={takeawayAccordion} />
          )}
        </div>
      ),
    },
  ]

  const totalSteps = steps.length
  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1))
  const prev = () => setStep((s) => Math.max(s - 1, 0))
  const current = steps[step]

  return (
    <div className="min-h-screen bg-enc-desk flex flex-col items-center p-4 md:p-8 relative">
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
