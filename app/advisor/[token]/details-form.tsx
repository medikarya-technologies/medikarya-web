"use client"

// The first thing an advisor sees: who are you? No account and no password, just what we would put beside their name.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { enterAdvisorLink } from "./actions"
import type { AdvisorDetails } from "@/lib/advisors/invites"

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"

export function AdvisorDetailsForm({ token, initial, returning }: { token: string; initial: AdvisorDetails; returning: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState<AdvisorDetails>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = (k: keyof AdvisorDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value })

  const enter = () =>
    start(async () => {
      setError(null)
      const r = await enterAdvisorLink(token, form)
      if (!r.ok) setError(r.error)
      else router.refresh()
    })

  return (
    <form onSubmit={(e) => { e.preventDefault(); enter() }} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-[18px] font-bold text-slate-900">{returning ? "Confirm your details to continue" : "First, who are you?"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[14px] font-medium text-slate-700">
          Full name *
          <input className={field} value={form.name} onChange={set("name")} placeholder="Dr. A. Sharma" autoComplete="name" />
        </label>
        <label className="block text-[14px] font-medium text-slate-700">
          Designation *
          <input className={field} value={form.designation} onChange={set("designation")} placeholder="Professor" />
        </label>
        <label className="block text-[14px] font-medium text-slate-700">
          Department
          <input className={field} value={form.department} onChange={set("department")} placeholder="General Medicine" />
        </label>
        <label className="block text-[14px] font-medium text-slate-700">
          Institution *
          <input className={field} value={form.institution} onChange={set("institution")} placeholder="Medical college or hospital" autoComplete="organization" />
        </label>
      </div>
      <label className="flex items-start gap-3 text-[14.5px] text-slate-800">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={form.listName} onChange={set("listName")} />
        <span>
          If I join MediKarya&apos;s Clinical Advisory Board, you may show my name, designation and institution on the website.
          <span className="block text-[13px] text-slate-500">Optional. Nothing is shown unless we ask you first and you join.</span>
        </span>
      </label>

      {error && <p className="rounded-lg bg-red-50 p-3 text-[14px] text-red-900">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-[15px] font-semibold text-white hover:bg-sky-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {returning ? "Continue" : "Open the cases"} <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-[13px] text-slate-500">
        These are training simulations, not medical guidance. What you do in a case is saved so we can show you your result and learn from it.
      </p>
    </form>
  )
}
