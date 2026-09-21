import type { Metadata } from "next"
import { getCases } from "@/data/cases"

// The page itself is a client component, so its tab title is set here. It is the anonymised title, never the
// diagnosis: this is what the tab, the browser history and a bookmark will say.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const found = (await getCases()).find((c) => c.id === id)
  return { title: found?.displayTitle || "Patient case" }
}

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return children
}
