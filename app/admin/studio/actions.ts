"use server"

// Admin actions for the studio converter (see page.tsx). The flow for a case sheet a student submitted:
//   convert it with AI, as a static case or as a live one (the same conversion plus a live plan), or send it back to
//   the author with comments → the converted case goes to the studio's reviewer queue, or a private link to a
//   professor (lib/review/links.ts), whichever approves first → (changes asked: rebuild with their comments, and it
//   goes back for review) → approved → publish (and reward the author). That one approval is the only one: it covers
//   the live plan too, so a live case goes live on publish.
// Every action checks the caller is an admin. Drafts never reach students: the library lists published cases only,
// and only admins can open a draft (lib/plans/access.ts).

import { auth, currentUser } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { revalidatePath, revalidateTag } from "next/cache"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { authorPublishedCount, getStudioCase, markPublishedInStudio, pushConversion, sendBackInStudio, studioReviews, type StudioCase, type StudioReview } from "@/lib/studio/source"
import { getCatalogTest } from "@/lib/clinical-catalog"
import { caseIdFor, convertStudioCase, type Conversion } from "@/lib/studio/convert"
import { createReviewLink, latestReviews } from "@/lib/review/links"
import { CASE_REWARD, caseRewardWindow, type GrantRow } from "@/lib/plans/grants"
import { isSimulationCase } from "@/lib/simulation/case-schema"
import { upgradeLegacyCase } from "@/lib/simulation/legacy-adapter"
import { checkLivePlan, isLivePlan, measuredOnArrival, normaliseLivePlan, type LivePlan, type LiveSignOff } from "@/lib/simulation/live-plan"
import { draftLivePlan } from "@/lib/studio/live-draft"

export type ActionResult =
  /** `live`: the page goes on to call makeLive(caseId, live.comments) for the plan, as a request of its own. */
  | { ok: true; message: string; caseId?: string; link?: string; live?: { comments?: string } }
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
 * Saves a conversion as the draft for this studio case. A new version needs a new review, so any review is dropped.
 * Returns `needsPlan` when the AI is still to write (or revise) its live plan (makeLive); otherwise this version goes
 * to the studio's reviewer queue straight away, with a warning if it could not (a private review link still works).
 *
 * A static case has no plan. A live one takes, in this order: the plan being revised (a rebuild: makeLive changes it
 * as the reviewer asked), the live course the author wrote in the studio if it passes the check, or one the AI writes.
 */
async function saveDraft(
  sc: StudioCase,
  conversion: Conversion,
  existingId: string | undefined,
  kind: "static" | "live",
  keepPlan?: LivePlan
): Promise<{ id: string; needsPlan: boolean; queueWarning?: string }> {
  const { caseJson, reviewNotes, check } = conversion
  let id = existingId

  let plan: LivePlan | null = kind === "live" && keepPlan ? keepPlan : null
  const authored = kind === "live" && !keepPlan && sc.livePlan ? normaliseLivePlan(sc.livePlan, "author") : null
  if (authored) {
    const base = upgradeLegacyCase({ ...caseJson })
    const planCheck = isSimulationCase(base)
      ? checkLivePlan(authored, measuredOnArrival(base))
      : { errors: ["the converted case cannot run at the bedside"], warnings: [] }
    if (planCheck.errors.length === 0) {
      plan = { ...authored, drafted_at: new Date().toISOString() }
      reviewNotes.push(`The live course is the author's own (${authored.stages.length} steps, ${authored.treatments.length} treatments), not the AI's: check it with the case.`)
    } else {
      reviewNotes.push(`The author's live course did not pass the check, so the AI wrote one instead: ${planCheck.errors.slice(0, 3).join(" ")}`)
    }
  }
  const needsPlan = kind === "live" && (!plan || !!keepPlan)
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
    ...(plan ? { live_plan: plan } : {}),
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

  if (needsPlan) return { id, needsPlan }
  return { id, needsPlan, queueWarning: await toQueue(sc.id, id, full) }
}

