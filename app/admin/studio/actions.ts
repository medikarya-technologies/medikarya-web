"use server"

// Admin actions for the studio converter (see page.tsx). The flow for a case:
//   convert → draft → send for review (a private link to a professor, lib/review/links.ts) → the professor approves,
//   or asks for changes → rebuild with their comments → send again → approved → publish (and reward the author).
// Every action checks the caller is an admin. Drafts never reach students: the library lists published cases only,
// and only admins can open a draft (lib/plans/access.ts).

import { auth } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { revalidatePath, revalidateTag } from "next/cache"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { getStudioCase, type StudioCase } from "@/lib/studio/source"
import { caseIdFor, convertStudioCase, type Conversion } from "@/lib/studio/convert"
import { createReviewLink, latestReviews } from "@/lib/review/links"
import { CASE_REWARD, caseRewardWindow, type GrantRow } from "@/lib/plans/grants"

export type ActionResult =
  | { ok: true; message: string; caseId?: string; link?: string }
  | { ok: false; error: string; details?: string[] }

async function requireAdmin(): Promise<string> {
  const { userId } = await auth()
  if (!userId || !(await isAdmin(userId))) throw new Error("Admins only")
  return userId
}

/** The MediKarya case made from this studio case, if any. */
async function convertedFrom(studioId: string): Promise<{ id: string; status: string; case_json: Record<string, any> } | null> {
  const { data, error } = await supabaseServer
    .from("cases")
    .select("id, status, case_json")
    .eq("case_json->source->>studio_case_id", studioId)
    .maybeSingle()
  if (error) throw error
  return data
}

function done() {
  revalidateTag("cases") // the library's cached case list
  revalidatePath("/admin/studio")
}

const fail = (error: unknown, fallback: string): ActionResult => {
  console.error(fallback, error)
  return { ok: false, error: error instanceof Error ? error.message : fallback }
}

/** Saves a conversion as the draft for this studio case. A new version needs a new review, so any review is dropped. */
async function saveDraft(sc: StudioCase, conversion: Conversion, existingId: string | undefined): Promise<string> {
  const { caseJson, reviewNotes, check } = conversion
  let id = existingId
  if (!id) {
    const { data: rows, error } = await supabaseServer.from("cases").select("id")
    if (error) throw error
    id = caseIdFor(String(caseJson.displayTitle), new Set((rows ?? []).map((r) => r.id)))
  }

  const full: Record<string, any> = {
    ...caseJson,
    id,
    status: "draft",
    // Shown on the case (who wrote it) and used here to link the draft back to its studio case.
    credit: { author: sc.author, source: "MediKarya Case Studio" },
    source: {
      studio_case_id: sc.id,
      studio_title: sc.title,
      author: sc.author,
      consent: sc.consentNote ?? "Ticked by the author on submission",
      converted_at: new Date().toISOString(),
      review_notes: reviewNotes,
      warnings: check.warnings,
    },
  }
  delete full.review

  const { error } = await supabaseServer.from("cases").upsert(
    {
      id,
      title: full.title,
      category: full.category,
      difficulty: full.difficulty,
      estimated_time: full.estimatedTime,
      status: "draft",
      case_json: full,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  )
  if (error) throw error
  return id
}

export async function convertToDraft(studioId: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    const sc = await getStudioCase(studioId)
    if (!sc) return { ok: false, error: "That studio case was not found." }
    if (!sc.publishConsent) return { ok: false, error: "The author's permission to publish is not recorded for this case." }

    const existing = await convertedFrom(studioId)
    if (existing?.status === "published") return { ok: false, error: "This case is live. Unpublish it before converting it again." }

    const conversion = await convertStudioCase(sc)
    if (conversion.check.errors.length > 0) {
      return { ok: false, error: "The conversion still had problems after one fix; nothing was saved. Try again.", details: conversion.check.errors }
    }
    const id = await saveDraft(sc, conversion, existing?.id)
    done()
    return { ok: true, message: existing ? "Draft re-converted. It needs a new review." : "Draft created.", caseId: id }
  } catch (error) {
    return fail(error, "Conversion failed.")
  }
}

