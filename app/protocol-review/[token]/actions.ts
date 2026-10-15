"use server"

// The professor's answers from /protocol-review/[token]. No account: the link's token is the permission.

import { saveProtocolAnswers, type Reviewer } from "@/lib/protocol-review/links"

export type SaveResult = { ok: true; savedAt: string; submitted: boolean } | { ok: false; error: string }

export async function saveAnswers(token: string, answers: unknown, who: Reviewer, submit: boolean): Promise<SaveResult> {
  try {
    const r = await saveProtocolAnswers(token, answers, who, submit)
    if (!r.ok) return r
    return { ok: true, savedAt: r.row.updated_at ?? new Date().toISOString(), submitted: r.row.submitted_at !== null }
  } catch (e) {
    console.error("Could not save protocol answers:", e)
    return { ok: false, error: "We could not save just now. Please try again in a moment." }
  }
}
