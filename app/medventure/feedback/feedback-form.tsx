"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2 } from "lucide-react"
import { RATINGS, STUDY_YEARS, TEXT_LIMIT, type Feedback, type RatingKey } from "@/lib/events/feedback"
import { sendMedventureFeedbackAction } from "./actions"

const WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"]
const chip = (on: boolean) =>
  `rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4b8f74] ${on ? "border-[#376c55] bg-[#376c55] text-white" : "border-[#c9ddd0] bg-white text-[#264a37] hover:border-[#4b8f74]"}`
const area = "mt-2 w-full rounded-xl border border-[#c9ddd0] bg-white px-3 py-2.5 text-[15px] leading-relaxed text-[#16261d] outline-none placeholder:text-[#8aa094] focus:border-[#4b8f74] focus:ring-2 focus:ring-[#d9f2e2]"

export function FeedbackForm({ initial }: { initial: Feedback | null }) {
  const [form, setForm] = useState<Partial<Feedback>>(initial ?? {})
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = <K extends keyof Feedback>(key: K, value: Feedback[K] | null) => setForm((f) => ({ ...f, [key]: value }))

  const send = () => start(async () => {
    setError(null)
    const result = await sendMedventureFeedbackAction(form)
    if (!result.ok) { setError(result.error); return }
    setSent(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  })

  if (sent) {
    return (
      <section className="mt-8 rounded-2xl border border-[#9fc9ae] bg-[#eaf6ed] p-6">
        <CheckCircle2 className="h-8 w-8 text-[#376c55]" />
        <h2 className="mt-3 text-xl font-semibold text-[#173c2d]">Thank you. Your feedback is in.</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#466657]">Your five days of MediKarya Intern carry on after today: try more patients from your dashboard.</p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/dashboard/cases" className="rounded-lg bg-[#376c55] px-4 py-2.5 text-white hover:bg-[#285640]">More patients</Link>
          <button type="button" onClick={() => setSent(false)} className="text-[#376c55] hover:underline">Change my answers</button>
        </div>
      </section>
    )
  }

  return (
    <form className="mt-8 space-y-8" onSubmit={(e) => { e.preventDefault(); send() }}>
      {RATINGS.map((r) => (
        <fieldset key={r.key}>
          <legend className="text-[15px] font-semibold text-[#173c2d]">{r.label}{r.required && <span className="ml-1.5 text-xs font-medium text-[#74877b]">needed</span>}</legend>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={r.label}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = form[r.key as RatingKey] === n
              return (
                <button key={n} type="button" role="radio" aria-checked={on} className={chip(on)} onClick={() => set(r.key as RatingKey, on && !r.required ? null : n)}>
                  {n} <span className="font-medium opacity-80">· {WORDS[n - 1]}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className="text-[15px] font-semibold text-[#173c2d]">How likely are you to recommend MediKarya to a classmate?</legend>
        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11" role="radiogroup" aria-label="Recommend, 0 to 10">
          {Array.from({ length: 11 }, (_, n) => {
            const on = form.recommend === n
            return <button key={n} type="button" role="radio" aria-checked={on} className={`${chip(on)} px-0 tabular-nums`} onClick={() => set("recommend", on ? null : n)}>{n}</button>
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-[#74877b]"><span>0 · Not at all</span><span>10 · Definitely</span></div>
      </fieldset>

      <fieldset>
        <legend className="text-[15px] font-semibold text-[#173c2d]">Your year</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {STUDY_YEARS.map((y) => {
            const on = form.studyYear === y
            return <button key={y} type="button" aria-pressed={on} className={chip(on)} onClick={() => set("studyYear", on ? null : y)}>{y}</button>
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-[15px] font-semibold text-[#173c2d]">What did you like most?</span>
        <textarea id="feedback-liked" className={`${area} min-h-24`} maxLength={TEXT_LIMIT} value={form.liked ?? ""} onChange={(e) => set("liked", e.target.value)} placeholder="Optional" />
      </label>

      <label className="block">
        <span className="text-[15px] font-semibold text-[#173c2d]">What should we improve?</span>
        <textarea id="feedback-improve" className={`${area} min-h-24`} maxLength={TEXT_LIMIT} value={form.improve ?? ""} onChange={(e) => set("improve", e.target.value)} placeholder="Anything that was confusing, slow or missing" />
      </label>

      <label className="flex items-start gap-2.5 text-sm leading-relaxed text-[#466657]">
        <input id="feedback-contact" type="checkbox" className="mt-1 h-4 w-4 accent-[#376c55]" checked={form.contactOk === true} onChange={(e) => set("contactOk", e.target.checked)} />
        <span>MediKarya may email me about new cases and future events. You can say no and still send this form.</span>
      </label>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <button type="submit" disabled={pending || !form.overall} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#376c55] px-4 py-3 text-[15px] font-semibold text-white hover:bg-[#285640] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Send feedback
      </button>
    </form>
  )
}
