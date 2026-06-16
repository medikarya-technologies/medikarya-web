"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Brain,
  ArrowRight,
  Target,
  ChevronDown,
  Loader2,
  Home,
  RotateCcw,
  Sparkles,
  BookOpen,
  TrendingUp,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedMCQ {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: string;
  difficulty: "recall" | "application" | "vignette" | "trap" | "integration";
  weaknessLink: string;
  knowledgeGap: string;
}

export interface KnowledgeGap {
  concept: string;
  relatedWeaknesses: string[];
  priority: number;
  questionCount: number;
}

export interface QuizAnswer {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  timeSpentMs: number;
}

export interface QuizResult {
  questions: GeneratedMCQ[];
  answers: QuizAnswer[];
  knowledgeGaps: KnowledgeGap[];
  score: number;
  total: number;
  generatedAt: string;
}

interface CaseQuizProps {
  quizPromise: Promise<{
    questions: GeneratedMCQ[];
    knowledgeGaps: KnowledgeGap[];
  }> | null;
  caseData: any;
  caseScore: number;
  caseTitle?: string;
  onComplete: (results: QuizResult) => void;
  onSkip: () => void;
  onExit: () => void;
  onViewFeedback?: () => void;
  onReset?: () => void;
  guestMode?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

const DIFFICULTY_STYLES: Record<
  GeneratedMCQ["difficulty"],
  { bg: string; text: string; border: string; label: string }
> = {
  recall: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Recall",
  },
  application: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Application",
  },
  vignette: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    label: "NEET Vignette",
  },
  trap: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Trap",
  },
  integration: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "Integration",
  },
};

const TRANSITION_EASE = [0.23, 1, 0.32, 1] as const;

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
};

const PAGE_TRANSITION = { duration: 0.4, ease: TRANSITION_EASE };