/** Puts this version of the case in the studio's reviewer queue. Returns a warning if it could not. */
async function toQueue(studioId: string, caseId: string, caseJson: Record<string, any>): Promise<string | undefined> {
  try {
    const source = caseJson.source ?? {}
    await pushConversion(studioId, {
      medikaryaCaseId: caseId,
      caseJson,
      reviewNotes: Array.isArray(source.review_notes) ? source.review_notes : [],
      warnings: Array.isArray(source.warnings) ? source.warnings : [],
      testNames: testNamesOf(caseJson),
    })
    return undefined
  } catch (e) {
    console.error("Could not put the draft in the studio's reviewer queue:", e)
    return "It could not be added to the studio's reviewer queue (has studio migration 010 been run?); a private review link still works."
  }
}

/**
 * Converts a submitted case sheet with AI. "live" converts it the same way and then (unless the author wrote a live
 * course that passes the check) leaves it for makeLive, which the page calls straight after as a request of its own,
 * since each AI step takes a few minutes.
 */
export async function convertToDraft(studioId: string, kind: "static" | "live" = "static"): Promise<ActionResult> {
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
    const { id, needsPlan, queueWarning } = await saveDraft(sc, conversion, existing?.id, kind)
    done()
    if (needsPlan) return { ok: true, message: "Converted. Now writing the live plan (a few minutes)…", caseId: id, live: {} }
    const base = `${existing ? "Re-converted" : "Converted"} as a ${kind} case${kind === "live" ? " with the author's own live course" : ""} and placed in the reviewer queue.`
    return { ok: true, message: queueWarning ? `${base} ${queueWarning}` : base, caseId: id }
  } catch (error) {
    return fail(error, "Conversion failed.")
  }
}

/**
 * The second half of "Convert to live case": the AI writes a live plan for the converted case (lib/studio/live-draft.ts)
 * and this version, with the plan, goes for its one review. If the AI judges the condition has no acute course (a
 * goitre does not crash in twenty minutes), the case goes for review as a static one and the admin is told why.
 */
export async function makeLive(caseId: string, comments?: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    const { data: row, error } = await supabaseServer.from("cases").select("status, case_json").eq("id", caseId).maybeSingle()
    if (error) throw error
    if (!row) return { ok: false, error: "Case not found." }
    if (row.status === "published") return { ok: false, error: "This case is live. Unpublish it first." }
    const caseJson = row.case_json as Record<string, any>
    const studioId = caseJson.source?.studio_case_id as string | undefined
    if (!studioId) return { ok: false, error: "This case did not come from the Case Studio." }

    const queueAsItIs = async (why: string, details?: string[]): Promise<ActionResult> => {
      const notes = [...(caseJson.source?.review_notes ?? []), `Not made live: ${why}`]
      const next = { ...caseJson, source: { ...caseJson.source, review_notes: notes } }
      const { error: saveError } = await supabaseServer.from("cases").update({ case_json: next, updated_at: new Date().toISOString() }).eq("id", caseId)
      if (saveError) throw saveError
      const warning = await toQueue(studioId, caseId, next)
      done()
      return { ok: false, error: `Converted, but not made live: ${why} It went for review as a static case.${warning ? ` ${warning}` : ""}`, details }
    }

    const base = upgradeLegacyCase({ ...caseJson })
    if (!isSimulationCase(base)) return queueAsItIs("the converted case cannot run at the bedside (it has no heart rate or no tests).")
    // a rebuild: change the plan the reviewer read, as they asked; otherwise write one
    const previous = comments?.trim() && isLivePlan(caseJson.live_plan) ? caseJson.live_plan : null
    const draft = await draftLivePlan(caseJson, measuredOnArrival(base), previous ? { previous, comments: comments!.trim() } : undefined)
    if (!draft.ok) {
      return draft.reason === "not_suitable" ? queueAsItIs(draft.why) : queueAsItIs("the AI's live plan still had problems after one fix.", draft.problems)
    }

    const plan = draft.plan
    const notes = [
      ...(caseJson.source?.review_notes ?? []),
      previous
        ? "Live plan changed by AI as the reviewer asked (see its basis for each change)."
        : `Live plan written by AI (${plan.stages.length} steps, ${plan.treatments.length} treatments): every number in it is for the reviewer to check, starting with its basis.`,
    ]
    const now = new Date().toISOString()
    // a new version (the case with its plan): a review of the version without it does not count
    const next = { ...caseJson, live_plan: plan, source: { ...caseJson.source, review_notes: notes, converted_at: now } }
    const { error: updateError } = await supabaseServer.from("cases").update({ case_json: next, updated_at: now }).eq("id", caseId)
    if (updateError) throw updateError
    const warning = await toQueue(studioId, caseId, next)
    done()
    const flagged = draft.check.warnings.length
    return {
      ok: true,
      message:
        `Converted as a live case (${plan.stages.length} steps, ${plan.treatments.length} treatments) and placed in the reviewer queue.` +
        (flagged ? ` The check flagged ${flagged} thing${flagged === 1 ? "" : "s"} for the reviewer.` : "") +
        (warning ? ` ${warning}` : ""),
      caseId,
    }
  } catch (error) {
    return fail(error, "Could not write the live plan.")
  }
}

