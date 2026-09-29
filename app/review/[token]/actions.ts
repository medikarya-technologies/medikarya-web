"use server"

// The reviewer's decision from /review/[token]. No account: the link's token is the permission. The decision is also
// written onto the case (case_json.review), which publishing requires, and which lets the case say who reviewed it
// when the reviewer agreed to be named (show_name).

import { revalidatePath } from "next/cache"
import { supabaseServer } from "@/lib/supabase/server"
import { recordDecision, type Decision } from "@/lib/review/links"

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
      const { error: updateError } = await supabaseServer
        .from("cases")
        .update({ case_json: { ...(row.case_json as object), review }, updated_at: new Date().toISOString() })
        .eq("id", r.case_id)
      if (updateError) throw updateError
    }
    revalidatePath("/admin/studio")
    return { ok: true, decision: d.decision }
  } catch (error) {
    console.error("Could not record review:", error)
    return { ok: false, error: "Something went wrong saving your review. Please try again." }
  }
}
