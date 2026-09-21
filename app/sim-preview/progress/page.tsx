import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { StudentProgress } from "@/components/dashboard/student-progress"
import { getCases } from "@/data/cases"
import { parseProgressTab } from "@/lib/library/progress-tabs"
import { sampleMilestones, sampleProgress, sampleSkills, sampleStats } from "../_sample"

// Dev-only: the progress page inside the dashboard frame, without a login, with real cases and made-up attempts.
// ?empty=1 is a student who has not started; ?tab=skills or ?tab=activity opens that tab. 404 in production builds.
export default async function ProgressPreview({ searchParams }: { searchParams: Promise<{ empty?: string; tab?: string | string[] }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { empty, tab } = await searchParams
  const cases = await getCases()
  const progress = sampleProgress(cases, empty === "1")

  return (
    <DashboardLayout activeHref="/dashboard/progress" userName="Abhishek Singh">
      <StudentProgress initialTab={parseProgressTab(tab)} initialStats={sampleStats(cases, progress)} cases={cases} progress={progress} milestones={sampleMilestones(cases, progress)} skills={sampleSkills(empty === "1")} />
    </DashboardLayout>
  )
}