const LOADING_MESSAGES = [
  "Analyzing your performance...",
  "Creating personalized questions...",
  "Almost ready...",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

type QuizPhase = "loading" | "error" | "intro" | "question" | "reveal" | "results";

function QuizProgressHeader({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 text-sm font-medium text-slate-500">
        <span>Knowledge Quiz</span>
        <span>
          Question {current + 1} of {total}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className="h-full bg-slate-900"
          initial={{ width: 0 }}
          animate={{ width: `${((current + 1) / total) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function DifficultyBadge({
  difficulty,
}: {
  difficulty: GeneratedMCQ["difficulty"];
}) {
  const style = DIFFICULTY_STYLES[difficulty];
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-2.5 py-0.5 rounded-full",
        style.bg,
        style.text,
        style.border
      )}
    >
      {style.label}
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CaseQuiz({
  quizPromise,
  caseData,
  caseScore,
  caseTitle,
  onComplete,
  onSkip,
  onExit,
  onViewFeedback,
  onReset,
  guestMode = false,
}: CaseQuizProps) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<QuizPhase>("loading");
  const [questions, setQuestions] = useState<GeneratedMCQ[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [showWeaknessLink, setShowWeaknessLink] = useState(false);

  // Loading message cycling
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  // Time tracking
  const questionStartRef = useRef<number>(Date.now());

  // ── Resolve quiz promise ───────────────────────────────────────────────────
  useEffect(() => {
    if (!quizPromise) {
      setPhase("error");
      return;
    }

    let cancelled = false;

    quizPromise
      .then((data) => {
        if (cancelled) return;
        if (!data?.questions || data.questions.length === 0) {
          setPhase("error");
          return;
        }
        setQuestions(data.questions);
        setKnowledgeGaps(data.knowledgeGaps || []);
        setPhase("intro");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [quizPromise]);

  // ── Cycle loading messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "loading") return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Reset timer when question changes ──────────────────────────────────────
  useEffect(() => {
    if (phase === "question") {
      questionStartRef.current = Date.now();
    }
  }, [phase, currentQ]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStartQuiz = useCallback(() => {
    setCurrentQ(0);
    setSelectedOption(null);
    setAnswers([]);
    setPhase("question");
  }, []);

  const handleCheckAnswer = useCallback(() => {
    if (selectedOption === null) return;

    const question = questions[currentQ];
    const timeSpent = Date.now() - questionStartRef.current;
    const isCorrect = selectedOption === question.correctIndex;

    const answer: QuizAnswer = {
      questionId: question.id,
      selectedIndex: selectedOption,
      correct: isCorrect,
      timeSpentMs: timeSpent,
    };

    setAnswers((prev) => [...prev, answer]);
    setPhase("reveal");
  }, [selectedOption, questions, currentQ]);

  const handleNextQuestion = useCallback(() => {
    setShowWeaknessLink(false);
    if (currentQ < questions.length - 1) {
      setCurrentQ((prev) => prev + 1);
      setSelectedOption(null);
      setPhase("question");
    } else {
      setPhase("results");
    }
  }, [currentQ, questions.length]);

  // ── Compute results ────────────────────────────────────────────────────────

  const score = answers.filter((a) => a.correct).length;
  const total = questions.length;
  const scorePercent = total > 0 ? Math.round((score / total) * 100) : 0;
  const knowledgeRecovery =
    total > 0
      ? Math.round((score / total) * (100 - caseScore) * 0.3)
      : 0;
  const reinforcedScore = Math.min(100, caseScore + knowledgeRecovery);

  // ── Fire onComplete when results phase is reached ──────────────────────────
  const completedRef = useRef(false);
  useEffect(() => {
    if (phase === "results" && answers.length === questions.length && questions.length > 0 && !completedRef.current) {
      completedRef.current = true;
      const result: QuizResult = {
        questions,
        answers,
        knowledgeGaps,
        score,
        total,
        generatedAt: new Date().toISOString(),
      };
      // Fire and forget — just persist, don't navigate away
      onComplete(result);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Current question shorthand ─────────────────────────────────────────────
  const question = questions[currentQ] as GeneratedMCQ | undefined;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-2xl pt-4 md:pt-8">
        <AnimatePresence mode="wait">
          {/* ── Loading ──────────────────────────────────────────────────── */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              variants={PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={PAGE_TRANSITION}
            >
              <Card className="shadow-lg shadow-slate-200/50 border-0 rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-6 md:p-10">
                  <div className="flex flex-col items-center text-center py-12">
                    <div className="relative mb-8">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
                      </div>
                    </div>

                    {/* Skeleton lines */}
                    <div className="w-full max-w-sm space-y-3 mb-8">
                      <div className="h-3 rounded-full bg-slate-100 animate-pulse" />
                      <div className="h-3 rounded-full bg-slate-100 animate-pulse w-4/5 mx-auto" />
                      <div className="h-3 rounded-full bg-slate-50 animate-pulse w-3/5 mx-auto" />
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.p
                        key={loadingMsgIndex}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm font-medium text-slate-500"
                      >
                        {LOADING_MESSAGES[loadingMsgIndex]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Error ────────────────────────────────────────────────────── */}
          {phase === "error" && (
            <motion.div
              key="error"
              variants={PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={PAGE_TRANSITION}
            >
              <Card className="shadow-lg shadow-slate-200/50 border-0 rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-6 md:p-10">
                  <div className="flex flex-col items-center text-center py-8">
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 mb-6">
                      <XCircle className="w-7 h-7 text-rose-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                      Quiz generation failed
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-sm">
                      We couldn&apos;t generate personalized questions right now.
                      Don&apos;t worry — your case evaluation has been saved.
                    </p>
                    <Button
                      onClick={onSkip}
                      className="gap-2 bg-slate-900 hover:bg-slate-800 text-white"
                    >
                      Continue to Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Intro ────────────────────────────────────────────────────── */}
          {phase === "intro" && (
            <motion.div
              key="intro"
              variants={PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={PAGE_TRANSITION}
            >
              <Card className="shadow-lg shadow-slate-200/50 border-0 rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-6 md:p-10">
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-900">
                      <Target className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Strengthen Your Weak Areas
                    </h2>
                  </div>

                  <p className="text-slate-600 leading-relaxed mb-6">
                    Based on your performance, we&apos;ve identified{" "}
                    <span className="font-semibold text-slate-900">
                      {knowledgeGaps.length} knowledge gap
                      {knowledgeGaps.length !== 1 ? "s" : ""}
                    </span>{" "}
                    and prepared{" "}
                    <span className="font-semibold text-slate-900">
                      {questions.length} targeted NEET PG-style questions
                    </span>
                    .
                  </p>

                  {/* Knowledge gaps list */}
                  {knowledgeGaps.length > 0 && (
                    <div className="mb-8 p-5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          Knowledge Gaps Identified
                        </h3>
                      </div>
                      <ul className="space-y-2.5">
                        {knowledgeGaps.map((gap, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-3 text-slate-700"
                          >
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0",
                                gap.priority >= 3
                                  ? "bg-rose-400"
                                  : gap.priority >= 2
                                    ? "bg-amber-400"
                                    : "bg-emerald-400"
                              )}
                            />
                            <span className="text-sm font-medium">
                              {gap.concept}
                            </span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {gap.questionCount} Q{gap.questionCount !== 1 ? "s" : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Time estimate */}
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
                    <Sparkles className="w-4 h-4" />
                    <span>~5 minutes</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={handleStartQuiz}
                      className="gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8"
                    >
                      Start Quiz
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onSkip}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      Skip
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Question ─────────────────────────────────────────────────── */}
          {phase === "question" && question && (
            <motion.div
              key={`question-${currentQ}`}
              variants={PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={PAGE_TRANSITION}
            >
              <QuizProgressHeader current={currentQ} total={questions.length} />

              <Card className="shadow-lg shadow-slate-200/50 border-0 rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-6 md:p-10">
                  {/* Top row: category + difficulty */}
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      {question.knowledgeGap}
                    </span>
                    <DifficultyBadge difficulty={question.difficulty} />
                  </div>

                  {/* Question stem */}
                  <p className="text-lg font-medium text-slate-900 leading-relaxed mb-8">
                    {question.stem}
                  </p>

                  {/* Options */}
                  <motion.div
                    className="space-y-3"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.05 } },
                      hidden: {},
                    }}
                  >
                    {question.options.map((option, i) => (
                      <motion.div
                        key={i}
                        variants={{
                          hidden: { opacity: 0, y: 8 },
                          visible: { opacity: 1, y: 0 },
                        }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.995 }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedOption(i)}
                          className={cn(
                            "w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150",
                            selectedOption === i
                              ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/10"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors",
                              selectedOption === i
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {OPTION_LETTERS[i]}
                          </span>
                          <span className="text-sm text-slate-700 leading-relaxed pt-1">
                            {option}
                          </span>
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Check Answer button */}
                  <div className="mt-8 flex justify-end">
                    <Button
                      onClick={handleCheckAnswer}
                      disabled={selectedOption === null}
                      className="gap-2 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40"
                    >
                      Check Answer
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Reveal ───────────────────────────────────────────────────── */}
          {phase === "reveal" && question && (
            <motion.div
              key={`reveal-${currentQ}`}
              variants={PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={PAGE_TRANSITION}
            >
              <QuizProgressHeader current={currentQ} total={questions.length} />

              <Card className="shadow-lg shadow-slate-200/50 border-0 rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-6 md:p-10">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      {question.knowledgeGap}
                    </span>
                    <DifficultyBadge difficulty={question.difficulty} />
                  </div>

                  {/* Question stem */}
                  <p className="text-lg font-medium text-slate-900 leading-relaxed mb-8">
                    {question.stem}
                  </p>

                  {/* Revealed options */}
                  <div className="space-y-3">
                    {question.options.map((option, i) => {
                      const isCorrect = i === question.correctIndex;
                      const isSelected = i === selectedOption;
                      const wasWrong = isSelected && !isCorrect;

                      return (
                        <div
                          key={i}
                          className={cn(
                            "w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all",
                            isCorrect
                              ? "border-emerald-500 bg-emerald-50"
                              : wasWrong
                                ? "border-rose-500 bg-rose-50"
                                : "border-slate-100 bg-slate-50/50 opacity-60"
                          )}
                        >
                          <span
                            className={cn(
                              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                              isCorrect
                                ? "bg-emerald-500 text-white"
                                : wasWrong
                                  ? "bg-rose-500 text-white"
                                  : "bg-slate-100 text-slate-400"
                            )}
                          >
                            {OPTION_LETTERS[i]}
                          </span>
                          <span
                            className={cn(
                              "text-sm leading-relaxed pt-1 flex-1",
                              isCorrect
                                ? "text-emerald-800 font-medium"
                                : wasWrong
                                  ? "text-rose-800"
                                  : "text-slate-500"
                            )}
                          >
                            {option}
                          </span>
                          {isCorrect && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-1" />
                          )}
                          {wasWrong && (
                            <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.4, ease: TRANSITION_EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 p-5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-4 h-4 text-slate-500" />
                        <h4 className="text-sm font-semibold text-slate-700">
                          Explanation
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {question.explanation}
                      </p>
                    </div>
                  </motion.div>

                  {/* Why this question — collapsible */}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowWeaknessLink((v) => !v)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <Target className="w-4 h-4" />
                      Why this question?
                      <motion.span
                        animate={{ rotate: showWeaknessLink ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.span>
                    </button>

                    <AnimatePresence>
                      {showWeaknessLink && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: TRANSITION_EASE }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                            <p className="text-sm text-amber-800 leading-relaxed">
                              {question.weaknessLink}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Next / See Results */}
                  <div className="mt-8 flex justify-end">
                    <Button
                      onClick={handleNextQuestion}
                      className="gap-2 bg-slate-900 hover:bg-slate-800 text-white"
                    >
                      {currentQ < questions.length - 1
                        ? "Next Question"
                        : "See Results"}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Results ──────────────────────────────────────────────────── */}
          {phase === "results" && (
            <motion.div
              key="results"
              variants={PAGE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={PAGE_TRANSITION}
              className="space-y-5"
            >
              {/* Score improvement hero card */}
              <Card className="shadow-lg shadow-slate-200/50 border-0 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  {caseTitle && (
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-4">
                      {caseTitle}
                    </p>
                  )}

                  {/* Score improvement visualization */}
                  <div className="flex items-center justify-center gap-4 sm:gap-8 mb-6">
                    <div className="text-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
                        Case Score
                      </p>
                      <p className="text-3xl sm:text-4xl font-bold text-slate-400 tracking-tighter">
                        {caseScore}<span className="text-lg text-slate-600">%</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                        className="p-2 rounded-full bg-emerald-500/20"
                      >
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      </motion.div>
                      <span className="text-xs font-bold text-emerald-400">+{knowledgeRecovery}</span>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
                        After Quiz
                      </p>
                      <motion.p
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                        className="text-3xl sm:text-4xl font-bold text-emerald-400 tracking-tighter"
                      >
                        {reinforcedScore}<span className="text-lg text-emerald-600">%</span>
                      </motion.p>
                    </div>
                  </div>

                  {/* Quiz score bar */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Quiz</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          scorePercent >= 80
                            ? "bg-emerald-400"
                            : scorePercent >= 50
                              ? "bg-amber-400"
                              : "bg-rose-400"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${scorePercent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white">{score}/{total}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Question breakdown card */}
              <Card className="shadow-lg shadow-slate-200/50 border-0 rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <Sparkles className="w-5 h-5 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      Question Breakdown
                    </h3>
                  </div>

                  <div className="rounded-xl border border-slate-100 overflow-hidden mb-6">
                    <div className="divide-y divide-slate-50">
                      {questions.map((q, i) => {
                        const answer = answers[i];
                        const wasCorrect = answer?.correct ?? false;
                        return (
                          <div
                            key={q.id}
                            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 hover:bg-slate-50/50 transition-colors"
                          >
                            <span className="text-sm font-medium text-slate-400 w-7 flex-shrink-0">
                              Q{i + 1}
                            </span>
                            {wasCorrect ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                            )}
                            <DifficultyBadge difficulty={q.difficulty} />
                            <span className="text-xs sm:text-sm text-slate-600 ml-auto text-right truncate min-w-0 flex-shrink">
                              {q.knowledgeGap}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Knowledge gaps summary */}
                  {knowledgeGaps.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-6">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Knowledge Gaps Targeted
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {knowledgeGaps.map((gap, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600"
                          >
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              i === 0 ? "bg-rose-400" : i === 1 ? "bg-amber-400" : "bg-emerald-400"
                            )} />
                            {gap.concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guest mode CTA */}
                  {guestMode && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          Save your progress
                        </p>
                        <p className="text-xs text-slate-500">
                          Create a free account to track your knowledge gaps and
                          earn XP.
                        </p>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        className="rounded-full bg-violet-600 hover:bg-violet-700 text-white px-5 flex-shrink-0 shadow-sm"
                      >
                        <Link href="/signup">Create Free Account</Link>
                      </Button>
                    </div>
                  )}

                  {/* Bottom actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {onViewFeedback && (
                      <Button
                        variant="outline"
                        onClick={onViewFeedback}
                        className="gap-2 text-slate-600 order-3 sm:order-1"
                      >
                        <Eye className="w-4 h-4" />
                        Review Feedback
                      </Button>
                    )}
                    {!guestMode && (
                      <Button
                        variant="ghost"
                        onClick={onExit}
                        className="gap-2 text-slate-500 order-2 sm:order-2"
                      >
                        <Home className="w-4 h-4" />
                        Dashboard
                      </Button>
                    )}
                    <Button
                      onClick={onReset || (() => window.location.reload())}
                      className="gap-2 bg-slate-900 hover:bg-slate-800 text-white order-1 sm:order-3 sm:ml-auto"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Re-attempt Case
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
