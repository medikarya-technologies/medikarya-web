import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { ArrowLeft, Trophy } from "lucide-react"
import { canManageMedventure, MEDVENTURE } from "@/lib/events/medventure"
import { getPassBatch } from "@/lib/plans/pass-batches"
import { shortName } from "@/lib/workshops/rank"
import { topScores } from "@/lib/workshops/server"

export const dynamic = "force-dynamic"
export const metadata = { title: "Medventure clinical reasoning scores" }

export default async function MedventureResultsPage() {
  const { userId } = await auth()
  if (!(await canManageMedventure(userId)).allowed) redirect("/")
  const batch = await getPassBatch(MEDVENTURE.name)
  if (!batch) return <Empty />

  const from = new Date(`${MEDVENTURE.date}T00:00:00+05:30`)
  const scores = await topScores({ from, to: new Date(from.getTime() + 86_400_000), batch, count: "first", limit: 60 })
  return (
    <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-[#18231e] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl"><Link href="/medventure/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5a6c61] hover:text-[#173c2d]"><ArrowLeft className="h-4 w-4" /> Organiser desk</Link><p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b8f74]">Clinical reasoning round</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#173c2d]">First-attempt scores</h1><p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#5a6c61]">Only students in the Medventure pass batch are shown. These are the MediKarya case scores; the general MCQ round will be combined here when its event quiz is connected.</p><div className="mt-8 space-y-5">{scores.length === 0 ? <p className="rounded-2xl border border-dashed border-[#c9ddd0] bg-white p-8 text-center text-sm text-[#5a6c61]">No completed clinical reasoning attempts yet.</p> : scores.map((caseScores) => <section key={caseScores.caseId} className="overflow-hidden rounded-2xl border border-[#dbe8df] bg-white"><header className="border-b border-[#dbe8df] bg-[#eff6f1] px-5 py-4"><h2 className="font-semibold text-[#173c2d]">{caseScores.title}</h2><p className="mt-1 text-sm text-[#5a6c61]">{caseScores.players} completed attempt{caseScores.players === 1 ? "" : "s"}</p></header><ol className="divide-y divide-[#edf3ef]">{caseScores.top.map((row) => <li key={row.userId} className="flex items-center gap-4 px-5 py-3.5"><span className="w-8 text-center font-mono text-sm font-semibold text-[#4b8f74]">{row.place}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-[#264a37]">{shortName(row.name)}</span><strong className="text-sm tabular-nums text-[#173c2d]">{row.score}</strong></li>)}</ol></section>)}</div></div>
    </main>
  )
}

function Empty() {
  return <main className="grid min-h-screen place-items-center bg-[#f7faf8] p-4"><div className="max-w-md rounded-2xl border border-[#dbe8df] bg-white p-8 text-center"><Trophy className="mx-auto h-9 w-9 text-[#4b8f74]" /><h1 className="mt-4 text-xl font-semibold text-[#173c2d]">Set up participant entry first</h1><p className="mt-2 text-sm leading-relaxed text-[#5a6c61]">The clinical reasoning scores appear after the Medventure pass batch has been created.</p><Link href="/medventure/admin" className="mt-6 inline-flex text-sm font-semibold text-[#376c55] hover:underline">Back to organiser desk</Link></div></main>
}
