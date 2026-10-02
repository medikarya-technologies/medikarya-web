import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCases } from "@/data/cases"
import { currentCaseId, isFormerCaseId } from "@/lib/cases/renamed-ids"

// The page itself is a client component, so its tab title is set here. It is the anonymised title, never the
// diagnosis: this is what the tab, the browser history and a bookmark will say.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const found = (await getCases()).find((c) => c.id === id)
  return { title: found?.displayTitle || "Patient case" }
}

export default async function CaseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  // A link or bookmark made before the first cases were renamed (their old ids named the diagnosis).
  const { id } = await params
  if (isFormerCaseId(id)) redirect(`/dashboard/cases/${currentCaseId(id)}`)
  return children
}
