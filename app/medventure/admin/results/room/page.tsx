import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Minimize2, Trophy } from "lucide-react"
import { AutoRefresh } from "@/app/admin/scores/auto-refresh"
import { canManageMedventure, MEDVENTURE } from "@/lib/events/medventure"
import { medventureResults } from "@/lib/events/medventure-results"
import { shortName } from "@/lib/workshops/rank"

export const dynamic = "force-dynamic"
export const metadata = { title: "MedVenture × MediKarya leaderboard" }

const time = (seconds: number) => `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`
const MEDAL = ["bg-[#f2c94c] text-[#3b2c00]", "bg-[#d5dde0] text-[#26323a]", "bg-[#d99a5b] text-[#3a2210]"]
const SHOWN = 10

/**
 * The live ranking in large type for the room's projector. Organisers only, though it shows no emails: a short name
 * ("Riya S."), the two round scores, the total and the time. Re-read every 30 s, so it moves as students finish.
 */
export default async function MedventureRoomBoard() {
  const { userId } = await auth()
  const access = await canManageMedventure(userId)
  if (!access.allowed) redirect("/")
  const results = await medventureResults()
  const names = new Map(results.progress.map((row) => [row.userId, row.name]))
  const playing = results.progress.length - results.ranked.length

  return <main className="min-h-screen bg-[radial-gradient(1200px_700px_at_15%_0%,#1d4a37_0%,#0f241b_55%,#0b1a14_100%)] px-8 py-8 text-white">
    <div className="flex items-start justify-between gap-6">
      <div><p className="text-[15px] font-semibold uppercase tracking-[0.2em] text-[#a8ddbb]">{MEDVENTURE.brand} · Live leaderboard</p><h1 className="mt-1 text-5xl font-bold tracking-tight">Clinical Decision Challenge</h1><p className="mt-3 text-xl text-white/60">{results.ranked.length} finished · {playing} still playing</p></div>
      <Link href="/medventure/admin/results" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-[14px] text-white/60 hover:text-white"><Minimize2 className="h-4 w-4" /> Exit</Link>
    </div>
    {results.ranked.length === 0 ? <div className="mt-28 text-center"><Trophy className="mx-auto h-14 w-14 text-[#a8ddbb]" /><p className="mt-5 text-3xl text-white/70">Places appear here as students finish both rounds.</p></div> : <section className="mt-10 overflow-hidden rounded-2xl border border-white/15 bg-white/[.05]">
      <div className="grid grid-cols-[4.5rem_1fr_8rem_8rem_9rem_10rem] items-center gap-4 border-b border-white/10 px-6 py-4 text-[15px] font-bold uppercase tracking-[.14em] text-[#a8ddbb]"><span>Place</span><span>Student</span><span className="text-right">Round 1</span><span className="text-right">Round 2</span><span className="text-right">Total</span><span className="text-right">Time</span></div>
      <ol>{results.ranked.slice(0, SHOWN).map((row) => <li key={row.userId} className="grid grid-cols-[4.5rem_1fr_8rem_8rem_9rem_10rem] items-center gap-4 border-b border-white/10 px-6 py-3.5 text-3xl last:border-0"><span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold ${MEDAL[row.place - 1] ?? "bg-white/10 text-white/80"}`}>{row.place}</span><span className="min-w-0 truncate font-semibold">{shortName(names.get(row.userId))}</span><span className="text-right tabular-nums text-white/75">{row.roundOne}</span><span className="text-right tabular-nums text-white/75">{row.roundTwo}</span><span className="text-right font-bold tabular-nums text-[#a8ddbb]">{row.total}<span className="text-xl text-white/45">/20</span></span><span className="text-right text-2xl tabular-nums text-white/60">{time(row.totalSeconds)}</span></li>)}</ol>
    </section>}
    {results.ranked.length > SHOWN && <p className="mt-4 text-center text-xl text-white/50">and {results.ranked.length - SHOWN} more</p>}
    <p className="mt-10 text-center text-lg text-white/45">Higher total first; equal totals go to the faster time · Updates by itself every 30 seconds</p>
    <AutoRefresh seconds={30} />
  </main>
}
