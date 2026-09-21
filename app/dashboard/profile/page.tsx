import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Profile } from "@/components/dashboard/profile"
import { ProfileSkeleton } from "@/components/dashboard/skeletons"
import { getDashboardData } from "@/app/actions/dashboard"
import { getCases } from "@/data/cases"

export const dynamic = "force-dynamic"
export const metadata = { title: "Profile" }

async function ProfileWithRecord() {
  // The same real numbers as the dashboard, for the one-card summary of the record.
  const [{ stats, progress }, cases] = await Promise.all([getDashboardData(), getCases()])
  return <Profile initialStats={stats} cases={cases} progress={progress} />
}

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileWithRecord />
      </Suspense>
    </DashboardLayout>
  )
}
