"use server"

// Admin actions for the studio converter (see page.tsx): convert a studio case sheet to a draft, publish it,
// take it back down, or throw a draft away. Every action checks the caller is an admin. Drafts never reach
// students: the library lists published cases only, and only admins can open a draft (lib/plans/access.ts).

import { auth } from "@clerk/nextjs/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { supabaseServer } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/plans/access"
import { getStudioCase } from "@/lib/studio/source"
import { caseIdFor, convertStudioCase } from "@/lib/studio/convert"

export type ActionResult = { ok: true; message: string; caseId?: string } | { ok: false; error: string; details?: string[] }

async function requireAdmin(): Promise<string> {
  const { userId } = await auth()
  if (!userId || !(await isAdmin(userId))) throw new Error("Admins only")
  return userId
}

/** The MediKarya case made from this studio case, if any. */
async function convertedFrom(studioId: string): Promise<{ id: string; status: string } | null> {
  const { data, error } = await supabaseServer.from("cases").select("id, status").eq("case_json->source->>studio_case_id", studioId).maybeSingle()
  if (error) throw error
  return data
}

function done() {
  revalidateTag("cases") // the library's cached case list
  revalidatePath("/admin/studio")
}

export async function convertToDraft(studioId: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    const sc = await getStudioCase(studioId)
    if (!sc) return { ok: false, error: "That studio case was not found." }
    if (!sc.publishConsent) return { ok: false, error: "The author's permission to publish is not recorded for this case." }

    const existing = await convertedFrom(studioId)
    if (existing?.status === "published") return { ok: false, error: "This case is live. Unpublish it before converting it again." }

    const { caseJson, reviewNotes, check } = await convertStudioCase(sc)
    if (check.errors.length > 0) {
      return { ok: false, error: "The conversion still had problems after one fix; nothing was saved. Try again.", details: check.errors }
    }

    let id = existing?.id
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

    done()
    return { ok: true, message: existing ? "Draft re-converted." : "Draft created.", caseId: id }
  } catch (error) {
    console.error("Studio conversion failed:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Conversion failed." }
  }
}

async function setStatus(caseId: string, status: "published" | "draft"): Promise<ActionResult> {
  try {
    await requireAdmin()
    const { data: row, error } = await supabaseServer.from("cases").select("case_json").eq("id", caseId).maybeSingle()
    if (error) throw error
    if (!row) return { ok: false, error: "Case not found." }
    const caseJson = { ...(row.case_json as object), status }
    const { error: updateError } = await supabaseServer
      .from("cases")
      .update({ status, case_json: caseJson, updated_at: new Date().toISOString() })
      .eq("id", caseId)
    if (updateError) throw updateError
    done()
    return { ok: true, message: status === "published" ? "Published: students can see it now (the library updates within a minute)." : "Unpublished: back to a draft." }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update the case." }
  }
}

export async function publishCase(caseId: string) {
  return setStatus(caseId, "published")
}

export async function unpublishCase(caseId: string) {
  return setStatus(caseId, "draft")
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
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete the draft." }
  }
}
