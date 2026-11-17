"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { cleanStaffEmail, canManageMedventure, MEDVENTURE } from "@/lib/events/medventure"
import { createJoinLink, setJoinLinkActive } from "@/lib/plans/join-links"
import { givePasses } from "@/lib/plans/pass-batches"
import { checkJoinRequest, checkPassRequest } from "@/lib/plans/passes"
import { supabaseServer } from "@/lib/supabase/server"
import { issueWorkshopCertificate } from "@/lib/studio/source"
import { CERTIFICATE_LIMITS, certificateProblem, finishedAll, printableName, workshopDetail } from "@/lib/workshops/rank"
import { attemptsOf, membersOf } from "@/lib/workshops/server"
import { getPassBatch } from "@/lib/plans/pass-batches"

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

