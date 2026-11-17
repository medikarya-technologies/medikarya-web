import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Trophy } from "lucide-react"
import { medventureParticipant } from "@/lib/events/medventure"
import { medventureResults } from "@/lib/events/medventure-results"
import { roundOnePoints, roundTwoPoints } from "@/lib/events/medventure-scoring"

export const dynamic = "force-dynamic"
export const metadata = { title: "My Medventure result" }

const duration = (seconds: number | null) => seconds === null ? "Not completed" : `${Math.floor(seconds / 60)}m ${seconds % 60}s`

export default async function MedventureResultPage() {
  const { userId } = await auth()
  if (!userId) redirect("/medventure/join")
  const participant = await medventureParticipant(userId)
  if (!participant) redirect("/medventure/join")
  const results = await medventureResults()
  const mine = results.progress.find((row) => row.userId === participant.userId)
  const rank = results.ranked.find((row) => row.userId === participant.userId)
  const roundOne = mine?.roundOneCompletedAt ? roundOnePoints(mine.roundOneRaw, results.roundOneMaximum || 1) : null
  const roundTwo = mine?.roundTwoRaw === null || mine?.roundTwoRaw === undefined ? null : roundTwoPoints(mine.roundTwoRaw)
  return <main className="min-h-screen bg-[#f5f8f5] px-5 py-10 text-[#16261d] sm:px-8 sm:py-16"><div className="mx-auto max-w-2xl"><Link href="/medventure/challenge" className="text-sm font-semibold text-[#376c55] hover:underline">← Back to challenge</Link><p className="mt-8 text-[11px] font-bold uppercase tracking-[.16em] text-[#4b8f74]">Medventure 2026</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#173c2d]">Your event result</h1>{!mine ? <div className="mt-7 rounded-2xl border border-[#dbe8df] bg-white p-6"><p className="text-sm text-[#5a6c61]">Start Round 1 to see your score here.</p><Link href="/medventure/challenge" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#376c55] px-4 py-2.5 text-sm font-semibold text-white">Start challenge <ArrowRight className="h-4 w-4" /></Link></div> : <><div className="mt-7 grid gap-3 sm:grid-cols-3"><Score label="Round 1" value={roundOne === null ? "—" : `${roundOne}/10`} detail={duration(mine.roundOneSeconds)} /><Score label="Round 2" value={roundTwo === null ? "—" : `${roundTwo}/10`} detail={duration(mine.roundTwoSeconds)} /><Score label="Total" value={rank ? `${rank.total}/20` : "—"} detail={rank ? `Place ${rank.place}` : "Complete both rounds"} /></div><div className="mt-5 rounded-2xl border border-[#dbe8df] bg-white p-6"><Trophy className="h-6 w-6 text-[#4b8f74]" /><h2 className="mt-3 text-lg font-semibold text-[#173c2d]">{rank ? `You are currently #${rank.place}.` : "Your challenge is in progress."}</h2><p className="mt-2 text-sm leading-relaxed text-[#5a6c61]">Round 1 is normalised to 10 points from the pathways your organisers published. Round 2 is your MediKarya clinical score normalised to 10. Equal totals are ordered by lower combined completion time.</p>{!rank && <Link href="/medventure/challenge" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#376c55] hover:underline">Continue challenge <ArrowRight className="h-4 w-4" /></Link>}</div></>}</div></main>
}

function Score({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border border-[#dbe8df] bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#4b8f74]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[#173c2d]">{value}</p><p className="mt-1 text-xs text-[#74877b]">{detail}</p></div> }
