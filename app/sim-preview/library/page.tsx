import { Suspense } from "react"
import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PracticeCases } from "@/components/dashboard/practice-cases"
import { getCases } from "@/data/cases"
import { PlanPreview } from "@/components/plans/use-plan"
import { UpgradeProvider } from "@/components/plans/upgrade-dialog"
import { samplePlan, sampleProgress } from "../_sample"

// Dev-only: the case library without a login, with real cases and made-up attempts.
//   ?plan=student|intern|resident   show that plan (locks, the plan card, the upgrade dialog); &admin=1 as an admin viewing as it
//   ?empty=1   a student who has not started      ?name=Priya   the name in the rail
// Returns 404 in production builds.
export default async function LibraryPreview({ searchParams }: { searchParams: Promise<{ empty?: string; name?: string; plan?: string; admin?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { empty, name, plan, admin } = await searchParams
  const planInfo = samplePlan(plan, admin === "1")
  const cases = await getCases()

  return (
    <UpgradeProvider>
      {planInfo && <PlanPreview info={planInfo} />}
      <DashboardLayout activeHref="/dashboard/cases" userName={name ?? "Abhishek Singh"}>
        <Suspense fallback={null}>
          <PracticeCases initialCases={cases} progress={sampleProgress(cases, empty === "1")} />
        </Suspense>
      </DashboardLayout>
    </UpgradeProvider>
  )
}
