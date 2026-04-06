import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PracticeCases } from "@/components/dashboard/practice-cases"
import { getCases } from "@/data/cases"

export default async function CasesPage() {
  const cases = await getCases();

  return (
    <DashboardLayout>
      <PracticeCases initialCases={cases} />
    </DashboardLayout>
  )
}
