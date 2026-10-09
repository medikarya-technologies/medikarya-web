"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Re-reads the page's data every `seconds` without reloading it, so a screen left on shows new scores as they come. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(timer)
  }, [router, seconds])
  return null
}
