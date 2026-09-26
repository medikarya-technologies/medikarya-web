import { BrandedLoading } from "@/components/ui/branded-loading"

// The fallback for every route that doesn't define its own more specific loading.tsx.
export default function Loading() {
  return <BrandedLoading />
}
