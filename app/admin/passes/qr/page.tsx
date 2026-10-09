import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { Minimize2 } from "lucide-react"
import { QrCode } from "@/components/qr-code"
import { isAdmin } from "@/lib/plans/access"
import { getJoinLink } from "@/lib/plans/join-links"
import { PLAN_NAME } from "@/lib/plans/limits"
import { cleanJoinCode, passDays } from "@/lib/plans/passes"
import { shortLink, siteOrigin } from "@/lib/site-origin"
import { AutoRefresh } from "../../scores/auto-refresh"

// Admin → Workshop passes → Show QR: a join link for the projector. A big QR code, the link written out for anyone
// whose camera will not scan, three steps, and how many have joined (it refreshes itself every 15 seconds).

export const dynamic = "force-dynamic"
export const metadata = { title: "Join the workshop" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const STATE_NOTE = {
  off: "This link is switched off.",
  not_yet: "This link is not open yet.",
  closed: "This link has closed.",
  full: "This link is full.",
} as const

export default async function JoinQrPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!(await isAdmin(userId))) redirect("/")

  const raw = (await searchParams).code
  const code = typeof raw === "string" ? cleanJoinCode(raw) : null
  const link = code ? await getJoinLink(code) : null
  if (!link) redirect("/admin/passes")

  const url = `${await siteOrigin()}/join/${link.code}`
  const days = passDays(new Date(link.startsAt), new Date(link.endsAt))

  return (
    <main className="flex min-h-screen flex-col bg-white px-8 py-8 text-slate-900">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src="/medikarya.svg" alt="" className="h-11 w-11" />
          <span className="text-3xl font-bold tracking-tight">MediKarya</span>
        </div>
        <Link href="/admin/passes" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-500 hover:text-slate-900">
          <Minimize2 className="h-4 w-4" /> Exit
        </Link>
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-6xl flex-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex justify-center">
          <QrCode value={url} label={`QR code: ${shortLink(url)}`} className="w-full max-w-[min(70vh,520px)] rounded-2xl border-4 border-slate-900 p-2" />
        </div>
        <div>
          <p className="text-xl font-semibold uppercase tracking-[0.18em] text-sky-700">{link.event}</p>
          <h1 className="mt-3 text-5xl font-bold leading-tight tracking-tight">
            {PLAN_NAME[link.plan]} free for {days} days
          </h1>
          <ol className="mt-8 space-y-5 text-3xl">
            {["Scan the code with your phone", "Sign in, or sign up with Google", "Tap Join, then start your first case"].map((step, i) => (
              <li key={step} className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-600 text-2xl font-bold text-white">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-10 text-xl text-slate-500">No camera? Type</p>
          {/* it may wrap after "join/", never inside the code itself */}
          <p className="mt-1 font-mono text-4xl font-semibold">
            {shortLink(url).replace(link.code, "")}
            <wbr />
            <span className="whitespace-nowrap">{link.code}</span>
          </p>
          <p className="mt-8 text-2xl text-slate-600">
            {link.state === "open" ? (
              <>
                <span className="font-bold tabular-nums text-slate-900">{link.joined}</span> joined so far
              </>
            ) : (
              <span className="font-semibold text-red-700">{STATE_NOTE[link.state]}</span>
            )}
          </p>
        </div>
      </div>
      <AutoRefresh seconds={15} />
    </main>
  )
}
