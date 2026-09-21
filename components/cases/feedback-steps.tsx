"use client";

// The classic step-by-step review chrome, shared by the standard case feedback and the
// simulation debrief so both read as one product: progress header, one card per step,
// Back / Next, and the closing calls to action.

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Brain, Flag, RotateCcw, Home } from "lucide-react";

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

export function ProgressHeader({ step, total, onReport }: { step: number; total: number; onReport?: () => void }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 text-sm font-medium text-slate-500">
        <span>Clinical Reasoning Replay</span>
        <span className="flex items-center gap-3">
          <span>Step {step + 1} of {total}</span>
          {onReport && (
            <button
              type="button"
              onClick={onReport}
              title="Report a problem with this case"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Flag className="h-3 w-3" /> Report
            </button>
          )}
        </span>
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

export function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
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
