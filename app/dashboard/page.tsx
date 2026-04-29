import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DashboardOverview } from "../../components/dashboard/dashboard-overview"
import { getDashboardStats } from "@/app/actions/dashboard"

export const dynamic = "force-dynamic";

async function DashboardStats() {
  const stats = await getDashboardStats();
  return <DashboardOverview initialStats={stats} />
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            <p className="text-sm text-slate-500">Loading your dashboard...</p>
          </div>
        </div>
      }>
        <DashboardStats />
      </Suspense>
    </DashboardLayout>
  )
}
