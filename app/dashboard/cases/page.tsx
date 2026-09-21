import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PracticeCases } from "@/components/dashboard/practice-cases"
import { LibrarySkeleton } from "@/components/dashboard/skeletons"
import { getCases } from "@/data/cases"
import { getCaseProgress } from "@/app/actions/case-progress"
import { auth } from "@clerk/nextjs/server"

export const metadata = { title: "Case library" };

async function Library() {
  // What the student has done on each case comes with the list, so the library opens already knowing.
  const [cases, progress, { userId }] = await Promise.all([getCases(), getCaseProgress(), auth()])
  return <PracticeCases initialCases={cases} progress={progress} userId={userId ?? undefined} />
}

export default function CasesPage() {
  // The frame is sent at once; the list streams in when its data is ready.
  return (
    <DashboardLayout>
      <Suspense fallback={<LibrarySkeleton />}>
        <Library />
      </Suspense>
    </DashboardLayout>
  )
}
