"use client"

// The tick-and-send page. Answers save by themselves a moment after each change, and "Send my answers" marks them sent.
// The professor can come back to the same link and change anything.

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { CheckCircle2, ChevronDown, Loader2, Send } from "lucide-react"
import { PROTOCOL_CARDS, type ProtocolCard } from "@/lib/protocol-review/decisions"
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

const answered = (card: ProtocolCard, a: Answer | undefined) => !!a && (card.options ? !!a.choice : !!a.other?.trim())

export function ProtocolForm({ token, initial }: { token: string; initial: Initial }) {
  const [answers, setAnswers] = useState<Answers>(initial.answers)
  const [who, setWho] = useState({ name: initial.name, designation: initial.designation, institution: initial.institution })
  const [submittedAt, setSubmittedAt] = useState<string | null>(initial.submittedAt)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState("")
  const [pending, startSending] = useTransition()
  const dirty = useRef(false)

  const done = PROTOCOL_CARDS.filter((c) => answered(c, answers[c.id])).length

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

  // Save a moment after the last change.
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
      const ok = await save(true)
      if (ok) window.scrollTo({ top: 0, behavior: "smooth" })
    })

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24">
      <div className="py-8">
        <h1 className="text-[26px] leading-tight font-bold text-slate-900">Fluid treatment in severe dengue with shock</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-slate-700">
          {PROTOCOL_CARDS.length} short questions. Tick the answer you agree with. Where the guideline says two different things, both are shown so you can choose. Your answers save as you go, and you can come back to this same link.
        </p>
        <p className="mt-1 text-[14px] text-slate-500">Based on the NCVBDC 2023 National Guidelines for Clinical Management of Dengue Fever (page numbers are the ones printed on the page).</p>

        {submittedAt && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-[15px] font-semibold text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> Thank you. Your answers were sent on {new Date(submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. You can still change them below and send again.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[17px] font-bold text-slate-900">Who is answering</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block text-[14px] font-medium text-slate-700">
            Full name
            <input className={field} value={who.name} onChange={(e) => changeWho("name", e.target.value)} placeholder="Dr. A. Sharma" autoComplete="name" />
          </label>
          <label className="block text-[14px] font-medium text-slate-700">
            Designation
            <input className={field} value={who.designation} onChange={(e) => changeWho("designation", e.target.value)} placeholder="Professor, Medicine" />
          </label>
          <label className="block text-[14px] font-medium text-slate-700">
            Institution
            <input className={field} value={who.institution} onChange={(e) => changeWho("institution", e.target.value)} placeholder="Medical college" autoComplete="organization" />
          </label>
        </div>
      </section>

      <div className="sticky top-0 z-10 -mx-4 mt-6 border-b border-slate-200 bg-slate-50/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between text-[13.5px] text-slate-600">
          <span className="font-semibold text-slate-800">
            {done} of {PROTOCOL_CARDS.length} answered
          </span>
          <span aria-live="polite">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved" : ""}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${(done / PROTOCOL_CARDS.length) * 100}%` }} />
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {PROTOCOL_CARDS.map((card, i) => (
          <Card key={card.id} n={i + 1} card={card} answer={answers[card.id]} onChange={(p) => change(card.id, p)} />
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-[14px] text-red-900">{error}</p>}
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-[16px] font-semibold text-white hover:bg-sky-700 disabled:opacity-60 sm:w-auto"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send my answers
        </button>
        <p className="mt-2 text-[13.5px] text-slate-500">
          {done} of {PROTOCOL_CARDS.length} answered. Anything left blank is fine; you can come back to this link.
        </p>
      </div>
    </div>
  )
}

function Card({ n, card, answer, onChange }: { n: number; card: ProtocolCard; answer: Answer | undefined; onChange: (p: Partial<Answer>) => void }) {
  const [showNote, setShowNote] = useState(!!answer?.note)
  const picked = card.options?.find((o) => o.id === answer?.choice)
  return (
    <article id={card.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${answered(card, answer) ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
          {answered(card, answer) ? "✓" : n}
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] leading-snug font-bold text-slate-900">{card.title}</h2>
          <p className="mt-1.5 text-[15.5px] leading-relaxed font-medium text-slate-800">{card.question}</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{card.why}</p>
        </div>
      </div>

      <details className="group mt-3 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[14px] font-semibold text-slate-700">
          What the guideline says
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <ul className="space-y-2 px-3 pb-3">
          {card.sources.map((s, k) => (
            <li key={k} className="text-[14px] leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900">{s.where}: </span>
              {s.says}
            </li>
          ))}
          {card.notes?.map((t, k) => (
            <li key={`n${k}`} className="text-[14px] leading-relaxed text-slate-600">
              {t}
            </li>
          ))}
        </ul>
      </details>

      {card.options ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">{card.title}</legend>
          {card.options.map((o) => {
            const on = answer?.choice === o.id
            return (
              <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-[15px] leading-snug transition ${on ? "border-sky-500 bg-sky-50 text-slate-900" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"}`}>
                <input type="radio" name={card.id} className="mt-1 h-4 w-4 shrink-0" checked={on} onChange={() => onChange({ choice: o.id })} />
                <span>
                  <span className="mr-1.5 font-semibold">{o.id}.</span>
                  {o.label}
                </span>
              </label>
            )
          })}
          {picked?.other && (
            <label className="block text-[14px] font-medium text-slate-700">
              Please write your answer
              <textarea className={`${field} min-h-[84px]`} value={answer?.other ?? ""} onChange={(e) => onChange({ other: e.target.value })} />
            </label>
          )}
        </fieldset>
      ) : (
        <label className="mt-4 block text-[14px] font-medium text-slate-700">
          {card.prompt}
          <textarea className={`${field} min-h-[110px]`} value={answer?.other ?? ""} onChange={(e) => onChange({ other: e.target.value })} placeholder="Type your answer" />
        </label>
      )}

      {showNote ? (
        <label className="mt-3 block text-[14px] font-medium text-slate-700">
          Note (optional)
          <textarea className={`${field} min-h-[70px]`} value={answer?.note ?? ""} onChange={(e) => onChange({ note: e.target.value })} />
        </label>
      ) : (
        <button type="button" onClick={() => setShowNote(true)} className="mt-3 text-[14px] font-medium text-sky-700 hover:underline">
          Add a note
        </button>
      )}
    </article>
  )
}
