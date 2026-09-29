"use client"

// The reviewer's side of /review/[token]: who they are, whether they may be named on the case, and their decision.

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2, PenLine } from "lucide-react"
import { submitReview, type ReviewResult } from "./actions"

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"

export function ReviewForm({ token }: { token: string }) {
  const [form, setForm] = useState({ name: "", designation: "", department: "", institution: "", showName: false, comments: "" })
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [pending, start] = useTransition()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value })

  const send = (decision: "approved" | "changes_requested") =>
    start(async () => setResult(await submitReview(token, { decision, ...form })))

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
        <p className="flex items-center gap-2 text-[17px] font-bold">
          <CheckCircle2 className="h-5 w-5" /> Thank you, your review is saved.
        </p>
        <p className="mt-1 text-[14.5px]">
          {result.decision === "approved"
            ? "The case is approved. The MediKarya team will publish it shortly."
            : "The team will make the changes you asked for and may send you the revised case."}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-[18px] font-bold text-slate-900">Your review</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[14px] font-medium text-slate-700">
          Full name *
          <input className={field} value={form.name} onChange={set("name")} placeholder="Dr. A. Sharma" autoComplete="name" />
        </label>
        <label className="block text-[14px] font-medium text-slate-700">
          Designation *
          <input className={field} value={form.designation} onChange={set("designation")} placeholder="Associate Professor" />
        </label>
        <label className="block text-[14px] font-medium text-slate-700">
          Department
          <input className={field} value={form.department} onChange={set("department")} placeholder="General Surgery" />
        </label>
        <label className="block text-[14px] font-medium text-slate-700">
          Institution *
          <input className={field} value={form.institution} onChange={set("institution")} placeholder="Medical college" autoComplete="organization" />
        </label>
      </div>
      <label className="flex items-start gap-3 text-[14.5px] text-slate-800">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={form.showName} onChange={set("showName")} />
        Show my name, designation and institution on this case as its clinical reviewer.
      </label>
      <label className="block text-[14px] font-medium text-slate-700">
        Comments <span className="font-normal text-slate-500">(required if you ask for changes: say what is wrong and what it should be)</span>
        <textarea className={`${field} min-h-[110px]`} value={form.comments} onChange={set("comments")} placeholder="e.g. Hb should be around 8 g/dL given the documented pallor; add ultrasound of the scrotum to the core tests." />
      </label>

      {result && !result.ok && <p className="rounded-lg bg-red-50 p-3 text-[14px] text-red-900">{result.error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => send("approved")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve the case
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => send("changes_requested")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-[15px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          <PenLine className="h-4 w-4" /> Ask for changes
        </button>
      </div>
    </form>
  )
}
