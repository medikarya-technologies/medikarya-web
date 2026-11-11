"use client"

// Drawn by the cookie banner only after the visitor accepts. Two jobs that need the signed-in account:
// - An admin's browser is marked as ours (traffic_type=internal on every Meta event and Clarity session), checked once
//   per browser session. Founders testing signed out, or on a phone, use ?mk_internal=1 (lib/traffic.ts).
// - CompleteRegistration, sent once per account, when the account was created in the last hour. Clerk creates the
//   account on several paths (the sign-up page, the join page's pop-up, Google), and all of them land signed in, so
//   this one check covers them; a long-standing account signing in again is not a sign-up.

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { loadMetaPixel, setInternalTraffic, trackMetaEvent, trafficType } from "@/lib/meta-pixel"

const NEW_ACCOUNT_MS = 60 * 60 * 1000
const ADMIN_CHECKED_KEY = "mk_admin_checked"

export function AnalyticsIdentity() {
  const { isLoaded, isSignedIn, user } = useUser()
  // Whether this browser is ours is settled before any account event goes out, so a founder's own new account is
  // labelled internal from its first event.
  const [identityKnown, setIdentityKnown] = useState(false)

  // The banner loads the pixel in its own effect, which runs after this child's: load it here first (it only ever
  // loads once) so the events below are not dropped.
  useEffect(() => {
    loadMetaPixel()
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    let checked = false
    try {
      checked = sessionStorage.getItem(ADMIN_CHECKED_KEY) === user.id
    } catch {}
    if (checked || trafficType() === "internal") {
      setIdentityKnown(true)
      return
    }
    // GET /api/plan says whether the account is an admin (realAdmin stays true while viewing as a student).
    void fetch("/api/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then((info: { admin?: boolean; realAdmin?: boolean } | null) => {
        if (!info) return
        try {
          sessionStorage.setItem(ADMIN_CHECKED_KEY, user.id)
        } catch {}
        if (info.realAdmin || info.admin) setInternalTraffic(true)
      })
      .catch(() => {})
      .finally(() => setIdentityKnown(true))
  }, [isLoaded, isSignedIn, user])

  useEffect(() => {
    if (!identityKnown || !isLoaded || !isSignedIn || !user?.createdAt) return
    if (Date.now() - user.createdAt.getTime() > NEW_ACCOUNT_MS) return
    trackMetaEvent("CompleteRegistration", user.id)
  }, [identityKnown, isLoaded, isSignedIn, user])

  return null
}
