import { notFound } from "next/navigation"
import SimPreviewClient from "./client"

// Dev-only sandbox for the STEMI simulation: opens the encounter without a login.
// Returns 404 in production builds, so it can never be reached on a deployed site.
// Delete the whole app/sim-preview folder whenever you no longer want it.
export default function SimPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <SimPreviewClient />
}
