import type { Metadata } from "next"
import { supabaseServer } from "@/lib/supabase/server"
import { isOpen, reviewForToken } from "@/lib/review/links"
import { CaseReport } from "@/components/review/case-report"
import { ReviewForm } from "./review-form"
import { PrintButton } from "@/components/review/print-button"
import { PRINT_CSS } from "@/components/review/print-css"

// A professor's private review page: the case as a one-page report, then their decision. No account needed; the
// link is the permission (lib/review/links.ts). Never indexed.

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Case review", robots: { index: false, follow: false } }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <img src="/medikarya.svg" alt="" className="h-7 w-7" />
          <span className="font-bold text-slate-900">MediKarya</span>
          <span className="text-slate-400">·</span>
          <span className="text-[14px] text-slate-600">Clinical review</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">{children}</div>
    </main>
  )
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-[20px] font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-[15px] text-slate-600">{text}</p>
    </div>
  )
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const review = await reviewForToken(token)

  if (!review) return <Shell><Notice title="This link is not valid" text="Please check you opened the full link you were sent, or ask the MediKarya team for a new one." /></Shell>
  if (review.decision) {
    return (
      <Shell>
        <Notice
          title="This case has been reviewed"
          text={`${review.reviewer_name ?? "The reviewer"} ${review.decision === "approved" ? "approved it" : "asked for changes"} on ${new Date(review.decided_at!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. Thank you.`}
        />
      </Shell>
    )
  }
  if (!isOpen(review)) return <Shell><Notice title="This link has expired" text="Please ask the MediKarya team for a new one." /></Shell>

  const { data: row } = await supabaseServer.from("cases").select("case_json").eq("id", review.case_id).maybeSingle()
  if (!row) return <Shell><Notice title="This case is no longer available" text="It may have been withdrawn. Please contact the MediKarya team." /></Shell>

  const caseJson = row.case_json as Record<string, any>
  const notes: string[] = Array.isArray(caseJson.source?.review_notes) ? caseJson.source.review_notes : []

  return (
    <Shell>
      <style>{PRINT_CSS}</style>
      {caseJson.live_plan ? (
        <p className="no-print text-[14.5px] text-slate-600">
          Thank you for looking at this case. It is to become a <strong>live</strong> case on MediKarya: a clock runs, the patient gets worse until
          the right treatments are given, and students are scored on what they give and when. The live course is the first section below. Please
          check its timings, vital signs, treatments and doses, then sign it off or tell us what to change.
        </p>
      ) : (
        <p className="no-print text-[14.5px] text-slate-600">
          Thank you for reviewing this case. It was written by a medical student and turned into an interactive case for MediKarya; students
          will interview the patient, examine them, order tests and make a diagnosis. Please read it through, then approve it or tell us what to
          change.
        </p>
      )}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-slate-600">You review this report: there is no need to play the case. Prefer paper? Save it as a PDF, then come back to this page to give your decision.</p>
        <PrintButton />
      </div>
      <div className="print-plain rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <CaseReport caseJson={caseJson} reviewNotes={notes} />
      </div>
      <div className="no-print">
        <ReviewForm token={token} />
      </div>
    </Shell>
  )
}
