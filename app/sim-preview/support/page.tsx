import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Support } from "@/components/dashboard/support"

// Dev-only: the support page inside the dashboard frame, without a login. 404 in production builds.
export default function SupportPreview() {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <DashboardLayout activeHref="/dashboard/support" userName="Abhishek Singh">
      <Support />
    </DashboardLayout>
  )
}
