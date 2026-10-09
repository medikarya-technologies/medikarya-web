"use server"

// Admin → Workshop passes: free Intern (or Resident) time for every student registered for an event, by email
// (lib/plans/passes.ts), and the event's participation certificates. Every action checks the caller is an admin.

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { isAdmin } from "@/lib/plans/access"
import { checkPassRequest, type PassRequest } from "@/lib/plans/passes"
import { emailsWithAccounts, getPassBatch, givePasses, removePassBatch } from "@/lib/plans/pass-batches"
import { issueWorkshopCertificate } from "@/lib/studio/source"
import { CERTIFICATE_LIMITS, certificateProblem, finishedAll, printableName, workshopDetail } from "@/lib/workshops/rank"
import { attemptsOf, membersOf } from "@/lib/workshops/server"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function adminId(): Promise<string> {
  const { userId } = await auth()
  if (!userId || !(await isAdmin(userId))) throw new Error("Admins only")
  return userId
}

const message = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback)

export async function givePassesAction(
  request: PassRequest
): Promise<Result<{ given: number; already: number; withAccount: number; invalid: string[] }>> {
  try {
    const admin = await adminId()
    const pass = checkPassRequest(request)
    if (!pass.ok) return pass
    const { given, already } = await givePasses(pass, admin)
    const withAccount = (await emailsWithAccounts(pass.emails)).size
    revalidatePath("/admin/passes")
    return { ok: true, given, already, withAccount, invalid: pass.invalid }
  } catch (error) {
    console.error("Could not give workshop passes:", error)
    return { ok: false, error: message(error, "Could not give the passes.") }
  }
}

export interface CertificateRequest {
  event: string
  title: string
  venue: string
  day: string
  /** The cases a student must have finished while their pass ran. */
  cases: string[]
  people: Array<{ email: string; name: string }>
}

/**
 * Issues participation certificates to these students of the workshop. Each one is checked again here: in the batch,
 * signed up, finished every ticked case while the pass ran, and a printable name. Someone who already has one keeps it.
 */
export async function issueCertificatesAction(
  r: CertificateRequest
): Promise<Result<{ issued: Array<{ email: string; credentialId: string; existed: boolean }>; skipped: Array<{ email: string; why: string }> }>> {
  try {
    await adminId()
    const problem = certificateProblem(r)
    if (problem) return { ok: false, error: problem }
    if (r.people.length > CERTIFICATE_LIMITS.perCall) return { ok: false, error: `Send at most ${CERTIFICATE_LIMITS.perCall} at a time.` }
    const batch = await getPassBatch(r.event)
    if (!batch) return { ok: false, error: "That workshop pass no longer exists." }

    const inBatch = new Set(batch.emails)
    const members = await membersOf(r.people.map((p) => p.email.toLowerCase()).filter((e) => inBatch.has(e)))
    const rows = await attemptsOf(
      members.map((m) => m.userId),
      new Date(batch.startsAt),
      new Date(batch.endsAt)
    )
    const finished = finishedAll(rows, r.cases)
    const byEmail = new Map(members.map((m) => [m.email, m]))
    const title = r.title.trim().replace(/\s+/g, " ")
    const detail = workshopDetail(r.venue, r.day, r.cases.length)

    const issued: Array<{ email: string; credentialId: string; existed: boolean }> = []
    const skipped: Array<{ email: string; why: string }> = []
    for (const p of r.people) {
      const email = p.email.toLowerCase()
      const member = byEmail.get(email)
      const name = printableName(p.name)
      if (!member) skipped.push({ email, why: inBatch.has(email) ? "has not signed up" : "is not in this workshop" })
      else if (!finished.has(member.userId)) skipped.push({ email, why: "has not finished every ticked case" })
      else if (!name) skipped.push({ email, why: "needs a proper name" })
      else issued.push({ email, ...(await issueWorkshopCertificate({ event: batch.name, email, name, title, detail })) })
    }
    revalidatePath("/admin/passes/certificates")
    return { ok: true, issued, skipped }
  } catch (error) {
    console.error("Could not issue workshop certificates:", error)
    return { ok: false, error: message(error, "Could not issue the certificates.") }
  }
}

export async function removeBatchAction(reason: string): Promise<Result<{ removed: number }>> {
  try {
    await adminId()
    const removed = await removePassBatch(reason)
    revalidatePath("/admin/passes")
    return { ok: true, removed }
  } catch (error) {
    return { ok: false, error: message(error, "Could not remove the batch.") }
  }
}
