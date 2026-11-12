import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft, Filter } from "lucide-react"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { countFunnel, TRY_STEPS, type FunnelCount, type TryStep } from "@/lib/try-funnel"

export const dynamic = "force-dynamic"
export const metadata = { title: "Try funnel" }

// Where guests stop in the free case on /try (lib/try-funnel.ts, table from scripts/create_try_funnel.sql). Our own
// testing is left out. The same numbers as scripts/try-funnel-report.mjs, for checking from a phone.

const LABEL: Record<TryStep, string> = {
  viewed: "Saw the case briefing",
  started: "Opened the case",
  asked: "Got a first answer from the patient",
  examined: "Examined the patient",
  ordered: "Ordered a test",
  submitted: "Submitted a diagnosis and plan",
  finished: "Saw the debrief",
  signed_up: "Signed up with that play",
}

const RANGES = [1, 3, 7, 30] as const
const SMALL = "text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"

interface Row {
  guest_id: string
  step: string
  ad_source: string | null
  internal: boolean
}

function isMissingTable(error: { code?: string; message: string } | null) {
  if (!error) return false
  return error.code === "42P01" || error.code === "PGRST205" || /try_funnel/i.test(error.message) && /(does not exist|could not find|schema cache)/i.test(error.message)
}

async function loadRows(since: string): Promise<{ rows: Row[]; error: { code?: string; message: string } | null }> {
  const rows: Row[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabaseServer
      .from("try_funnel")
      .select("guest_id, step, ad_source, internal")
      .gte("created_at", since)
      .range(from, from + 999)
    if (error) return { rows, error }
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  return { rows, error: null }
}

/** The largest fall between two steps in a row, among steps that started with anyone. */
function biggestDrop(counts: FunnelCount[]): { from: TryStep; to: TryStep; lost: number; share: number } | null {
  let worst: { from: TryStep; to: TryStep; lost: number; share: number } | null = null
  // signed_up is a different kind of step (it needs an account), so the drop into it is not compared here.
  for (let i = 0; i < counts.length - 2; i++) {
    const a = counts[i]
    const b = counts[i + 1]
    if (!a.guests) continue
    const lost = Math.max(0, a.guests - b.guests)
    const share = lost / a.guests
    if (!worst || share > worst.share) worst = { from: a.step, to: b.step, lost, share }
  }
  return worst && worst.lost > 0 ? worst : null
}

function Funnel({ title, note, counts }: { title: string; note: string; counts: FunnelCount[] }) {
  const base = counts[0].guests
  const drop = biggestDrop(counts)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{note}</p>
      </div>
      {base === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No visits in this period yet.</p>
      ) : (
        <>
          <ol className="mt-5 space-y-3">
            {counts.map((c, i) => {
              const share = c.guests / base
              const prev = i > 0 ? counts[i - 1].guests : null
              return (
                <li key={c.step}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-800">{LABEL[c.step]}</span>
                    <span className="shrink-0 tabular-nums text-slate-600">
                      <strong className="text-slate-900">{c.guests}</strong>
                      <span className="ml-2 text-slate-400">{Math.round(share * 100)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(share * 100, c.guests ? 1.5 : 0)}%` }} />
                  </div>
                  {prev !== null && prev > 0 && c.guests < prev && (
                    <p className="mt-1 text-xs text-slate-400">{prev - c.guests} stopped before this</p>
                  )}
                </li>
              )
            })}
          </ol>
          {drop && (
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Biggest drop: {Math.round(drop.share * 100)}% of those who {LABEL[drop.from].toLowerCase()} did not go on to{" "}
              {LABEL[drop.to].charAt(0).toLowerCase() + LABEL[drop.to].slice(1)} ({drop.lost} people).
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default async function AdminFunnelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { userId } = await auth()
  if (!(await isAdmin(userId ?? null))) redirect("/")

  const asked = Number((await searchParams).days)
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 7
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { rows, error } = await loadRows(since)
  const missing = isMissingTable(error)

  const real = rows.filter((r) => !r.internal)
  const fromAd = new Set(real.filter((r) => r.ad_source === "meta").map((r) => r.guest_id))
  const all = countFunnel(real)
  const ads = countFunnel(real.filter((r) => fromAd.has(r.guest_id)))
  const testing = new Set(rows.filter((r) => r.internal).map((r) => r.guest_id)).size

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Try funnel</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
              How far guests get through the free case on /try. Each person counts once per step. Our own testing (admins,
              ?mk_internal=1, test mode) is left out. &ldquo;From Meta ads&rdquo; means the visit began with a Meta ad click.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm">
            <Filter className="h-4 w-4 text-sky-600" /> /try, step by step
          </div>
        </header>

        <nav aria-label="Period" className="flex flex-wrap items-center gap-2">
          <span className={SMALL}>Last</span>
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/admin/funnel?days=${d}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${d === days ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {d === 1 ? "24 hours" : `${d} days`}
            </Link>
          ))}
        </nav>

        {missing ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            The try_funnel table is not there yet. Run scripts/create_try_funnel.sql in the main project&apos;s SQL editor.
          </p>
        ) : error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">Could not load the funnel: {error.message}</p>
        ) : (
          <>
            <Funnel title="All guests" note={`${all[0].guests} saw the briefing`} counts={all} />
            <Funnel title="From Meta ads" note={`${ads[0].guests} saw the briefing`} counts={ads} />
            <p className="text-xs text-slate-400">
              {testing} of our own test visit{testing === 1 ? "" : "s"} left out. Steps: {TRY_STEPS.length}. Someone can do a
              later step without an earlier one (order a test before asking anything), so counts need not shrink in order.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
