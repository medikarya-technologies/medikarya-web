import "server-only"

import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { getPassBatch } from "@/lib/plans/pass-batches"
import type { EventPathway, PathwayNode } from "./pathways"
import { MEDVENTURE } from "./medventure-config"

export { MEDVENTURE } from "./medventure-config"

export interface EventStaffMember {
  email: string
  createdAt: string
}

export type EventRoom = {
  status: "draft" | "live" | "closed" | "finalized"
  roundTwoCaseId: string | null
  startedAt: string | null
  closedAt: string | null
  finalizedAt: string | null
}

export type EventRoundOneAttempt = {
  state: unknown
  score: number
  startedAt: string
  completedAt: string | null
}

const roomFrom = (row: Record<string, unknown>): EventRoom => ({
  status: row.status === "live" || row.status === "closed" || row.status === "finalized" ? row.status : "draft",
  roundTwoCaseId: typeof row.round_two_case_id === "string" ? row.round_two_case_id : null,
  startedAt: typeof row.started_at === "string" ? row.started_at : null,
  closedAt: typeof row.closed_at === "string" ? row.closed_at : null,
  finalizedAt: typeof row.finalized_at === "string" ? row.finalized_at : null,
})

/** Returns `available: false` until the event schema has been installed in the main project. */
export async function medventureRoom(): Promise<{ available: boolean; room: EventRoom | null }> {
  const { data, error } = await supabaseServer.from("event_rooms").select("status, round_two_case_id, started_at, closed_at, finalized_at").eq("event_key", MEDVENTURE.key).maybeSingle()
  if (error) {
    console.error("Could not read the Medventure room:", error.message)
    return { available: false, room: null }
  }
  return { available: true, room: data ? roomFrom(data) : null }
}

const pathwayFrom = (row: Record<string, unknown>): EventPathway | null => {
  if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.position !== "number" || typeof row.start_node_id !== "string" || !Array.isArray(row.nodes)) return null
  const nodes = row.nodes.filter((node): node is PathwayNode => !!node && typeof node === "object")
  return { id: row.id, title: row.title, position: row.position, startNodeId: row.start_node_id, nodes, published: row.published === true }
}

export async function medventurePathways(options: { publishedOnly?: boolean } = {}): Promise<{ available: boolean; pathways: EventPathway[] }> {
  let query = supabaseServer.from("event_pathways").select("id, title, position, start_node_id, nodes, published").eq("event_key", MEDVENTURE.key).order("position")
  if (options.publishedOnly) query = query.eq("published", true)
  const { data, error } = await query
  if (error) {
    console.error("Could not read Medventure pathways:", error.message)
    return { available: false, pathways: [] }
  }
  return { available: true, pathways: (data ?? []).map((row) => pathwayFrom(row)).filter((pathway): pathway is EventPathway => !!pathway) }
}

/** A participant is an account on the Medventure five-day pass, never simply any MediKarya user. */
export async function medventureParticipant(userId: string | null): Promise<{ userId: string; email: string } | null> {
  if (!userId) return null
  const { data, error } = await supabaseServer.from("user_profiles").select("email").eq("clerk_user_id", userId).maybeSingle()
  if (error || typeof data?.email !== "string") return null
  const email = data.email.toLowerCase()
  const [eventBatch, preflightBatch] = await Promise.all([getPassBatch(MEDVENTURE.name), getPassBatch(MEDVENTURE.dryRun.name)])
  return eventBatch?.emails.includes(email) || preflightBatch?.emails.includes(email) ? { userId, email } : null
}

export async function medventureRoundOneAttempt(userId: string): Promise<{ available: boolean; attempt: EventRoundOneAttempt | null }> {
  const { data, error } = await supabaseServer.from("event_round1_attempts").select("state, score, started_at, completed_at").eq("event_key", MEDVENTURE.key).eq("clerk_user_id", userId).maybeSingle()
  if (error) {
    console.error("Could not read the Medventure Round 1 attempt:", error.message)
    return { available: false, attempt: null }
  }
  return { available: true, attempt: data ? { state: data.state, score: Number(data.score) || 0, startedAt: data.started_at, completedAt: data.completed_at ?? null } : null }
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
