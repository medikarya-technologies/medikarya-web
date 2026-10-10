import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { isSimulationCase } from "@/lib/simulation/case-schema"
import { upgradeLegacyCase } from "@/lib/simulation/legacy-adapter"
import { checkLivePlan, isLivePlan, measuredOnArrival } from "@/lib/simulation/live-plan"
import { LiveRow, type LiveCase } from "./live-row"

// Admin → Live cases. Every case in the library, and where each stands on becoming a live one: no plan, a proposed
// plan (drafted by AI, or written by a resident in the Case Studio), signed off by a clinician (optional), or live for students.

export const dynamic = "force-dynamic"
export const metadata = { title: "Live cases" }

async function load(): Promise<LiveCase[]> {
  const { data, error } = await supabaseServer.from("cases").select("id, title, status, difficulty, category, case_json").order("updated_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const c = row.case_json as Record<string, any>
    const plan = isLivePlan(c.live_plan) ? c.live_plan : null
    const authored = isSimulationCase(c)
    const base = authored ? null : upgradeLegacyCase(c)
    const playable = !!base && isSimulationCase(base)
    const check = plan && playable ? checkLivePlan(plan, measuredOnArrival(base as any)) : null
    return {
      id: row.id,
      title: row.title ?? c.title ?? row.id,
      displayTitle: c.displayTitle ?? "",
      status: row.status === "published" ? "published" : "draft",
      difficulty: row.difficulty ?? c.difficulty ?? "",
      category: row.category ?? c.category ?? "",
      authored,
      playable,
      plan: plan
        ? {
            origin: plan.origin,
            status: plan.status,
            summary: plan.summary,
            stages: plan.stages.length,
            treatments: plan.treatments.length,
            window: plan.critical_window_minutes,
            limit: plan.time_limit_minutes,
            draftedAt: plan.drafted_at ?? null,
            teamCheckedAt: plan.team_checked_at ?? null,
            signOff: plan.sign_off
              ? { decision: plan.sign_off.decision, by: plan.sign_off.reviewer_name ?? null, at: plan.sign_off.decided_at, comments: plan.sign_off.comments ?? null }
              : null,
            errors: check?.errors ?? [],
            warnings: check?.warnings ?? [],
          }
        : null,
    }
  })
}

export default async function LiveCasesPage() {
  const { userId } = await auth()
  if (!(await isAdmin(userId))) redirect("/")
  const cases = await load()
  const live = cases.filter((c) => c.plan?.status === "approved" && c.status === "published").length
  const waiting = cases.filter((c) => c.plan && c.plan.status !== "approved").length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Live cases</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          A live case has a clock, a treatment tray and a patient who gets worse until the right things are done. Any ordinary case with an acute
          course can become one: the AI drafts the plan (what happens untreated, what each treatment does, what stops it), you read it and
          play-test it, and then you switch it on. Until then students keep the ordinary case. A live case counts against the live allowance on
          a student&apos;s plan.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
          {[
            ["Cases", cases.length],
            ["Live for students", live],
            ["Plans waiting", waiting],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-bold tracking-[0.1em] text-slate-500 uppercase">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{n}</p>
            </div>
          ))}
        </div>

        <ul className="mt-8 space-y-4">
          {cases.map((c) => (
            <LiveRow key={c.id} c={c} />
          ))}
        </ul>
      </div>
    </main>
  )
}
