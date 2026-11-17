"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { cleanStaffEmail, canManageMedventure, medventurePathways, MEDVENTURE } from "@/lib/events/medventure"
import { pathwayProblem, type EventPathway, type PathwayNode } from "@/lib/events/pathways"
import { createJoinLink, setJoinLinkActive } from "@/lib/plans/join-links"
import { givePasses } from "@/lib/plans/pass-batches"
import { checkJoinRequest, checkPassRequest } from "@/lib/plans/passes"
import { indiaDay } from "@/lib/plans/limits"
import { supabaseServer } from "@/lib/supabase/server"
import { issueWorkshopCertificate } from "@/lib/studio/source"
import { CERTIFICATE_LIMITS, certificateProblem, finishedAll, printableName, workshopDetail } from "@/lib/workshops/rank"
import { attemptsOf, membersOf } from "@/lib/workshops/server"
import { getPassBatch } from "@/lib/plans/pass-batches"
import { medventureResults } from "@/lib/events/medventure-results"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function eventManager(): Promise<{ userId: string; owner: boolean }> {
  const { userId } = await auth()
  const access = await canManageMedventure(userId)
  if (!userId || !access.allowed) throw new Error("Medventure organisers only")
  return { userId, owner: access.owner }
}

const revalidate = () => {
  revalidatePath("/medventure/admin")
  revalidatePath("/medventure/join")
  revalidatePath("/medventure/challenge")
  revalidatePath("/medventure/results")
}

type PathwayInput = Pick<EventPathway, "id" | "title" | "position" | "startNodeId" | "nodes" | "published">

function pathId(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{1,80}$/i.test(value) ? value : null
}

function nodesFrom(value: unknown): PathwayNode[] | null {
  if (!Array.isArray(value)) return null
  const nodes: PathwayNode[] = []
  for (const row of value) {
    if (!row || typeof row !== "object") return null
    const node = row as Record<string, unknown>
    if (typeof node.id !== "string" || typeof node.prompt !== "string" || !Array.isArray(node.answers)) return null
    const answers = node.answers.map((answer) => {
      if (!answer || typeof answer !== "object") return null
      const item = answer as Record<string, unknown>
      return typeof item.id === "string" && typeof item.text === "string" && typeof item.points === "number" && Number.isInteger(item.points) && (typeof item.nextNodeId === "string" || item.nextNodeId === null)
        ? { id: item.id, text: item.text, points: item.points, nextNodeId: item.nextNodeId }
        : null
    })
    if (answers.some((answer) => !answer)) return null
    nodes.push({ id: node.id, prompt: node.prompt, answers: answers as PathwayNode["answers"] })
  }
  return nodes
}

