"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Activity,
  FlaskConical,
  Brain,
  Award,
  BookOpen,
  Clock,
  Scale,
  AlertTriangle,
  Network,
  Stethoscope,
  MessageSquare,
  Pill
} from "lucide-react";
import { trackEvent } from "@/lib/clarity";
import dynamic from "next/dynamic";
import { fluidActionLabels } from "@/lib/simulation/fluid-infusion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { WalkthroughMarkdown, ProgressHeader, Nav, Section, Celebration, DiagnosisCompare, Kicker, ScoreRow, SubHeading } from "./feedback-steps";
import type { InfoAccordionItem } from "./debrief-parts";

// Only simulation results use the clinical debrief; keep it out of the classic review's bundle.
const SimulationDebrief = dynamic(() => import("./simulation-debrief").then((m) => m.SimulationDebrief), {
  ssr: false,
});

// The encounter steps (assistance audit, timeline) are only for encounters run at the bedside.
const AssistanceAudit = dynamic(() => import("./debrief-parts").then((m) => m.AssistanceAudit), { ssr: false });
const EncounterReview = dynamic(() => import("./debrief-parts").then((m) => m.EncounterReview), { ssr: false });
const InfoAccordion = dynamic(() => import("./debrief-parts").then((m) => m.InfoAccordion), { ssr: false });
const BedsideSummary = dynamic(() => import("./debrief-parts").then((m) => m.BedsideSummary), { ssr: false });

interface CaseFeedbackProps {
  feedback: any
  caseData: any
  orderedTests: any[]
  onExit: () => void
  onReset?: () => void
  onQuizStart?: () => void
  mode?: 'live' | 'history'
  guestMode?: boolean
  /** Opens "report a problem with this case". */
  onReport?: () => void
}

function ConsequenceItem({ action, effect, outcome, type, isLast }: { action: string, effect: string, outcome: string, type: 'success' | 'warning' | 'danger', isLast?: boolean }) {
  const colors = {
    success: { bg: "bg-enc-ok-soft", text: "text-enc-ok", iconStr: "text-enc-ok", thread: "bg-enc-ok/30" },
    warning: { bg: "bg-enc-warn-soft", text: "text-enc-warn", iconStr: "text-enc-warn", thread: "bg-enc-warn/30" },
    danger: { bg: "bg-enc-crit-soft", text: "text-enc-crit", iconStr: "text-enc-crit", thread: "bg-enc-crit/30" },
  }
  const c = colors[type];

  return (
    <div className="relative flex gap-4">
      {/* Timeline Thread */}
      <div className="flex flex-col items-center">
        <div className="z-10 p-1.5 rounded-full bg-enc-sheet shadow-sm border border-enc-line flex-shrink-0">
          {type === 'success' ? <CheckCircle2 className={`w-4 h-4 ${c.iconStr}`} /> :
           type === 'warning' ? <AlertTriangle className={`w-4 h-4 ${c.iconStr}`} /> :
           <XCircle className={`w-4 h-4 ${c.iconStr}`} />}
        </div>
        {!isLast && <div className={`w-0.5 flex-1 my-1 rounded-full ${c.thread}`} />}
      </div>

      <div className={`flex-1 p-4 rounded-xl ${c.bg} flex flex-col gap-2 mb-4 last:mb-0`}>
        <p className={`text-sm font-bold ${c.text} leading-snug`}>{action}</p>

        <p className="text-[13px] leading-normal text-enc-ink-2">{effect}</p>
        <span className={`self-start rounded-md bg-enc-sheet px-2 py-0.5 text-[12px] font-semibold tabular-nums ${c.text}`}>{outcome}</span>
      </div>
    </div>
  )
}


/**
 * Routes a rubric-scored simulation result to the clinical debrief (dual scores,
 * assistance audit, reasoning error, expert reads). Everything else gets the
 * classic step-by-step review below, and a classic case that was run at the
 * bedside gets that same review with the encounter's own steps added.
 */
