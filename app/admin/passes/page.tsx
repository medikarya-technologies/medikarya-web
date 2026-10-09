import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { isAdmin } from "@/lib/plans/access"
import { indiaDay } from "@/lib/plans/limits"
import { listPassBatches } from "@/lib/plans/pass-batches"
import { PassesAdmin } from "./passes-admin"

// Admin → Workshop passes. Everyone registered for an event gets a plan free for a few days: paste their emails,
// and the plan applies when they sign in with that email. Nothing is charged and nothing renews.

export const dynamic = "force-dynamic"
export const metadata = { title: "Workshop passes" }

export default async function PassesAdminPage() {
  const { userId } = await auth()
  if (!(await isAdmin(userId))) redirect("/")

  const { available, batches } = await listPassBatches()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Workshop passes</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          Give everyone registered for a workshop a plan for free, for a few days. Paste the emails they registered with. A student who
          already has an account gets the plan at once (from the start day); anyone else gets it as soon as they sign up with that same
          email. When the pass ends they go back to the free plan. Nothing is charged and nothing renews.
        </p>

        {!available ? (
          <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-950">
            One step first: run <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px]">scripts/create_reviews_and_grants.sql</code> in the Supabase SQL
            editor of the <strong>main site&apos;s</strong> project.
          </p>
        ) : (
          <PassesAdmin batches={batches} today={indiaDay()} />
        )}
      </div>
    </main>
  )
}
