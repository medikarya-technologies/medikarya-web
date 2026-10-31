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
  Pill,
  Scale,
  ScanSearch,
  Timer,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/clarity"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AssistanceAudit, EncounterReview, InfoAccordion, type InfoAccordionItem } from "./debrief-parts"
import { Celebration, DiagnosisCompare, Kicker, Nav, ProgressHeader, ScoreRow, Section, SubHeading, WalkthroughMarkdown } from "./feedback-steps"

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
  { key: "clinical_reasoning", label: "Clinical reasoning", icon: Brain },
  { key: "investigation_accuracy", label: "Choice of tests", icon: FlaskConical },
  { key: "management", label: "Management", icon: Pill },
  { key: "efficiency", label: "Efficiency", icon: Timer },
] as const


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
  // A clinician who reviewed part of the case (the dengue fluid protocol) is named only with their consent (show_name),
  // and only here, after the case: naming what they reviewed on the briefing would hint at the answer.
  const pr = caseData?.protocol_review
  const protocolReviewer: string | null =
    pr?.show_name && pr.reviewer_name
      ? `${pr.scope ?? "Protocol"} reviewed by ${[pr.reviewer_name, pr.reviewer_designation, pr.reviewer_institution].filter(Boolean).join(", ")}.`
      : null
  const expertImpressions: Array<{ testId: string; title: string; text: string }> = sim.expertImpressions ?? []

  const examLabels: Record<string, string> = Object.fromEntries(
    [...(caseData?.examination ?? []), ...(caseData?.custom_interventions ?? [])].map((m: { id: string; label: string }) => [m.id, m.label])
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
          title: "Clinical takeaway",
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
      title: "Case outcome",
      icon: Activity,
      content: (
        <div className="space-y-4">
          <DiagnosisCompare yours={sim.diagnosis?.studentDiagnosis} actual={sim.diagnosis?.groundTruth ?? ""} correct={!!sim.diagnosis?.isCorrect} />
          <p className="text-sm text-enc-ink-3">Next: what you did well, what you missed, and why it mattered.</p>
        </div>
      ),
    },
    {
      key: "decisions",
      title: "What you did, and what you missed",
      icon: Scale,
      content: (
        <div>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_1.6fr]">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-enc-ok">
                <CheckCircle2 className="h-4 w-4" /> What you did well
              </h3>
              {didWell.length > 0 ? (
                <div className="space-y-2.5">
                  {didWell.map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl bg-enc-ok-soft p-3.5">
                      <CheckCircle2 className="w-4 h-4 text-enc-ok mt-0.5 shrink-0" />
                      <span className="text-sm text-enc-ink">{text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-enc-ink-2">Nothing stood out as a strength this time.</p>
              )}
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-enc-crit">
                <XCircle className="h-4 w-4" /> What you missed
              </h3>
              {missed.length > 0 ? (
                <div className="space-y-2.5">
                  {missed.map((m, i) => (
                    <div key={i} className={cn("rounded-xl p-3.5", m.critical ? "bg-enc-crit-soft" : "bg-enc-warn-soft")}>
                      <div className="flex items-start gap-2.5">
                        <XCircle className={cn("w-4 h-4 mt-0.5 shrink-0", m.critical ? "text-enc-crit" : "text-enc-warn")} />
                        <span className={cn("text-sm", m.critical ? "text-enc-crit" : "text-enc-warn")}>
                          {m.text}
                          {m.critical && (
                            <span className="ml-2 rounded bg-enc-sheet px-1.5 py-0.5 align-middle text-[11px] font-semibold text-enc-crit">
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
                  <Kicker>Why it mattered</Kicker>
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
            title: "Why the two scores differ",
            icon: Scale,
            content: <AssistanceAudit clinical={clinical} independent={independent} cost={cost} assistance={assistance} />,
          } satisfies Step,
        ]
      : []),
    {
      key: "review",
      title: "Review the encounter",
      icon: Clock,
      content: (
        <div className="space-y-5">
          <EncounterReview sim={sim} examLabels={examLabels} />

          {/* Expert Interpretations — always shown inline */}
          {expertImpressions.length > 0 && (
            <>
              <SubHeading icon={ScanSearch} tone="text-brand-700">Expert interpretations</SubHeading>
              <p className="text-xs text-enc-ink-3 -mt-1 mb-2">Shown to every student, whether or not you asked for an interpretation during the case.</p>
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
                      <p className="text-sm font-semibold text-enc-ink">Expert walkthrough</p>
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
      title: "Performance summary",
      icon: Award,
      content: (
        <div className="space-y-5">
          {/* Two scores: what you did, and what you did without help. Side by side, the same weight, so neither reads
              as the "real" one. */}
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-enc-line bg-enc-desk">
            <div className="px-5 py-4">
              <Kicker>Clinical score</Kicker>
              <p className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tighter text-enc-ink tabular-nums">{clinical}</span>
                <span className="text-base font-medium text-enc-ink-3">/ 100</span>
              </p>
              <p className="mt-1 text-[12px] text-enc-ink-3">What you did</p>
            </div>
            <div className="border-l border-enc-line px-5 py-4">
              <Kicker>Independent score</Kicker>
              <p className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tighter text-enc-ink tabular-nums">{independent}</span>
                <span className="text-base font-medium text-enc-ink-3">/ 100</span>
              </p>
              <p className="mt-1 text-[12px] text-enc-ink-3">{cost > 0 ? `Without help (−${cost})` : "No help used"}</p>
            </div>
          </div>

          {feedback.xpEarned !== undefined && (
            <p className="text-center text-sm text-enc-ink-3">
              <span className="font-semibold text-brand-700">+{feedback.xpEarned} XP</span>, from your clinical score
            </p>
          )}

          <div className="overflow-hidden rounded-xl border border-enc-line bg-enc-sheet">
            <h4 className="border-b border-enc-line bg-enc-desk px-4 py-2.5 text-[13px] font-semibold text-enc-ink">Score by area</h4>
            <div className="divide-y divide-enc-line">
              {DOMAINS.map(({ key, label, icon }) => (
                <ScoreRow key={key} label={label} icon={icon} score={sim.domains?.[key] ?? 0} max={100} />
              ))}
              {safetyCount > 0 && (
                <div className="flex items-center justify-between bg-enc-crit-soft px-4 py-3">
                  <span className="flex items-center gap-2.5 text-sm font-semibold text-enc-crit">
                    <AlertTriangle className="h-4 w-4" /> Unsafe interventions
                  </span>
                  <span className="font-bold text-enc-crit tabular-nums">{safetyCount}</span>
                </div>
              )}
            </div>
          </div>

          {(references.length > 0 || protocolReviewer) && (
            <div className="pt-4 border-t border-enc-line">
              <h4 className="text-sm font-semibold text-enc-ink mb-2.5 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-enc-ink-3" />
                Guidelines and references
              </h4>
              {/* Every source the case follows is credited, not a sample of them. */}
              <ul className="space-y-2">
                {references.map((ref, i) => (
                  <li key={i} className="text-xs text-enc-ink-3 leading-normal pl-2 border-l-2 border-enc-line-strong">
                    {ref}
                  </li>
                ))}
              </ul>
              {protocolReviewer && <p className="mt-3 text-xs text-enc-ink-2">{protocolReviewer}</p>}
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
