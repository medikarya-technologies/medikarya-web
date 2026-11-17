import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { canManageMedventure, medventurePathways } from "@/lib/events/medventure"
import { MedventureQuestionsAdmin } from "./questions-admin"

export const dynamic = "force-dynamic"
export const metadata = { title: "Medventure Round 1" }

export default async function MedventureQuestionsPage() {
  const { userId } = await auth()
  const access = await canManageMedventure(userId)
  if (!access.allowed) redirect("/")
  const { available, pathways } = await medventurePathways()

  return <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-[#18231e] sm:px-6 sm:py-12"><div className="mx-auto max-w-5xl">
    <Link href="/medventure/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5a6c61] hover:text-[#173c2d]"><ArrowLeft className="h-4 w-4" /> Organiser desk</Link>
    <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b8f74]">Round 1 authoring</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#173c2d] sm:text-4xl">Build the decision pathways.</h1>
    <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[#5a6c61]">Write each question, its answers, score and next decision here. A published pathway is available to students only when the organiser opens the room.</p>
    {!available ? <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Run <code className="rounded bg-white px-1.5 py-0.5">scripts/create_medventure_challenge.sql</code> in the main MediKarya Supabase project first.</p> : <MedventureQuestionsAdmin pathways={pathways} />}
  </div></main>
}
