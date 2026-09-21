import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Profile } from "@/components/dashboard/profile"
import { getCases } from "@/data/cases"
import { sampleProgress, sampleStats } from "../_sample"

// Dev-only: the profile page inside the dashboard frame, without a login, with real cases and made-up
// attempts. ?empty=1 is a student who has not started. 404 in production builds.
export default async function ProfilePreview({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { empty } = await searchParams
  const cases = await getCases()
  const progress = sampleProgress(cases, empty === "1")

  return (
    <DashboardLayout activeHref="/dashboard/profile" userName="Abhishek Singh">
      <Profile initialStats={sampleStats(cases, progress)} cases={cases} progress={progress} userName="Abhishek Singh" />
    </DashboardLayout>
  )
}
