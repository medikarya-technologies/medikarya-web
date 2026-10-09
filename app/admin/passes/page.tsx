import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { isAdmin } from "@/lib/plans/access"
import { indiaDay } from "@/lib/plans/limits"
import { listPassBatches } from "@/lib/plans/pass-batches"
import { listJoinLinks } from "@/lib/plans/join-links"
import { siteOrigin } from "@/lib/site-origin"
import { PassesAdmin } from "./passes-admin"

// Admin → Workshop passes. Everyone at an event gets a plan free for a few days, in one of two ways: a join link shown
// in the room as a QR code (whoever opens it and signs in gets the pass, whatever their email), or a pasted list of
// registered emails (the plan applies when they sign in with that email). Nothing is charged and nothing renews.

export const dynamic = "force-dynamic"
export const metadata = { title: "Workshop passes" }

export default async function PassesAdminPage() {
  const { userId } = await auth()
  if (!(await isAdmin(userId))) redirect("/")

  const [{ available, batches }, joinLinks, origin] = await Promise.all([listPassBatches(), listJoinLinks(), siteOrigin()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Workshop passes</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          Give everyone at a workshop a plan for free, for a few days. Best on the day: a join link, shown in the room as a QR code.
          Whoever scans it and signs in gets the pass, with any email. Or paste the emails people registered with: the plan applies when
          they sign in with that same email. When the pass ends they go back to the free plan. Nothing is charged and nothing renews.
        </p>

        {!available ? (
          <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-950">
            One step first: run <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px]">scripts/create_reviews_and_grants.sql</code> in the Supabase SQL
            editor of the <strong>main site&apos;s</strong> project.
          </p>
        ) : (
          <PassesAdmin batches={batches} today={indiaDay()} links={joinLinks.links} linksAvailable={joinLinks.available} origin={origin} />
        )}
      </div>
    </main>
  )
}
