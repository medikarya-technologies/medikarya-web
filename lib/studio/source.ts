import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The MediKarya Case Studio (a separate app and Supabase project, where students write case sheets and faculty
// review them), read by the admin converter. This module only ever reads from it.

let client: SupabaseClient | null = null;

/** null when STUDIO_SUPABASE_URL / STUDIO_SUPABASE_SERVICE_KEY are not set (e.g. a deploy without the converter). */
function studio(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.STUDIO_SUPABASE_URL;
  const key = process.env.STUDIO_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function studioConfigured(): boolean {
  return studio() !== null;
}

type Json = Record<string, any>;

export interface StudioCaseSummary {
  id: string;
  title: string;
  status: string;
  specialty: string;
  difficulty: string;
  author: string | null;
  createdAt: string;
  /** The studio's own "added to platform" switch. */
  addedToPlatform: boolean;
  /** The author allowed MediKarya to publish it (ticked on submit, or recorded by an admin). */
  publishConsent: boolean;
  consentNote: string | null;
  /** The author's email when they wrote it in the studio themselves (not when an admin entered it for them). */
  authorEmail: string | null;
}

export interface StudioCase extends StudioCaseSummary {
  patient: { age: number | null; sex: string | null; occupation: string | null; religion: string | null };
  sections: Record<string, unknown>;
  /** What must never reach the playable case: the patient's name and case number, and their address. */
  identifiers: { names: string[]; places: string[] };
}

const SECTIONS = ["history", "general_physical_examination", "systemic_examination", "local_examination", "diagnosis", "investigations_info", "custom_fields"] as const;

function specialtyOf(row: Json): string {
  const custom = row.custom_specialty ?? row.patient_details?.custom_specialty;
  if (row.specialty === "other" && custom) return String(custom);
  return String(row.specialty ?? "other").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function summary(row: Json, authorEmail: string | null = null): StudioCaseSummary {
  const d = row.patient_details?.declarations ?? {};
  return {
    id: row.id,
    title: row.title ?? "Untitled",
    status: row.status,
    specialty: specialtyOf(row),
    difficulty: row.difficulty ?? "intermediate",
    author: row.original_author_name || null,
    createdAt: row.created_at,
    addedToPlatform: !!row.added_to_platform,
    publishConsent: d.publish_consent === true,
    consentNote: typeof d.consent_note === "string" ? d.consent_note : null,
    authorEmail,
  };
}

/** Emails of the studio users who wrote these cases, for authors only: an admin entering a case for someone else is not its author. */
async function authorEmails(db: SupabaseClient, authorIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(authorIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const { data, error } = await db.from("users").select("id, email, role").in("id", ids);
  if (error) throw error;
  for (const u of data ?? []) if (u.role === "author" && u.email) out.set(u.id, String(u.email).toLowerCase());
  return out;
}

export async function listStudioCases(): Promise<StudioCaseSummary[]> {
  const db = studio();
  if (!db) return [];
  const { data, error } = await db
    .from("cases")
    .select("id, title, status, specialty, difficulty, original_author_name, created_at, added_to_platform, patient_details, author_id")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const emails = await authorEmails(db, (data ?? []).map((r) => r.author_id));
  return (data ?? []).map((r) => summary(r, emails.get(r.author_id) ?? null));
}

// Rich-text fields are stored as HTML; the model reads plain text.
function plain(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

function redactor(names: string[], places: string[]) {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = (w: string) => new RegExp(`\\b${escape(w)}\\b`, "gi");
  const patterns: Array<[RegExp, string]> = [
    // every part of the name ("Rubi Devi" hides "Rubi" and "Devi"), and the case number
    ...names.flatMap((n) => n.split(/\s+/).filter((w) => w.length >= 2)).map((w): [RegExp, string] => [word(w), "the patient"]),
    ...places.flatMap((p) => p.split(/[^A-Za-z]+/).filter((w) => w.length >= 4)).map((w): [RegExp, string] => [word(w), "[place]"]),
  ];
  const run = (v: unknown): unknown => {
    if (typeof v === "string") return patterns.reduce((text, [re, to]) => text.replace(re, to), v);
    if (Array.isArray(v)) return v.map(run);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, run(x)]));
    return v;
  };
  return run;
}

export async function getStudioCase(id: string): Promise<StudioCase | null> {
  const db = studio();
  if (!db) return null;
  const { data: row, error } = await db.from("cases").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const pd: Json = row.patient_details ?? {};
  // A case number that is only digits ("17") says nothing in the text and would clash with ages and doses.
  const names = [pd.patient_name, pd.case_no, pd.patient_id].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0 && /[A-Za-z]/.test(v)
  );
  const places = [pd.address, pd.location].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  // The case sheet is sent to the model with the patient's name and address taken out of the text as well.
  const hide = redactor(names, places);
  const sections: Record<string, unknown> = {};
  for (const k of SECTIONS) if (row[k] != null) sections[k] = hide(plain(row[k]));

  const emails = await authorEmails(db, [row.author_id]);
  return {
    ...summary(row, emails.get(row.author_id) ?? null),
    patient: {
      age: typeof pd.age === "number" ? pd.age : null,
      sex: pd.sex ?? pd.gender ?? null,
      occupation: pd.occupation ?? null,
      religion: pd.religion ?? null,
    },
    sections,
    identifiers: { names, places },
  };
}

// ── Writing back: the AI-built version, for the studio's reviewers ──────────
// The only place MediKarya writes to the studio: table case_conversions (studio migration 010). Each conversion or
// rebuild is a new version; a review only counts for the version it was made on.

export async function pushConversion(
  studioCaseId: string,
  c: { medikaryaCaseId: string; caseJson: Record<string, unknown>; reviewNotes: string[]; warnings: string[]; testNames: Record<string, string> }
): Promise<number> {
  const db = studio();
  if (!db) throw new Error("The case studio is not connected");
  const { data: existing, error } = await db.from("case_conversions").select("version").eq("case_id", studioCaseId).maybeSingle();
  if (error) throw error;
  const version = (existing?.version ?? 0) + 1;
  const { error: upsertError } = await db.from("case_conversions").upsert(
    {
      case_id: studioCaseId,
      medikarya_case_id: c.medikaryaCaseId,
      version,
      case_json: c.caseJson,
      review_notes: c.reviewNotes,
      warnings: c.warnings,
      test_names: c.testNames,
      converted_at: new Date().toISOString(),
    },
    { onConflict: "case_id" }
  );
  if (upsertError) throw upsertError;
  return version;
}

export interface StudioReview {
  /** The studio's current version of the conversion, and whether this review is of it. */
  version: number;
  claimedAt: string;
  expiresAt: string;
  decision: "approved" | "changes_requested" | null;
  comments: string | null;
  showName: boolean;
  decidedAt: string | null;
  reviewerName: string;
  designation: string | null;
  department: string | null;
  institution: string | null;
}

/** The latest review in the studio's reviewer queue of the current version of each studio case. */
export async function studioReviews(studioCaseIds: string[]): Promise<Map<string, StudioReview>> {
  const out = new Map<string, StudioReview>();
  const db = studio();
  if (!db || studioCaseIds.length === 0) return out;
  const [{ data: convs, error: convError }, { data: reviews, error: revError }] = await Promise.all([
    db.from("case_conversions").select("case_id, version").in("case_id", studioCaseIds),
    db
      .from("conversion_reviews")
      .select("case_id, version, reviewer_id, claimed_at, claim_expires_at, decision, comments, show_name, decided_at")
      .in("case_id", studioCaseIds)
      .order("claimed_at", { ascending: false }),
  ]);
  if (convError || revError) {
    // Studio migration 010 not run yet: there is simply no queue.
    console.error("Could not read studio reviews:", (convError ?? revError)?.message);
    return out;
  }
  const current = new Map((convs ?? []).map((c) => [c.case_id, c.version]));
  const latest = (reviews ?? []).filter((r) => current.get(r.case_id) === r.version);
  const reviewerIds = [...new Set(latest.map((r) => r.reviewer_id))];
  const [{ data: users }, { data: profiles }] = await Promise.all([
    db.from("users").select("id, name").in("id", reviewerIds.length ? reviewerIds : ["00000000-0000-0000-0000-000000000000"]),
    db.from("reviewer_profiles").select("user_id, designation, department, institution").in("user_id", reviewerIds.length ? reviewerIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  for (const r of latest) {
    if (out.has(r.case_id)) continue; // newest first
    const p = (profiles ?? []).find((x) => x.user_id === r.reviewer_id);
    out.set(r.case_id, {
      version: r.version,
      claimedAt: r.claimed_at,
      expiresAt: r.claim_expires_at,
      decision: r.decision,
      comments: r.comments,
      showName: r.show_name,
      decidedAt: r.decided_at,
      reviewerName: (users ?? []).find((u) => u.id === r.reviewer_id)?.name ?? "A reviewer",
      designation: p?.designation ?? null,
      department: p?.department ?? null,
      institution: p?.institution ?? null,
    });
  }
  return out;
}

/** Which of these studio cases have a version in the reviewer queue (case_conversions). */
export async function queuedInStudio(studioCaseIds: string[]): Promise<Set<string>> {
  const db = studio();
  if (!db || studioCaseIds.length === 0) return new Set();
  const { data, error } = await db.from("case_conversions").select("case_id").in("case_id", studioCaseIds);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.case_id));
}
