import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Support } from "@/components/dashboard/support"

export const metadata = { title: "Support" }

export default function SupportPage() {
  return (
    <DashboardLayout>
      <Support />
    </DashboardLayout>
  )
}
