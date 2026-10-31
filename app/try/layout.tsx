import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo/site"

export const metadata: Metadata = pageMetadata({
  path: "/try",
  title: "Try a Patient Case Free",
  description: "Work up a real patient case end to end, no sign-up: take the history, watch the live monitor, order tests, rank your differential and see your debrief.",
  socialTitle: "Try a MediKarya patient case free, no account",
})

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return children
}
