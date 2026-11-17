import { redirect } from "next/navigation"
import { ArrowLeft, Ticket } from "lucide-react"
import Link from "next/link"
import { MEDVENTURE } from "@/lib/events/medventure"
import { listJoinLinks } from "@/lib/plans/join-links"

export const dynamic = "force-dynamic"
export const metadata = { title: "Join Medventure" }

export default async function MedventureJoinPage() {
  const { links } = await listJoinLinks({ event: MEDVENTURE.name })
  const link = links.find((item) => item.active) ?? links[0]
  if (link) redirect(`/join/${link.code}`)

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7faf8] px-4 text-[#18231e]">
      <div className="w-full max-w-md rounded-2xl border border-[#dbe8df] bg-white p-7 text-center shadow-sm">
        <Ticket className="mx-auto h-9 w-9 text-[#4b8f74]" />
        <h1 className="mt-4 text-xl font-semibold text-[#173c2d]">Entry is not open yet</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5a6c61]">Your Medventure organisers will share the event entry link at the venue. Sign in or create your MediKarya account then to receive your five-day access pass.</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#376c55] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to Medventure</Link>
      </div>
    </main>
  )
}
