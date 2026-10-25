"use client"

// The short follow-up page (lib/protocol-review/short.ts): the case and the flowchart with the professor's first
// answers already in, then a handful of tick-box questions. Saves by itself like the long form; "Send" marks it sent.

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import { SHORT_CARDS, SHORT_CASE, type ShortCard } from "@/lib/protocol-review/short"
import type { CaseView } from "@/lib/protocol-review/case-view"
import { CasePanel } from "./case-panel"
import { Flowchart } from "./flowchart"
import type { Answer, Answers } from "@/lib/protocol-review/answers"
import { saveAnswers } from "./actions"

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"

interface Initial {
  answers: Answers
  name: string
  designation: string
  institution: string
  submittedAt: string | null
}

const ticked = (a: Answer | undefined) => new Set((a?.choice ?? "").split(",").filter(Boolean))

export function ShortForm({ token, initial, caseView }: { token: string; initial: Initial; caseView: CaseView | null }) {
  const [answers, setAnswers] = useState<Answers>(initial.answers)
  const [who, setWho] = useState({ name: initial.name, designation: initial.designation, institution: initial.institution })
  const [submittedAt, setSubmittedAt] = useState<string | null>(initial.submittedAt)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState("")
  const [pending, startSending] = useTransition()
  const dirty = useRef(false)

  const done = SHORT_CARDS.filter((c) => !!answers[c.id]?.choice).length
  // Worked out from what was saved when the page opened, so the list does not jump while he ticks.
  const [open] = useState(() => SHORT_CARDS.filter((c) => !initial.answers[c.id]?.choice))

  const save = useCallback(
    async (submit: boolean) => {
      setStatus("saving")
      const r = await saveAnswers(token, answers, who, submit)
      if (r.ok) {
        setStatus("saved")
        setError("")
        if (r.submitted && submit) setSubmittedAt(r.savedAt)
        return true
      }
      setStatus("error")
      setError(r.error)
      return false
    },
    [token, answers, who]
  )

  useEffect(() => {
    if (!dirty.current) return
    const t = window.setTimeout(() => void save(false), 900)
    return () => window.clearTimeout(t)
  }, [answers, who, save])

  const change = (id: string, patch: Partial<Answer>) => {
    dirty.current = true
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }
  const changeWho = (k: keyof typeof who, v: string) => {
    dirty.current = true
    setWho((prev) => ({ ...prev, [k]: v }))
  }
  const send = () =>
    startSending(async () => {
      if (await save(true)) window.scrollTo({ top: 0, behavior: "smooth" })
    })

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <div className="py-8">
        <h1 className="text-[26px] leading-tight font-bold text-slate-900">Dengue shock case: a few last questions</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-slate-700">
          Thank you for your first answers. This page has three parts. Your answers are already built into the case and the flowchart; only the last part needs you, and it is just ticks.
        </p>
        <nav className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["#case", "1. The case", "as students see it"],
            ["#flowchart", "2. Treatment flowchart", "with your answers in"],
            ["#questions", `3. ${SHORT_CARDS.length} quick questions`, "about five minutes"],
          ].map(([href, t, sub]) => (
            <a key={href} href={href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-sky-400">
              <span className="block text-[15px] font-bold text-sky-700">{t}</span>
              <span className="block text-[13px] text-slate-500">{sub}</span>
            </a>
          ))}
        </nav>
        {open.length > 0 && submittedAt ? (
          // He has sent once: show only what is still unanswered, each a link to its question.
          <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3">
            <p className="text-[15.5px] font-bold text-amber-950">Thank you for your answers. {open.length === 1 ? "One question is" : `${open.length} questions are`} still open:</p>
            <ul className="mt-1.5 space-y-1">
              {open.map((c) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="text-[15px] font-medium text-sky-800 underline">{SHORT_CARDS.indexOf(c)}. {c.question}</a>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[14px] text-amber-900">{open.length === 1 ? "Tick it" : "Tick these"} and press Send at the bottom. Everything else is already saved.</p>
          </div>
        ) : submittedAt ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-[15px] font-semibold text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> Thank you. Sent on {new Date(submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. You can still change anything and send again.
          </p>
        ) : null}
      </div>

      <section id="case" className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[20px] font-bold text-slate-900">1. The case</h2>
        {caseView && <p className="mt-0.5 text-[14px] text-slate-500">{caseView.title}</p>}
        <div className="mt-3 rounded-lg bg-sky-50 p-4">
          <h3 className="text-[15px] font-bold text-slate-900">{SHORT_CASE.title}</h3>
          <ul className="mt-1.5 space-y-1">
            {SHORT_CASE.lines.map((l, i) => (
              <li key={i} className={`text-[15px] leading-relaxed ${i === SHORT_CASE.lines.length - 1 ? "font-semibold text-slate-900" : "text-slate-700"}`}>{l}</li>
            ))}
          </ul>
        </div>
        <div className="mt-4">
          {caseView ? <CasePanel view={caseView} /> : <p className="text-[14px] text-slate-600">The full case could not be loaded just now. Please refresh the page.</p>}
        </div>
      </section>

      <section id="flowchart" className="scroll-mt-4 mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[20px] font-bold text-slate-900">2. Treatment flowchart</h2>
        <p className="mt-1 text-[14px] text-slate-600">From the NCVBDC 2023 dengue guideline (Figures 12 and 13), with your first answers built in. Amber boxes follow the guideline for now and are waiting for your confirmation in the questions below.</p>
        <div className="mt-5">
          <Flowchart />
        </div>
      </section>

      <h2 id="questions" className="scroll-mt-4 mt-8 text-[20px] font-bold text-slate-900">3. Quick questions</h2>
      <p className="mt-1 text-[14px] text-slate-600">Tick one answer each (or all that apply where it says so). Anything you are unsure of, tick "discuss when we meet".</p>

      <div className="sticky top-0 z-10 -mx-4 mt-3 border-b border-slate-200 bg-slate-50/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between text-[13.5px] text-slate-600">
          <span className="font-semibold text-slate-800">{done} of {SHORT_CARDS.length} answered</span>
          <span aria-live="polite">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved" : ""}</span>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {SHORT_CARDS.map((card, i) => (
          <Question key={card.id} n={i} card={card} answer={answers[card.id]} onChange={(p) => change(card.id, p)} />
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-[15px] font-semibold text-slate-900">
          Anything to change or add? (optional)
          <textarea className={`${field} min-h-[90px] font-normal`} value={answers.S0?.note ?? ""} onChange={(e) => change("S0", { note: e.target.value })} />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-[14px] font-medium text-slate-700">
            Name
            <input className={field} value={who.name} onChange={(e) => changeWho("name", e.target.value)} autoComplete="name" />
          </label>
          <label className="block text-[14px] font-medium text-slate-700">
            Designation
            <input className={field} value={who.designation} onChange={(e) => changeWho("designation", e.target.value)} />
          </label>
          <label className="block text-[14px] font-medium text-slate-700">
            Institution
            <input className={field} value={who.institution} onChange={(e) => changeWho("institution", e.target.value)} autoComplete="organization" />
          </label>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-[14px] text-red-900">{error}</p>}
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-[16px] font-semibold text-white hover:bg-sky-700 disabled:opacity-60 sm:w-auto"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </button>
        <p className="mt-2 text-[13.5px] text-slate-500">Anything left blank is fine. We will go through the rest when we meet.</p>
      </section>
    </div>
  )
}

function Question({ n, card, answer, onChange }: { n: number; card: ShortCard; answer: Answer | undefined; onChange: (p: Partial<Answer>) => void }) {
  const on = ticked(answer)
  const toggle = (id: string) => {
    if (!card.multi) return onChange({ choice: id })
    const next = new Set(on)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ choice: card.options.map((o) => o.id).filter((x) => next.has(x)).join(",") })
  }
  return (
    <article id={card.id} className={`scroll-mt-16 rounded-xl border bg-white p-5 shadow-sm ${on.size === 0 ? "border-amber-300" : "border-slate-200"}`}>
      <p className="text-[16px] leading-snug font-semibold text-slate-900">
        <span className="mr-2 text-slate-400">{n === 0 ? "★" : n}</span>
        {card.question}
      </p>
      {card.hint && <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{card.hint}</p>}
      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">{card.question}</legend>
        {card.options.map((o) => (
          <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-[15px] leading-snug transition ${on.has(o.id) ? "border-sky-500 bg-sky-50 text-slate-900" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"}`}>
            <input type={card.multi ? "checkbox" : "radio"} name={card.id} className="mt-1 h-4 w-4 shrink-0" checked={on.has(o.id)} onChange={() => toggle(o.id)} />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
    </article>
  )
}
