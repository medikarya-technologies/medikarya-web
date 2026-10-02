"use client"

// An advisor's cases: the list chosen for them, the briefing and the bedside encounter (the same one students get),
// and a box for what they think. Their attempts are saved under the invite's id, the way a guest's are on /try.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Clock, Loader2, Play, Send } from "lucide-react"
import { CaseInteraction } from "@/components/cases/case-interaction"
import { PatientCard } from "@/components/cases/patient-card"
import { sendAdvisorFeedback } from "./actions"

export interface InvitedCase {
  id: string
  title: string
  category: string
  difficulty: string
  minutes: number | string | null
  live: boolean
}

interface Props {
  token: string
  inviteId: string
  name: string
  cases: InvitedCase[]
  /** Best score on each case they have finished. */
  played: Record<string, number | null>
  feedback: string
  expires: string
}

export function AdvisorCases({ token, inviteId, name, cases, played, feedback: savedFeedback, expires }: Props) {
  const router = useRouter()
  const [caseData, setCaseData] = useState<any>(null)
  const [stage, setStage] = useState<"list" | "briefing" | "playing">("list")
  const [opening, setOpening] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState(savedFeedback)
  const [sent, setSent] = useState(false)
  const [pending, start] = useTransition()

  const open = async (id: string) => {
    setOpening(id)
    setError(null)
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error()
      setCaseData(await res.json())
      setStage("briefing")
    } catch {
      setError("We could not open that case. Please try again.")
    } finally {
      setOpening(null)
    }
  }

  const begin = async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseData.id)}/start`, { method: "POST", headers: { "Content-Type": "application/json" } })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "")
      setCaseData(body)
      setStage("playing")
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We could not start that case. Please try again.")
    } finally {
      setStarting(false)
    }
  }

  const backToList = () => {
    setStage("list")
    setCaseData(null)
    router.refresh() // a finished case now shows as done
  }

  if (stage === "playing" && caseData) return <CaseInteraction caseData={caseData} guestId={inviteId} onExit={backToList} />

  if (stage === "briefing" && caseData) {
    return (
      <div className="min-h-screen bg-enc-desk pb-20">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <button type="button" onClick={backToList} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink">
              <ArrowLeft className="h-4 w-4" /> All cases
            </button>
            {error && <p className="rounded-lg bg-red-50 p-3 text-[14px] text-red-900">{error}</p>}
            <PatientCard patient={caseData.patient} caseTitle={caseData.displayTitle || caseData.title} caseData={caseData} starting={starting} onStartCase={begin} />
          </div>
        </div>
      </div>
    )
  }

  const done = cases.filter((c) => c.id in played).length
  const send = () =>
    start(async () => {
      setError(null)
      const r = await sendAdvisorFeedback(token, feedback)
      if (!r.ok) setError(r.error)
      else setSent(true)
    })

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <img src="/medikarya.svg" alt="" className="h-7 w-7" />
          <span className="font-bold text-slate-900">MediKarya</span>
          <span className="text-slate-400">·</span>
          <span className="text-[14px] text-slate-600">For advisors</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-[26px] leading-tight font-bold text-slate-900 sm:text-[30px]">Thank you{name ? `, ${name}` : ""}</h1>
          <p className="mt-2 text-[15.5px] leading-relaxed text-slate-600">
            {cases.length === 1 ? "This case is" : `These ${cases.length} cases are`} exactly what a student sees: you interview the patient, examine them, order
            investigations and commit to a diagnosis and plan. Play {cases.length === 1 ? "it" : "them"} as you would see a real patient, then tell us what you would change.
          </p>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-[14px] text-red-900">{error}</p>}

        <ul className="space-y-3">
          {cases.map((c) => {
            const finished = c.id in played
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="text-[16.5px] font-semibold text-slate-900">{c.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13.5px] text-slate-500">
                    {[c.category, c.difficulty].filter(Boolean).join(" · ")}
                    {c.live && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[12px] font-semibold text-rose-700">Live: the patient can deteriorate</span>}
                    {c.minutes ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {typeof c.minutes === "number" ? `${c.minutes} min` : c.minutes}
                      </span>
                    ) : null}
                  </p>
                  {finished && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Completed{typeof played[c.id] === "number" ? ` · score ${played[c.id]}` : ""}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={opening !== null}
                  onClick={() => open(c.id)}
                  className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14.5px] font-semibold disabled:opacity-60 ${
                    finished ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" : "bg-sky-600 text-white hover:bg-sky-700"
                  }`}
                >
                  {opening === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {finished ? "Play again" : "Open case"}
                </button>
              </li>
            )
          })}
          {cases.length === 0 && <li className="rounded-xl border border-slate-200 bg-white p-5 text-[15px] text-slate-600">The cases on this link are no longer available. Please ask the MediKarya team for a new link.</li>}
        </ul>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-[18px] font-bold text-slate-900">What would you change?</h2>
          <p className="mt-1 text-[14px] text-slate-600">
            {done === 0 ? "Once you have played a case, tell us here." : "Anything at all: the medicine, what the patient says, the scoring, what a student would take away."}
          </p>
          {sent ? (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-[14.5px] font-medium text-emerald-900">
              <CheckCircle2 className="h-4 w-4" /> Thank you. We have your feedback, and we read every word.
            </p>
          ) : (
            <>
              <textarea
                className="mt-3 min-h-[130px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. The troponin came back too quickly for a district hospital; the patient should mention the radiation to the jaw only when asked."
              />
              <button
                type="button"
                disabled={pending || !feedback.trim()}
                onClick={send}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {savedFeedback ? "Update my feedback" : "Send feedback"}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[13px] text-slate-500">
          This link works until {new Date(expires).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. No account is needed; please do not share it.
        </p>
      </div>
    </main>
  )
}
