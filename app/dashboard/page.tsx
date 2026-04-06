import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DashboardOverview } from "../../components/dashboard/dashboard-overview"
import { getDashboardStats } from "@/app/actions/dashboard"

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <DashboardLayout>
      <DashboardOverview initialStats={stats} />
    </DashboardLayout>
  )
}
