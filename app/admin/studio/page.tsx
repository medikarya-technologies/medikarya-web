import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { listStudioCases, queuedInStudio, studioConfigured, studioReviews } from "@/lib/studio/source"
import { latestReviews } from "@/lib/review/links"
import { StudioRow, type Converted } from "./studio-row"

// Studio cases → MediKarya. Each case sheet a student submits in the Case Studio is converted here with AI into a
// static or a live case (lib/studio/convert.ts, lib/studio/live-draft.ts), or sent back to its author. The converted
// case gets one review, in the studio's reviewer queue or through a private link (lib/review/links.ts), and is
// published once approved. Drafts never show in the student library.

export const dynamic = "force-dynamic"
// Each AI step (the conversion, then a live plan) is a request of its own, a few minutes; server actions run under this limit.
export const maxDuration = 300

export const metadata = { title: "Studio cases" }

export default async function StudioCasesPage() {
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
      inQueue: queued.has(source.studio_case_id),
      live: row.plan != null,
    })
  }

  // a sheet the author is still writing is not ours to act on yet (unless it was converted before)
  const shown = studio.filter((c) => c.status !== "draft" || byStudioId.has(c.id))

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

        <div className="mt-8 space-y-3">
          {shown.map((c) => (
            <StudioRow key={c.id} studioCase={c} converted={byStudioId.get(c.id) ?? null} />
          ))}
          {shown.length === 0 && <p className="text-slate-500">No submitted cases yet.</p>}
        </div>
      </div>
    </main>
  )
}
