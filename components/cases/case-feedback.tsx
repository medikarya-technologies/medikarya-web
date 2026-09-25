"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Activity,
  FlaskConical,
  Brain,
  ArrowRight,
  Award,
  BookOpen,
  Clock,
  Scale,
  PartyPopper,
  AlertTriangle,
  Network,
  Stethoscope,
  MessageSquare,
  Pill
} from "lucide-react";
import { trackEvent } from "@/lib/clarity";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { WalkthroughMarkdown, ProgressHeader, Nav, Section, Celebration } from "./feedback-steps";
import type { InfoAccordionItem } from "./debrief-parts";

// Only simulation results use the clinical debrief; keep it out of the classic review's bundle.
const SimulationDebrief = dynamic(() => import("./simulation-debrief").then((m) => m.SimulationDebrief), {
  ssr: false,
});

// The encounter steps (assistance audit, timeline) are only for encounters run at the bedside.
const AssistanceAudit = dynamic(() => import("./debrief-parts").then((m) => m.AssistanceAudit), { ssr: false });
const EncounterReview = dynamic(() => import("./debrief-parts").then((m) => m.EncounterReview), { ssr: false });
const InfoAccordion = dynamic(() => import("./debrief-parts").then((m) => m.InfoAccordion), { ssr: false });

