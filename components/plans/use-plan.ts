"use client"

// The signed-in student's plan and today's usage (GET /api/plan), shared by everything on the page that shows it
// (library locks, the dashboard's plan card, the upgrade dialog, the pricing page), so one refreshPlan() after a
// payment or a case start updates them all at once. null while loading, when signed out, or if it cannot be read.
// Only for display: the limits are enforced when a case starts, so a stale value here can make a lock show late,
// never let a case open that the plan does not include.

import { useEffect, useSyncExternalStore } from "react"
import { useAuth } from "@clerk/nextjs"
import type { Plan } from "@/lib/plans/limits"

export interface PlanInfo {
  plan: Plan
  admin: boolean
  casesToday: number
  liveToday: number
  liveEver: number
  openedToday: string[]
  /** null = no limit. */
  limits: { maxDifficulty: 1 | 2 | 3; casesPerDay: number | null; livePerDay: number | null; liveEver: number | null }
  /** Free plan time (the reward for a published case, a workshop pass) giving this plan, when it ends, and why. */
  grant?: { plan: Plan; endsAt: string; from?: "case" | "pass" | "other"; pass?: string | null } | null
  /** The account is an admin (even while viewing as a student plan). */
  realAdmin?: boolean
  /** An admin viewing the site as this plan. */
  viewingAs?: Plan | null
}

/** The last day free plan time covers, for "Free until …": a pass ends at midnight, so the day before. */
export const freeUntil = (endsAt: string) =>
  new Date(Date.parse(endsAt) - 1).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

/** Why the plan is free, after "Free until <date>": a published case, a workshop pass, or a gift. */
export function freeBecause(grant: NonNullable<PlanInfo["grant"]>): string {
  if (grant.from === "pass") return grant.pass ? `with your pass from ${grant.pass}` : "with your workshop pass"
  if (grant.from === "other") return "from the MediKarya team"
  return "thanks to your published case"
}

let current: PlanInfo | null = null
// Dev preview pages (/sim-preview, no login) show a made-up plan instead; see PlanPreview.
let preview: PlanInfo | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function set(next: PlanInfo | null) {
  current = next
  listeners.forEach((l) => l())
}

/** Re-reads the plan (after a payment, or a case start) and updates every component showing it. */
export function refreshPlan(): Promise<void> {
  inflight ??= fetch("/api/plan")
    .then((res) => (res.ok ? res.json() : null))
    .then((data: PlanInfo | null) => set(data))
    .catch(() => set(null))
    .finally(() => {
      inflight = null
    })
  return inflight
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePlan(): PlanInfo | null {
  const { isLoaded, isSignedIn } = useAuth()
  const info = useSyncExternalStore(subscribe, () => preview ?? current, () => null)

  useEffect(() => {
    if (!isLoaded || preview) return
    if (!isSignedIn) set(null)
    else if (!current) void refreshPlan()
  }, [isLoaded, isSignedIn])

  return preview || isSignedIn ? info : null
}

/** Dev preview pages only: show this plan instead of the signed-in one. */
export function PlanPreview({ info }: { info: PlanInfo }) {
  useEffect(() => {
    preview = info
    listeners.forEach((l) => l())
    return () => {
      preview = null
      listeners.forEach((l) => l())
    }
  }, [info])
  return null
}