export function CaseFeedback(props: CaseFeedbackProps) {
  const simulation = props.feedback?.simulation
  if (simulation && simulation.scoring !== "classic") {
    return (
      <SimulationDebrief
        feedback={props.feedback}
        caseData={props.caseData}
        onExit={props.onExit}
        onReset={props.onReset}
        onQuizStart={props.onQuizStart}
        mode={props.mode}
        guestMode={props.guestMode}
        onReport={props.onReport}
      />
    );
  }
  return <LegacyCaseFeedback {...props} simulation={simulation} />;
}

function LegacyCaseFeedback({
  feedback,
  caseData,
  orderedTests,
  onExit,
  onReset,
  onQuizStart,
  mode = 'live',
  guestMode = false,
  onReport,
  simulation
}: CaseFeedbackProps & { simulation?: any }) {
  const [step, setStep] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    trackEvent("Evaluation_Viewed");
  }, []);

  // Filter out ELISA and any empty strings
  const missedTestsStart = feedback.feedback.testingEfficiency.missedTests || [];
  const filteredMissedTests = missedTestsStart
    .filter((t: string) => !t.toLowerCase().includes("elisa"))
    .filter(Boolean);

  // Trigger celebration if score is good (> 70) and we are on the first or result step
  useEffect(() => {
    if (feedback.score >= 70 && step === 0) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [feedback.score, step]);

  // Resolve correct diagnosis with robust fallback chain
  const resolvedCorrectDiagnosis =
    feedback?.correctDiagnosis ||
    caseData?.evaluation_config?.diagnosis?.accepted_primary?.[0] ||
    caseData?.patient?.final_diagnosis ||
    caseData?.diagnosis ||
    caseData?.displayTitle ||
    caseData?.title ||
    "Clinical Diagnosis";

  // --- Build Decision Consequence Chain ---
  const consequenceChain: Array<{action: string, effect: string, outcome: string, type: 'success'|'warning'|'danger'}> = [];

  // The outcome line quotes the real points from the breakdown on the last step, so the two can never disagree.
  const pts = (v: unknown) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : "0");

  try {
    if (feedback.isCorrect) {
      consequenceChain.push({
        action: "Put the findings together correctly",
        effect: `You reached ${resolvedCorrectDiagnosis}.`,
        outcome: `Diagnosis ${pts(feedback.diagnosisScore)} of 15`,
        type: "success"
      });
    } else {
      consequenceChain.push({
        action: "The findings pointed somewhere else",
        effect: feedback.studentDiagnosis
          ? `You diagnosed ${feedback.studentDiagnosis}; the case was ${resolvedCorrectDiagnosis}.`
          : `No diagnosis was given; the case was ${resolvedCorrectDiagnosis}.`,
        outcome: `Diagnosis ${pts(feedback.diagnosisScore)} of 15`,
        type: "danger"
      });
    }

    // Red flags
    if (feedback.missedRedFlags && feedback.missedRedFlags.length > 0) {
      feedback.missedRedFlags.forEach((flag: string) => {
        consequenceChain.push({
          action: `Missed a red flag: ${flag.replace(/_/g, " ")}`,
          effect: "A dangerous cause or complication was left unexcluded.",
          outcome: "5 points off for safety",
          type: "danger"
        });
      });
    }

    // Testing
    const { appropriateTests, unnecessaryTests, missedTests } = feedback.feedback?.testingEfficiency || { appropriateTests: 0, unnecessaryTests: 0, missedTests: [] };

    if (unnecessaryTests > 0) {
      consequenceChain.push({
        action: unnecessaryTests === 1 ? "Ordered a test the case did not need" : `Ordered ${unnecessaryTests} tests the case did not need`,
        effect: "Each one costs the patient time, money or discomfort without changing the plan.",
        outcome: `Tests ${pts(feedback.testingScore)} of 20`,
        type: "warning"
      });
    }

    if (missedTests && missedTests.length > 0) {
      consequenceChain.push({
        action: "Left out a key investigation",
        effect: "The diagnosis rested on less objective evidence than it needed.",
        outcome: `Tests ${pts(feedback.testingScore)} of 20`,
        type: "warning"
      });
    } else if (appropriateTests > 0 && unnecessaryTests === 0) {
       consequenceChain.push({
         action: "Ordered only the tests that mattered",
         effect: "Nothing was wasted, and nothing essential was left out.",
         outcome: `Tests ${pts(feedback.testingScore)} of 20`,
         type: "success"
       })
    }

    // History. With history scoring version 2 the debrief knows which required questions were not asked, and says
    // so by name; it calls the history thorough only when nothing was missed. Version 1's list was unreliable, so
    // its attempts keep the old score bands.
    const review = feedback.historyReview as { asked: number; of: number; missed: string[] } | undefined;
    if (review && Array.isArray(review.missed)) {
      const shown = review.missed.slice(0, 4);
      const more = review.missed.length - shown.length;
      if (review.missed.length === 0) {
        consequenceChain.push({
          action: "Took a thorough history",
          effect: "You asked about everything this case needed before moving on.",
          outcome: `History ${pts(feedback.historyScore)} of 25`,
          type: "success"
        });
      } else {
        consequenceChain.push({
          action: review.missed.length === 1 ? "The history missed one thing" : `The history missed ${review.missed.length} things`,
          effect: `You did not ask about: ${shown.join("; ")}${more > 0 ? `; and ${more} more` : ""}.`,
          outcome: `History ${pts(feedback.historyScore)} of 25`,
          type: review.asked >= review.of / 2 ? "warning" : "danger"
        });
      }
    } else if (feedback.historyScore >= 20) {
      consequenceChain.push({
        action: "Took a thorough history",
        effect: "You had most of the story before ordering anything.",
        outcome: `History ${pts(feedback.historyScore)} of 25`,
        type: "success"
      });
    } else if (feedback.historyScore < 15) {
      consequenceChain.push({
        action: "The history left gaps",
        effect: "You moved on with less of the story than the case needed.",
        outcome: `History ${pts(feedback.historyScore)} of 25`,
        type: "warning"
      });
    }

    // Sort consequence chain
    const typeWeight = { danger: 0, warning: 1, success: 2 };
    consequenceChain.sort((a, b) => typeWeight[a.type] - typeWeight[b.type]);
  } catch (err) {
    console.error("Failed to parse consequence chain details", err)
  }

  // Fallback to simple explanation if parsing fails or chain is empty
  if (consequenceChain.length === 0) {
    consequenceChain.push(
      {
        action: "Your assessment was scored",
        effect: "The breakdown on the last step shows where the points came from.",
        outcome: `${pts(feedback.score)} of 100`,
        type: "success"
      },
      {
        action: "Your diagnosis was submitted",
        effect: feedback.studentDiagnosis ? `You diagnosed ${feedback.studentDiagnosis}.` : "No diagnosis was given.",
        outcome: `Diagnosis ${pts(feedback.diagnosisScore)} of 15`,
        type: "warning"
      }
    )
  }


  // Construct steps based on feedback data — restructured this round: What You Did Well
  // and Decision Consequences (plus the two smaller supporting steps, missed tests and
  // red flags — both really just more detail on entries already in the consequence chain)
  // are now one step. Review the Encounter and Expert Walkthrough are now one step.
  // Performance Summary and Clinical Takeaway moved out of the step flow into a
  // collapsed-by-default InfoAccordion. See simulation-debrief.tsx's own comment for the
  // full rationale — both flows share the same restructuring.
  const steps = [
    {
      title: "Case outcome",
      icon: Activity,
      content: (
        <div className="space-y-4">
          <DiagnosisCompare yours={feedback.studentDiagnosis} actual={resolvedCorrectDiagnosis} correct={!!feedback.isCorrect} />
          <p className="text-sm text-enc-ink-3">Next: what you did, and what each choice led to.</p>
        </div>
      ),
    },
    {
      title: "What you did, and what it led to",
      icon: Network,
      content: (
        <div>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_1.6fr]">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-enc-ok">
                <CheckCircle2 className="h-4 w-4" /> What you did well
              </h3>
              {feedback.feedback.strengths && feedback.feedback.strengths.length > 0 ? (
                <div className="space-y-2.5">
                  {feedback.feedback.strengths.map((str: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl bg-enc-ok-soft p-3.5">
                      <CheckCircle2 className="w-4 h-4 text-enc-ok mt-0.5 shrink-0" />
                      <span className="text-sm text-enc-ink">{str.replace(/✅/g, '').trim()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-enc-ink-2">Nothing stood out as a strength this time. The choices on the right show where the points went.</p>
              )}
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-enc-ink">
                <Network className="h-4 w-4 text-enc-ink-3" /> Your choices and what they cost or earned
              </h3>
              <div>
                {consequenceChain.map((item, i) => (
                  <ConsequenceItem
                    key={`cons-${i}`}
                    {...item}
                    isLast={i === consequenceChain.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>

          {filteredMissedTests.length > 0 && (
            <>
              <SubHeading icon={FlaskConical} tone="text-brand-700">Tests you should have considered</SubHeading>
              <p className="mb-2.5 text-sm">These would have narrowed your differential:</p>
              <div className="flex flex-wrap gap-2">
                {filteredMissedTests.map((test: string, i: number) => (
                  <div key={i} className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 font-medium text-sm border border-brand-100">
                    {test}
                  </div>
                ))}
              </div>
            </>
          )}

          {feedback.missedRedFlags && feedback.missedRedFlags.length > 0 && (
            <>
              <SubHeading icon={AlertTriangle} tone="text-enc-crit">Critical misses (red flags)</SubHeading>
              <div className="p-3.5 rounded-xl bg-enc-crit-soft">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-enc-crit shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-enc-ink mb-0.5 text-sm">Safety penalty</h4>
                    <p className="text-sm text-enc-ink-2 leading-relaxed mb-2.5">
                      You did not ask about these red flags, and they are how the life-threatening causes are ruled out. Each one missed costs 5 points.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {feedback.missedRedFlags.map((flag: string, i: number) => (
                        <div key={i} className="px-2.5 py-1 rounded-lg bg-enc-sheet text-enc-crit font-medium shadow-sm text-sm capitalize">
                          {flag.replace(/_/g, " ")}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  // Only Clinical Takeaway goes in the accordion — Performance Summary is shown inline always.
  const takeawayAccordion: InfoAccordionItem[] = [
    {
      id: "takeaway",
      icon: BookOpen,
      title: "Clinical takeaway",
      teaser: "Key points to remember from this case",
      content: (
        <div className="space-y-4">
          {caseData.discussion?.keyPoints?.length > 0 ? (
            <ul className="space-y-3">
              {caseData.discussion.keyPoints.map((point: string, i: number) => (
                <li key={i} className="flex gap-3 text-enc-ink-2 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p>
                This case highlights the importance of systematic evaluation in patients presenting with <strong>{caseData.patient.chiefComplaint}</strong>.
              </p>
              <p>
                Accurate diagnosis relies on distinguishing between similar presentations through focused history taking and targeted investigations.
              </p>
            </>
          )}
        </div>
      ),
    },
  ];

  const performanceSummaryContent = (
    <div className="space-y-5">
      {/* The total leads; XP is the smaller, secondary number beside it. */}
      <div className="flex items-end justify-between gap-4 rounded-xl border border-enc-line bg-enc-desk px-5 py-4">
        <div>
          <Kicker>Total score</Kicker>
          <p className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tighter text-enc-ink tabular-nums">{feedback.score}</span>
            <span className="text-base font-medium text-enc-ink-3">/ 100</span>
          </p>
        </div>
        <p className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 tabular-nums">
          +{feedback.xpEarned !== undefined ? feedback.xpEarned : (feedback.isCorrect ? (caseData.xpReward || 50) : Math.floor((caseData.xpReward || 50) * 0.2))} XP
        </p>
      </div>

      {/* A live case: what was given at the bedside, and when */}
      {simulation?.bedside && <BedsideSummary bedside={simulation.bedside} total={feedback.score} />}

      {/* Where the points came from */}
      <div className="overflow-hidden rounded-xl border border-enc-line bg-enc-sheet">
        <h4 className="border-b border-enc-line bg-enc-desk px-4 py-2.5 text-[13px] font-semibold text-enc-ink">Score by area</h4>
        <div className="divide-y divide-enc-line">
          <ScoreRow label="Clinical reasoning" icon={Brain} score={feedback.reasoningScore} max={30} />
          <ScoreRow label="History taking" icon={MessageSquare} score={feedback.historyScore} max={25} />
          <ScoreRow label="Diagnosis" icon={Stethoscope} score={feedback.diagnosisScore} max={15} />
          <ScoreRow label="Choice of tests" icon={FlaskConical} score={feedback.testingScore} max={20} />
          <ScoreRow label="Management plan" icon={Pill} score={feedback.managementScore} max={10} />
          {feedback.safetyPenalty > 0 && (
            <div className="flex items-center justify-between bg-enc-crit-soft px-4 py-3">
              <span className="flex items-center gap-2.5 text-sm font-semibold text-enc-crit">
                <AlertTriangle className="h-4 w-4" /> Safety penalties
              </span>
              <span className="font-bold text-enc-crit tabular-nums">−{feedback.safetyPenalty}</span>
            </div>
          )}
        </div>
        <p className="border-t border-enc-line px-4 py-2.5 text-[12px] text-enc-ink-3">
          Tests: {feedback.feedback.testingEfficiency.appropriateTests} useful, {feedback.feedback.testingEfficiency.unnecessaryTests} not needed.
        </p>
      </div>

      {/* References Section */}
      {caseData.discussion?.references && caseData.discussion.references.length > 0 && (
        <div className="pt-4 border-t border-enc-line">
          <h4 className="text-sm font-semibold text-enc-ink mb-2.5 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-enc-ink-3" />
            Guidelines and references
          </h4>
          <ul className="space-y-2">
            {caseData.discussion.references.map((ref: string, i: number) => (
              <li key={i} className="text-xs text-enc-ink-3 leading-normal pl-2 border-l-2 border-enc-line-strong">
                {ref}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clinical Takeaway — only this goes in accordion */}
      <InfoAccordion items={takeawayAccordion} />
    </div>
  );

  // A classic case run at the bedside also has an encounter to look back on.
  let reviewContent: React.ReactNode = null;
  if (simulation) {
    const cost: number = simulation.assistanceCost ?? 0;
    if (cost > 0 && simulation.assistance?.length > 0) {
      steps.push({
        title: "Why the two scores differ",
        icon: Scale,
        content: (
          <AssistanceAudit
            clinical={simulation.clinicalScore}
            independent={simulation.independentScore}
            cost={cost}
            assistance={simulation.assistance}
          />
        ),
      });
    }
    const examLabels: Record<string, string> = {
      ...Object.fromEntries(
        [...(caseData?.examination ?? []), ...(caseData?.custom_interventions ?? [])].map((m: { id: string; label: string }) => [m.id, m.label])
      ),
      // a fluid's rates and its stop, named by the fluid and the rate
      ...Object.fromEntries(fluidActionLabels(caseData?.custom_interventions)),
    };
    reviewContent = <EncounterReview sim={simulation} examLabels={examLabels} />;
  }

  // Review the Encounter: the objective record, plus Expert Walkthrough collapsed by
  // default in its own accordion (same device as simulation-debrief.tsx's own Review
  // step) rather than always-expanded — a walkthrough can be long, and this way the
  // step opens on the numbers, not a wall of authored text.
  if (reviewContent || caseData.walkthrough) {
    steps.push({
      title: reviewContent ? "Review the encounter" : "Expert walkthrough",
      icon: reviewContent ? Clock : Brain,
      content: (
        <div className="space-y-5">
          {reviewContent}
          {caseData.walkthrough && (
            <Accordion type="single" collapsible className={reviewContent ? "mt-2" : undefined}>
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
    });
  }

  // Performance Summary — always shown inline; only Clinical Takeaway inside it collapses.
  steps.push({
    title: "Performance summary",
    icon: Award,
    content: performanceSummaryContent,
  });

  const totalSteps = steps.length;
  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="min-h-screen bg-enc-desk flex flex-col items-center p-4 md:p-8 relative">
      <AnimatePresence>
        {showCelebration && <Celebration key="celebration" />}
      </AnimatePresence>

      <div className="w-full max-w-2xl relative z-10 pt-4 md:pt-8">

        <ProgressHeader step={step} total={totalSteps} onReport={onReport} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <Section icon={steps[step].icon} title={steps[step].title}>
              {steps[step].content}
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
  );
}

