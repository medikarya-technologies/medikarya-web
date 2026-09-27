import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Billing, type Subscription } from "@/components/plans/billing"
import { PlanPreview } from "@/components/plans/use-plan"
import { UpgradeProvider } from "@/components/plans/upgrade-dialog"
import { getCases } from "@/data/cases"
import { samplePlan } from "../_sample"

// Dev-only: Plan & billing without a login.
//   ?plan=student|intern|resident   the plan (student = no subscription)
//   ?period=yearly                  billed yearly      ?cancelled=1   cancelled, running to the end of the period
//   ?pending=1                      a renewal payment that failed and is being retried
// Returns 404 in production builds.
export default async function PlanPreviewPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string; cancelled?: string; pending?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { plan = "intern", period, cancelled, pending } = await searchParams
  const planInfo = samplePlan(plan)
  const cases = await getCases()
  const end = new Date(Date.now() + 23 * 86_400_000).toISOString()
  const subscription: Subscription | null =
    plan === "intern" || plan === "resident"
      ? { tier: plan, period: period === "yearly" ? "yearly" : "monthly", status: pending === "1" ? "pending" : "active", currentEnd: end, cancelAt: cancelled === "1" ? end : null }
      : null

  return (
    <UpgradeProvider>
      {planInfo && <PlanPreview info={planInfo} />}
      <DashboardLayout activeHref="/dashboard/plan" userName="Abhishek Singh">
        <Billing cases={cases} preview={subscription} />
      </DashboardLayout>
    </UpgradeProvider>
  )
}
