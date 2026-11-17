import "server-only"

import { MEDVENTURE } from "./medventure"
import type { Feedback } from "./feedback"
import { supabaseServer } from "@/lib/supabase/server"

const COLUMNS = "clerk_user_id, email, overall, round_one, round_two, realism, recommend, study_year, liked, improve, contact_ok, created_at, updated_at"

export type StoredFeedback = Feedback & { userId: string; email: string; createdAt: string; updatedAt: string }

const fromRow = (row: Record<string, any>): StoredFeedback => ({
  userId: String(row.clerk_user_id),
  email: String(row.email),
  overall: Number(row.overall),
  roundOne: row.round_one ?? null,
  roundTwo: row.round_two ?? null,
  realism: row.realism ?? null,
  recommend: row.recommend ?? null,
  studyYear: row.study_year ?? null,
  liked: row.liked ?? "",
  improve: row.improve ?? "",
  contactOk: row.contact_ok === true,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
})

/** `available: false` until scripts/create_medventure_feedback.sql has been run in the main project. */
export async function myMedventureFeedback(userId: string): Promise<{ available: boolean; feedback: StoredFeedback | null }> {
  const { data, error } = await supabaseServer.from("event_feedback").select(COLUMNS).eq("event_key", MEDVENTURE.key).eq("clerk_user_id", userId).maybeSingle()
  if (error) {
    console.error("Could not read Medventure feedback:", error.message)
    return { available: false, feedback: null }
  }
  return { available: true, feedback: data ? fromRow(data) : null }
}

/** One form per student: sending it again replaces their earlier answers. */
export async function saveMedventureFeedback(userId: string, email: string, f: Feedback): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabaseServer.from("event_feedback").upsert({
    event_key: MEDVENTURE.key,
    clerk_user_id: userId,
    email,
    overall: f.overall,
    round_one: f.roundOne,
    round_two: f.roundTwo,
    realism: f.realism,
    recommend: f.recommend,
    study_year: f.studyYear,
    liked: f.liked || null,
    improve: f.improve || null,
    contact_ok: f.contactOk,
    updated_at: now,
  }, { onConflict: "event_key,clerk_user_id" })
  if (error) throw error
}

export async function allMedventureFeedback(): Promise<{ available: boolean; rows: StoredFeedback[]; names: Map<string, string> }> {
  const { data, error } = await supabaseServer.from("event_feedback").select(COLUMNS).eq("event_key", MEDVENTURE.key).order("created_at", { ascending: false })
  if (error) {
    console.error("Could not read Medventure feedback:", error.message)
    return { available: false, rows: [], names: new Map() }
  }
  const rows = (data ?? []).map(fromRow)
  const names = new Map<string, string>()
  if (rows.length) {
    const { data: profiles } = await supabaseServer.from("user_profiles").select("clerk_user_id, full_name").in("clerk_user_id", rows.map((r) => r.userId))
    for (const p of profiles ?? []) if (typeof p.full_name === "string" && p.full_name.trim()) names.set(String(p.clerk_user_id), p.full_name.trim())
  }
  return { available: true, rows, names }
}
