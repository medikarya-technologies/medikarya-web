import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, CheckCircle2, Clock, Trophy } from "lucide-react"
import { AutoRefresh } from "@/app/admin/scores/auto-refresh"
import { medventureParticipant, medventureRoom } from "@/lib/events/medventure"
import { medventureResults } from "@/lib/events/medventure-results"

export const dynamic = "force-dynamic"
export const metadata = { title: "My MedVenture × MediKarya result" }

const duration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`

/**
 * The end of the challenge. Scores stay hidden until both rounds are done, then the student sees their two scores,
 * the time on each, the total time and their place, which keeps moving as others finish (re-read every 30 s).
 */
export default async function MedventureResultPage() {
  const { userId } = await auth()
  if (!userId) redirect("/medventure/join")
  const participant = await medventureParticipant(userId)
  if (!participant) redirect("/medventure/join")
  const [results, { room }] = await Promise.all([medventureResults(), medventureRoom()])
  const rank = results.ranked.find((row) => row.userId === participant.userId)
  const feedback = <Link href="/medventure/feedback" className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#9fc9ae] bg-[#eaf6ed] p-5 hover:border-[#4b8f74]"><span><span className="block font-semibold text-[#173c2d]">How did it go?</span><span className="mt-0.5 block text-sm text-[#466657]">Two minutes of feedback for the organisers and MediKarya.</span></span><ArrowRight className="h-5 w-5 shrink-0 text-[#376c55]" /></Link>

  if (!rank) return <main className="min-h-screen bg-[#f5f8f5] px-5 py-10 text-[#16261d] sm:px-8 sm:py-16"><div className="mx-auto max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#4b8f74]">MedVenture × MediKarya 2026</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#173c2d]">Your result</h1><div className="mt-7 rounded-2xl border border-[#dbe8df] bg-white p-6"><p className="text-sm leading-relaxed text-[#5a6c61]">Your scores, time and rank appear here as soon as you finish both rounds.</p><Link href="/medventure/challenge" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#376c55] px-4 py-2.5 text-sm font-semibold text-white">Continue the challenge <ArrowRight className="h-4 w-4" /></Link></div></div></main>

  return <main className="min-h-screen bg-[#f5f8f5] px-5 py-10 text-[#16261d] sm:px-8 sm:py-16"><AutoRefresh seconds={30} /><div className="mx-auto max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#4b8f74]">MedVenture × MediKarya 2026</p><div className="mt-2 flex items-center gap-3"><CheckCircle2 className="h-8 w-8 shrink-0 text-[#376c55]" /><h1 className="text-3xl font-semibold tracking-[-.04em] text-[#173c2d]">Done. Well played.</h1></div><p className="mt-2 text-sm text-[#5a6c61]">Both rounds are complete and your score is saved.</p>
    <div className="mt-7 rounded-2xl border border-[#173c2d] bg-[#173c2d] p-6 text-white"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a8ddbb]">Your score</p><p className="mt-1 text-5xl font-semibold tracking-[-.05em]">{rank.total}<span className="text-2xl text-white/60"> / 20</span></p></div><div className="text-right"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a8ddbb]">Current rank</p><p className="mt-1 flex items-center justify-end gap-2 text-5xl font-semibold tracking-[-.05em]"><Trophy className="h-7 w-7 text-[#f2c94c]" />#{rank.place}</p><p className="mt-1 text-xs text-white/60">of {results.ranked.length} finished so far</p></div></div></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3"><Score label="Round 1" value={`${rank.roundOne} / 10`} detail={duration(rank.roundOneSeconds)} /><Score label="Round 2" value={`${rank.roundTwo} / 10`} detail={duration(rank.roundTwoSeconds)} /><Score label="Total time" value={duration(rank.totalSeconds)} detail="Both rounds" /></div>
    <div className="mt-5 rounded-2xl border border-[#dbe8df] bg-white p-5"><p className="flex items-center gap-2 text-sm font-semibold text-[#173c2d]"><Clock className="h-4 w-4 text-[#4b8f74]" /> This is your place so far</p><p className="mt-1.5 text-sm leading-relaxed text-[#5a6c61]">Others are still playing. If someone finishes with a higher score, or the same score in less time, they move above you. This page updates by itself, and the final places are announced when the event ends.</p>{room?.roundTwoCaseId && <Link href={`/dashboard/cases/${encodeURIComponent(room.roundTwoCaseId)}?review=last`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#376c55] hover:underline">See your Round 2 debrief <ArrowRight className="h-4 w-4" /></Link>}</div>
    {feedback}</div></main>
}

function Score({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border border-[#dbe8df] bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#4b8f74]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[#173c2d]">{value}</p><p className="mt-1 text-xs text-[#74877b]">{detail}</p></div> }
