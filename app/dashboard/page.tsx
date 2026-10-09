import { Suspense } from "react"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DashboardOverview } from "../../components/dashboard/dashboard-overview"
import { HomeSkeleton } from "@/components/dashboard/skeletons"
import { getDashboardData, getMyCertificates } from "@/app/actions/dashboard"
import { getCases } from "@/data/cases"
import { FIRST_CASE_HREF } from "@/lib/library/first-case"
import { isBrandNewVisit } from "@/lib/library/first-case-server"

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

async function DashboardStats() {
  // The numbers and per-case progress in one go (two small queries), beside the case list, which is kept for a minute.
  const [{ stats, progress }, cases, certificates] = await Promise.all([getDashboardData(), getCases(), getMyCertificates()])
  return <DashboardOverview initialStats={stats} cases={cases} progress={progress} certificates={certificates} />
}

export default async function DashboardPage() {
  // A brand-new account meets its first patient instead of an empty dashboard, once (lib/library/first-case.ts).
  if (await isBrandNewVisit()) redirect(FIRST_CASE_HREF)

  // The frame is sent at once; the page's own content streams in when its data is ready.
  return (
    <DashboardLayout>
      <Suspense fallback={<HomeSkeleton />}>
        <DashboardStats />
      </Suspense>
    </DashboardLayout>
  )
}
