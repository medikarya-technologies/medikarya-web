"use client"

// Once per browser session, for a signed-in visitor on any page: bring the free-case plays they made as a guest into
// their account (POST /api/guest-claim, lib/library/guest-claim-server.ts). Before this only the dashboard did it, so a
// student who signed up and landed anywhere else kept an empty account. Not analytics: it is their own work, so it
// does not wait for the cookie banner. When something moved, the page is refreshed so it shows the play.

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"

const DONE_KEY = "mk_guest_claimed"

export function GuestPlayClaim() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return
    try {
      if (sessionStorage.getItem(DONE_KEY) === userId) return
    } catch {}
    let cancelled = false
    void fetch("/api/guest-claim", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { moved?: number } | null) => {
        if (!body) return
        try {
          sessionStorage.setItem(DONE_KEY, userId)
        } catch {}
        if (!cancelled && (body.moved ?? 0) > 0) router.refresh()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, userId, router])

  return null
}
