"use client"

// The working part of Admin → Workshop passes: give a batch, see who has signed up, add late registrations, remove one.

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Award, Check, Copy, Loader2, Plus, Ticket, Trash2, Trophy } from "lucide-react"
import { PLAN_NAME, indiaDay } from "@/lib/plans/limits"
import { PASS_LIMITS, parseEmails, passWindow } from "@/lib/plans/passes"
import type { PassBatch } from "@/lib/plans/pass-batches"
import { givePassesAction, removeBatchAction } from "./actions"

const LABEL = "text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"
const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
const quiet = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"

const day = (at: Date | string, year = true) =>
  new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "Asia/Kolkata" })
const longDay = (at: Date) => at.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
/** A pass ends at midnight; the last day it covers is the one before. */
const lastDay = (endsAt: Date | string) => new Date(new Date(endsAt).getTime() - 1)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function status(b: PassBatch): { text: string; tone: string } {
  const now = Date.now()
  if (now < Date.parse(b.startsAt)) return { text: `Starts ${day(b.startsAt, false)}`, tone: "bg-amber-50 text-amber-800" }
  if (now < Date.parse(b.endsAt)) return { text: `Running · last day ${day(lastDay(b.endsAt), false)}`, tone: "bg-emerald-50 text-emerald-800" }
  return { text: "Ended", tone: "bg-slate-100 text-slate-600" }
}

const EMPTY = { name: "", plan: "intern" as "intern" | "resident", days: 14, emails: "" }

