import "server-only";

import { createHash, randomBytes } from "crypto";
import { supabaseServer } from "@/lib/supabase/server";

// Private review links (table case_reviews, scripts/create_reviews_and_grants.sql). An admin makes one for a draft
// case and sends it to a professor, who opens /review/<token> without an account, reads the report, and approves
// or asks for changes with their name and position. Only a hash of the token is stored; a link works once and for
// LINK_DAYS.

export const LINK_DAYS = 14;

export interface ReviewRow {
  id: string;
  case_id: string;
  created_at: string;
  expires_at: string;
  reviewer_name: string | null;
  reviewer_designation: string | null;
  reviewer_department: string | null;
  reviewer_institution: string | null;
  show_name: boolean;
  decision: "approved" | "changes_requested" | null;
  comments: string | null;
  decided_at: string | null;
}

const COLUMNS =
  "id, case_id, created_at, expires_at, reviewer_name, reviewer_designation, reviewer_department, reviewer_institution, show_name, decision, comments, decided_at";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createReviewLink(caseId: string, adminId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const { error } = await supabaseServer.from("case_reviews").insert({
    case_id: caseId,
    token_hash: hash(token),
    created_by: adminId,
    expires_at: new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString(),
  });
  if (error) throw error;
  return token;
}

/** The review behind a link, however it stands (open, decided or expired); null for a link that never existed. */
export async function reviewForToken(token: string): Promise<ReviewRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const { data, error } = await supabaseServer.from("case_reviews").select(COLUMNS).eq("token_hash", hash(token)).maybeSingle();
  if (error) throw error;
  return data as ReviewRow | null;
}

export function isOpen(r: ReviewRow, now = Date.now()): boolean {
  return r.decision === null && Date.parse(r.expires_at) > now;
}

/** The most recent review link for each case (to show where each draft stands). */
export async function latestReviews(caseIds: string[]): Promise<Map<string, ReviewRow>> {
  const out = new Map<string, ReviewRow>();
  if (caseIds.length === 0) return out;
  const { data, error } = await supabaseServer.from("case_reviews").select(COLUMNS).in("case_id", caseIds).order("created_at", { ascending: false });
  if (error) {
    // Table not created yet: treat as "not sent", never break the admin page.
    console.error("Could not read case reviews:", error.message);
    return out;
  }
  for (const row of (data ?? []) as ReviewRow[]) if (!out.has(row.case_id)) out.set(row.case_id, row);
  return out;
}

export interface Decision {
  decision: "approved" | "changes_requested";
  name: string;
  designation: string;
  department: string;
  institution: string;
  showName: boolean;
  comments: string;
}

/** Records the reviewer's decision, once. Returns the review, or an error to show them. */
export async function recordDecision(token: string, d: Decision): Promise<{ review: ReviewRow } | { error: string }> {
  const review = await reviewForToken(token);
  if (!review) return { error: "This review link is not valid." };
  if (!isOpen(review)) return { error: review.decision ? "This case has already been reviewed with this link." : "This review link has expired." };

  const clean = (s: string, max: number) => s.trim().slice(0, max);
  const name = clean(d.name, 120);
  if (!name) return { error: "Please enter your name." };
  if (!clean(d.designation, 120) || !clean(d.institution, 160)) return { error: "Please enter your designation and institution." };
  if (d.decision === "changes_requested" && !clean(d.comments, 4000)) return { error: "Please say what should change." };

  const { data, error } = await supabaseServer
    .from("case_reviews")
    .update({
      reviewer_name: name,
      reviewer_designation: clean(d.designation, 120),
      reviewer_department: clean(d.department, 120) || null,
      reviewer_institution: clean(d.institution, 160),
      show_name: d.showName,
      decision: d.decision,
      comments: clean(d.comments, 4000) || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", review.id)
    .is("decision", null) // once only, even if two submissions race
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: "This case has already been reviewed with this link." };
  return { review: data as ReviewRow };
}
