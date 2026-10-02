"use client"

// The working part of Admin → Advisors: make a link, see who used it and what they said, and manage the board.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, ExternalLink, Loader2, Plus, ScrollText, UserPlus } from "lucide-react"
import type { Advisor, InviteWithPlays } from "@/lib/advisors/invites"
import { addAdvisorAction, createInviteAction, endInviteAction, issueCertificateAction, removeAdvisorAction, setListedAction } from "./actions"

interface CaseOption {
  id: string
  title: string
  category: string
  difficulty: string
  live: boolean
}

const LABEL = "text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"
const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
const quiet = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "")

const EMPTY = { name: "", designation: "", department: "", institution: "", listed: true, certificate: true, inviteId: null as string | null }

export function AdvisorsAdmin({ invites, advisors, cases, studioUrl, canCertify }: { invites: InviteWithPlays[]; advisors: Advisor[]; cases: CaseOption[]; studioUrl: string; canCertify: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // a new link
  const [chosen, setChosen] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // a new board member
  const [member, setMember] = useState(EMPTY)

  const titleOf = (id: string) => cases.find((c) => c.id === id)?.title ?? id
  const onBoard = (inviteId: string) => advisors.some((a) => a.invite_id === inviteId)

  const run = (key: string, work: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>, done?: (r: any) => void) =>
    start(async () => {
      setBusy(key)
      setError(null)
      setNotice(null)
      const r = await work()
      setBusy(null)
      if (!r.ok) setError(r.error ?? "Something went wrong.")
      else {
        done?.(r)
        router.refresh()
      }
    })

  const makeLink = () =>
    run("link", () => createInviteAction(chosen, note), (r) => {
      setLink(r.url)
      setCopied(false)
      setChosen([])
      setNote("")
    })

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const addMember = () =>
    run("add", () => addAdvisorAction({ ...member, certificate: member.certificate && canCertify }), (r) => {
      setNotice(r.warning ?? (r.credentialId ? `Added. Certificate ${r.credentialId} is ready.` : "Added to the board."))
      setMember(EMPTY)
    })

  const setM = (k: "name" | "designation" | "department" | "institution") => (e: React.ChangeEvent<HTMLInputElement>) => setMember({ ...member, [k]: e.target.value })

  return (
    <div className="mt-8 space-y-10">
      {error && <p className="rounded-lg bg-red-50 p-3 text-[14.5px] text-red-900">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-[14.5px] text-emerald-900">{notice}</p>}

      {/* ── 1. a new link ── */}
      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-100/70 px-5 py-3.5">
          <p className={LABEL}>Step 1</p>
          <h2 className="text-[19px] font-bold text-slate-900">Send someone a link</h2>
          <p className="mt-0.5 text-[14px] text-slate-600">It opens the cases you tick, with no sign-up, for 14 days. Everything else on the site stays locked.</p>
        </header>
        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="text-[14px] font-medium text-slate-700">Cases this link opens</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {cases.map((c) => {
                const on = chosen.includes(c.id)
                return (
                  <label key={c.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${on ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500" : "border-slate-200 hover:border-slate-400"}`}>
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={on} onChange={() => setChosen(on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])} />
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-semibold leading-snug text-slate-900">{c.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-slate-500">
                        {c.category} · {c.difficulty}
                        {c.live && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700">Live</span>}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
          <label className="block text-[14px] font-medium text-slate-700">
            Who is it for? <span className="font-normal text-slate-500">(only you see this, so you can tell your links apart)</span>
            <input className={`${field} sm:max-w-md`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Dr. Mehra, Medicine, MAMC" maxLength={200} />
          </label>
          <button type="button" className={primary} disabled={pending || chosen.length === 0} onClick={makeLink}>
            {busy === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create link
          </button>

          {link && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-[14.5px] font-semibold text-emerald-950">Your link is ready. Copy it now: it is shown only this once.</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-[13px] text-slate-800" />
                <button type="button" onClick={copy} className={`${quiet} shrink-0`}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 2. links sent ── */}
      <section>
        <p className={LABEL}>Step 2</p>
        <h2 className="text-[19px] font-bold text-slate-900">Links you have sent ({invites.length})</h2>
        {invites.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">No links yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {invites.map((i) => {
              const open = Date.parse(i.expires_at) > Date.now()
              return (
                <li key={i.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold text-slate-900">
                        {i.name ?? i.note ?? "Not opened yet"}
                        {i.name && i.note && <span className="font-normal text-slate-500"> · sent as “{i.note}”</span>}
                      </p>
                      {i.name ? (
                        <p className="text-[14px] text-slate-600">{[i.designation, i.department, i.institution].filter(Boolean).join(", ")}</p>
                      ) : (
                        <p className="text-[14px] text-slate-500">They have not opened it yet.</p>
                      )}
                      <p className="mt-1 text-[13px] text-slate-500">
                        Sent {day(i.created_at)} · {open ? `works until ${day(i.expires_at)}` : `ended ${day(i.expires_at)}`}
                        {i.name && (i.list_name ? " · agreed to be named on the website" : " · did not agree to be named")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {i.name &&
                        (onBoard(i.id) ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-[13.5px] font-semibold text-emerald-800">
                            <Check className="h-4 w-4" /> On the board
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={quiet}
                            onClick={() => {
                              setMember({ name: i.name ?? "", designation: i.designation ?? "", department: i.department ?? "", institution: i.institution ?? "", listed: i.list_name, certificate: true, inviteId: i.id })
                              document.getElementById("add-to-board")?.scrollIntoView({ behavior: "smooth", block: "start" })
                            }}
                          >
                            <UserPlus className="h-4 w-4" /> Add to the board
                          </button>
                        ))}
                      {open && (
                        <button
                          type="button"
                          className={`${quiet} text-red-700`}
                          disabled={pending}
                          onClick={() => window.confirm("End this link now? It will stop opening cases at once.") && run(`end-${i.id}`, () => endInviteAction(i.id))}
                        >
                          {busy === `end-${i.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null} End link
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                    <div>
                      <p className={LABEL}>Cases</p>
                      <ul className="mt-1 space-y-0.5 text-[14px] text-slate-700">
                        {i.case_ids.map((id) => {
                          const plays = i.plays.filter((p) => p.caseId === id)
                          return (
                            <li key={id}>
                              {titleOf(id)}
                              {plays.length > 0 ? (
                                <span className="font-semibold text-emerald-700"> · played{plays.length > 1 ? ` ${plays.length} times` : ""}, score {Math.max(...plays.map((p) => p.score ?? 0))}</span>
                              ) : (
                                <span className="text-slate-400"> · not played</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    <div>
                      <p className={LABEL}>What they said</p>
                      {i.feedback ? (
                        <p className="mt-1 whitespace-pre-wrap text-[14px] text-slate-800">{i.feedback}</p>
                      ) : (
                        <p className="mt-1 text-[14px] text-slate-400">No feedback yet.</p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── 3. the board ── */}
      <section>
        <p className={LABEL}>Step 3</p>
        <h2 className="text-[19px] font-bold text-slate-900">Clinical Advisory Board ({advisors.length})</h2>
        <p className="mt-0.5 text-[14px] text-slate-600">Shown on the contributors page in the order they joined. Each certificate has a QR code and is checked at /verify.</p>

        {advisors.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {advisors.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[15.5px] font-semibold text-slate-900">
                    {a.name}
                    {!a.listed && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-600">Hidden from the website</span>}
                  </p>
                  <p className="text-[14px] text-slate-600">{[a.designation, a.department, a.institution].filter(Boolean).join(", ") || "No designation given"}</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    Joined {day(a.created_at)}
                    {a.credential_id && (
                      <>
                        {" · certificate "}
                        <span className="font-mono font-semibold text-slate-800">{a.credential_id}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {a.credential_id ? (
                    <>
                      <a href={`${studioUrl}/certificate/${a.credential_id}`} target="_blank" rel="noreferrer" className={quiet}>
                        <ScrollText className="h-4 w-4" /> Certificate
                      </a>
                      <a href={`/verify/${a.credential_id}`} target="_blank" rel="noreferrer" className={quiet}>
                        Verify page <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </>
                  ) : (
                    <button type="button" className={quiet} disabled={pending || !canCertify} onClick={() => run(`cert-${a.id}`, () => issueCertificateAction(a.id), (r) => setNotice(`Certificate ${r.credentialId} is ready.`))}>
                      {busy === `cert-${a.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />} Issue certificate
                    </button>
                  )}
                  <button type="button" className={quiet} disabled={pending} onClick={() => run(`list-${a.id}`, () => setListedAction(a.id, !a.listed))}>
                    {a.listed ? "Hide from website" : "Show on website"}
                  </button>
                  <button
                    type="button"
                    className={`${quiet} text-red-700`}
                    disabled={pending}
                    onClick={() =>
                      window.confirm(`Remove ${a.name} from the board?${a.credential_id ? " Their certificate stays valid until you withdraw it in the Case Studio (Admin → Certificates)." : ""}`) &&
                      run(`remove-${a.id}`, () => removeAdvisorAction(a.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div id="add-to-board" className="mt-4 scroll-mt-6 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <header className="border-b border-slate-200 bg-slate-100/70 px-5 py-3.5">
            <h3 className="text-[17px] font-bold text-slate-900">{member.inviteId ? "Add this person to the board" : "Add someone to the board"}</h3>
            <p className="mt-0.5 text-[14px] text-slate-600">
              {member.inviteId ? "Filled in from what they told us. Check it reads the way it should on a certificate." : "For someone who never used a link, or has no account anywhere. Type it as it should read on the certificate."}
            </p>
          </header>
          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[14px] font-medium text-slate-700">
                Full name *
                <input className={field} value={member.name} onChange={setM("name")} placeholder="Dr. A. Sharma" />
              </label>
              <label className="block text-[14px] font-medium text-slate-700">
                Designation
                <input className={field} value={member.designation} onChange={setM("designation")} placeholder="Professor" />
              </label>
              <label className="block text-[14px] font-medium text-slate-700">
                Department
                <input className={field} value={member.department} onChange={setM("department")} placeholder="General Medicine" />
              </label>
              <label className="block text-[14px] font-medium text-slate-700">
                Institution
                <input className={field} value={member.institution} onChange={setM("institution")} placeholder="Maulana Azad Medical College, Delhi" />
              </label>
            </div>
            <label className="flex items-start gap-3 text-[14.5px] text-slate-800">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={member.listed} onChange={(e) => setMember({ ...member, listed: e.target.checked })} />
              <span>
                Show them on the contributors page.
                <span className="block text-[13px] text-slate-500">Only tick this if they have agreed to be named.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-[14.5px] text-slate-800">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={member.certificate && canCertify} disabled={!canCertify} onChange={(e) => setMember({ ...member, certificate: e.target.checked })} />
              <span>
                Issue their Clinical Advisory Board certificate now.
                {!canCertify && <span className="block text-[13px] text-amber-700">The case studio is not connected on this server, so certificates cannot be issued from here.</span>}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primary} disabled={pending || member.name.trim().length < 3} onClick={addMember}>
                {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add to the board
              </button>
              {member.inviteId && (
                <button type="button" className={quiet} onClick={() => setMember(EMPTY)}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