export function PassesAdmin({ batches, today }: { batches: PassBatch[]; today: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY, startDay: today })

  const parsed = useMemo(() => parseEmails(form.emails), [form.emails])
  const span = passWindow(form.startDay, form.days)
  const ready = form.name.trim().length >= 3 && parsed.valid.length > 0 && !!span && form.days >= PASS_LIMITS.minDays && form.days <= PASS_LIMITS.maxDays

  const give = () => {
    if (!span) return
    const sure = span.startsAt.getTime() < Date.now() - 86_400_000 ? "\n\nThe start day is in the past: the pass will have fewer days left." : ""
    if (!window.confirm(`Give ${plural(parsed.valid.length, "student")} ${PLAN_NAME[form.plan]} from ${day(span.startsAt)} to ${day(lastDay(span.endsAt))}?${sure}`)) return
    start(async () => {
      setBusy("give")
      setError(null)
      setNotice(null)
      const r = await givePassesAction({ name: form.name, plan: form.plan, startDay: form.startDay, days: form.days, emailsText: form.emails })
      setBusy(null)
      if (!r.ok) return setError(r.error)
      const parts = [
        r.given ? `Given to ${plural(r.given, "student")}.` : "No new passes: everyone on the list already has this one.",
        r.already ? `${plural(r.already, "email")} already had it.` : "",
        `Signed up already: ${r.withAccount} of ${r.given + r.already}.${r.withAccount < r.given + r.already ? " The rest get the plan when they sign up with that email." : ""}`,
        r.invalid.length ? `Skipped, not emails: ${r.invalid.join(", ")}.` : "",
      ]
      setNotice(parts.filter(Boolean).join(" "))
      setForm({ ...form, emails: "" })
      router.refresh()
    })
  }

  const remove = (b: PassBatch) => {
    if (!window.confirm(`Remove the pass “${b.name}” from all ${b.emails.length} students? Anyone using it goes back to their own plan at once.`)) return
    start(async () => {
      setBusy(b.reason)
      setError(null)
      setNotice(null)
      const r = await removeBatchAction(b.reason)
      setBusy(null)
      if (!r.ok) return setError(r.error)
      setNotice(`Removed “${b.name}” (${plural(r.removed, "pass", "passes")}).`)
      router.refresh()
    })
  }

  const copyMissing = async (b: PassBatch) => {
    const missing = b.emails.filter((e) => !b.withAccount.includes(e))
    try {
      await navigator.clipboard.writeText(missing.join("\n"))
      setCopied(b.reason)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError("Could not copy. Your browser blocked the clipboard.")
    }
  }

  const addMore = (b: PassBatch) => {
    setForm({ name: b.name, plan: b.plan, startDay: indiaDay(new Date(b.startsAt)), days: b.days, emails: "" })
    document.getElementById("new-pass")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="mt-8 space-y-10">
      {error && <p className="rounded-lg bg-red-50 p-3 text-[14.5px] text-red-900">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-[14.5px] text-emerald-900">{notice}</p>}

      {/* ── a new batch ── */}
      <section id="new-pass" className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-100/70 px-5 py-3.5">
          <p className={LABEL}>New pass</p>
          <h2 className="text-[19px] font-bold text-slate-900">Give a workshop pass</h2>
          <p className="mt-0.5 text-[14px] text-slate-600">
            To add late registrations to a batch you already gave, use “Add emails” on it below: everyone already in it is skipped.
          </p>
        </header>
        <div className="space-y-4 px-5 py-5">
          <label className="block text-[14px] font-medium text-slate-700">
            Event name
            <input
              className={`${field} block sm:max-w-md`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. the MAMC workshop"
              maxLength={PASS_LIMITS.nameChars}
            />
            <span className="mt-1 block text-[12.5px] font-normal text-slate-500">
              Students see it under their plan: “Free until {span ? longDay(lastDay(span.endsAt)) : "…"}, with your pass from{" "}
              {form.name.trim() || "the MAMC workshop"}”.
            </span>
          </label>

          <div className="flex flex-wrap gap-4">
            <fieldset>
              <legend className="text-[14px] font-medium text-slate-700">Plan</legend>
              <div className="mt-1 flex gap-2">
                {(["intern", "resident"] as const).map((p) => (
                  <label key={p} className={`cursor-pointer rounded-lg border px-3 py-2 text-[14.5px] font-semibold ${form.plan === p ? "border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-500" : "border-slate-300 text-slate-700 hover:border-slate-400"}`}>
                    <input type="radio" name="plan" className="sr-only" checked={form.plan === p} onChange={() => setForm({ ...form, plan: p })} />
                    {PLAN_NAME[p]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-[14px] font-medium text-slate-700">
              Starts on
              <input type="date" className={field} value={form.startDay} onChange={(e) => setForm({ ...form, startDay: e.target.value })} />
            </label>
            <label className="block w-32 text-[14px] font-medium text-slate-700">
              Days
              <input
                type="number"
                min={PASS_LIMITS.minDays}
                max={PASS_LIMITS.maxDays}
                className={field}
                value={form.days}
                onChange={(e) => setForm({ ...form, days: Math.round(Number(e.target.value) || 0) })}
              />
            </label>
          </div>
          {span && (
            <p className="text-[13.5px] text-slate-600">
              From the start of {day(span.startsAt)} to the end of {day(lastDay(span.endsAt))}, India time.
            </p>
          )}

          <label className="block text-[14px] font-medium text-slate-700">
            Emails
            <textarea
              className={`${field} min-h-40 font-mono text-[13.5px]`}
              value={form.emails}
              onChange={(e) => setForm({ ...form, emails: e.target.value })}
              placeholder={"One per line, or separated by commas. A column pasted from the registration sheet works too.\nstudent1@gmail.com\nstudent2@gmail.com"}
            />
          </label>
          {form.emails.trim() && (
            <p className="text-[13.5px] text-slate-600">
              <span className="font-semibold text-slate-900">{plural(parsed.valid.length, "email")}</span>
              {parsed.invalid.length > 0 && (
                <span className="text-amber-800">
                  {" "}
                  · {parsed.invalid.length} {parsed.invalid.length === 1 ? "looks" : "look"} wrong and will be skipped: {parsed.invalid.slice(0, 5).join(", ")}
                  {parsed.invalid.length > 5 ? "…" : ""}
                </span>
              )}
              {parsed.valid.length > PASS_LIMITS.maxEmails && <span className="text-red-700"> · up to {PASS_LIMITS.maxEmails} at a time</span>}
            </p>
          )}

          <button type="button" className={primary} disabled={pending || !ready} onClick={give}>
            {busy === "give" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            {parsed.valid.length ? `Give ${plural(parsed.valid.length, "pass", "passes")}` : "Give passes"}
          </button>
        </div>
      </section>

      {/* ── batches given ── */}
      <section>
        <p className={LABEL}>Given</p>
        <h2 className="text-[19px] font-bold text-slate-900">Passes you have given ({batches.length})</h2>
        {batches.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {batches.map((b) => {
              const s = status(b)
              const missing = b.emails.length - b.withAccount.length
              return (
                <li key={b.reason} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-slate-900">
                        {b.name}
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${s.tone}`}>{s.text}</span>
                      </p>
                      <p className="mt-0.5 text-[14px] text-slate-600">
                        {PLAN_NAME[b.plan]} · {day(b.startsAt)} to {day(lastDay(b.endsAt))} ({plural(b.days, "day")})
                      </p>
                      <p className="mt-1 text-[13px] text-slate-500">
                        {plural(b.emails.length, "student")} · {b.withAccount.length} signed up
                        {missing > 0 ? ` · ${missing} not yet` : " · everyone"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {missing > 0 && (
                        <button type="button" className={quiet} onClick={() => void copyMissing(b)}>
                          {copied === b.reason ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                          {copied === b.reason ? "Copied" : `Copy the ${missing} not signed up`}
                        </button>
                      )}
                      {Date.now() < Date.parse(b.endsAt) && (
                        <button type="button" className={quiet} disabled={pending} onClick={() => addMore(b)}>
                          <Plus className="h-4 w-4" /> Add emails
                        </button>
                      )}
                      <Link href={`/admin/scores?${new URLSearchParams({ event: b.name, day: indiaDay(new Date(Math.min(Date.now(), Date.parse(b.endsAt) - 1))) })}`} className={quiet}>
                        <Trophy className="h-4 w-4" /> Top scores
                      </Link>
                      <Link href={`/admin/passes/certificates?${new URLSearchParams({ event: b.name })}`} className={quiet}>
                        <Award className="h-4 w-4" /> Certificates
                      </Link>
                      <button type="button" className={`${quiet} text-red-700`} disabled={pending} onClick={() => remove(b)}>
                        {busy === b.reason ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
