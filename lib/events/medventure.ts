import "server-only"

import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"

export const MEDVENTURE = {
  key: "medventure-2026",
  name: "Medventure Clinical Decision Challenge",
  date: "2026-11-18",
  venue: "Maulana Azad Medical College, New Delhi",
  pass: { plan: "intern" as const, days: 5, maxJoins: 60, openDays: 1 },
} as const

export interface EventStaffMember {
  email: string
  createdAt: string
}

/** True for a platform admin, or a Medventure organiser who signed in with their invited email. */
export async function canManageMedventure(userId: string | null): Promise<{ allowed: boolean; owner: boolean }> {
  if (!userId) return { allowed: false, owner: false }
  if (await isAdmin(userId)) return { allowed: true, owner: true }

  const { data: profile } = await supabaseServer.from("user_profiles").select("email").eq("clerk_user_id", userId).maybeSingle()
  const email = typeof profile?.email === "string" ? profile.email.toLowerCase() : null
  if (!email) return { allowed: false, owner: false }

  const { data, error } = await supabaseServer.from("event_staff").select("email").eq("event_key", MEDVENTURE.key).eq("email", email).maybeSingle()
  if (error) {
    console.error("Could not check Medventure staff access:", error.message)
    return { allowed: false, owner: false }
  }
  return { allowed: !!data, owner: false }
}

export async function listMedventureStaff(): Promise<{ available: boolean; staff: EventStaffMember[] }> {
  const { data, error } = await supabaseServer.from("event_staff").select("email, created_at").eq("event_key", MEDVENTURE.key).order("created_at")
  if (error) {
    console.error("Could not read Medventure staff:", error.message)
    return { available: false, staff: [] }
  }
  return {
    available: true,
    staff: (data ?? []).map((row) => ({ email: String(row.email).toLowerCase(), createdAt: row.created_at })),
  }
}

export function cleanStaffEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(email) ? email : null
}