/** Sends a submitted case sheet back to its author with comments, instead of converting it. */
export async function sendBackToAuthor(studioId: string, comments: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    if (comments.trim().length < 10) return { ok: false, error: "Say what the author should change (a sentence or two)." }
    const existing = await convertedFrom(studioId)
    if (existing?.status === "published") return { ok: false, error: "This case is live. Unpublish it first." }
    const me = await currentUser()
    await sendBackInStudio(studioId, comments, me?.emailAddresses?.[0]?.emailAddress ?? null)
    done()
    return { ok: true, message: "Sent back to the author with your comments. It comes back here when they resubmit." }
  } catch (error) {
    return fail(error, "Could not send the case back.")
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
    if (sc.status === "changes_requested") return { ok: false, error: "The sheet is with the author. Rebuild once they have fixed it and resubmitted." }
    // sent to the author after this review, and resubmitted: their corrected sheet is the source of the fixes
    const authorUpdated = !!sc.sentBackAt && sc.sentBackAt > asked.at

    const { source, credit, review: _r, status: _s, id: _i, live_plan: oldPlan, ...current } = existing.case_json
    const keepPlan = isLivePlan(oldPlan) ? oldPlan : undefined
    const conversion = await convertStudioCase(sc, {
      previous: { case: current, review_notes: Array.isArray(source?.review_notes) ? source.review_notes : [] },
      comments: asked.comments,
      authorUpdated,
    })
    if (conversion.check.errors.length > 0) {
      return { ok: false, error: "The rebuild still had problems; nothing was saved. Try again.", details: conversion.check.errors }
    }
    const { needsPlan, queueWarning } = await saveDraft(sc, conversion, existing.id, keepPlan ? "live" : "static", keepPlan)
    done()
    if (needsPlan) {
      return { ok: true, message: `Rebuilt for ${asked.reviewer}'s comments. Now changing the live plan as they asked…`, caseId: existing.id, live: { comments: asked.comments } }
    }
    return {
      ok: true,
      message: `Rebuilt ${authorUpdated ? "from the author's corrected sheet" : "with AI"} for ${asked.reviewer}'s comments and put back in the reviewer queue (they are offered it first).${queueWarning ? ` ${queueWarning}` : ""}`,
      caseId: existing.id,
    }
  } catch (error) {
    return fail(error, "Rebuild failed.")
  }
}

