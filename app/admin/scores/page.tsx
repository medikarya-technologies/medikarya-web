import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft, Maximize2, Minimize2, RefreshCw } from "lucide-react"
import { isAdmin } from "@/lib/plans/access"
import { indiaDay } from "@/lib/plans/limits"
import { listPassBatches } from "@/lib/plans/pass-batches"
import { shortName, type Count } from "@/lib/workshops/rank"
import { topScores, type CaseScores } from "@/lib/workshops/server"
import { AutoRefresh } from "./auto-refresh"

// Admin → Top scores: the day's best scores, case by case, for announcing a workshop's winners. Everyone who played
// that day, or only the students of one workshop pass. "Room view" is the same list in large type for a projector:
// first names only, and it refreshes itself every 30 seconds.

export const dynamic = "force-dynamic"
export const metadata = { title: "Top scores" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
const longDay = (day: string) =>
  new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

export default async function TopScoresPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!(await isAdmin(userId))) redirect("/")

  const params = await searchParams
  const today = indiaDay()
  const day = /^\d{4}-\d{2}-\d{2}$/.test(one(params.day)) ? one(params.day) : today
  const count: Count = one(params.count) === "best" ? "best" : "first"
  const room = one(params.room) === "1"
  const { batches } = await listPassBatches({ accounts: false })
  const batch = batches.find((b) => b.name === one(params.event)) ?? null

  const from = new Date(`${day}T00:00:00+05:30`)
  const to = new Date(from.getTime() + 86_400_000)
  const scores = await topScores({ from, to, batch, count, limit: 10 })

  const query = (extra: Record<string, string>) =>
    `/admin/scores?${new URLSearchParams({ day, count, ...(batch ? { event: batch.name } : {}), ...extra }).toString()}`

  if (room) return <RoomView scores={scores} title={batch?.name ?? "Top scores"} day={day} count={count} exit={query({})} />

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Top scores</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          The best scores of one day, case by case. Choose a workshop to see only its students (by their pass emails). Ties share a place and are listed in
          the order they finished. Admins and advisor links are never counted.
        </p>

        <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-[14px] font-medium text-slate-700">
            Day
            <input type="date" name="day" defaultValue={day} max={today} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-[15px]" />
          </label>
          <label className="text-[14px] font-medium text-slate-700">
            Students
            <select name="event" defaultValue={batch?.name ?? ""} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px]">
              <option value="">Everyone who played</option>
              {batches.map((b) => (
                <option key={b.reason} value={b.name}>
                  {b.name} ({b.emails.length})
                </option>
              ))}
            </select>
          </label>
          <label className="text-[14px] font-medium text-slate-700">
            Counting
            <select name="count" defaultValue={count} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px]">
              <option value="first">First attempt (fair for prizes)</option>
              <option value="best">Best attempt</option>
            </select>
          </label>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-sky-700">
            <RefreshCw className="h-4 w-4" /> Show
          </button>
          <Link
            href={query({ room: "1" })}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14.5px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Maximize2 className="h-4 w-4" /> Room view
          </Link>
        </form>

        <p className="mt-6 text-[14px] text-slate-500">
          {longDay(day)} · {batch ? batch.name : "everyone"} · {count === "first" ? "first attempt counts" : "best attempt counts"}
        </p>
        {scores.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No finished cases yet on this day.</p>
        ) : (
          <div className="mt-3 grid gap-5 lg:grid-cols-2">
            {scores.map((c) => (
              <section key={c.caseId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex items-baseline justify-between gap-3 border-b border-slate-200 bg-slate-100/70 px-5 py-3">
                  <h2 className="text-[16px] font-bold text-slate-900">{c.title}</h2>
                  <span className="shrink-0 text-[13px] text-slate-500">{c.players} played</span>
                </header>
                <table className="w-full text-[14.5px]">
                  <thead>
                    <tr className="text-left text-[12px] uppercase tracking-wide text-slate-500">
                      <th className="w-14 px-5 py-2 font-semibold">#</th>
                      <th className="py-2 font-semibold">Student</th>
                      <th className="py-2 text-right font-semibold">Score</th>
                      <th className="px-5 py-2 text-right font-semibold">Finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.top.map((r) => (
                      <tr key={r.userId} className="border-t border-slate-100">
                        <td className="px-5 py-2 font-semibold text-slate-500">{r.place}</td>
                        <td className="py-2 text-slate-900">
                          {r.name ?? "No name on the account"}
                          {r.attempts > 1 && <span className="ml-2 text-[12.5px] text-slate-500">{r.attempts} attempts</span>}
                        </td>
                        <td className="py-2 text-right font-bold tabular-nums text-slate-900">{r.score}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-slate-500">{time(r.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
        <AutoRefresh seconds={60} />
      </div>
    </main>
  )
}

const MEDAL = ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-900", "bg-orange-300 text-orange-950"]

/** Large type on a dark screen, readable from the back of a hall. */
function RoomView({ scores, title, day, count, exit }: { scores: CaseScores[]; title: string; day: string; count: Count; exit: string }) {
  return (
    <main className="min-h-screen bg-slate-950 px-8 py-8 text-white">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[15px] font-semibold uppercase tracking-[0.2em] text-sky-300">MediKarya · Top scores</p>
          <h1 className="mt-1 text-5xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-xl text-slate-400">
            {longDay(day)} · {count === "first" ? "first attempt counts" : "best attempt counts"}
          </p>
        </div>
        <Link href={exit} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-[14px] text-slate-400 hover:text-white">
          <Minimize2 className="h-4 w-4" /> Exit
        </Link>
      </div>

      {scores.length === 0 ? (
        <p className="mt-24 text-center text-3xl text-slate-400">Scores appear here as cases are finished.</p>
      ) : (
        <div className={`mt-10 grid gap-8 ${scores.length > 1 ? "xl:grid-cols-2" : ""}`}>
          {scores.slice(0, 4).map((c) => (
            <section key={c.caseId} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-3xl font-bold">{c.title}</h2>
                <span className="shrink-0 text-xl text-slate-400">{c.players} played</span>
              </div>
              <ol className="mt-5 space-y-2.5">
                {c.top.map((r) => (
                  <li key={r.userId} className="flex items-center gap-4 text-3xl">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl font-bold ${MEDAL[r.place - 1] ?? "bg-slate-800 text-slate-300"}`}>
                      {r.place}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{shortName(r.name)}</span>
                    <span className="font-bold tabular-nums text-sky-300">{r.score}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
      <p className="mt-10 text-center text-lg text-slate-500">Updates by itself every 30 seconds · medikarya.in</p>
      <AutoRefresh seconds={30} />
    </main>
  )
}
