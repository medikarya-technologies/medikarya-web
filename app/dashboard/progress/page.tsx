import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { StudentProgress } from "@/components/dashboard/student-progress"
import { ProgressSkeleton } from "@/components/dashboard/skeletons"
import { getDashboardData } from "@/app/actions/dashboard"
import { getSkillProfile } from "@/app/actions/skills"
import { getCases } from "@/data/cases"
import { parseProgressTab, type ProgressTab } from "@/lib/library/progress-tabs"

export const dynamic = "force-dynamic"
export const metadata = { title: "Progress" }

async function ProgressWithRecord({ tab }: { tab: ProgressTab }) {
  // The record, and the library it is measured against; what the attempts say about marks comes from the stored feedback.
  const [{ stats, progress, milestones }, cases, skills] = await Promise.all([getDashboardData(), getCases(), getSkillProfile()])
  return <StudentProgress initialTab={tab} initialStats={stats} cases={cases} progress={progress} milestones={milestones} skills={skills} />
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams
  return (
    <DashboardLayout>
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressWithRecord tab={parseProgressTab(tab)} />
      </Suspense>
    </DashboardLayout>
  )
}