/** Rebuilds the draft with the professor's requested changes, keeping everything they did not question. */
export async function rebuildWithComments(studioId: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    const sc = await getStudioCase(studioId)
    if (!sc) return { ok: false, error: "That studio case was not found." }
    const existing = await convertedFrom(studioId)
    if (!existing || existing.status === "published") return { ok: false, error: "There is no draft to rebuild." }

    const review = (await latestReviews([existing.id])).get(existing.id)
    if (review?.decision !== "changes_requested" || !review.comments) return { ok: false, error: "The latest review did not ask for changes." }

    const { source, credit, review: _r, status: _s, id: _i, ...current } = existing.case_json
    const conversion = await convertStudioCase(sc, {
      previous: { case: current, review_notes: Array.isArray(source?.review_notes) ? source.review_notes : [] },
      comments: review.comments,
    })
    if (conversion.check.errors.length > 0) {
      return { ok: false, error: "The rebuild still had problems; nothing was saved. Try again.", details: conversion.check.errors }
    }
    await saveDraft(sc, conversion, existing.id)
    done()
    return { ok: true, message: `Rebuilt with ${review.reviewer_name ?? "the reviewer"}'s comments. Send it for review again.`, caseId: existing.id }
  } catch (error) {
    return fail(error, "Rebuild failed.")
  }
}

/** A private review link for a professor (valid 14 days, usable once). */
export async function sendForReview(caseId: string): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin()
    const { data: row, error } = await supabaseServer.from("cases").select("status").eq("id", caseId).maybeSingle()
    if (error) throw error
    if (!row) return { ok: false, error: "Case not found." }
    if (row.status === "published") return { ok: false, error: "This case is already live." }

    const token = await createReviewLink(caseId, adminId)
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.medikarya.in"
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
    revalidatePath("/admin/studio")
    return { ok: true, message: "Review link created. Send it to the professor; it works once, for 14 days.", link: `${proto}://${host}/review/${token}` }
  } catch (error) {
    return fail(error, "Could not create a review link.")
  }
}

/** Gives the author their reward for a published case, once per case. Returns a line for the admin. */
async function rewardAuthor(email: string, caseId: string, adminId: string): Promise<string> {
  const { data, error } = await supabaseServer.from("plan_grants").select("tier, months, starts_at, ends_at, reason, case_id").eq("email", email)
  if (error) return `Reward not given: ${error.message} (has create_reviews_and_grants.sql been run?)`
  const rows = (data ?? []) as Array<GrantRow & { case_id: string | null }>
  if (rows.some((g) => g.case_id === caseId)) return `${email} was already rewarded for this case.`

  const window = caseRewardWindow(rows)
  if (!window) return `${email} has already had the maximum ${CASE_REWARD.capMonths} months of rewards.`

  const { error: insertError } = await supabaseServer.from("plan_grants").insert({
    email,
    tier: CASE_REWARD.tier,
    months: window.months,
    starts_at: window.startsAt.toISOString(),
    ends_at: window.endsAt.toISOString(),
    reason: "case_published",
    case_id: caseId,
    granted_by: adminId,
  })
  if (insertError) return `Reward not given: ${insertError.message}`
  const until = window.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  return `${email} gets Resident free until ${until} (it applies when they sign in to MediKarya with this email).`
}

export async function publishCase(caseId: string, rewardEmail: string | null): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin()
    const { data: row, error } = await supabaseServer.from("cases").select("case_json").eq("id", caseId).maybeSingle()
    if (error) throw error
    if (!row) return { ok: false, error: "Case not found." }
    const caseJson = row.case_json as Record<string, any>
    if (caseJson.review?.decision !== "approved") return { ok: false, error: "A professor has to approve this case before it can be published." }

    const email = rewardEmail?.trim().toLowerCase() || null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That author email does not look right." }

    const { error: updateError } = await supabaseServer
      .from("cases")
      .update({ status: "published", case_json: { ...caseJson, status: "published" }, updated_at: new Date().toISOString() })
      .eq("id", caseId)
    if (updateError) throw updateError
    done()

    const reward = email ? ` ${await rewardAuthor(email, caseId, adminId)}` : ""
    return { ok: true, message: `Published: students see it in the library within a minute.${reward}` }
  } catch (error) {
    return fail(error, "Could not publish the case.")
  }
}

export async function unpublishCase(caseId: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    const { data: row, error } = await supabaseServer.from("cases").select("case_json").eq("id", caseId).maybeSingle()
    if (error) throw error
    if (!row) return { ok: false, error: "Case not found." }
    const { error: updateError } = await supabaseServer
      .from("cases")
      .update({ status: "draft", case_json: { ...(row.case_json as object), status: "draft" }, updated_at: new Date().toISOString() })
      .eq("id", caseId)
    if (updateError) throw updateError
    done()
    return { ok: true, message: "Unpublished: back to a draft. Its approval stands until you re-convert or rebuild it." }
  } catch (error) {
    return fail(error, "Could not unpublish the case.")
  }
}

export async function deleteDraft(caseId: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    const { error, count } = await supabaseServer.from("cases").delete({ count: "exact" }).eq("id", caseId).eq("status", "draft")
    if (error) throw error
    if (!count) return { ok: false, error: "Only a draft can be deleted." }
    done()
    return { ok: true, message: "Draft deleted." }
  } catch (error) {
    return fail(error, "Could not delete the draft.")
  }
}
