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
import { getStudioCase, markPublishedInStudio, pushConversion, studioReviews, type StudioCase, type StudioReview } from "@/lib/studio/source"
import { getCatalogTest } from "@/lib/clinical-catalog"
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
  revalidatePath("/admin/records")
}

const fail = (error: unknown, fallback: string): ActionResult => {
  console.error(fallback, error)
  return { ok: false, error: error instanceof Error ? error.message : fallback }
}

/** Names for every test id the case mentions, for the studio's copy of the report (the catalog lives here). */
function testNamesOf(c: Record<string, any>): Record<string, string> {
  const t = c.evaluation_config?.testing ?? {}
  const ids = [...(t.core_tests ?? []), ...(t.optional_tests ?? []), ...(t.distractor_tests ?? []), ...(t.dangerous_tests ?? [])]
  const names: Record<string, string> = {}
  for (const id of ids) {
    const name = (c.tests ?? []).find((x: any) => x.id === id)?.name ?? getCatalogTest(id)?.name
    if (name) names[id] = name
  }
  return names
}

/**
 * Saves a conversion as the draft for this studio case, and puts the new version in the studio's reviewer queue. A
 * new version needs a new review, so any review is dropped. Returns a warning if the studio could not be updated
 * (the draft is saved either way; a private review link still works).
 */
async function saveDraft(sc: StudioCase, conversion: Conversion, existingId: string | undefined): Promise<{ id: string; queueWarning?: string }> {
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

  try {
    await pushConversion(sc.id, { medikaryaCaseId: id, caseJson: full, reviewNotes, warnings: check.warnings, testNames: testNamesOf(full) })
    return { id }
  } catch (e) {
    console.error("Could not put the draft in the studio's reviewer queue:", e)
    return { id, queueWarning: "It could not be added to the studio's reviewer queue (has studio migration 010 been run?); a private review link still works." }
  }
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
    const { id, queueWarning } = await saveDraft(sc, conversion, existing?.id)
    done()
    const base = existing ? "Draft re-converted. It needs a new review." : "Draft created and placed in the reviewer queue."
    return { ok: true, message: queueWarning ? `${base} ${queueWarning}` : base, caseId: id }
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

    const asked = await latestChangeRequest(existing.id, studioId)
    if (!asked) return { ok: false, error: "The latest review did not ask for changes." }

    const { source, credit, review: _r, status: _s, id: _i, ...current } = existing.case_json
    const conversion = await convertStudioCase(sc, {
      previous: { case: current, review_notes: Array.isArray(source?.review_notes) ? source.review_notes : [] },
      comments: asked.comments,
    })
    if (conversion.check.errors.length > 0) {
      return { ok: false, error: "The rebuild still had problems; nothing was saved. Try again.", details: conversion.check.errors }
    }
    const { queueWarning } = await saveDraft(sc, conversion, existing.id)
    done()
    return {
      ok: true,
      message: `Rebuilt with ${asked.reviewer}'s comments and put back in the reviewer queue.${queueWarning ? ` ${queueWarning}` : ""}`,
      caseId: existing.id,
    }
  } catch (error) {
    return fail(error, "Rebuild failed.")
  }
}

/** The newest "changes requested" on this draft, from the studio's queue or a private link. */
async function latestChangeRequest(caseId: string, studioId: string): Promise<{ comments: string; reviewer: string } | null> {
  const [link, queue] = await Promise.all([latestReviews([caseId]).then((m) => m.get(caseId)), studioReviews([studioId]).then((m) => m.get(studioId))])
  const candidates = [
    link?.decision === "changes_requested" && link.comments ? { at: link.decided_at!, comments: link.comments, reviewer: link.reviewer_name ?? "the reviewer" } : null,
    queue?.decision === "changes_requested" && queue.comments ? { at: queue.decidedAt!, comments: queue.comments, reviewer: queue.reviewerName } : null,
  ].filter((x): x is { at: string; comments: string; reviewer: string } => !!x)
  candidates.sort((a, b) => b.at.localeCompare(a.at))
  return candidates[0] ?? null
}

/** What goes on the case from a studio approval: the reviewer's name only if they agreed to be named. */
function reviewFromStudio(r: StudioReview) {
  return {
    decision: "approved",
    show_name: r.showName,
    decided_at: r.decidedAt,
    via: "studio",
    ...(r.showName
      ? { reviewer_name: r.reviewerName, reviewer_designation: r.designation, reviewer_department: r.department, reviewer_institution: r.institution }
      : {}),
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
    let caseJson = row.case_json as Record<string, any>
    if (caseJson.review?.decision !== "approved") {
      // Approved in the studio's reviewer queue rather than through a private link: take the approval from there.
      const studioId = caseJson.source?.studio_case_id
      const queued = studioId ? (await studioReviews([studioId])).get(studioId) : undefined
      if (queued?.decision !== "approved") return { ok: false, error: "A reviewer has to approve this case before it can be published." }
      caseJson = { ...caseJson, review: reviewFromStudio(queued) }
    }

    const email = rewardEmail?.trim().toLowerCase() || null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That author email does not look right." }

    const publishedAt = new Date().toISOString()
    const { error: updateError } = await supabaseServer
      .from("cases")
      .update({ status: "published", case_json: { ...caseJson, status: "published", published_at: publishedAt }, updated_at: publishedAt })
      .eq("id", caseId)
    if (updateError) throw updateError
    done()

    // The studio pays the author and counts the case towards their title from this.
    const studioCaseId = caseJson.source?.studio_case_id
    const studioNote = studioCaseId ? await markPublishedInStudio(studioCaseId, publishedAt) : null
    const reward = email ? ` ${await rewardAuthor(email, caseId, adminId)}` : ""
    return { ok: true, message: `Published: students see it in the library within a minute.${reward}${studioNote ? ` ${studioNote}` : ""}` }
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
    const { published_at: _was, ...caseJson } = row.case_json as Record<string, any>
    const { error: updateError } = await supabaseServer
      .from("cases")
      .update({ status: "draft", case_json: { ...caseJson, status: "draft" }, updated_at: new Date().toISOString() })
      .eq("id", caseId)
    if (updateError) throw updateError
    if (caseJson.source?.studio_case_id) await markPublishedInStudio(caseJson.source.studio_case_id, null)
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