function SubHeading({ children, icon: Icon, tone = "text-enc-ink-3" }: { children: React.ReactNode; icon: React.ElementType; tone?: string }) {
  return (
    <p className={cn("mb-3 mt-6 flex items-center gap-1.5 border-t border-enc-line pt-6 text-[11px] font-bold uppercase tracking-widest", tone)}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </p>
  );
}

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

      <div className={`flex-1 p-4 rounded-xl ${c.bg} flex flex-col gap-3 mb-6 last:mb-0`}>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-enc-ink-3 mb-0.5 block">Decision</span>
          <p className={`text-sm font-bold ${c.text} leading-tight`}>{action}</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            <ArrowRight className="w-3.5 h-3.5 text-enc-ink-3 mt-0.5 flex-shrink-0" />
            <p className={`text-xs ${c.text} opacity-90 leading-normal`}>{effect}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <ArrowRight className="w-3.5 h-3.5 text-enc-ink-3 flex-shrink-0" />
            <div className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-enc-sheet ${c.text}`}>
              {outcome}
            </div>
          </div>
        </div>
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

  try {
    if (feedback.isCorrect) {
      consequenceChain.push({
        action: "Synthesised clinical findings accurately",
        effect: `Correctly identified ${resolvedCorrectDiagnosis}`,
        outcome: "+15 Diagnosis Score",
        type: "success"
      });
    } else {
      consequenceChain.push({
        action: "Misinterpreted clinical findings",
        effect: `Diagnosed ${feedback.studentDiagnosis || "unknown"} instead of ${resolvedCorrectDiagnosis}`,
        outcome: "0 Diagnosis Score",
        type: "danger"
      });
    }

    // Red flags
    if (feedback.missedRedFlags && feedback.missedRedFlags.length > 0) {
      feedback.missedRedFlags.forEach((flag: string) => {
        consequenceChain.push({
          action: `Missed red flag: ${flag.replace(/_/g, " ")}`,
          effect: "Failed to rule out critical differential or complication",
          outcome: "-5 Safety Penalty",
          type: "danger"
        });
      });
    }

    // Testing
    const { appropriateTests, unnecessaryTests, missedTests } = feedback.feedback?.testingEfficiency || { appropriateTests: 0, unnecessaryTests: 0, missedTests: [] };

    if (unnecessaryTests > 0) {
      consequenceChain.push({
        action: `Ordered ${unnecessaryTests} unnecessary investigation(s)`,
        effect: "Wasted clinical resources and potential patient discomfort",
        outcome: "Reduced Testing Score",
        type: "warning"
      });
    }

    if (missedTests && missedTests.length > 0) {
      consequenceChain.push({
        action: `Failed to order core investigation(s)`,
        effect: "Diagnosis lacked sufficient objective evidence",
        outcome: "Reduced Testing Score",
        type: "warning"
      });
    } else if (appropriateTests > 0 && unnecessaryTests === 0) {
       consequenceChain.push({
         action: "Ordered highly targeted investigations",
         effect: "Validates hypotheses efficiently without waste",
         outcome: "Max Testing Score",
         type: "success"
       })
    }

    // History Quality
    if (feedback.historyScore >= 20) {
      consequenceChain.push({
        action: "Conducted thorough history taking",
        effect: "Gathered strong clinical evidence prior to tests",
        outcome: "Max History Score",
        type: "success"
      });
    } else if (feedback.historyScore < 15) {
      consequenceChain.push({
        action: "Conducted incomplete patient history",
        effect: "Proceeded with limited clinical context",
        outcome: "Low History Score",
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
        action: "Completed Clinical Evaluation",
        effect: "Structured metrics derived from history and diagnosis",
        outcome: "Evaluation Generated",
        type: "success"
      },
      {
        action: "Submitted Final Diagnosis",
        effect: "Review your detailed diagnostic breakdown below",
        outcome: "Review Recommended",
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
      title: "Case Outcome",
      icon: Activity,
      content: (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-enc-desk border border-enc-line">
            <p className="text-enc-ink-3 text-xs uppercase tracking-wide font-semibold mb-1">You Suspected</p>
            <p className="text-base font-medium text-enc-ink">
              {feedback.studentDiagnosis || "No diagnosis provided"}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-enc-desk border border-enc-line">
            <p className="text-enc-ink-3 text-xs uppercase tracking-wide font-semibold mb-1">Actual Diagnosis</p>
            <p className="text-base font-medium text-brand-600 flex items-center gap-2">
              {resolvedCorrectDiagnosis}
              {feedback.isCorrect && <CheckCircle2 className="w-4 h-4 text-enc-ok" />}
            </p>
          </div>
          <p className="text-enc-ink-3 italic text-sm">
            Let's calmly walk through how your reasoning unfolded and identify key decision points.
          </p>
        </div>
      ),
    },
    {
      title: "What You Did Well & Decision Consequences",
      icon: Network,
      content: (
        <div>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_1.6fr]">
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-enc-ok">
                <CheckCircle2 className="h-3.5 w-3.5" /> What you did well
              </p>
              {feedback.feedback.strengths && feedback.feedback.strengths.length > 0 ? (
                <div className="space-y-2.5">
                  {feedback.feedback.strengths.map((str: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl bg-enc-ok-soft p-3.5">
                      <CheckCircle2 className="w-4 h-4 text-enc-ok mt-0.5 shrink-0" />
                      <span className="text-sm font-medium text-enc-ok">{str.replace(/✅/g, '').trim()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-enc-ink-2">No specific strengths noted, but that's okay! We learn from every case.</p>
              )}
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-enc-ink-3">
                <Network className="h-3.5 w-3.5" /> Decision consequences
              </p>
              <p className="text-xs text-enc-ink-3 mb-3 italic">Tracing the impact of your clinical actions:</p>
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
              <p className="mb-2.5 text-sm">Consider ordering these tests to narrow down your differential:</p>
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
                    <h4 className="font-semibold text-enc-ink mb-0.5 text-sm">Safety Penalty Applied</h4>
                    <p className="text-sm text-enc-ink-2 leading-relaxed mb-2.5">
                      You failed to ask about critical "red flag" symptoms that were essential to rule out life-threatening conditions. A 5-point penalty was applied for each missed flag.
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
      title: "Clinical Takeaway",
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
      {/* Scores — always shown inline, never collapsed */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-enc-desk p-4 rounded-xl border border-enc-line flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <Award className="w-12 h-12 text-enc-ink" />
          </div>
          <span className="text-enc-ink-3 text-[10px] font-bold uppercase tracking-widest mb-1.5">Total Score</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-4xl font-bold text-enc-ink tracking-tighter">{feedback.score}</span>
            <span className="text-enc-ink-3 text-base font-medium">/100</span>
          </div>
        </div>
        <div className="bg-brand-600 p-4 rounded-xl flex flex-col items-center text-center relative overflow-hidden shadow-md shadow-brand-600/20">
           <div className="absolute top-0 right-0 p-2 opacity-10 text-white">
            <Activity className="w-12 h-12" />
          </div>
          <span className="text-brand-200 text-[10px] font-bold uppercase tracking-widest mb-1.5">XP Gained</span>
          <span className="text-4xl font-bold text-white tracking-tighter">
            +{feedback.xpEarned !== undefined ? feedback.xpEarned : (feedback.isCorrect ? (caseData.xpReward || 50) : Math.floor((caseData.xpReward || 50) * 0.2))}
          </span>
        </div>
      </div>

      {/* Score Breakdown Table */}
      <div className="bg-enc-desk rounded-xl border border-enc-line overflow-hidden">
        <div className="px-4 py-2.5 border-b border-enc-line bg-enc-sheet">
          <h4 className="text-[10px] font-bold text-enc-ink-3 uppercase tracking-widest">Performance Metrics</h4>
        </div>
        <div className="p-1.5 space-y-0.5">
          {[
            { label: "Clinical Reasoning", score: feedback.reasoningScore, max: 30, icon: Brain, bg: "bg-blue-50", text: "text-blue-700" },
            { label: "History Taking", score: feedback.historyScore, max: 25, icon: MessageSquare, bg: "bg-amber-50", text: "text-amber-700" },
            { label: "Diagnostic Accuracy", score: feedback.diagnosisScore, max: 15, icon: Stethoscope, bg: "bg-emerald-50", text: "text-emerald-700" },
            { label: "Test Strategy", score: feedback.testingScore, max: 20, icon: FlaskConical, bg: "bg-violet-50", text: "text-violet-700" },
            { label: "Management Plan", score: feedback.managementScore, max: 10, icon: Pill, bg: "bg-indigo-50", text: "text-indigo-700" },
          ].map((m, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-enc-sheet transition-colors">
              <div className="flex items-center gap-2.5">
                <div className={`p-1 rounded-md ${m.bg} ${m.text}`}>
                  <m.icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium text-enc-ink-2">{m.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-enc-ink text-sm">{m.score}</span>
                <span className="text-[10px] text-enc-ink-3 font-medium uppercase">/ {m.max}</span>
              </div>
            </div>
          ))}

          {feedback.safetyPenalty > 0 && (
            <div className="mt-1 p-2.5 rounded-lg bg-enc-crit-soft flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-enc-sheet text-enc-crit">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-bold text-enc-crit">Safety Penalties</span>
              </div>
              <span className="font-black text-enc-crit">-{feedback.safetyPenalty}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-1 space-y-1.5">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-enc-ink-3">
          <span>Investigation Accuracy</span>
          <span className="text-enc-ink-2">
            {feedback.feedback.testingEfficiency.appropriateTests} Hit / {feedback.feedback.testingEfficiency.unnecessaryTests} Miss
          </span>
        </div>
        <div className="h-1 rounded-full bg-enc-line overflow-hidden flex">
          <div
            className="h-full bg-enc-ok"
            style={{ width: `${(feedback.feedback.testingEfficiency.appropriateTests / (feedback.feedback.testingEfficiency.appropriateTests + feedback.feedback.testingEfficiency.unnecessaryTests + 0.1)) * 100}%` }}
          />
          <div
            className="h-full bg-enc-crit"
            style={{ width: `${(feedback.feedback.testingEfficiency.unnecessaryTests / (feedback.feedback.testingEfficiency.appropriateTests + feedback.feedback.testingEfficiency.unnecessaryTests + 0.1)) * 100}%` }}
          />
        </div>
      </div>

      {/* References Section */}
      {caseData.discussion?.references && caseData.discussion.references.length > 0 && (
        <div className="pt-4 border-t border-enc-line">
          <h4 className="text-sm font-semibold text-enc-ink mb-2.5 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-enc-ink-3" />
            References
          </h4>
          <ul className="space-y-2">
            {caseData.discussion.references.slice(0, 2).map((ref: string, i: number) => (
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
        title: "Why the Difference?",
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
    const examLabels: Record<string, string> = Object.fromEntries(
      (caseData?.examination ?? []).map((m: { id: string; label: string }) => [m.id, m.label])
    );
    reviewContent = <EncounterReview sim={simulation} examLabels={examLabels} />;
  }

  // Review the Encounter: the objective record, plus Expert Walkthrough collapsed by
  // default in its own accordion (same device as simulation-debrief.tsx's own Review
  // step) rather than always-expanded — a walkthrough can be long, and this way the
  // step opens on the numbers, not a wall of authored text.
  if (reviewContent || caseData.walkthrough) {
    steps.push({
      title: reviewContent ? "Review the Encounter" : "Expert Walkthrough",
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
    });
  }

  // Performance Summary — always shown inline; only Clinical Takeaway inside it collapses.
  steps.push({
    title: "Performance Summary",
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

