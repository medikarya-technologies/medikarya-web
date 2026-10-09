"use client"

// The working part of a workshop's certificates: the wording, which cases count, the names as they will be printed,
// then issuing them in small parts with progress.

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Award, Check, Copy, ExternalLink, Loader2 } from "lucide-react"
import { CERTIFICATE_LIMITS, certificateProblem, printableName, workshopDetail } from "@/lib/workshops/rank"
import { issueCertificatesAction } from "../actions"

const LABEL = "text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
const quiet = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

interface Student {
  email: string
  name: string
  /** Cases finished while the pass ran. */
  done: string[]
}

interface Props {
  event: string
  students: Student[]
  notSignedUp: number
  cases: Array<{ id: string; title: string; players: number }>
  issued: Record<string, { credentialId: string; name: string; revoked: boolean }>
  defaults: { title: string; day: string }
  studioUrl: string
}

export function CertificatesAdmin({ event, students, notSignedUp, cases, issued, defaults, studioUrl }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [title, setTitle] = useState(defaults.title)
  const [venue, setVenue] = useState("")
  const [day, setDay] = useState(defaults.day)
  // the cases most of the room played are ticked to begin with
  const [required, setRequired] = useState<string[]>(() => cases.filter((c) => c.players * 2 >= (cases[0]?.players ?? 0)).map((c) => c.id))
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.email, s.name])))
  const [left, setLeft] = useState<Record<string, boolean>>({})

  const finished = useMemo(() => students.filter((s) => required.length > 0 && required.every((c) => s.done.includes(c))), [students, required])
  const waiting = students.filter((s) => !finished.includes(s))
  const toIssue = finished.filter((s) => !issued[s.email] && !left[s.email])
  const badNames = toIssue.filter((s) => !printableName(names[s.email] ?? ""))
  const problem = certificateProblem({ title, venue, day, cases: required })
  const caseTitle = (id: string) => cases.find((c) => c.id === id)?.title ?? id
  const link = (credentialId: string) => `${studioUrl}/certificate/${credentialId}`

  const issueAll = () => {
    if (problem || toIssue.length === 0) return
    if (badNames.length) return setError(`Fix ${plural(badNames.length, "name")} first (highlighted below), or leave those students out.`)
    if (!window.confirm(`Issue ${plural(toIssue.length, "certificate")} for “${title.trim()}”? Each gets a permanent credential ID.`)) return
    start(async () => {
      setError(null)
      setNotice(null)
      let done = 0
      const skipped: string[] = []
      for (let i = 0; i < toIssue.length; i += CERTIFICATE_LIMITS.perCall) {
        const part = toIssue.slice(i, i + CERTIFICATE_LIMITS.perCall)
        setProgress(`Issuing… ${done} of ${toIssue.length}`)
        const r = await issueCertificatesAction({ event, title, venue, day, cases: required, people: part.map((s) => ({ email: s.email, name: names[s.email] ?? "" })) })
        if (!r.ok) {
          setProgress(null)
          setError(`${r.error}${done ? ` (${plural(done, "certificate")} were issued before this.)` : ""}`)
          router.refresh()
          return
        }
        done += r.issued.length
        skipped.push(...r.skipped.map((s) => `${s.email} ${s.why}`))
      }
      setProgress(null)
      setNotice(`Issued ${plural(done, "certificate")}.${skipped.length ? ` Not issued: ${skipped.join("; ")}.` : ""}`)
      router.refresh()
    })
  }

  const copyLinks = async () => {
    const lines = students.filter((s) => issued[s.email] && !issued[s.email].revoked).map((s) => `${issued[s.email].name}: ${link(issued[s.email].credentialId)}`)
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy. Your browser blocked the clipboard.")
    }
  }

  const issuedCount = Object.values(issued).filter((c) => !c.revoked).length

  return (
    <div className="mt-8 space-y-10">
      {error && <p className="rounded-lg bg-red-50 p-3 text-[14.5px] text-red-900">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-[14.5px] text-emerald-900">{notice}</p>}

      {/* ── the wording ── */}
      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-100/70 px-5 py-3.5">
          <p className={LABEL}>Step 1</p>
          <h2 className="text-[19px] font-bold text-slate-900">What the certificate says</h2>
        </header>
        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[14px] font-medium text-slate-700">
              Title
              <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={CERTIFICATE_LIMITS.titleChars} placeholder="Clinical Reasoning Workshop" />
            </label>
            <label className="block text-[14px] font-medium text-slate-700">
              Day of the workshop
              <input type="date" className={field} value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
          </div>
          <label className="block text-[14px] font-medium text-slate-700">
            Where <span className="font-normal text-slate-500">(optional)</span>
            <input className={field} value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={CERTIFICATE_LIMITS.venueChars} placeholder="Maulana Azad Medical College, New Delhi" />
          </label>

          <div>
            <p className="text-[14px] font-medium text-slate-700">Cases a student must finish</p>
            {cases.length === 0 ? (
              <p className="mt-1 text-[14px] text-slate-500">Nobody in this workshop has finished a case since the pass started.</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {cases.map((c) => {
                  const on = required.includes(c.id)
                  return (
                    <label key={c.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${on ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500" : "border-slate-200 hover:border-slate-400"}`}>
                      <input type="checkbox" className="mt-1 h-4 w-4" checked={on} onChange={() => setRequired(on ? required.filter((x) => x !== c.id) : [...required, c.id])} />
                      <span>
                        <span className="block text-[14.5px] font-semibold text-slate-900">{c.title}</span>
                        <span className="text-[12.5px] text-slate-500">finished by {plural(c.players, "student")}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {!problem && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-[14.5px] leading-relaxed text-slate-700">
              <p className={LABEL}>Reads</p>
              <p className="mt-1">
                This is to certify that <strong>[name]</strong> has taken part in the <strong>{title.trim()}</strong> {workshopDetail(venue, day, required.length)}.
              </p>
            </div>
          )}
          {problem && <p className="text-[14px] text-amber-800">{problem}</p>}
        </div>
      </section>

      {/* ── the names ── */}
      <section>
        <p className={LABEL}>Step 2</p>
        <h2 className="text-[19px] font-bold text-slate-900">Who gets one ({finished.length})</h2>
        <p className="mt-1 text-[14px] text-slate-600">
          {plural(students.length, "student")} signed up with their pass email
          {notSignedUp > 0 ? `; ${notSignedUp} never signed up` : ""}. {issuedCount > 0 && `${plural(issuedCount, "certificate")} issued so far.`}
        </p>

        {finished.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">Nobody has finished every ticked case yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {finished.map((s) => {
              const cert = issued[s.email]
              const bad = !cert && !left[s.email] && !printableName(names[s.email] ?? "")
              return (
                <li key={s.email} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    {cert ? (
                      <p className="text-[15px] font-semibold text-slate-900">{cert.name}</p>
                    ) : (
                      <input
                        className={`w-full max-w-sm rounded-lg border px-3 py-1.5 text-[15px] ${bad ? "border-red-400 bg-red-50" : "border-slate-300"} ${left[s.email] ? "opacity-50" : ""}`}
                        value={names[s.email] ?? ""}
                        onChange={(e) => setNames({ ...names, [s.email]: e.target.value })}
                        disabled={left[s.email] || pending}
                        aria-label={`Name on the certificate for ${s.email}`}
                      />
                    )}
                    <p className="mt-0.5 text-[12.5px] text-slate-500">{s.email}</p>
                  </div>
                  {cert ? (
                    <a href={link(cert.credentialId)} target="_blank" rel="noreferrer" className={quiet}>
                      {cert.revoked ? "Withdrawn" : cert.credentialId} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <label className="flex items-center gap-2 text-[13.5px] text-slate-600">
                      <input type="checkbox" checked={!left[s.email]} onChange={() => setLeft({ ...left, [s.email]: !left[s.email] })} disabled={pending} />
                      Include
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {waiting.length > 0 && (
          <details className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-[14px] text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-800">{plural(waiting.length, "student")} not finished yet</summary>
            <ul className="mt-2 space-y-1">
              {waiting.map((s) => (
                <li key={s.email}>
                  {s.name || s.email}: missing {required.filter((c) => !s.done.includes(c)).map(caseTitle).join(", ") || "a case"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primary} disabled={pending || !!problem || toIssue.length === 0} onClick={issueAll}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
          {progress ?? (toIssue.length ? `Issue ${plural(toIssue.length, "certificate")}` : "Everyone listed has one")}
        </button>
        {issuedCount > 0 && (
          <button type="button" className={quiet} onClick={() => void copyLinks()}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy every name and link"}
          </button>
        )}
      </div>
    </div>
  )
}
