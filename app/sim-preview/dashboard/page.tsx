import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard/dashboard-overview"
import { getCases } from "@/data/cases"
import { sampleProgress, sampleStats } from "../_sample"

// Dev-only: the dashboard home without a login, with real cases and made-up attempts.
//   ?empty=1   a student who has not started      ?name=Priya   the name in the greeting
// Returns 404 in production builds.
export default async function DashboardPreview({ searchParams }: { searchParams: Promise<{ empty?: string; name?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { empty, name } = await searchParams
  const cases = await getCases()
  const progress = sampleProgress(cases, empty === "1")
  const userName = name ?? "Abhishek Singh"

  return (
    <DashboardLayout activeHref="/dashboard" userName={userName}>
      <DashboardOverview initialStats={sampleStats(cases, progress)} cases={cases} progress={progress} userName={userName} />
    </DashboardLayout>
  )
}
