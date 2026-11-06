import { BrandedLoading } from "@/components/ui/branded-loading"

// Signed-in screens get the loading screen while the next page renders. There is deliberately no app/loading.tsx:
// a root one wraps every public page in a Suspense boundary, so the HTML a search engine or link preview reads is
// just "Loading…" with the real page hidden until JavaScript swaps it in.
export default function Loading() {
  return <BrandedLoading />
}
