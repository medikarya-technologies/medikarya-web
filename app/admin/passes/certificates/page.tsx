import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { getCases } from "@/data/cases"
import { isAdmin } from "@/lib/plans/access"
import { indiaDay } from "@/lib/plans/limits"
import { getPassBatch } from "@/lib/plans/pass-batches"
import { CASE_STUDIO_URL } from "@/lib/site-links"
import { workshopCertificates, type WorkshopCertificate } from "@/lib/studio/source"
import { attemptsOf, membersOf } from "@/lib/workshops/server"
import { CertificatesAdmin } from "./certificates-admin"

// Admin → Workshop passes → Certificates: a participation certificate for every student of a workshop who finished
// the cases you tick, while their pass ran. Same certificates as the studio's (credential ID, QR code, page on
// /verify); students find theirs on their dashboard.

export const dynamic = "force-dynamic"
export const metadata = { title: "Workshop certificates" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function WorkshopCertificatesPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!(await isAdmin(userId))) redirect("/")

  const event = (await searchParams).event
  const batch = typeof event === "string" ? await getPassBatch(event) : null

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/admin/passes" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Workshop passes
        </Link>
        {batch ? <Body batch={batch} /> : <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">There is no workshop pass with that name.</p>}
      </div>
    </main>
  )
}

async function Body({ batch }: { batch: NonNullable<Awaited<ReturnType<typeof getPassBatch>>> }) {
  const members = await membersOf(batch.emails)
  const [rows, cases] = await Promise.all([
    attemptsOf(
      members.map((m) => m.userId),
      new Date(batch.startsAt),
      new Date(batch.endsAt)
    ),
    getCases(),
  ])
  let issued = new Map<string, WorkshopCertificate>()
  let studioProblem: string | null = null
  try {
    issued = await workshopCertificates(batch.name)
  } catch (error) {
    studioProblem = error instanceof Error ? error.message : "The case studio could not be read."
  }

  const titles = new Map(cases.map((c) => [c.id, c.displayTitle]))
  const done = new Map<string, Set<string>>()
  for (const r of rows) {
    if (typeof r.score !== "number") continue
    done.set(r.user_id, (done.get(r.user_id) ?? new Set()).add(r.case_id))
  }
  const players = new Map<string, number>()
  for (const set of done.values()) for (const id of set) players.set(id, (players.get(id) ?? 0) + 1)
  const played = [...players.entries()].map(([id, n]) => ({ id, title: titles.get(id) ?? id, players: n })).sort((a, b) => b.players - a.players)

  const students = members
    .map((m) => ({ email: m.email, name: m.name ?? "", done: [...(done.get(m.userId) ?? [])] }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const first = [...issued.values()][0]

  return (
    <>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Certificates: {batch.name}</h1>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
        A certificate of participation for each student who finished every case you tick while their pass ran ({batch.days} days from the start day). Check the
        names: they are printed as written here. Students see their certificate on their dashboard, with its QR code and a link for LinkedIn.
      </p>
      {studioProblem ? (
        <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-950">{studioProblem}</p>
      ) : (
        <CertificatesAdmin
          event={batch.name}
          students={students}
          notSignedUp={batch.emails.length - members.length}
          cases={played}
          issued={Object.fromEntries([...issued.entries()].map(([email, c]) => [email, { credentialId: c.credentialId, name: c.name, revoked: c.revoked }]))}
          defaults={{ title: first?.title ?? "Clinical Reasoning Workshop", day: indiaDay(new Date(batch.startsAt)) }}
          studioUrl={CASE_STUDIO_URL}
        />
      )}
    </>
  )
}
