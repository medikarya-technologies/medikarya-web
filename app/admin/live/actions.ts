"use server"

// Admin → Live cases. Turning an ordinary case into a live one (lib/simulation/live-plan.ts):
//   draft a plan with AI (or it arrives written by a resident in the Case Studio) → read the report and play-test it
//   (a proposed plan runs for admins only) → switch it on.
// The MediKarya team checks the plan and switches it on; a clinician's sign-off (a private link) is optional while we
// have no reviewers. Students get the live version only once it is switched on, and only if it passes the check.
// Every action checks the caller is an admin.

import { auth } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { revalidatePath, revalidateTag } from "next/cache"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { createReviewLink } from "@/lib/review/links"
import { isSimulationCase } from "@/lib/simulation/case-schema"
import { upgradeLegacyCase } from "@/lib/simulation/legacy-adapter"
import { checkLivePlan, isLivePlan, measuredOnArrival, type LivePlan } from "@/lib/simulation/live-plan"
import { draftLivePlan } from "@/lib/studio/live-draft"

export type LiveResult = { ok: true; message: string; link?: string } | { ok: false; error: string; details?: string[] }

async function requireAdmin(): Promise<string> {
  const { userId } = await auth()
  if (!userId || !(await isAdmin(userId))) throw new Error("Admins only")
  return userId
}

const fail = (error: unknown, fallback: string): LiveResult => {
  console.error(fallback, error)
  return { ok: false, error: error instanceof Error && error.message ? error.message : fallback }
}

function done() {
  revalidateTag("cases") // the library's cached list says which cases are live
  revalidatePath("/admin/live")
  revalidatePath("/admin/studio")
}

async function load(caseId: string): Promise<Record<string, any> | null> {
  const { data, error } = await supabaseServer.from("cases").select("case_json").eq("id", caseId).maybeSingle()
  if (error) throw error
  return (data?.case_json as Record<string, any>) ?? null
}

async function savePlan(caseId: string, caseJson: Record<string, any>, plan: LivePlan | null): Promise<void> {
  const { live_plan: _old, ...rest } = caseJson
  const next = plan ? { ...rest, live_plan: plan } : rest
  const { error } = await supabaseServer.from("cases").update({ case_json: next, updated_at: new Date().toISOString() }).eq("id", caseId)
  if (error) throw error
}

/**
 * Drafts a live plan for this case with AI, or (when it already has one) changes it: as `instructions` say, or else as
 * the clinician who asked for changes said. The result is a proposal: any earlier sign-off is dropped, and students
 * keep (or go back to) the ordinary case until the new plan is switched on.
 */
export async function draftLivePlanAction(caseId: string, instructions = ""): Promise<LiveResult> {
  try {
    await requireAdmin()
    const caseJson = await load(caseId)
    if (!caseJson) return { ok: false, error: "Case not found." }
    if (isSimulationCase(caseJson)) return { ok: false, error: "This case was written as a live case: it has its own physiology and needs no plan." }

    const base = upgradeLegacyCase(caseJson)
    if (!isSimulationCase(base)) return { ok: false, error: "This case cannot run at the bedside (it has no heart rate or no tests), so it cannot be made live." }
    const measured = measuredOnArrival(base)

    const existing = isLivePlan(caseJson.live_plan) ? caseJson.live_plan : null
    const asked = instructions.trim() || (existing?.sign_off?.decision === "changes_requested" ? (existing.sign_off.comments ?? "") : "")
    if (existing && !asked) return { ok: false, error: "This case already has a live plan. Say what to change, or remove the plan to start again." }

    const draft = await draftLivePlan(caseJson, measured, existing ? { previous: existing, comments: asked } : undefined)
    if (!draft.ok) {
      if (draft.reason === "not_suitable") return { ok: false, error: `Not made live: ${draft.why}` }
      return { ok: false, error: "The plan still had problems after one fix; nothing was saved. Try again.", details: draft.problems }
    }

    await savePlan(caseId, caseJson, draft.plan)
    done()
    const warned = draft.check.warnings.length > 0 ? ` ${draft.check.warnings.length} thing${draft.check.warnings.length === 1 ? "" : "s"} to look at.` : ""
    return {
      ok: true,
      message: `${existing ? "Plan changed" : "Live plan drafted"}: ${draft.plan.stages.length} steps, ${draft.plan.treatments.length} treatments.${warned} It is a proposal: read the report and play-test it, then switch it on.`,
    }
  } catch (error) {
    return fail(error, "Could not draft a live plan.")
  }
}

export async function removeLivePlanAction(caseId: string): Promise<LiveResult> {
  try {
    await requireAdmin()
    const caseJson = await load(caseId)
    if (!caseJson) return { ok: false, error: "Case not found." }
    await savePlan(caseId, caseJson, null)
    done()
    return { ok: true, message: "Live plan removed. The case is an ordinary one again." }
  } catch (error) {
    return fail(error, "Could not remove the plan.")
  }
}

/** A private link for a clinician to sign the plan off: no account, valid 14 days, usable once (lib/review/links.ts). */
export async function sendLiveSignOffAction(caseId: string): Promise<LiveResult> {
  try {
    const adminId = await requireAdmin()
    const caseJson = await load(caseId)
    if (!caseJson || !isLivePlan(caseJson.live_plan)) return { ok: false, error: "This case has no live plan to sign off." }
    const token = await createReviewLink(caseId, adminId)
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.medikarya.in"
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
    revalidatePath("/admin/live")
    return { ok: true, message: "Sign-off link created. Send it to the clinician; it works once, for 14 days.", link: `${proto}://${host}/review/${token}` }
  } catch (error) {
    return fail(error, "Could not create a sign-off link.")
  }
}

/**
 * Switches the live version on for students, or back off. Switching on needs a plan that passes the check (students
 * would otherwise silently get the ordinary case), not a sign-off; without one it is recorded as the team's check.
 */
export async function setLiveAction(caseId: string, on: boolean): Promise<LiveResult> {
  try {
    await requireAdmin()
    const caseJson = await load(caseId)
    const plan = caseJson?.live_plan
    if (!caseJson || !isLivePlan(plan)) return { ok: false, error: "This case has no live plan." }
    let next: LivePlan = { ...plan, status: on ? "approved" : "proposed" }
    if (on) {
      const base = upgradeLegacyCase(caseJson)
      if (!isSimulationCase(base)) return { ok: false, error: "This case cannot run at the bedside, so it cannot be made live." }
      const check = checkLivePlan(plan, measuredOnArrival(base))
      if (check.errors.length > 0) return { ok: false, error: "The plan does not pass the check. Fix it first.", details: check.errors }
      if (plan.sign_off?.decision !== "approved") next = { ...next, team_checked_at: new Date().toISOString() }
    }
    await savePlan(caseId, caseJson, next)
    done()
    return {
      ok: true,
      message: on
        ? caseJson.status === "published"
          ? "Live: students now get this case with the clock, the tray and the deterioration. It counts as a live case on their plan."
          : "Switched on. The case is still a draft: students get the live version once you publish it."
        : "Switched off: students get the ordinary case again. The plan is kept.",
    }
  } catch (error) {
    return fail(error, "Could not change that.")
  }
}
