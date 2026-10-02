import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { listStudioCases, studioConfigured, studioRecords, syncPublishedToStudio, type StudioRecord } from "@/lib/studio/source"
import { CsvButton } from "./csv-button"

// Case records: for every case, who wrote it, every review it had (who, when, what they said, from a private link or
// from the studio's reviewer queue), when it went live, and what its author and reviewers were given for it. The
// one place that answers "which professor approved which case, and which student wrote it".

export const dynamic = "force-dynamic"
export const metadata = { title: "Case records" }

interface Review {
  reviewer: string
  position: string
  decision: "approved" | "changes_requested"
  comments: string | null
  named: boolean
  at: string | null
  via: "Private link" | "Studio queue" | "On record"
}

interface CaseRecord {
  id: string
  title: string
  status: string
  origin: string
  author: string
  authorDetail: string
  publishedAt: string | null
  reviews: Review[]
  planReward: string | null
  payouts: StudioRecord["payouts"]
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "")
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`
const PAYOUT_KIND = { case_published: "Case", review: "Review", re_review: "Re-review" } as const
// The small name of a thing ("WRITTEN BY"), so the value under it is what the eye lands on.
const LABEL = "text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"

async function load(): Promise<CaseRecord[]> {
  const [{ data: cases, error }, { data: links }, { data: grants }, studioCases, studio] = await Promise.all([
    supabaseServer
      .from("cases")
      .select("id, title, status, updated_at, credit:case_json->credit, review:case_json->review, source:case_json->source, published_at:case_json->>published_at")
      .order("updated_at", { ascending: false }),
    supabaseServer
      .from("case_reviews")
      .select("case_id, reviewer_name, reviewer_designation, reviewer_department, reviewer_institution, show_name, decision, comments, decided_at")
      .not("decision", "is", null)
      .order("decided_at", { ascending: true }),
    supabaseServer.from("plan_grants").select("email, tier, months, ends_at, case_id").eq("reason", "case_published"),
    studioConfigured() ? listStudioCases().catch(() => []) : Promise.resolve([]),
    studioRecords().catch(() => new Map<string, StudioRecord>()),
  ])
  if (error) throw error

  // Cases that went live before publishing was reported to the studio: report them now, so their authors are paid.
  const live = (cases ?? [])
    .filter((c) => c.status === "published" && (c.source as any)?.studio_case_id && !studio.get((c.source as any).studio_case_id)?.publishedAt)
    .map((c) => ({ studioCaseId: (c.source as any).studio_case_id as string, publishedAt: (c.published_at as string | null) ?? c.updated_at }))
  if (live.length) await syncPublishedToStudio(live).catch((e) => console.error("Could not sync published cases to the studio:", e))

  return (cases ?? []).map((c) => {
    const credit = (c.credit ?? {}) as Record<string, any>
    const onCase = (c.review ?? null) as Record<string, any> | null
    const source = (c.source ?? {}) as Record<string, any>
    const studioId: string | undefined = source.studio_case_id
    const sheet = studioId ? studioCases.find((s) => s.id === studioId) : undefined
    const record = studioId ? studio.get(studioId) : undefined

    const reviews: Review[] = [
      ...(links ?? [])
        .filter((l) => l.case_id === c.id)
        .map((l) => ({
          reviewer: l.reviewer_name ?? "Not given",
          position: [l.reviewer_designation, l.reviewer_department, l.reviewer_institution].filter(Boolean).join(", "),
          decision: l.decision as Review["decision"],
          comments: l.comments,
          named: l.show_name,
          at: l.decided_at,
          via: "Private link" as const,
        })),
      ...(record?.reviews ?? []).map((r) => ({ reviewer: r.reviewer, position: r.position, decision: r.decision, comments: r.comments, named: r.showName, at: r.decidedAt, via: "Studio queue" as const })),
    ].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))
    // A review recorded on the case itself with no link or queue behind it (the founding cases).
    if (reviews.length === 0 && onCase?.decision === "approved" && onCase.reviewer_name) {
      reviews.push({
        reviewer: onCase.reviewer_name,
        position: [onCase.reviewer_designation, onCase.reviewer_department, onCase.reviewer_institution].filter(Boolean).join(", "),
        decision: "approved",
        comments: null,
        named: !!onCase.show_name,
        at: onCase.decided_at ?? null,
        via: "On record",
      })
    }

    const grant = (grants ?? []).find((g) => g.case_id === c.id)
    return {
      id: c.id,
      title: c.title ?? c.id,
      status: c.status,
      origin: studioId ? "Case Studio" : credit.source ? String(credit.source) : "MediKarya team",
      author: credit.author ?? sheet?.author ?? "",
      authorDetail: [credit.institution, sheet?.authorEmail].filter(Boolean).join(" · "),
      publishedAt: c.status === "published" ? ((c.published_at as string | null) ?? record?.publishedAt ?? null) : null,
      reviews,
      planReward: grant ? `${grant.months} month${grant.months === 1 ? "" : "s"} of ${grant.tier} to ${grant.email} (until ${day(grant.ends_at)})` : null,
      payouts: record?.payouts ?? [],
    }
  })
}

export default async function CaseRecordsPage() {
  const { userId } = await auth()
  if (!(await isAdmin(userId ?? null))) redirect("/")

  const records = await load()
  const published = records.filter((r) => r.status === "published")
  const authors = new Set(records.map((r) => r.author).filter(Boolean))
  const reviewers = new Set(records.flatMap((r) => r.reviews.map((x) => x.reviewer)))

  const csv = records.flatMap((r) => {
    const base = [r.id, r.title, r.status, r.origin, r.author, r.authorDetail, day(r.publishedAt), r.planReward ?? "", r.payouts.map((p) => `${PAYOUT_KIND[p.kind]} ${p.payee} ${p.amount} ${p.status}`).join("; ")]
    if (r.reviews.length === 0) return [[...base, "", "", "", "", "", "", ""]]
    return r.reviews.map((v) => [...base, v.reviewer, v.position, v.decision === "approved" ? "Approved" : "Changes asked", day(v.at), v.via, v.named ? "Yes" : "No", v.comments ?? ""])
  })

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Case records</h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
              Who wrote each case, who reviewed it and what they said, when it went live, and what was given for it. Payouts are made and marked paid in
              the Case Studio (Admin → Payouts).
            </p>
          </div>
          <CsvButton
            filename={`medikarya-case-records-${new Date().toISOString().slice(0, 10)}.csv`}
            header={["Case ID", "Title", "Status", "Came from", "Author", "Author details", "Published", "Plan reward", "Payouts", "Reviewer", "Reviewer position", "Decision", "Reviewed on", "Reviewed through", "Named publicly", "Comments"]}
            rows={csv}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Cases", records.length],
            ["Live", published.length],
            ["Authors", authors.size],
            ["Reviewers", reviewers.size],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className={LABEL}>{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{n}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-5">
          {records.map((r) => (
            <article key={r.id} className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              {/* The case: its name is the heading of everything under it. */}
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-100/70 px-5 py-3.5">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-bold leading-snug text-slate-900">{r.title}</h2>
                  <p className="mt-0.5 font-mono text-[12px] text-slate-500">{r.id}</p>
                </div>
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-3 py-1 text-xs font-bold ${r.status === "published" ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900"}`}
                >
                  {r.status === "published" ? `Live${r.publishedAt ? ` since ${day(r.publishedAt)}` : ""}` : "Draft"}
                </span>
              </header>

              <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <section className="px-5 py-4">
                  <p className={LABEL}>Written by</p>
                  <p className="mt-1 text-[16px] font-semibold text-slate-900">{r.author || "Not recorded"}</p>
                  {r.authorDetail && <p className="text-[14px] text-slate-600">{r.authorDetail}</p>}
                  <p className="mt-1 text-[13px] text-slate-500">Came from: {r.origin}</p>
                </section>
                <section className="px-5 py-4">
                  <p className={LABEL}>Given for it</p>
                  {!r.planReward && r.payouts.length === 0 && <p className="mt-1 text-[15px] text-slate-500">Nothing recorded</p>}
                  <ul className="mt-1 space-y-1 text-[15px] text-slate-900">
                    {r.planReward && <li>{r.planReward}</li>}
                    {r.payouts.map((p, i) => (
                      <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span>
                          <span className="font-semibold">{rupees(p.amount)}</span> to {p.payee} <span className="text-slate-500">({PAYOUT_KIND[p.kind].toLowerCase()})</span>
                        </span>
                        <span
                          className={`text-[13px] font-semibold ${p.status === "paid" ? "text-emerald-700" : p.status === "owed" ? "text-amber-700" : "text-slate-500"}`}
                        >
                          {p.status === "paid" ? `Paid ${day(p.paidAt)}` : p.status === "owed" ? "Owed" : "Not payable"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section className="border-t border-slate-200 px-5 py-4">
                <p className={LABEL}>
                  Reviews{r.reviews.length > 1 ? ` (${r.reviews.length}, oldest first)` : ""}
                </p>
                {r.reviews.length === 0 && <p className="mt-1 text-[15px] text-slate-500">No review recorded.</p>}
                <ul className="mt-2 space-y-3">
                  {r.reviews.map((v, i) => (
                    <li key={i} className={`border-l-[3px] pl-3.5 ${v.decision === "approved" ? "border-emerald-500" : "border-amber-500"}`}>
                      <p className="text-[15px] text-slate-900">
                        <span className={`font-bold ${v.decision === "approved" ? "text-emerald-700" : "text-amber-700"}`}>{v.decision === "approved" ? "Approved" : "Changes asked"}</span>
                        {" by "}
                        <span className="font-semibold">{v.reviewer}</span>
                      </p>
                      {v.position && <p className="text-[14px] text-slate-600">{v.position}</p>}
                      <p className="mt-0.5 text-[13px] text-slate-500">{[day(v.at), v.via, v.named ? "Named on the case" : "Not named publicly"].filter(Boolean).join(" · ")}</p>
                      {v.comments && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-[14px] leading-relaxed text-slate-700">{v.comments}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            </article>
          ))}
          {records.length === 0 && <p className="text-slate-500">No cases yet.</p>}
        </div>
      </div>
    </main>
  )
}
