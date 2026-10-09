import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard/dashboard-overview"
import { getCases } from "@/data/cases"
import { PlanPreview } from "@/components/plans/use-plan"
import { CASE_STUDIO_URL } from "@/lib/site-links"
import { UpgradeProvider } from "@/components/plans/upgrade-dialog"
import { samplePlan, sampleProgress, sampleStats } from "../_sample"

// Dev-only: the dashboard home without a login, with real cases and made-up attempts.
//   ?plan=student|intern|resident   show that plan (locks, the plan card, the upgrade dialog); &admin=1 as an admin viewing as it
//   ?empty=1   a student who has not started      ?name=Priya   the name in the greeting
//   ?certificate=1   a student who has a workshop certificate (the sample one, MK-0000-00002)
// Returns 404 in production builds.
export default async function DashboardPreview({ searchParams }: { searchParams: Promise<{ empty?: string; name?: string; plan?: string; admin?: string; certificate?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { empty, name, plan, admin, certificate } = await searchParams
  const planInfo = samplePlan(plan, admin === "1")
  const cases = await getCases()
  const progress = sampleProgress(cases, empty === "1")
  const userName = name ?? "Abhishek Singh"

  return (
    <UpgradeProvider>
      {planInfo && <PlanPreview info={planInfo} />}
      <DashboardLayout activeHref="/dashboard" userName={userName}>
        <DashboardOverview
          initialStats={sampleStats(cases, progress)}
          cases={cases}
          progress={progress}
          userName={userName}
          certificates={
            certificate === "1"
              ? [
                  {
                    credentialId: "MK-0000-00002",
                    title: "Clinical Reasoning Workshop",
                    issuedAt: "2026-10-24T12:30:00Z",
                    url: `${CASE_STUDIO_URL}/certificate/MK-0000-00002`,
                    verifyUrl: "https://www.medikarya.in/verify/MK-0000-00002",
                  },
                ]
              : []
          }
        />
      </DashboardLayout>
    </UpgradeProvider>
  )
}