/** Saves a whole pathway as one atomic draft, so students never see a half-edited clinical question. */
export async function saveMedventurePathwayAction(input: PathwayInput): Promise<Result<{ id: string }>> {
  try {
    await eventManager()
    const id = pathId(input.id)
    const nodes = nodesFrom(input.nodes)
    if (!id || !nodes || !Number.isInteger(input.position) || input.position < 1 || typeof input.title !== "string" || typeof input.startNodeId !== "string" || typeof input.published !== "boolean") {
      return { ok: false, error: "This pathway has an invalid field. Refresh and try again." }
    }
    const pathway = { id, title: input.title.trim(), position: input.position, startNodeId: input.startNodeId, nodes, published: input.published }
    const problem = pathwayProblem(pathway)
    if (problem) return { ok: false, error: problem }
    const { error } = await supabaseServer.from("event_pathways").upsert({
      event_key: MEDVENTURE.key,
      id: pathway.id,
      title: pathway.title,
      position: pathway.position,
      start_node_id: pathway.startNodeId,
      nodes: pathway.nodes,
      published: pathway.published,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_key,id" })
    if (error) throw error
    revalidatePath("/medventure/admin/questions")
    revalidate()
    return { ok: true, id }
  } catch (error) {
    console.error("Could not save the Medventure pathway:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the pathway." }
  }
}

export async function deleteMedventurePathwayAction(id: string): Promise<Result> {
  try {
    await eventManager()
    const safeId = pathId(id)
    if (!safeId) return { ok: false, error: "That pathway is not valid." }
    const { error } = await supabaseServer.from("event_pathways").delete().eq("event_key", MEDVENTURE.key).eq("id", safeId)
    if (error) throw error
    revalidatePath("/medventure/admin/questions")
    revalidate()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete the pathway." }
  }
}

export async function configureMedventureRoomAction(input: { status: "draft" | "live" | "closed" }): Promise<Result> {
  try {
    await eventManager()
    if (!(["draft", "live", "closed"] as string[]).includes(input.status)) return { ok: false, error: "That room status is not valid." }
    const caseId = MEDVENTURE.roundTwo.caseId
    const { pathways } = await medventurePathways({ publishedOnly: true })
    if (input.status === "live" && pathways.length === 0) return { ok: false, error: "Publish at least one Round 1 pathway before opening the room." }
    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { status: input.status, round_two_case_id: caseId, updated_at: now }
    if (input.status === "live") patch.started_at = now
    if (input.status === "closed") patch.closed_at = now
    const { error } = await supabaseServer.from("event_rooms").upsert({ event_key: MEDVENTURE.key, ...patch }, { onConflict: "event_key" })
    if (error) throw error
    revalidate()
    return { ok: true }
  } catch (error) {
    console.error("Could not update the Medventure room:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not update the room." }
  }
}

/** Locks the event table and grants the promised subscriptions once, after organisers close the room. */
export async function finalizeMedventureResultsAction(): Promise<Result<{ awarded: number }>> {
  try {
    const { userId } = await eventManager()
    const { data: room, error: roomError } = await supabaseServer.from("event_rooms").select("status").eq("event_key", MEDVENTURE.key).maybeSingle()
    if (roomError) throw roomError
    if (room?.status !== "closed") return { ok: false, error: "Close the room before finalising prizes." }
    const results = await medventureResults()
    if (!results.available) return { ok: false, error: "The event results are not available." }
    const winners = results.ranked.slice(0, 3)
    if (winners.length === 0) return { ok: false, error: "No participant has completed both rounds yet." }
    const profiles = await supabaseServer.from("user_profiles").select("clerk_user_id, email").in("clerk_user_id", winners.map((winner) => winner.userId))
    if (profiles.error) throw profiles.error
    const emails = new Map((profiles.data ?? []).map((row) => [String(row.clerk_user_id), String(row.email).toLowerCase()]))
    let awarded = 0
    for (const [index, winner] of winners.entries()) {
      const place = index + 1
      const email = emails.get(winner.userId)
      if (!email) throw new Error("A winning account is missing its email address.")
      const { data: existing, error: existingError } = await supabaseServer.from("event_prizes").select("place").eq("event_key", MEDVENTURE.key).eq("place", place).maybeSingle()
      if (existingError) throw existingError
      if (existing) continue
      const tier = place === 1 ? "resident" : "intern"
      const now = new Date()
      const ends = new Date(now)
      ends.setUTCMonth(ends.getUTCMonth() + 1)
      const { error: prizeError } = await supabaseServer.from("event_prizes").insert({ event_key: MEDVENTURE.key, place, clerk_user_id: winner.userId, email, tier })
      if (prizeError) throw prizeError
      const { error: grantError } = await supabaseServer.from("plan_grants").insert({ email, tier, months: 1, starts_at: now.toISOString(), ends_at: ends.toISOString(), reason: `event:${MEDVENTURE.key}:place-${place}`, case_id: null, granted_by: userId })
      if (grantError) throw grantError
      awarded += 1
    }
    const { error: updateError } = await supabaseServer.from("event_rooms").update({ status: "finalized", finalized_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("event_key", MEDVENTURE.key)
    if (updateError) throw updateError
    revalidate()
    revalidatePath("/medventure/admin/results")
    return { ok: true, awarded }
  } catch (error) {
    console.error("Could not finalise Medventure prizes:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not finalise prizes." }
  }
}

/** Makes the event's single room link. Its dates, pass and capacity are fixed to the agreed Medventure setup. */
export async function createMedventureJoinAction(): Promise<Result<{ code: string }>> {
  try {
    const { userId } = await eventManager()
    const check = checkJoinRequest({
      name: MEDVENTURE.name,
      plan: MEDVENTURE.pass.plan,
      startDay: MEDVENTURE.date,
      days: MEDVENTURE.pass.days,
      openDay: MEDVENTURE.date,
      openDays: MEDVENTURE.pass.openDays,
      maxJoins: MEDVENTURE.pass.maxJoins,
    })
    if (!check.ok) return check
    const link = await createJoinLink(check, userId)
    revalidate()
    return { ok: true, code: link.code }
  } catch (error) {
    console.error("Could not create the Medventure entry link:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not create the entry link." }
  }
}

/** A tiny, separate link that lets organisers rehearse today without opening tomorrow's attendee QR. */
export async function createMedventureDryRunAction(): Promise<Result<{ code: string }>> {
  try {
    const { userId } = await eventManager()
    const today = indiaDay()
    const check = checkJoinRequest({
      name: MEDVENTURE.dryRun.name,
      plan: MEDVENTURE.pass.plan,
      startDay: today,
      days: MEDVENTURE.dryRun.days,
      openDay: today,
      openDays: 1,
      maxJoins: MEDVENTURE.dryRun.maxJoins,
    })
    if (!check.ok) return check
    const link = await createJoinLink(check, userId)
    revalidate()
    return { ok: true, code: link.code }
  } catch (error) {
    console.error("Could not create the Medventure preflight link:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not create the preflight link." }
  }
}

export async function setMedventureJoinActiveAction(code: string, active: boolean): Promise<Result> {
  try {
    await eventManager()
    await setJoinLinkActive(code, active)
    revalidate()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update the entry link." }
  }
}

/** Adds registered attendees to the same five-day pass, including students who join after the room link closes. */
export async function giveMedventurePassesAction(emailsText: string): Promise<Result<{ given: number; already: number; invalid: string[] }>> {
  try {
    const { userId } = await eventManager()
    const check = checkPassRequest({
      name: MEDVENTURE.name,
      plan: MEDVENTURE.pass.plan,
      startDay: MEDVENTURE.date,
      days: MEDVENTURE.pass.days,
      emailsText,
    })
    if (!check.ok) return check
    const { given, already } = await givePasses(check, userId)
    revalidate()
    return { ok: true, given, already, invalid: check.invalid }
  } catch (error) {
    console.error("Could not give Medventure passes:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not give the passes." }
  }
}

export async function addMedventureStaffAction(rawEmail: string): Promise<Result<{ email: string }>> {
  try {
    const { userId, owner } = await eventManager()
    if (!owner) return { ok: false, error: "Only a MediKarya platform admin can add Medventure organisers." }
    const email = cleanStaffEmail(rawEmail)
    if (!email) return { ok: false, error: "Enter one valid email address." }
    const { error } = await supabaseServer.from("event_staff").upsert({ event_key: MEDVENTURE.key, email, added_by: userId }, { onConflict: "event_key,email", ignoreDuplicates: true })
    if (error) throw error
    revalidate()
    return { ok: true, email }
  } catch (error) {
    console.error("Could not add Medventure staff:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not add the organiser." }
  }
}

export async function removeMedventureStaffAction(rawEmail: string): Promise<Result> {
  try {
    const { owner } = await eventManager()
    if (!owner) return { ok: false, error: "Only a MediKarya platform admin can remove Medventure organisers." }
    const email = cleanStaffEmail(rawEmail)
    if (!email) return { ok: false, error: "That email address is not valid." }
    const { error } = await supabaseServer.from("event_staff").delete().eq("event_key", MEDVENTURE.key).eq("email", email)
    if (error) throw error
    revalidate()
    return { ok: true }
  } catch (error) {
    console.error("Could not remove Medventure staff:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not remove the organiser." }
  }
}

type CertificateRequest = {
  event: string
  title: string
  venue: string
  day: string
  cases: string[]
  people: Array<{ email: string; name: string }>
}

/** The same QR-verifiable certificates as workshops, with authority limited to the Medventure batch. */
export async function issueMedventureCertificatesAction(r: CertificateRequest): Promise<Result<{ issued: Array<{ email: string; credentialId: string; existed: boolean }>; skipped: Array<{ email: string; why: string }> }>> {
  try {
    await eventManager()
    if (r.event !== MEDVENTURE.name) return { ok: false, error: "That is not the Medventure certificate batch." }
    const problem = certificateProblem(r)
    if (problem) return { ok: false, error: problem }
    if (r.people.length > CERTIFICATE_LIMITS.perCall) return { ok: false, error: `Send at most ${CERTIFICATE_LIMITS.perCall} at a time.` }
    const batch = await getPassBatch(MEDVENTURE.name)
    if (!batch) return { ok: false, error: "The Medventure pass batch does not exist yet." }

    const inBatch = new Set(batch.emails)
    const members = await membersOf(r.people.map((person) => person.email.toLowerCase()).filter((email) => inBatch.has(email)))
    const rows = await attemptsOf(members.map((member) => member.userId), new Date(batch.startsAt), new Date(batch.endsAt))
    const finished = finishedAll(rows, r.cases)
    const byEmail = new Map(members.map((member) => [member.email, member]))
    const detail = workshopDetail(r.venue, r.day, r.cases.length)
    const title = r.title.trim().replace(/\s+/g, " ")
    const issued: Array<{ email: string; credentialId: string; existed: boolean }> = []
    const skipped: Array<{ email: string; why: string }> = []
    for (const person of r.people) {
      const email = person.email.toLowerCase()
      const member = byEmail.get(email)
      const name = printableName(person.name)
      if (!member) skipped.push({ email, why: inBatch.has(email) ? "has not signed up" : "is not in Medventure" })
      else if (!finished.has(member.userId)) skipped.push({ email, why: "has not finished every selected case" })
      else if (!name) skipped.push({ email, why: "needs a proper name" })
      else issued.push({ email, ...(await issueWorkshopCertificate({ event: MEDVENTURE.name, email, name, title, detail })) })
    }
    revalidatePath("/medventure/admin/certificates")
    return { ok: true, issued, skipped }
  } catch (error) {
    console.error("Could not issue Medventure certificates:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not issue the certificates." }
  }
}

