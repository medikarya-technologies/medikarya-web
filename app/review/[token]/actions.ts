"use server"

// The reviewer's decision from /review/[token]. No account: the link's token is the permission. The decision is also
// written onto the case (case_json.review), which publishing requires, and which lets the case say who reviewed it
// when the reviewer agreed to be named (show_name).
//
// A case with a live plan waiting for sign-off (lib/simulation/live-plan.ts): the decision is the sign-off of that
// plan (case_json.live_plan.sign_off), which switching the live version on requires. If the case already had an
// approved review (it is in the library as an ordinary case), that review and its credit are left as they are.

import { revalidatePath } from "next/cache"
import { supabaseServer } from "@/lib/supabase/server"
import { recordDecision, type Decision } from "@/lib/review/links"
import { isLivePlan, type LiveSignOff } from "@/lib/simulation/live-plan"

export type ReviewResult = { ok: true; decision: Decision["decision"] } | { ok: false; error: string }

export async function submitReview(token: string, d: Decision): Promise<ReviewResult> {
  try {
    const result = await recordDecision(token, d)
    if ("error" in result) return { ok: false, error: result.error }
    const r = result.review

    const { data: row, error } = await supabaseServer.from("cases").select("case_json").eq("id", r.case_id).maybeSingle()
    if (error) throw error
    if (row) {
      // The case's JSON reaches students' browsers, so it carries the reviewer's name only if they agreed to be named;
      // otherwise who reviewed it stays in case_reviews, which only the server reads.
      const review = {
        decision: r.decision,
        show_name: r.show_name,
        decided_at: r.decided_at,
        ...(r.show_name
          ? {
              reviewer_name: r.reviewer_name,
              reviewer_designation: r.reviewer_designation,
              reviewer_department: r.reviewer_department,
              reviewer_institution: r.reviewer_institution,
            }
          : {}),
      }
      const current = row.case_json as Record<string, any>
      const plan = current.live_plan
      const signsPlan = isLivePlan(plan) && plan.sign_off?.decision !== "approved"
      const signOff: LiveSignOff | null = signsPlan
        ? {
            decision: r.decision!,
            decided_at: r.decided_at!,
            show_name: r.show_name,
            // what to change is for the team, not for the case: it is dropped once the plan is approved
            ...(r.decision === "changes_requested" && r.comments ? { comments: r.comments } : {}),
            ...(r.show_name
              ? {
                  reviewer_name: r.reviewer_name ?? undefined,
                  reviewer_designation: r.reviewer_designation ?? undefined,
                  reviewer_department: r.reviewer_department ?? undefined,
                  reviewer_institution: r.reviewer_institution ?? undefined,
                }
              : {}),
          }
        : null
      const next = {
        ...current,
        ...(current.review?.decision === "approved" && signsPlan ? {} : { review }),
        ...(signOff ? { live_plan: { ...plan, sign_off: signOff } } : {}),
      }
      const { error: updateError } = await supabaseServer
        .from("cases")
        .update({ case_json: next, updated_at: new Date().toISOString() })
        .eq("id", r.case_id)
      if (updateError) throw updateError
    }
    revalidatePath("/admin/studio")
    revalidatePath("/admin/live")
    return { ok: true, decision: d.decision }
  } catch (error) {
    console.error("Could not record review:", error)
    return { ok: false, error: "Something went wrong saving your review. Please try again." }
  }
}