/** The newest "changes requested" on this draft, from the studio's queue or a private link. */
async function latestChangeRequest(caseId: string, studioId: string): Promise<{ at: string; comments: string; reviewer: string } | null> {
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

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`

/**
 * Gives the author the free Resident months their published cases have reached (milestones in lib/plans/grants.ts:
 * the 1st, 3rd and 5th case). `published` = how many they have published, this case included. Returns a line for
 * the admin.
 */
async function rewardAuthor(email: string, caseId: string, adminId: string, published: number | null): Promise<string> {
  if (published === null) return `Could not count ${email}'s published cases in the studio, so no free months were given this time.`
  const { data, error } = await supabaseServer.from("plan_grants").select("tier, months, starts_at, ends_at, reason, case_id").eq("email", email)
  if (error) return `Reward not given: ${error.message} (has create_reviews_and_grants.sql been run?)`
  const rows = (data ?? []) as Array<GrantRow & { case_id: string | null }>
  if (rows.some((g) => g.case_id === caseId)) return `${email} was already rewarded for this case.`

  const window = caseRewardWindow(rows, published)
  if (!window) {
    const next = CASE_REWARD.milestones.find((m) => m.at > published)
    return next
      ? `No free months this time (${published} published case${published === 1 ? "" : "s"}); the next ${next.months} come at their ${ordinal(next.at)} case.`
      : `${email} has already had the full ${CASE_REWARD.capMonths} months of free Resident.`
  }

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
  return `${email} gets ${window.months} month${window.months === 1 ? "" : "s"} of Resident free, until ${until} (for reaching ${published} published case${published === 1 ? "" : "s"}; it applies when they sign in to MediKarya with this email).`
}

export async function publishCase(caseId: string, rewardEmail: string | null): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin()
    const { data: row, error } = await supabaseServer.from("cases").select("case_json").eq("id", caseId).maybeSingle()
    if (error) throw error
    if (!row) return { ok: false, error: "Case not found." }
    let caseJson = row.case_json as Record<string, any>
    const studioId = caseJson.source?.studio_case_id
    const queued = studioId ? (await studioReviews([studioId])).get(studioId) : undefined
    const queueApproved = queued?.decision === "approved" ? queued : null
    if (caseJson.review?.decision !== "approved") {
      // Approved in the studio's reviewer queue rather than through a private link: take the approval from there.
      if (!queueApproved) return { ok: false, error: "A reviewer has to approve this case before it can be published." }
      caseJson = { ...caseJson, review: reviewFromStudio(queueApproved) }
    }
    // A live case: the same approval signed its plan off (a private link writes the sign-off itself; the queue's
    // approval is of the version with the plan), and it goes live with the case.
    const plan = caseJson.live_plan
    if (isLivePlan(plan)) {
      let signOff: LiveSignOff | undefined = plan.sign_off?.decision === "approved" ? plan.sign_off : undefined
      if (!signOff && queueApproved) {
        const r = reviewFromStudio(queueApproved)
        signOff = {
          decision: "approved",
          decided_at: r.decided_at ?? new Date().toISOString(),
          show_name: r.show_name,
          ...(r.show_name
            ? {
                reviewer_name: r.reviewer_name,
                reviewer_designation: r.reviewer_designation ?? undefined,
                reviewer_department: r.reviewer_department ?? undefined,
                reviewer_institution: r.reviewer_institution ?? undefined,
              }
            : {}),
        }
      }
      if (!signOff) return { ok: false, error: "The live plan has not been approved. Remove it (Admin → Live cases) to publish this as a static case." }
      caseJson = { ...caseJson, live_plan: { ...plan, sign_off: signOff, status: "approved" } }
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
    // every published case gives its author a month of Resident (capped in caseRewardWindow); it needs their email
    // free Resident months by milestone (lib/plans/grants.ts), counted from the studio once this case is marked published
    const reward = email
      ? ` ${await rewardAuthor(email, caseId, adminId, studioCaseId ? await authorPublishedCount(studioCaseId) : null)}`
      : " No author email, so no free months of Resident could be given."
    const kind = isLivePlan(caseJson.live_plan) ? "as a live case" : "as a static case"
    return { ok: true, message: `Published ${kind}: students see it in the library within a minute.${reward}${studioNote ? ` ${studioNote}` : ""}` }
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
