import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Try a patient case free",
  description: "Work up a real patient case end to end, no sign-up: take the history, watch the live monitor, order tests, rank your differential and see your debrief.",
  alternates: { canonical: "https://www.medikarya.in/try" },
}

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return children
}
