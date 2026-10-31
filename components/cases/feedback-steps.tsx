"use client";

// The classic step-by-step review chrome, shared by the standard case feedback and the
// simulation debrief so both read as one product: progress header, one card per step,
// Back / Next, and the closing calls to action.
//
// Redesigned this round to actually match the rest of the app instead of a generic
// white-card-on-slate template: enc-* tokens throughout (so this also now works correctly
// in dark mode, same as every other dashboard screen — it never did before, since slate-*/
// emerald-*/rose-* are fixed colours with no dark-mode counterpart), brand-600 as the one
// forward-action colour instead of a neutral slate-900 "next" button that made every step
// feel like a generic wizard rather than this specific product.

import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Brain, CheckCircle2, CircleAlert, Flag, RotateCcw, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreBand } from "@/lib/library/case-library";

// ─── Lightweight markdown renderer for walkthrough text ──────────────────────
// Handles: ### headings, **bold**, * bullet lists, blank-line paragraphs
export function WalkthroughMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let paraBuffer: string[] = [];
  let bulletBuffer: string[] = [];

  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    const raw = paraBuffer.join(" ").trim();
    if (raw) elements.push(
      <p key={elements.length} className="text-enc-ink-2 leading-relaxed mb-1">
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
          <li key={i} className="flex gap-2.5 text-enc-ink-2 leading-relaxed">
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
        ? <strong key={i} className="font-semibold text-enc-ink">{p.slice(2, -2)}</strong>
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
        <h3 key={elements.length} className="text-base font-bold text-enc-ink mt-5 mb-2 first:mt-0">
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
        <h2 key={elements.length} className="text-lg font-bold text-enc-ink mt-6 mb-2 first:mt-0">
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
        <h1 key={elements.length} className="text-xl font-bold text-enc-ink mt-6 mb-3 first:mt-0">
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

export function ProgressHeader({ step, total, onReport }: { step: number; total: number; onReport?: () => void }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 text-sm font-medium text-enc-ink-3">
        <span>Debrief</span>
        <span className="flex items-center gap-3">
          <span>Step {step + 1} of {total}</span>
          {onReport && (
            <button
              type="button"
              onClick={onReport}
              title="Report a problem with this case"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-enc-ink-3 outline-none hover:bg-enc-desk hover:text-enc-ink focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Flag className="h-3 w-3" /> Report
            </button>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-enc-line overflow-hidden">
        <motion.div
          className="h-full bg-brand-600"
          initial={{ width: 0 }}
          animate={{ width: `${((step + 1) / total) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

export function Nav({ onPrev, onNext, isFirst, isLast, onExit, onReset, onQuizStart, mode, guestMode }: {
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
  const back = (
    <Button
      variant="outline"
      onClick={onPrev}
      disabled={isFirst}
      className="gap-2 border-enc-line-strong text-enc-ink-2 hover:bg-enc-desk"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </Button>
  );

  if (!isLast) {
    return (
      <div className="flex items-center justify-between mt-10">
        {back}
        <Button onClick={onNext} className="gap-2 bg-brand-600 hover:bg-brand-700 text-white">
          Next <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // The last step: the offers stack full width first, then one row with Back on the left and the ways out on the
  // right. (They used to share a row with Back, which pushed Back halfway down the quiz card.)
  return (
    <div className="mt-10 space-y-4">
      {/* The quiz is the one thing on this step worth doing before you leave, so it is the boldest thing here. */}
      {onQuizStart && mode !== 'history' && (
        <div className="rounded-2xl bg-brand-600 p-5 shadow-enc-lift sm:p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                <Brain className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-bold leading-tight text-white">Five questions from this case</p>
                <p className="mt-1 text-sm text-brand-100">NEET PG style, aimed at where this attempt was weakest.</p>
              </div>
            </div>
            <Button
              onClick={onQuizStart}
              size="lg"
              className="w-full shrink-0 gap-1.5 rounded-full bg-white px-6 font-bold text-brand-700 hover:bg-brand-50 sm:w-auto"
            >
              Start the quiz <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      {guestMode && (
        <div className="p-4 rounded-xl bg-brand-50 border border-brand-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-enc-ink">Enjoyed this case?</p>
            <p className="text-xs text-enc-ink-2">Create a free account to open more cases, track your progress and earn XP.</p>
          </div>
          <Button asChild size="sm" className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-5 flex-shrink-0 shadow-sm">
            <Link href="/signup">Create a free account</Link>
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pt-2">
        {back}
        <div className="flex gap-2">
          {!guestMode && (
            <Button variant="ghost" onClick={onExit} className="gap-2 text-enc-ink-2 hover:bg-enc-desk hover:text-enc-ink">
              <Home className="w-4 h-4" /> Dashboard
            </Button>
          )}
          <Button onClick={onReset || (() => window.location.reload())} className="gap-2 bg-brand-600 hover:bg-brand-700 text-white">
            <RotateCcw className="w-4 h-4" /> {mode === 'history' ? 'Try the case again' : 'Try again'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-enc-line bg-enc-sheet shadow-enc-lift">
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-enc-line bg-enc-console text-enc-ink-2">
            <Icon className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-enc-ink tracking-tight">{title}</h2>
        </div>
        <div className="text-enc-ink-2 leading-relaxed text-[14px]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Pieces both debriefs use ─────────────────────────────────────────────────
// Labels are sentence case at reading size, not tracked capitals: the rest of the app (the encounter, the diagnosis
// form, the library) labels things that way, and a screen of small capitals reads as a template, not as this product.

/** A small label above a value or a list. */
export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mb-1 text-[12px] font-semibold text-enc-ink-3", className)}>{children}</p>;
}

/** A sub-section inside a step, set off by a rule. */
export function SubHeading({ children, icon: Icon, tone = "text-enc-ink" }: { children: React.ReactNode; icon: React.ElementType; tone?: string }) {
  return (
    <h3 className={cn("mb-3 mt-6 flex items-center gap-2 border-t border-enc-line pt-6 text-[14px] font-semibold", tone)}>
      <Icon className="h-4 w-4 shrink-0" /> {children}
    </h3>
  );
}

/** Step one: the student's diagnosis against the case's, with the verdict said in words as well as colour. */
export function DiagnosisCompare({ yours, actual, correct }: { yours?: string; actual: string; correct: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-enc-line">
      <div className="bg-enc-desk p-4">
        <Kicker>Your diagnosis</Kicker>
        <p className={cn("text-base font-medium", yours ? "text-enc-ink" : "text-enc-ink-3")}>{yours || "No diagnosis given"}</p>
      </div>
      <div className="border-t border-enc-line bg-enc-sheet p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Kicker className="mb-0">The diagnosis</Kicker>
          {correct ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-enc-ok-soft px-2 py-0.5 text-[12px] font-semibold text-enc-ok">
              <CheckCircle2 className="h-3.5 w-3.5" /> Correct
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-enc-warn-soft px-2 py-0.5 text-[12px] font-semibold text-enc-warn">
              <CircleAlert className="h-3.5 w-3.5" /> Not a match
            </span>
          )}
        </div>
        <p className="mt-1 text-base font-semibold text-enc-ink">{actual}</p>
      </div>
    </div>
  );
}

const BAND_BAR: Record<string, string> = { ok: "bg-enc-ok", warn: "bg-enc-warn", crit: "bg-enc-crit" };

/** One scored area: its name, the points, and a bar coloured by the same bands the library uses. */
export function ScoreRow({ label, icon: Icon, score, max }: { label: string; icon: React.ElementType; score: number; max: number }) {
  const value = Number.isFinite(score) ? score : 0;
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  // Areas are worth different points (history 25, management 10), so a whole number reads cleaner where it is one.
  const shown = Number.isInteger(value) ? value : value.toFixed(1);
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-sm font-medium text-enc-ink-2">
          <Icon className="h-4 w-4 shrink-0 text-enc-ink-3" /> {label}
        </span>
        <span className="text-sm tabular-nums">
          <span className="font-bold text-enc-ink">{shown}</span>
          <span className="text-enc-ink-3"> / {max}</span>
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-enc-line">
        <div className={cn("h-full rounded-full", BAND_BAR[scoreBand(pct)])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Simple celebration component using framer-motion
export function Celebration() {
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
