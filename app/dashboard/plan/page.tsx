import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Billing } from "@/components/plans/billing"
import { getCases } from "@/data/cases"

export const metadata = { title: "Plan & billing" }

export default async function PlanPage() {
  const cases = await getCases()
  return (
    <DashboardLayout>
      <Billing cases={cases} />
    </DashboardLayout>
  )
}
