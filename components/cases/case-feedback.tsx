"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Activity,
  FlaskConical,
  Brain,
  ArrowRight,
  ArrowLeft,
  Award,
  RotateCcw,
  Home,
  BookOpen,
  PartyPopper,
  AlertTriangle,
  Network,
  Stethoscope,
  MessageSquare,
  Pill
} from "lucide-react";
import { trackEvent } from "@/lib/clarity";

// ─── Lightweight markdown renderer for walkthrough text ──────────────────────
// Handles: ### headings, **bold**, * bullet lists, blank-line paragraphs
function WalkthroughMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let paraBuffer: string[] = [];
  let bulletBuffer: string[] = [];

  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    const raw = paraBuffer.join(" ").trim();
    if (raw) elements.push(
      <p key={elements.length} className="text-slate-700 leading-relaxed mb-1">
        {renderInline(raw)}
      </p>
    );
    paraBuffer = [];
  };

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={elements.length} className="space-y-2 mb-3 pl-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-slate-700 leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-500 flex-shrink-0" />
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  // Inline renderer: **bold** → <strong>
  function renderInline(str: string): React.ReactNode[] {
    const parts = str.split(/(\*\*[^*]+\*\*)/);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>
        : p
    );
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // ### heading
    if (line.startsWith("###")) {
      flushBullets(); flushPara();
      const heading = line.replace(/^###\s*/, "");
      elements.push(
        <h3 key={elements.length} className="text-base font-bold text-slate-900 mt-5 mb-2 first:mt-0">
          {heading}
        </h3>
      );
      continue;
    }
    // ## heading
    if (line.startsWith("##")) {
      flushBullets(); flushPara();
      const heading = line.replace(/^##\s*/, "");
      elements.push(
        <h2 key={elements.length} className="text-lg font-bold text-slate-900 mt-6 mb-2 first:mt-0">
          {heading}
        </h2>
      );
      continue;
    }
    // # heading
    if (line.startsWith("#") && !line.startsWith("##")) {
      flushBullets(); flushPara();
      const heading = line.replace(/^#\s*/, "");
      elements.push(
        <h1 key={elements.length} className="text-xl font-bold text-slate-900 mt-6 mb-3 first:mt-0">
          {heading}
        </h1>
      );
      continue;
    }
    // bullet: * or -
    if (/^[*-]\s+/.test(line)) {
      flushPara();
      bulletBuffer.push(line.replace(/^[*-]\s+/, ""));
      continue;
    }
    // blank line = paragraph break
    if (line === "") {
      flushBullets(); flushPara();
      continue;
    }
    // regular text — accumulate into paragraph
    flushBullets();
    paraBuffer.push(line);
  }
  flushBullets();
  flushPara();

  return <div className="space-y-0">{elements}</div>;
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
}

function ProgressHeader({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 text-sm font-medium text-slate-500">
        <span>Clinical Reasoning Replay</span>
        <span>Step {step + 1} of {total}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className="h-full bg-slate-900"
          initial={{ width: 0 }}
          animate={{ width: `${((step + 1) / total) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function Nav({ onPrev, onNext, isFirst, isLast, onExit, onReset, onQuizStart, mode, guestMode }: {
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
  onExit: () => void;
  onReset?: () => void;
  onQuizStart?: () => void;
  mode?: 'live' | 'history';
  guestMode?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mt-10">
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={isFirst}
        className="gap-2 text-slate-600"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      {isLast ? (
        <div className="flex flex-col gap-3 items-end">
          {/* Quiz CTA — only in live mode, not history replay */}
          {onQuizStart && mode !== 'history' && (
            <div className="w-full p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-amber-400" />
                  Strengthen Your Weak Areas
                </p>
                <p className="text-xs text-slate-400 mt-0.5">5 personalized NEET PG questions targeting your knowledge gaps</p>
              </div>
              <Button
                onClick={onQuizStart}
                size="sm"
                className="rounded-full bg-white hover:bg-slate-100 text-slate-900 px-5 flex-shrink-0 shadow-sm font-semibold gap-1.5"
              >
                Take Quiz <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          {guestMode && (
            <div className="w-full p-4 rounded-xl bg-gradient-to-r from-brand-50 to-cyan-50 border border-brand-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Enjoyed this case?</p>
                <p className="text-xs text-slate-500">Create a free account to access all cases, track your progress, and earn XP.</p>
              </div>
              <Button asChild size="sm" className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-5 flex-shrink-0 shadow-sm">
                <Link href="/signup">Create Free Account</Link>
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            {!guestMode && (
              <Button variant="ghost" onClick={onExit} className="gap-2">
                <Home className="w-4 h-4" /> Dashboard
              </Button>
            )}
            <Button onClick={onReset || (() => window.location.reload())} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
              <RotateCcw className="w-4 h-4" /> {mode === 'history' ? 'Re-attempt Case' : 'Try Again'}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={onNext} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
          Next <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-lg shadow-slate-200/50 border-0 rounded-2xl bg-white overflow-hidden">
      <CardContent className="p-6 md:p-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-900">
            <Icon className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
        </div>
        <div className="text-slate-600 leading-relaxed text-[16px] md:text-lg">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function ConsequenceItem({ action, effect, outcome, type, isLast }: { action: string, effect: string, outcome: string, type: 'success' | 'warning' | 'danger', isLast?: boolean }) {
  const colors = {
    success: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-800", iconStr: "text-emerald-500", outcomeBg: "bg-emerald-100", outcomeText: "text-emerald-700", thread: "bg-emerald-200" },
    warning: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-800", iconStr: "text-amber-600", outcomeBg: "bg-amber-100", outcomeText: "text-amber-700", thread: "bg-amber-200" },
    danger: { bg: "bg-rose-50", border: "border-rose-100", text: "text-rose-800", iconStr: "text-rose-500", outcomeBg: "bg-rose-100", outcomeText: "text-rose-700", thread: "bg-rose-200" },
  }
  const c = colors[type];

  return (
    <div className="relative flex gap-4">
      {/* Timeline Thread */}
      <div className="flex flex-col items-center">
        <div className={`z-10 p-1.5 rounded-full bg-white shadow-sm border ${c.border} flex-shrink-0`}>
          {type === 'success' ? <CheckCircle2 className={`w-4 h-4 ${c.iconStr}`} /> : 
           type === 'warning' ? <AlertTriangle className={`w-4 h-4 ${c.iconStr}`} /> : 
           <XCircle className={`w-4 h-4 ${c.iconStr}`} />}
        </div>
        {!isLast && <div className={`w-0.5 flex-1 my-1 rounded-full ${c.thread}`} />}
      </div>
      
      <div className={`flex-1 p-4 rounded-xl border ${c.bg} ${c.border} flex flex-col gap-3 mb-6 last:mb-0`}>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500/80 mb-0.5 block">Decision</span>
          <p className={`text-sm font-bold ${c.text} leading-tight`}>{action}</p>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className={`text-xs ${c.text} opacity-90 leading-normal`}>{effect}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <div className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${c.outcomeBg} ${c.outcomeText}`}>
              {outcome}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// Simple celebration component using framer-motion
function Celebration() {
  const particles = Array.from({ length: 20 });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50 flex justify-center items-center">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: 0,
            scale: Math.random() * 1 + 0.5,
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400
          }}
          transition={{ duration: 1, ease: "easeOut", delay: Math.random() * 0.2 }}
          className="absolute w-3 h-3 rounded-full"
          style={{
            backgroundColor: ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 5)]
          }}
        />
      ))}
    </div>
  );
}

