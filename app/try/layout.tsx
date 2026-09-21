import type { Metadata } from "next"

export const metadata: Metadata = { title: "Try a patient case" }

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return children
}
