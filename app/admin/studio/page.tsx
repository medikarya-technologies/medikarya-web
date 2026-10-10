import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { listStudioCases, queuedInStudio, studioConfigured, studioReviews } from "@/lib/studio/source"
import { latestReviews } from "@/lib/review/links"
import { cn } from "@/lib/utils"
import { defaultStudioTab, STUDIO_TABS, studioStage, type StudioTab } from "@/lib/studio/stage"
import { StudioRow, type Converted } from "./studio-row"

// Studio cases → MediKarya. Each case sheet a student submits in the Case Studio is converted here with AI into a
// static or a live case (lib/studio/convert.ts, lib/studio/live-draft.ts), or sent back to its author. The converted
// case gets one review, in the studio's reviewer queue or through a private link (lib/review/links.ts), and is
// published once approved. Drafts never show in the student library.

export const dynamic = "force-dynamic"
// Each AI step (the conversion, then a live plan) is a request of its own, a few minutes; server actions run under this limit.
export const maxDuration = 300

export const metadata = { title: "Studio cases" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function StudioCasesPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!(await isAdmin(userId ?? null))) redirect("/")

  if (!studioConfigured()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Studio cases</h1>
        <p className="mt-3 text-slate-600">
          The case studio is not connected. Set <code>STUDIO_SUPABASE_URL</code> and <code>STUDIO_SUPABASE_SERVICE_KEY</code> (the studio&apos;s Supabase project) in
          the environment and redeploy.
        </p>
      </main>
    )
  }

  const [studio, { data: made }] = await Promise.all([
    listStudioCases(),
    supabaseServer
      .from("cases")
      .select("id, status, updated_at, source:case_json->source, plan:case_json->live_plan->>version")
      .not("case_json->source->>studio_case_id", "is", null),
  ])
  const studioIds = (made ?? []).map((r) => (r.source as Record<string, any> | null)?.studio_case_id).filter(Boolean) as string[]
  const [reviews, queue, queued] = await Promise.all([latestReviews((made ?? []).map((r) => r.id)), studioReviews(studioIds), queuedInStudio(studioIds)])
  const byStudioId = new Map<string, Converted>()
  for (const row of made ?? []) {
    const source = (row.source ?? {}) as Record<string, any>
    if (!source.studio_case_id) continue
    const r = reviews.get(row.id)
    // A review is of the version the professor read: a later conversion or rebuild needs a new one.
    const link = r && (!source.converted_at || Date.parse(r.created_at) >= Date.parse(source.converted_at)) ? r : null
    const q = queue.get(source.studio_case_id) ?? null
    const fromLink = link
      ? {
          sentAt: link.created_at,
          expiresAt: link.expires_at,
          decision: link.decision,
          reviewer: [link.reviewer_name, link.reviewer_designation, link.reviewer_department, link.reviewer_institution].filter(Boolean).join(", "),
          showName: link.show_name,
          comments: link.comments,
          decidedAt: link.decided_at,
          via: "link" as const,
        }
      : null
    const fromQueue = q
      ? {
          sentAt: q.claimedAt,
          expiresAt: q.expiresAt,
          decision: q.decision,
          reviewer: [q.reviewerName, q.designation, q.department, q.institution].filter(Boolean).join(", "),
          showName: q.showName,
          comments: q.comments,
          decidedAt: q.decidedAt,
          via: "queue" as const,
        }
      : null
    // the most recent of the two, if a draft has both a private link and a queue review
    const review = [fromLink, fromQueue].filter((x) => !!x).sort((a, b) => b!.sentAt.localeCompare(a!.sentAt))[0] ?? null
    byStudioId.set(source.studio_case_id, {
      id: row.id,
      status: row.status,
      updatedAt: row.updated_at,
      reviewNotes: Array.isArray(source.review_notes) ? source.review_notes : [],
      warnings: Array.isArray(source.warnings) ? source.warnings : [],
      review,
      // unknown (studio unreadable) counts as in the queue, so a read error does not flag every draft
      inQueue: queued === null || (queued.has(source.studio_case_id) && queued.get(source.studio_case_id) === (source.converted_at ?? null)),
      live: row.plan != null,
    })
  }

  // a sheet the author is still writing is not ours to act on yet (unless it was converted before)
  const shown = studio.filter((c) => c.status !== "draft" || byStudioId.has(c.id))
  const now = Date.now()
  const tabOf = new Map(shown.map((c) => [c.id, studioStage(c, byStudioId.get(c.id) ?? null, now).tab]))
  const counts = Object.fromEntries(STUDIO_TABS.map((t) => [t.key, shown.filter((c) => tabOf.get(c.id) === t.key).length])) as Record<StudioTab, number>
  const asked = (await searchParams).tab
  const tab = STUDIO_TABS.find((t) => t.key === asked)?.key ?? defaultStudioTab(counts)
  const inTab = shown.filter((c) => tabOf.get(c.id) === tab)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Studio cases</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          Case sheets students have submitted in the Case Studio. Nobody reviews the raw sheet: <strong>convert it to a static case</strong> (the AI
          writes the patient&apos;s script, test results and scoring from the sheet and marks everything it added), <strong>convert it to a live
          case</strong> (the same, plus how the patient deteriorates and what treats it), or <strong>send it back to the author</strong> with comments.
          The converted case then gets its <strong>one review</strong>, as a report: in the Case Studio&apos;s reviewer queue (verified reviewers and
          faculty), or through a <strong>private link</strong> to a professor, whichever approves first. Then <strong>Publish</strong> it and reward the
          author. Drafts are hidden from students throughout.
        </p>

        <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Where the cases stand">
          {STUDIO_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/studio?tab=${t.key}`}
              aria-current={t.key === tab ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium",
                t.key === tab ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs tabular-nums",
                  t.key === "todo" && counts.todo > 0 ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"
                )}
              >
                {counts[t.key]}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-5 space-y-3">
          {inTab.map((c) => (
            <StudioRow key={c.id} studioCase={c} converted={byStudioId.get(c.id) ?? null} />
          ))}
          {shown.length === 0 ? (
            <p className="text-slate-500">No submitted cases yet.</p>
          ) : (
            inTab.length === 0 && <p className="text-slate-500">{STUDIO_TABS.find((t) => t.key === tab)!.empty}</p>
          )}
        </div>
      </div>
    </main>
  )
}