export function CaseFeedback({ 
  feedback, 
  caseData, 
  orderedTests, 
  onExit, 
  onReset,
  onQuizStart,
  mode = 'live',
  guestMode = false
}: CaseFeedbackProps) {
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

  // --- Build Decision Consequence Chain ---
  const consequenceChain: Array<{action: string, effect: string, outcome: string, type: 'success'|'warning'|'danger'}> = [];

  try {
    if (feedback.isCorrect) {
      consequenceChain.push({
        action: "Synthesised clinical findings accurately",
        effect: `Correctly identified ${feedback.correctDiagnosis}`,
        outcome: "+15 Diagnosis Score",
        type: "success"
      });
    } else {
      consequenceChain.push({
        action: "Misinterpreted clinical findings",
        effect: `Diagnosed ${feedback.studentDiagnosis || "unknown"} instead of ${feedback.correctDiagnosis}`,
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


  // Construct steps based on feedback data
  const steps = [
    {
      title: "Case Outcome",
      icon: Activity,
      content: (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-1">You Suspected</p>
            <p className="text-xl font-medium text-slate-900">
              {feedback.studentDiagnosis || "No diagnosis provided"}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-1">Actual Diagnosis</p>
            <p className="text-xl font-medium text-brand-600 flex items-center gap-2">
              {feedback.correctDiagnosis}
              {feedback.isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </p>
          </div>
          <p className="text-slate-500 italic mt-4">
            Let’s calmly walk through how your reasoning unfolded and identify key decision points.
          </p>
        </div>
      ),
    },
    {
      title: "What You Did Well",
      icon: CheckCircle2,
      content: (
        feedback.feedback.strengths && feedback.feedback.strengths.length > 0 ? (
          <ul className="space-y-4">
            {feedback.feedback.strengths.map((str: string, i: number) => (
              <li key={i} className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                <span className="text-slate-700">{str.replace(/✅/g, '').trim()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No specific strengths noted, but that's okay! We learn from every case.</p>
        )
      ),
    },
    {
      title: "Decision Consequences",
      icon: Network,
      content: (
        <div className="space-y-0">
          <p className="text-sm text-slate-500 mb-6 px-1 italic">Tracing the impact of your clinical actions:</p>
          <div className="pl-1">
            {consequenceChain.map((item, i) => (
              <ConsequenceItem 
                key={`cons-${i}`} 
                {...item} 
                isLast={i === consequenceChain.length - 1} 
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Tests You Should Have Considered",
      icon: FlaskConical,
      content: (
        filteredMissedTests.length > 0 ? (
          <div className="space-y-4">
            <p>Consider ordering these tests to narrow down your differential:</p>
            <div className="flex flex-wrap gap-2">
              {filteredMissedTests.map((test: string, i: number) => (
                <div key={i} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
                  {test}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 bg-emerald-50 rounded-xl border border-emerald-100">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-emerald-800 font-medium">Great job! You ordered all the relevant tests.</p>
          </div>
        )
      ),
    },
    ...(feedback.missedRedFlags && feedback.missedRedFlags.length > 0 ? [{
      title: "Critical Misses (Red Flags)",
      icon: AlertTriangle,
      content: (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-rose-900 mb-1">Safety Penalty Applied</h4>
                <p className="text-sm text-rose-700 leading-relaxed mb-3">
                  You failed to ask about critical "red flag" symptoms that were essential to rule out life-threatening conditions. A 5-point penalty was applied for each missed flag.
                </p>
                <div className="flex flex-wrap gap-2">
                  {feedback.missedRedFlags.map((flag: string, i: number) => (
                    <div key={i} className="px-3 py-1.5 rounded-lg bg-white text-rose-700 font-medium border border-rose-200 shadow-sm text-sm capitalize">
                      {flag.replace(/_/g, " ")}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }] : []),
    {
      title: "Clinical Takeaway",
      icon: BookOpen,
      content: (
        <div className="space-y-4">
          {caseData.discussion?.keyPoints?.length > 0 ? (
            <ul className="space-y-3">
              {caseData.discussion.keyPoints.map((point: string, i: number) => (
                <li key={i} className="flex gap-3 text-slate-700 leading-relaxed">
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
    {
      title: "Performance Summary",
      icon: Award,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col items-center text-center relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-3 opacity-5">
                <Award className="w-16 h-16 text-slate-900" />
              </div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Total Score</span>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-slate-900 tracking-tighter">{feedback.score}</span>
                <span className="text-slate-300 text-lg font-medium">/100</span>
              </div>
            </div>
            <div className="bg-brand-600 p-6 rounded-2xl flex flex-col items-center text-center relative overflow-hidden shadow-md shadow-brand-100">
               <div className="absolute top-0 right-0 p-3 opacity-10 text-white">
                <Activity className="w-16 h-16" />
              </div>
              <span className="text-brand-200 text-[10px] font-bold uppercase tracking-widest mb-2">XP Gained</span>
              <span className="text-5xl font-bold text-white tracking-tighter">
                +{feedback.xpEarned !== undefined ? feedback.xpEarned : (feedback.isCorrect ? (caseData.xpReward || 50) : Math.floor((caseData.xpReward || 50) * 0.2))}
              </span>
            </div>
          </div>

          {/* Score Breakdown Table */}
          <div className="mt-6 bg-slate-50/50 rounded-2xl border border-slate-100/80 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-white">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Performance Metrics</h4>
            </div>
            <div className="p-2 space-y-1">
              {[
                { label: "Clinical Reasoning", score: feedback.reasoningScore, max: 30, icon: Brain, bg: "bg-blue-50", text: "text-blue-700" },
                { label: "History Taking", score: feedback.historyScore, max: 25, icon: MessageSquare, bg: "bg-amber-50", text: "text-amber-700" },
                { label: "Diagnostic Accuracy", score: feedback.diagnosisScore, max: 15, icon: Stethoscope, bg: "bg-emerald-50", text: "text-emerald-700" },
                { label: "Test Strategy", score: feedback.testingScore, max: 20, icon: FlaskConical, bg: "bg-violet-50", text: "text-violet-700" },
                { label: "Management Plan", score: feedback.managementScore, max: 10, icon: Pill, bg: "bg-indigo-50", text: "text-indigo-700" },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${m.bg} ${m.text}`}>
                      <m.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{m.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-slate-900">{m.score}</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase">/ {m.max}</span>
                  </div>
                </div>
              ))}
              
              {feedback.safetyPenalty > 0 && (
                <div className="mt-1 p-3 rounded-xl bg-rose-50 border border-rose-100/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-rose-700">Safety Penalties</span>
                  </div>
                  <span className="font-black text-rose-600">-{feedback.safetyPenalty}</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-1 space-y-2 mt-4">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>Investigation Accuracy</span>
              <span className="text-slate-600">
                {feedback.feedback.testingEfficiency.appropriateTests} Hit / {feedback.feedback.testingEfficiency.unnecessaryTests} Miss
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                style={{ width: `${(feedback.feedback.testingEfficiency.appropriateTests / (feedback.feedback.testingEfficiency.appropriateTests + feedback.feedback.testingEfficiency.unnecessaryTests + 0.1)) * 100}%` }}
              />
              <div
                className="h-full bg-rose-400"
                style={{ width: `${(feedback.feedback.testingEfficiency.unnecessaryTests / (feedback.feedback.testingEfficiency.appropriateTests + feedback.feedback.testingEfficiency.unnecessaryTests + 0.1)) * 100}%` }}
              />
            </div>
          </div>

          {/* References Section */}
          {caseData.discussion?.references && caseData.discussion.references.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" />
                References
              </h4>
              <ul className="space-y-2">
                {caseData.discussion.references.slice(0, 2).map((ref: string, i: number) => (
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
  ];

  // Add optional authored walkthrough if present in caseData
  if (caseData.walkthrough) {
    steps.push({
      title: "Expert Walkthrough",
      icon: Brain,
      content: (
        <div className="space-y-4">
          <WalkthroughMarkdown text={caseData.walkthrough} />
        </div>
      )
    });
  }

  const totalSteps = steps.length;
  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center p-4 md:p-8 relative">
      <AnimatePresence>
        {showCelebration && <Celebration key="celebration" />}
      </AnimatePresence>

      <div className="w-full max-w-2xl relative z-10 pt-4 md:pt-8">

        <ProgressHeader step={step} total={totalSteps} />

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

