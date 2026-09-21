import { Suspense } from "react"
import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PracticeCases } from "@/components/dashboard/practice-cases"
import { getCases } from "@/data/cases"
import { sampleProgress } from "../_sample"

// Dev-only: the case library without a login, with real cases and made-up attempts.
//   ?empty=1   a student who has not started      ?name=Priya   the name in the rail
// Returns 404 in production builds.
export default async function LibraryPreview({ searchParams }: { searchParams: Promise<{ empty?: string; name?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { empty, name } = await searchParams
  const cases = await getCases()

  return (
    <DashboardLayout activeHref="/dashboard/cases" userName={name ?? "Abhishek Singh"}>
      <Suspense fallback={null}>
        <PracticeCases initialCases={cases} progress={sampleProgress(cases, empty === "1")} />
      </Suspense>
    </DashboardLayout>
  )
}
