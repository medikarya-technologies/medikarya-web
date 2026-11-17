import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ExternalLink, Trophy } from "lucide-react"
import { canManageMedventure, medventureRoom } from "@/lib/events/medventure"
import { medventureResults } from "@/lib/events/medventure-results"
import { roundOnePoints, roundTwoPoints } from "@/lib/events/medventure-scoring"
import { FinalizeResults } from "./finalize-results"

export const dynamic = "force-dynamic"
export const metadata = { title: "Medventure results" }

const time = (seconds: number | null) => seconds === null ? "—" : `${Math.floor(seconds / 60)}m ${seconds % 60}s`

export default async function MedventureResultsPage() {
  const { userId } = await auth()
  const access = await canManageMedventure(userId)
  if (!access.allowed) redirect("/")
  const [results, roomData] = await Promise.all([medventureResults(), medventureRoom()])

  return <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-[#18231e] sm:px-6 sm:py-12"><div className="mx-auto max-w-5xl">
    <Link href="/medventure/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5a6c61] hover:text-[#173c2d]"><ArrowLeft className="h-4 w-4" /> Organiser desk</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#4b8f74]">Competition desk</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#173c2d]">Combined leaderboard</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5a6c61]">Only students who complete both rounds receive a place. Totals are out of 20, with lower combined completion time breaking a tie.</p></div><Link href="/medventure/results" target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-[#c9ddd0] bg-white px-3 py-2 text-sm font-semibold text-[#285640]"><ExternalLink className="h-4 w-4" /> Student result</Link></div>
    {!results.available ? <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">The event-results tables are not available yet. Run <code className="rounded bg-white px-1.5 py-0.5">scripts/create_medventure_challenge.sql</code> in the main MediKarya Supabase project.</p> : <>
      <div className="mt-8 grid gap-3 sm:grid-cols-3"><Summary value={String(results.progress.length)} label="started Round 1" /><Summary value={String(results.progress.filter((row) => row.roundOneCompletedAt).length)} label="finished Round 1" /><Summary value={String(results.ranked.length)} label="completed both rounds" /></div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[#dbe8df] bg-white"><header className="flex items-center gap-2 border-b border-[#dbe8df] bg-[#eff6f1] px-5 py-4"><Trophy className="h-5 w-5 text-[#4b8f74]" /><h2 className="font-semibold text-[#173c2d]">Final ranking</h2></header>{results.ranked.length === 0 ? <p className="p-8 text-center text-sm text-[#5a6c61]">Scores will appear after participants complete both rounds.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[43rem] text-sm"><thead><tr className="border-b border-[#edf3ef] text-left text-[11px] font-bold uppercase tracking-[.11em] text-[#74877b]"><th className="px-5 py-3">Place</th><th className="py-3">Student</th><th className="py-3 text-right">Round 1</th><th className="py-3 text-right">Round 2</th><th className="py-3 text-right">Total</th><th className="px-5 py-3 text-right">Time</th></tr></thead><tbody>{results.ranked.map((row) => { const student = results.progress.find((item) => item.userId === row.userId); return <tr key={row.userId} className="border-b border-[#edf3ef] last:border-0"><td className="px-5 py-3 font-mono font-semibold text-[#376c55]">{row.place}</td><td className="py-3"><p className="font-medium text-[#264a37]">{student?.name ?? student?.email ?? "Participant"}</p><p className="text-xs text-[#74877b]">{student?.email}</p></td><td className="py-3 text-right tabular-nums">{/* rankChallenge has already turned Round 1 into points out of 10; converting again shrank it */}{row.roundOne}</td><td className="py-3 text-right tabular-nums">{roundTwoPoints(row.roundTwoRaw)}</td><td className="py-3 text-right font-bold tabular-nums text-[#173c2d]">{row.total} / 20</td><td className="px-5 py-3 text-right tabular-nums text-[#5a6c61]">{time(row.totalSeconds)}</td></tr> })}</tbody></table></div>}</section>
      <FinalizeResults canFinalize={roomData.room?.status === "closed" && results.ranked.length > 0} />
      <section className="mt-5 overflow-hidden rounded-2xl border border-[#dbe8df] bg-white"><header className="border-b border-[#dbe8df] px-5 py-4"><h2 className="font-semibold text-[#173c2d]">Progress log</h2></header>{results.progress.length === 0 ? <p className="p-6 text-sm text-[#5a6c61]">No participant has started yet.</p> : <div className="divide-y divide-[#edf3ef]">{results.progress.map((row) => <div key={row.userId} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1fr_auto_auto]"><div><p className="font-medium text-[#264a37]">{row.name ?? row.email}</p><p className="text-xs text-[#74877b]">{row.email}</p></div><p className="text-[#5a6c61]">Round 1: {row.roundOneCompletedAt ? `${roundOnePoints(row.roundOneRaw, results.roundOneMaximum)} / 10` : "in progress"}</p><p className="text-[#5a6c61]">Round 2: {row.roundTwoRaw === null ? "not started" : `${roundTwoPoints(row.roundTwoRaw)} / 10`}</p></div>)}</div>}</section>
    </>}
  </div></main>
}

function Summary({ value, label }: { value: string; label: string }) { return <div className="rounded-xl border border-[#dbe8df] bg-white p-4"><p className="font-mono text-2xl font-semibold text-[#173c2d]">{value}</p><p className="mt-1 text-xs text-[#74877b]">{label}</p></div> }
