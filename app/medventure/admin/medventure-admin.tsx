"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { Copy, ExternalLink, Link2, Loader2, Pause, Play, Plus, Settings2, ShieldCheck, Ticket, Users } from "lucide-react"
import type { EventRoom, EventStaffMember } from "@/lib/events/medventure"
import type { JoinLink } from "@/lib/plans/join-links"
import type { PassBatch } from "@/lib/plans/pass-batches"
import {
  addMedventureStaffAction,
  createMedventureJoinAction,
  giveMedventurePassesAction,
  removeMedventureStaffAction,
  configureMedventureRoomAction,
  setMedventureJoinActiveAction,
} from "./actions"

type Props = {
  origin: string
  owner: boolean
  batch: PassBatch | null
  links: JoinLink[]
  staff: EventStaffMember[]
  staffAvailable: boolean
  room: EventRoom | null
  roomAvailable: boolean
  cases: Array<{ id: string; title: string }>
}

const button = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#376c55] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285640] disabled:cursor-not-allowed disabled:opacity-50"
const quiet = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#c9ddd0] bg-white px-3 py-2 text-[13px] font-semibold text-[#285640] hover:bg-[#eff6f1] disabled:opacity-50"

export function MedventureAdmin({ origin, owner, batch, links, staff, staffAvailable, room, roomAvailable, cases }: Props) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [emails, setEmails] = useState("")
  const [staffEmail, setStaffEmail] = useState("")
  const [roundTwoCaseId, setRoundTwoCaseId] = useState(room?.roundTwoCaseId ?? "")
  const currentLink = links[0] ?? null
  const entryUrl = `${origin}/join`

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      setError(null)
      setNotice(null)
      const result = await work()
      if (!result.ok) setError(result.error ?? "Something went wrong. Please try again.")
      else setNotice(success)
    })

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setNotice("Copied to the clipboard.")
    } catch {
      setError("Could not copy. Your browser blocked the clipboard.")
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
      {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p>}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#dbe8df] bg-white p-5"><Users className="h-5 w-5 text-[#4b8f74]" /><p className="mt-5 text-3xl font-semibold text-[#173c2d]">{batch?.emails.length ?? 0}</p><p className="mt-1 text-sm text-[#5a6c61]">on the event pass</p></div>
        <div className="rounded-2xl border border-[#dbe8df] bg-white p-5"><ShieldCheck className="h-5 w-5 text-[#4b8f74]" /><p className="mt-5 text-3xl font-semibold text-[#173c2d]">{currentLink?.joined ?? 0}</p><p className="mt-1 text-sm text-[#5a6c61]">joined from the room link</p></div>
        <div className="rounded-2xl border border-[#dbe8df] bg-white p-5"><Ticket className="h-5 w-5 text-[#4b8f74]" /><p className="mt-5 text-3xl font-semibold text-[#173c2d]">5 days</p><p className="mt-1 text-sm text-[#5a6c61]">of Intern access per attendee</p></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#c9ddd0] bg-white shadow-sm">
        <header className="border-b border-[#dbe8df] bg-[#eff6f1] px-5 py-4 sm:px-6"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b8f74]">Participant entry</p><h2 className="mt-1 text-xl font-semibold text-[#173c2d]">One QR link, one MediKarya account</h2><p className="mt-1.5 text-sm leading-relaxed text-[#5a6c61]">Students sign in or create a MediKarya account before joining. The five-day pass is then added to that same account.</p></header>
        <div className="space-y-4 p-5 sm:p-6">
          {currentLink ? (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dbe8df] bg-[#f7faf8] p-4"><code className="min-w-0 flex-1 break-all text-sm font-semibold text-[#264a37]">{entryUrl}</code><button type="button" className={quiet} onClick={() => void copy(entryUrl)}><Copy className="h-3.5 w-3.5" /> Copy</button><a className={quiet} href={entryUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open</a></div>
              <p className="text-sm text-[#5a6c61]">The active room link has {currentLink.joined} of {currentLink.maxJoins} available places used. It is {currentLink.active ? "on" : "paused"}.</p>
              <button type="button" className={quiet} disabled={pending} onClick={() => run(() => setMedventureJoinActiveAction(currentLink.code, !currentLink.active), currentLink.active ? "The entry link is paused." : "The entry link is live again.")}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : currentLink.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{currentLink.active ? "Pause entry" : "Resume entry"}</button>
            </>
          ) : (
            <div><p className="max-w-2xl text-sm leading-relaxed text-[#5a6c61]">Create the room link once. It opens on 18 November for up to 60 participants and gives each successful joiner the agreed five-day Intern pass.</p><button type="button" className={`${button} mt-4`} disabled={pending} onClick={() => run(createMedventureJoinAction, "The entry link is ready. Show or share the short URL above.")}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Create entry link</button></div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dbe8df] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b8f74]">Challenge room</p><h2 className="mt-1 text-xl font-semibold text-[#173c2d]">Set Round 2, then open the room.</h2>{!roomAvailable ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Run <code className="rounded bg-white px-1.5 py-0.5">scripts/create_medventure_challenge.sql</code> in the main MediKarya Supabase project to switch the room on.</p> : <><p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#5a6c61]">Status: <strong className="capitalize text-[#264a37]">{room?.status ?? "draft"}</strong>. Opening the room makes the published Round 1 pathways and this selected patient available to participants.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-sm font-semibold text-[#264a37]">Round 2 MediKarya patient<select className="mt-1.5 block w-full rounded-lg border border-[#c9ddd0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#4b8f74]" value={roundTwoCaseId} onChange={(event) => setRoundTwoCaseId(event.target.value)}><option value="">Choose a published case</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button type="button" className={button} disabled={pending || !roundTwoCaseId} onClick={() => run(() => configureMedventureRoomAction({ status: "live", roundTwoCaseId }), "The challenge room is now live.")}><Play className="h-4 w-4" /> Open room</button><button type="button" className={quiet} disabled={pending} onClick={() => run(() => configureMedventureRoomAction({ status: "closed", roundTwoCaseId }), "The challenge room is closed. Scores remain visible.")}><Pause className="h-4 w-4" /> Close room</button></div><p className="mt-3 text-xs leading-relaxed text-[#74877b]">Before opening: publish at least one pathway from the Round 1 editor. Students who already entered via the QR can then visit <code className="rounded bg-[#eff6f1] px-1.5 py-0.5">/challenge</code>.</p></>}</section>

      <section className="rounded-2xl border border-[#dbe8df] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b8f74]">Late or pre-registered students</p><h2 className="mt-1 text-xl font-semibold text-[#173c2d]">Add pass by email</h2><p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#5a6c61]">Paste registration emails if someone cannot scan the room QR. The pass appears as soon as they sign in with that email.</p><textarea className="mt-4 min-h-32 w-full rounded-xl border border-[#c9ddd0] px-3 py-2.5 font-mono text-sm outline-none focus:border-[#4b8f74] focus:ring-2 focus:ring-[#d9f2e2]" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="student1@example.com&#10;student2@example.com" /><button type="button" className={`${button} mt-3`} disabled={pending || !emails.trim()} onClick={() => run(async () => { const r = await giveMedventurePassesAction(emails); if (r.ok) setEmails(""); return r }, "Passes added. They activate on the students’ MediKarya accounts.")}><Ticket className="h-4 w-4" /> Add attendees</button></section>

      <section className="grid gap-4 md:grid-cols-3"><Link href="/medventure/admin/questions" className="rounded-2xl border border-[#dbe8df] bg-white p-5 transition-colors hover:border-[#9fc9ae] sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b8f74]">Round 1</p><h2 className="mt-1 inline-flex items-center gap-2 text-xl font-semibold text-[#173c2d]"><Settings2 className="h-5 w-5 text-[#4b8f74]" /> Decision pathways</h2><p className="mt-2 text-sm leading-relaxed text-[#5a6c61]">Create and publish every branching question, answer and point value.</p></Link><Link href="/medventure/admin/results" className="rounded-2xl border border-[#dbe8df] bg-white p-5 transition-colors hover:border-[#9fc9ae] sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b8f74]">Competition desk</p><h2 className="mt-1 text-xl font-semibold text-[#173c2d]">Challenge results</h2><p className="mt-2 text-sm leading-relaxed text-[#5a6c61]">Follow both rounds and the final event ranking from one screen.</p></Link><Link href="/medventure/admin/certificates" className="rounded-2xl border border-[#dbe8df] bg-white p-5 transition-colors hover:border-[#9fc9ae] sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b8f74]">After the event</p><h2 className="mt-1 text-xl font-semibold text-[#173c2d]">QR-verifiable certificates</h2><p className="mt-2 text-sm leading-relaxed text-[#5a6c61]">Issue participation certificates from the event batch, using the same MediKarya verification system students see on their dashboards.</p></Link></section>

      {owner && <section className="rounded-2xl border border-[#dbe8df] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b8f74]">Access team</p><h2 className="mt-1 text-xl font-semibold text-[#173c2d]">Medventure organisers</h2><p className="mt-1.5 text-sm leading-relaxed text-[#5a6c61]">These people can manage this event only. They must first create a normal MediKarya account with the same email.</p>{!staffAvailable ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Run <code className="rounded bg-white px-1.5 py-0.5">scripts/create_event_staff.sql</code> in the main MediKarya Supabase project before adding organisers.</p> : <><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input className="min-w-0 flex-1 rounded-lg border border-[#c9ddd0] px-3 py-2.5 text-sm outline-none focus:border-[#4b8f74]" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="organiser@example.com" type="email" /><button type="button" className={button} disabled={pending || !staffEmail.trim()} onClick={() => run(async () => { const r = await addMedventureStaffAction(staffEmail); if (r.ok) setStaffEmail(""); return r }, "Organiser access added.")}><Plus className="h-4 w-4" /> Add organiser</button></div><ul className="mt-4 divide-y divide-[#e5eee7] rounded-xl border border-[#dbe8df]">{staff.length === 0 ? <li className="px-4 py-3 text-sm text-[#5a6c61]">No event organisers have been added yet.</li> : staff.map((member) => <li key={member.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><span className="text-sm font-medium text-[#264a37]">{member.email}</span><button type="button" className={quiet} disabled={pending} onClick={() => run(() => removeMedventureStaffAction(member.email), "Organiser access removed.")}>Remove</button></li>)}</ul></>}</section>}
    </div>
  )
}
