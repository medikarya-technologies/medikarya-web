"use client"

// One case on Admin → Live cases: where it stands, and the next thing to do with it.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, Copy, FileText, Loader2, Play, Send, Sparkles, Trash2, Zap } from "lucide-react"
import { draftLivePlanAction, removeLivePlanAction, sendLiveSignOffAction, setLiveAction, type LiveResult } from "./actions"

export interface LiveCase {
  id: string
  title: string
  displayTitle: string
  status: "published" | "draft"
  difficulty: string
  category: string
  /** Written as a live case (its own physiology), like the chest-pain case: it needs no plan. */
  authored: boolean
  /** Can run at the bedside at all. */
  playable: boolean
  plan: {
    origin: "ai" | "author"
    status: "proposed" | "approved"
    summary: string
    stages: number
    treatments: number
    window: number
    limit: number
    draftedAt: string | null
    signOff: { decision: "approved" | "changes_requested"; by: string | null; at: string; comments: string | null } | null
    errors: string[]
    warnings: string[]
  } | null
}

const quiet = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
const primary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-[14px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "")

function Badge({ tone, children }: { tone: "slate" | "amber" | "emerald" | "rose" | "sky"; children: React.ReactNode }) {
  const tones = { slate: "bg-slate-100 text-slate-700", amber: "bg-amber-100 text-amber-900", emerald: "bg-emerald-600 text-white", rose: "bg-rose-100 text-rose-900", sky: "bg-sky-100 text-sky-900" }
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${tones[tone]}`}>{children}</span>
}

export function LiveRow({ c }: { c: LiveCase }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<LiveResult | null>(null)
  const [changes, setChanges] = useState("")
  const [asking, setAsking] = useState(false)
  const [copied, setCopied] = useState(false)

  const run = (key: string, work: () => Promise<LiveResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    start(async () => {
      setBusy(key)
      setResult(null)
      setCopied(false)
      const r = await work()
      setBusy(null)
      setResult(r)
      if (r.ok) {
        setAsking(false)
        setChanges("")
        router.refresh()
      }
    })
  }
  const spin = (key: string, icon: React.ReactNode) => (busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : icon)

  const p = c.plan
  const signedOff = p?.signOff?.decision === "approved"
  const changesAsked = p?.signOff?.decision === "changes_requested"
  const broken = !!p && p.errors.length > 0

  return (
    <li className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-100/70 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-snug text-slate-900">{c.title}</p>
          <p className="text-[13.5px] text-slate-600">
            {[c.displayTitle, c.category, c.difficulty].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge tone={c.status === "published" ? "sky" : "slate"}>{c.status === "published" ? "In the library" : "Draft"}</Badge>
          {c.authored ? (
            <Badge tone="emerald">Written as a live case</Badge>
          ) : !p ? (
            <Badge tone="slate">Ordinary case</Badge>
          ) : p.status === "approved" ? (
            <Badge tone="emerald">Live for students</Badge>
          ) : signedOff ? (
            <Badge tone="sky">Signed off, not switched on</Badge>
          ) : changesAsked ? (
            <Badge tone="rose">Changes asked for</Badge>
          ) : (
            <Badge tone="amber">Plan proposed</Badge>
          )}
        </div>
      </header>

      <div className="space-y-3 px-5 py-4">
        {c.authored && <p className="text-[14px] text-slate-600">This case has its own hand-written physiology. Nothing to do here.</p>}
        {!c.authored && !c.playable && <p className="text-[14px] text-amber-800">This case cannot run at the bedside (no heart rate, or no tests), so it cannot be made live.</p>}

        {!c.authored && c.playable && !p && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[14px] text-slate-600">
              The AI reads the case and drafts what happens to this patient untreated, the treatments and what stops it. If the condition has no acute
              course, it says so and nothing is made.
            </p>
            <button type="button" className={primary} disabled={pending} onClick={() => run("draft", () => draftLivePlanAction(c.id))}>
              {spin("draft", <Sparkles className="h-4 w-4" />)} Draft a live plan with AI
            </button>
          </div>
        )}

        {p && (
          <>
            <p className="text-[14.5px] leading-relaxed text-slate-800">{p.summary}</p>
            <p className="text-[13px] text-slate-500">
              {p.origin === "ai" ? "Drafted by AI" : "Written by the case's author"}
              {p.draftedAt ? ` on ${day(p.draftedAt)}` : ""} · {p.stages} steps untreated · {p.treatments} treatments · decisive treatment due by {p.window} min · ends at{" "}
              {p.limit} min
            </p>

            {broken && (
              <div className="rounded-lg bg-red-50 p-3 text-[13.5px] text-red-900">
                <p className="font-semibold">This plan does not pass the check, so it is not running for anyone:</p>
                <ul className="mt-1 list-disc pl-5">
                  {p.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {p.warnings.length > 0 && (
              <ul className="list-disc rounded-lg bg-amber-50 p-3 pl-8 text-[13.5px] text-amber-900">
                {p.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {p.signOff && (
              <p className={`rounded-lg p-3 text-[14px] ${signedOff ? "bg-emerald-50 text-emerald-950" : "bg-rose-50 text-rose-950"}`}>
                {signedOff ? "✓ Signed off" : "Changes asked for"} by <strong>{p.signOff.by ?? "the clinician (name kept private)"}</strong> on {day(p.signOff.at)}.
                {p.signOff.comments && <span className="mt-1 block whitespace-pre-wrap">{p.signOff.comments}</span>}
              </p>
            )}

            {/* what to do next, in order */}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Link href={`/admin/studio/report/${c.id}`} target="_blank" className={quiet}>
                <FileText className="h-4 w-4" /> Read the plan
              </Link>
              <Link href={`/dashboard/cases/${c.id}`} target="_blank" className={quiet} title="As an admin you get the live version even while it is only proposed">
                <Play className="h-4 w-4" /> Play-test it
              </Link>
              {!signedOff && !broken && (
                <button type="button" className={changesAsked ? quiet : primary} disabled={pending} onClick={() => run("link", () => sendLiveSignOffAction(c.id))}>
                  {spin("link", <Send className="h-4 w-4" />)} {p.signOff ? "New sign-off link" : "Send for sign-off"}
                </button>
              )}
              {changesAsked && (
                <button type="button" className={primary} disabled={pending} onClick={() => run("revise", () => draftLivePlanAction(c.id), "Change the plan as the clinician asked? It takes about half a minute, and the new plan needs a new sign-off.")}>
                  {spin("revise", <Sparkles className="h-4 w-4" />)} Change it as they asked
                </button>
              )}
              {signedOff && p.status !== "approved" && !broken && (
                <button type="button" className={primary} disabled={pending} onClick={() => run("on", () => setLiveAction(c.id, true), c.status === "published" ? "Switch the live version on? Students will get this case with the clock and the tray from now on." : undefined)}>
                  {spin("on", <Zap className="h-4 w-4" />)} Switch it on
                </button>
              )}
              {p.status === "approved" && (
                <button type="button" className={quiet} disabled={pending} onClick={() => run("off", () => setLiveAction(c.id, false), "Switch the live version off? Students get the ordinary case again.")}>
                  {spin("off", null)} Switch it off
                </button>
              )}
              <button type="button" className={quiet} disabled={pending} onClick={() => setAsking(!asking)}>
                Ask for a change
              </button>
              <button
                type="button"
                className={`${quiet} text-red-700`}
                disabled={pending}
                onClick={() => run("remove", () => removeLivePlanAction(c.id), "Remove the live plan? The case goes back to an ordinary one. This cannot be undone.")}
              >
                {spin("remove", <Trash2 className="h-4 w-4" />)} Remove plan
              </button>
            </div>

            {asking && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="block text-[14px] font-medium text-slate-700">
                  What should change?
                  <textarea
                    className="mt-1 min-h-[84px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14.5px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    value={changes}
                    onChange={(e) => setChanges(e.target.value)}
                    placeholder="e.g. Decompensation should come at 15 minutes, not 12. Add IV antibiotics as an essential treatment within 10 minutes."
                  />
                </label>
                <p className="mt-1 text-[13px] text-slate-500">The AI changes only what you ask. The changed plan is a new proposal and needs a new sign-off{p.status === "approved" ? "; students go back to the ordinary case until then" : ""}.</p>
                <button type="button" className={`${primary} mt-2`} disabled={pending || changes.trim().length < 8} onClick={() => run("change", () => draftLivePlanAction(c.id, changes))}>
                  {spin("change", <Sparkles className="h-4 w-4" />)} Change the plan
                </button>
              </div>
            )}
          </>
        )}

        {result && !result.ok && (
          <div className="rounded-lg bg-red-50 p-3 text-[14px] text-red-900">
            <p>{result.error}</p>
            {result.details && (
              <ul className="mt-1 list-disc pl-5 text-[13.5px]">
                {result.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {result?.ok && (
          <div className="rounded-lg bg-emerald-50 p-3 text-[14px] text-emerald-950">
            <p>{result.message}</p>
            {result.link && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-[13px] text-slate-800" />
                <button
                  type="button"
                  className={`${quiet} shrink-0`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.link!)
                      setCopied(true)
                    } catch {
                      setCopied(false)
                    }
                  }}
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
