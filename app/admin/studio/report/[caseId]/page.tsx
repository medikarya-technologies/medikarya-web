import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { CaseReport } from "@/components/review/case-report"

// The review report exactly as the professor will see it (without the decision form), for an admin to read first.

export const dynamic = "force-dynamic"
export const metadata = { title: "Review report", robots: { index: false, follow: false } }

export default async function AdminReportPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { userId } = await auth()
  if (!(await isAdmin(userId ?? null))) redirect("/")

  const { caseId } = await params
  const { data: row } = await supabaseServer.from("cases").select("case_json").eq("id", caseId).maybeSingle()
  if (!row) notFound()
  const caseJson = row.case_json as Record<string, any>
  const notes: string[] = Array.isArray(caseJson.source?.review_notes) ? caseJson.source.review_notes : []

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Link href="/admin/studio" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Studio cases
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <CaseReport caseJson={caseJson} reviewNotes={notes} />
        </div>
      </div>
    </main>
  )
}
