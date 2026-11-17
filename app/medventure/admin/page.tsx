import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { canManageMedventure, listMedventureStaff, medventureRoom, MEDVENTURE } from "@/lib/events/medventure"
import { getPassBatch } from "@/lib/plans/pass-batches"
import { listJoinLinks } from "@/lib/plans/join-links"
import { siteOrigin } from "@/lib/site-origin"
import { MedventureAdmin } from "./medventure-admin"

export const dynamic = "force-dynamic"
export const metadata = { title: "Medventure organiser desk" }

export default async function MedventureAdminPage() {
  const { userId } = await auth()
  if (!userId) redirect("/medventure/join")
  const access = await canManageMedventure(userId)
  if (!access.allowed) redirect("/")

  const [batch, links, dryRunLinks, staff, origin, eventRoom] = await Promise.all([
    getPassBatch(MEDVENTURE.name),
    listJoinLinks({ event: MEDVENTURE.name }),
    listJoinLinks({ event: MEDVENTURE.dryRun.name }),
    access.owner ? listMedventureStaff() : Promise.resolve({ available: true, staff: [] }),
    siteOrigin(),
    medventureRoom(),
  ])

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#18231e]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5a6c61] hover:text-[#173c2d]"><ArrowLeft className="h-4 w-4" /> Medventure</Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4b8f74]">Organiser desk</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#173c2d] sm:text-4xl">{MEDVENTURE.name}</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[#5a6c61]">Entry, five-day MediKarya access, certificates and the clinical reasoning round. This workspace is limited to Medventure and does not grant access to the wider MediKarya admin.</p>
        <MedventureAdmin origin={origin} owner={access.owner} batch={batch} links={links.links} dryRunLinks={dryRunLinks.links} staff={staff.staff} staffAvailable={staff.available} room={eventRoom.room} roomAvailable={eventRoom.available} />
      </div>
    </main>
  )
}
