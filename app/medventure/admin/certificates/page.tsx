import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getCases } from "@/data/cases"
import { CertificatesAdmin } from "@/app/admin/passes/certificates/certificates-admin"
import { canManageMedventure, MEDVENTURE } from "@/lib/events/medventure"
import { indiaDay } from "@/lib/plans/limits"
import { getPassBatch } from "@/lib/plans/pass-batches"
import { CASE_STUDIO_URL } from "@/lib/site-links"
import { workshopCertificates, type WorkshopCertificate } from "@/lib/studio/source"
import { attemptsOf, membersOf } from "@/lib/workshops/server"
import { issueMedventureCertificatesAction } from "../actions"

export const dynamic = "force-dynamic"
export const metadata = { title: "Medventure certificates" }

export default async function MedventureCertificatesPage() {
  const { userId } = await auth()
  if (!(await canManageMedventure(userId)).allowed) redirect("/")
  const batch = await getPassBatch(MEDVENTURE.name)
  if (!batch) redirect("/medventure/admin")
  const members = await membersOf(batch.emails)
  const [rows, cases] = await Promise.all([
    attemptsOf(members.map((member) => member.userId), new Date(batch.startsAt), new Date(batch.endsAt)),
    getCases(),
  ])
  let issued = new Map<string, WorkshopCertificate>()
  let studioProblem: string | null = null
  try {
    issued = await workshopCertificates(batch.name)
  } catch (error) {
    studioProblem = error instanceof Error ? error.message : "The Case Studio could not be read."
  }

  const titles = new Map(cases.map((item) => [item.id, item.displayTitle]))
  const done = new Map<string, Set<string>>()
  for (const row of rows) if (typeof row.score === "number") done.set(row.user_id, (done.get(row.user_id) ?? new Set()).add(row.case_id))
  const players = new Map<string, number>()
  for (const completed of done.values()) for (const id of completed) players.set(id, (players.get(id) ?? 0) + 1)
  const played = [...players.entries()].map(([id, players]) => ({ id, title: titles.get(id) ?? id, players })).sort((a, b) => b.players - a.players)
  const students = members.map((member) => ({ email: member.email, name: member.name ?? "", done: [...(done.get(member.userId) ?? [])] })).sort((a, b) => a.name.localeCompare(b.name))
  const first = [...issued.values()][0]

  return <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-[#18231e] sm:px-6 sm:py-12"><div className="mx-auto max-w-5xl"><Link href="/medventure/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5a6c61] hover:text-[#173c2d]"><ArrowLeft className="h-4 w-4" /> Organiser desk</Link><h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-[#173c2d]">Medventure certificates</h1><p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[#5a6c61]">Issue QR-verifiable certificates to event participants who complete the selected MediKarya case. They appear on each student’s MediKarya dashboard.</p>{studioProblem ? <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{studioProblem}</p> : <CertificatesAdmin event={batch.name} students={students} notSignedUp={batch.emails.length - members.length} cases={played} issued={Object.fromEntries([...issued.entries()].map(([email, certificate]) => [email, { credentialId: certificate.credentialId, name: certificate.name, revoked: certificate.revoked }]))} defaults={{ title: first?.title ?? "Medventure Clinical Decision Challenge", day: indiaDay(new Date(batch.startsAt)) }} studioUrl={CASE_STUDIO_URL} issueAction={issueMedventureCertificatesAction} />}</div></main>
}
