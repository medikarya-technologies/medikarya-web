import "server-only";

import { createHash, randomBytes } from "crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanAnswers, type Answers } from "./answers";

// Private links to the fluid protocol decision package (table protocol_reviews, scripts/create_protocol_reviews.sql).
// A professor opens /protocol-review/<token> without an account, ticks their answers, and sends them. Only a hash of
// the token is stored. Answers are saved as they go and can be changed until the link expires.

export const PROTOCOL_LINK_DAYS = 30;

export interface ProtocolReviewRow {
  id: string;
  package: string;
  expires_at: string;
  reviewer_name: string | null;
  reviewer_designation: string | null;
  reviewer_institution: string | null;
  answers: Answers;
  updated_at: string | null;
  submitted_at: string | null;
}

const COLUMNS = "id, package, expires_at, reviewer_name, reviewer_designation, reviewer_institution, answers, updated_at, submitted_at";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createProtocolLink(pkg: string, label: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const { error } = await supabaseServer.from("protocol_reviews").insert({
    package: pkg,
    token_hash: hash(token),
    created_by: label,
    expires_at: new Date(Date.now() + PROTOCOL_LINK_DAYS * 86_400_000).toISOString(),
  });
  if (error) throw error;
  return token;
}

export async function protocolReviewForToken(token: string): Promise<ProtocolReviewRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const { data, error } = await supabaseServer.from("protocol_reviews").select(COLUMNS).eq("token_hash", hash(token)).maybeSingle();
  if (error) throw error;
  return data as ProtocolReviewRow | null;
}

export const isProtocolLinkOpen = (r: ProtocolReviewRow, now = Date.now()) => Date.parse(r.expires_at) > now;

export interface Reviewer {
  name: string;
  designation: string;
  institution: string;
}

/** Saves what has been answered so far (and, with `submit`, marks it sent). */
export async function saveProtocolAnswers(token: string, answers: unknown, who: Reviewer, submit: boolean): Promise<{ ok: true; row: ProtocolReviewRow } | { ok: false; error: string }> {
  const review = await protocolReviewForToken(token);
  if (!review) return { ok: false, error: "This link is not valid." };
  if (!isProtocolLinkOpen(review)) return { ok: false, error: "This link has expired." };
  const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
  const name = clean(who?.name, 120);
  const designation = clean(who?.designation, 120);
  const institution = clean(who?.institution, 160);
  if (submit && (!name || !designation || !institution)) return { ok: false, error: "Please fill in your name, designation and institution." };
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("protocol_reviews")
    .update({
      reviewer_name: name || null,
      reviewer_designation: designation || null,
      reviewer_institution: institution || null,
      answers: cleanAnswers(answers),
      updated_at: now,
      ...(submit ? { submitted_at: now } : {}),
    })
    .eq("id", review.id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "This link is not valid." };
  return { ok: true, row: data as ProtocolReviewRow };
}
