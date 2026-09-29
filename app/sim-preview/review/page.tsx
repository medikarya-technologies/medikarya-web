import { notFound } from "next/navigation"
import { CaseReport } from "@/components/review/case-report"
import { ReviewForm } from "@/app/review/[token]/review-form"
import example from "@/lib/studio/example-case.json"

// Dev-only: the professor's review page (/review/[token]) with the converter's worked example, to check the report and
// the form without a real link. Submitting says the link is not valid, as it should. Returns 404 in production builds.
export default function ReviewPreview() {
  if (process.env.NODE_ENV === "production") notFound()
  const caseJson = { ...example.case, credit: { author: "A. Sample Student" } }
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <CaseReport caseJson={caseJson} reviewNotes={example.review_notes} />
        </div>
        <ReviewForm token="preview-token-not-valid-000000" />
      </div>
    </main>
  )
}
