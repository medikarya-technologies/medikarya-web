"use server"

// Admin → Advisors: private links for professors to play chosen cases without an account, and the Clinical Advisory
// Board shown on /contributors (lib/advisors/invites.ts). Every action checks the caller is an admin.

import { auth } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getCases } from "@/data/cases"
import { isAdmin } from "@/lib/plans/access"
import { addAdvisor, createInvite, endInvite, listAdvisors, removeAdvisor, updateAdvisor, type NewAdvisor } from "@/lib/advisors/invites"
import { issueAdvisoryCertificate } from "@/lib/studio/source"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function adminId(): Promise<string> {
  const { userId } = await auth()
  if (!userId || !(await isAdmin(userId))) throw new Error("Admins only")
  return userId
}

const message = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback)

function refresh() {
  revalidatePath("/admin/advisors")
  revalidatePath("/contributors")
}

/** Makes a link that opens these cases for 14 days. The link is shown once: only its hash is stored. */
export async function createInviteAction(caseIds: string[], note: string): Promise<Result<{ url: string }>> {
  try {
    const admin = await adminId()
    const live = new Set((await getCases()).map((c) => c.id))
    const chosen = [...new Set(caseIds)].filter((id) => live.has(id))
    if (chosen.length === 0) return { ok: false, error: "Choose at least one case." }
    const token = await createInvite(chosen, note, admin)
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.medikarya.in"
    const origin = `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`
    refresh()
    return { ok: true, url: `${origin}/advisor/${token}` }
  } catch (error) {
    console.error("Could not create advisor link:", error)
    return { ok: false, error: message(error, "Could not create the link.") }
  }
}

export async function endInviteAction(id: string): Promise<Result> {
  try {
    await adminId()
    await endInvite(id)
    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: message(error, "Could not end the link.") }
  }
}

/** Adds someone to the advisory board, from a link they used or by hand, and (if asked) issues their certificate. */
export async function addAdvisorAction(a: NewAdvisor & { certificate: boolean }): Promise<Result<{ credentialId: string | null; warning?: string }>> {
  try {
    const admin = await adminId()
    const advisor = await addAdvisor(a, admin)
    let credentialId: string | null = null
    let warning: string | undefined
    if (a.certificate) {
      try {
        credentialId = await issueAdvisoryCertificate(advisor.name)
        await updateAdvisor(advisor.id, { credential_id: credentialId })
      } catch (error) {
        console.error("Could not issue advisory certificate:", error)
        warning = `Added, but the certificate could not be issued: ${message(error, "unknown error")}. Use "Issue certificate" on their row to try again.`
      }
    }
    refresh()
    return { ok: true, credentialId, warning }
  } catch (error) {
    return { ok: false, error: message(error, "Could not add them.") }
  }
}

export async function issueCertificateAction(advisorId: string): Promise<Result<{ credentialId: string }>> {
  try {
    await adminId()
    const advisor = (await listAdvisors()).find((a) => a.id === advisorId)
    if (!advisor) return { ok: false, error: "That person is no longer on the list." }
    const credentialId = await issueAdvisoryCertificate(advisor.name)
    await updateAdvisor(advisor.id, { credential_id: credentialId })
    refresh()
    return { ok: true, credentialId }
  } catch (error) {
    return { ok: false, error: message(error, "Could not issue the certificate.") }
  }
}

export async function setListedAction(advisorId: string, listed: boolean): Promise<Result> {
  try {
    await adminId()
    await updateAdvisor(advisorId, { listed })
    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: message(error, "Could not change that.") }
  }
}

/** Takes someone off the board. A certificate already issued stays valid until it is withdrawn in the studio. */
export async function removeAdvisorAction(advisorId: string): Promise<Result> {
  try {
    await adminId()
    await removeAdvisor(advisorId)
    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: message(error, "Could not remove them.") }
  }
}
