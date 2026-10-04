import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The MediKarya Case Studio (a separate app and Supabase project, where students write case sheets and faculty
// review them), read by the admin converter. It writes back a case's converted report (for the studio's reviewer
// queue), when it was published, and a Clinical Advisory Board certificate for an advisor who has no studio account
// (Admin → Advisors); everything else here is a read.

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
  /** When the sheet was last sent back to its author for changes (studio case_reviews), if ever. */
  sentBackAt: string | null;
}

export interface StudioCase extends StudioCaseSummary {
  /** `state` is the one part of where the patient lives that is passed on (the studio's State choice); the place is not. */
  patient: { age: number | null; sex: string | null; occupation: string | null; religion: string | null; state: string | null };
  sections: Record<string, unknown>;
  /** What must never reach the playable case: the patient's name and case number, and their address. */
  identifiers: { names: string[]; places: string[] };
  /** A live course written in the studio by a resident or above (studio migration 015), as it was saved there. */
  livePlan: unknown | null;
}

const SECTIONS = ["history", "general_physical_examination", "systemic_examination", "local_examination", "diagnosis", "investigations_info", "custom_fields"] as const;

function specialtyOf(row: Json): string {
  const custom = row.custom_specialty ?? row.patient_details?.custom_specialty;
  if (row.specialty === "other" && custom) return String(custom);
  return String(row.specialty ?? "other").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function summary(row: Json, authorEmail: string | null = null, sentBackAt: string | null = null): StudioCaseSummary {
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
    sentBackAt,
  };
}

/** When each of these sheets was last sent back to its author. */
async function sentBack(db: SupabaseClient, caseIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (caseIds.length === 0) return out;
  const { data, error } = await db.from("case_reviews").select("case_id, created_at").eq("decision", "changes_requested").in("case_id", caseIds);
  if (error) throw error;
  for (const r of data ?? []) if (!out.has(r.case_id) || r.created_at > out.get(r.case_id)!) out.set(r.case_id, r.created_at);
  return out;
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
  const [emails, back] = await Promise.all([authorEmails(db, (data ?? []).map((r) => r.author_id)), sentBack(db, (data ?? []).map((r) => r.id))]);
  return (data ?? []).map((r) => summary(r, emails.get(r.author_id) ?? null, back.get(r.id) ?? null));
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
  const state = typeof pd.state === "string" && pd.state.trim() ? pd.state.trim() : null;
  // The state is kept, so it is taken out of what gets hidden ("Gorakhpur, Uttar Pradesh" hides only "Gorakhpur").
  const places = [pd.address, pd.location]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => (state ? v.replace(new RegExp(state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ") : v).trim())
    .filter((v) => v.length > 0);

  // The case sheet is sent to the model with the patient's name and address taken out of the text as well.
  const hide = redactor(names, places);
  const sections: Record<string, unknown> = {};
  for (const k of SECTIONS) if (row[k] != null) sections[k] = hide(plain(row[k]));

  const [emails, back] = await Promise.all([authorEmails(db, [row.author_id]), sentBack(db, [row.id])]);
  return {
    ...summary(row, emails.get(row.author_id) ?? null, back.get(row.id) ?? null),
    patient: {
      age: typeof pd.age === "number" ? pd.age : null,
      sex: pd.sex ?? pd.gender ?? null,
      occupation: pd.occupation ?? null,
      religion: pd.religion ?? null,
      state,
    },
    sections,
    identifiers: { names, places },
    livePlan: row.live_plan ?? null,
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

/**
 * Sends a submitted case sheet back to its author with the admin's comments, instead of converting it: the studio
 * shows them as a "changes requested" review (filed under a studio admin: the one with this email if there is one),
 * reopens the sheet for editing, and notifies the author.
 */
export async function sendBackInStudio(studioCaseId: string, comments: string, adminEmail: string | null): Promise<void> {
  const db = studio();
  if (!db) throw new Error("The case studio is not connected");
  const { data: row, error } = await db.from("cases").select("id, title, status, author_id").eq("id", studioCaseId).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("That studio case was not found.");
  if (row.status === "draft") throw new Error("The author has not submitted this case.");

  const { data: admins, error: adminError } = await db.from("users").select("id, email").eq("role", "admin");
  if (adminError) throw adminError;
  const filer = (admins ?? []).find((a) => adminEmail && String(a.email).toLowerCase() === adminEmail.toLowerCase()) ?? admins?.[0];
  if (!filer) throw new Error("The studio has no admin account to file the comments under.");

  // the studio's review comments are a list of section comments (lib/types.ts there, parseReviewComments)
  const text = comments.trim().slice(0, 4000);
  const { error: reviewError } = await db.from("case_reviews").insert({
    case_id: studioCaseId,
    reviewer_id: filer.id,
    decision: "changes_requested",
    comments: JSON.stringify([{ id: "sc_mk", sectionId: "general", sectionLabel: "From the MediKarya team", text }]),
  });
  if (reviewError) throw reviewError;
  const { error: statusError } = await db.from("cases").update({ status: "changes_requested" }).eq("id", studioCaseId);
  if (statusError) throw statusError;
  if (row.author_id) {
    await db.from("notifications").insert({
      user_id: row.author_id,
      type: "changes_requested",
      message: `The MediKarya team sent "${row.title}" back to you: ${text.slice(0, 300)}`,
      related_case_id: studioCaseId,
    });
  }
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

// ── Publishing, records and certificates (studio migration 011) ──────────────

/**
 * Tells the studio a case went live (or was taken down: null). The studio pays its author and counts it towards
 * their title from this. Returns a message when it could not be recorded, so publishing itself never fails on it.
 */
export async function markPublishedInStudio(studioCaseId: string, publishedAt: string | null): Promise<string | null> {
  const db = studio();
  if (!db) return "The case studio is not connected, so the author's reward was not recorded.";
  const { data, error } = await db.from("case_conversions").update({ published_at: publishedAt }).eq("case_id", studioCaseId).select("case_id");
  if (error) return `Not recorded in the studio: ${error.message} (has the studio's 011_rewards.sql been run?)`;
  // there is no approval of the raw sheet any more: the author's sheet shows "approved" once its case is published
  await db
    .from("cases")
    .update({ added_to_platform: publishedAt !== null, ...(publishedAt ? { status: "approved", approved_at: publishedAt } : {}) })
    .eq("id", studioCaseId);
  if (!data?.length) return "This case has no record in the studio's reviewer queue (it was converted before the queue existed), so no payout is recorded for it. Rebuild or re-convert it to add one.";
  return null;
}

/** Brings the studio's published dates in line with what is live here (for cases published before the write-back existed). */
export async function syncPublishedToStudio(live: Array<{ studioCaseId: string; publishedAt: string }>): Promise<void> {
  const db = studio();
  if (!db || live.length === 0) return;
  const { data, error } = await db.from("case_conversions").select("case_id, published_at").in("case_id", live.map((l) => l.studioCaseId));
  if (error) return;
  for (const row of data ?? []) {
    if (row.published_at) continue;
    const at = live.find((l) => l.studioCaseId === row.case_id)?.publishedAt;
    if (at) await markPublishedInStudio(row.case_id, at);
  }
}

/**
 * Profile pictures for /contributors, per studio case: its writer's (only when they wrote it in the studio
 * themselves, not when an admin typed it in for them) and the reviewer's who approved it in the queue and chose to
 * be named. Pictures come from each person's sign-in account (studio migration 016); empty before that is run.
 */
export async function contributorPictures(studioCaseIds: string[]): Promise<Map<string, { writer?: string; reviewer?: string }>> {
  const out = new Map<string, { writer?: string; reviewer?: string }>();
  const db = studio();
  if (!db || studioCaseIds.length === 0) return out;
  const [{ data: cases }, { data: reviews }] = await Promise.all([
    db.from("cases").select("id, author_id, original_author_name").in("id", studioCaseIds),
    db.from("conversion_reviews").select("case_id, reviewer_id, decided_at").in("case_id", studioCaseIds).eq("decision", "approved").eq("show_name", true),
  ]);
  const userIds = [
    ...new Set([...(cases ?? []).filter((c) => !c.original_author_name).map((c) => c.author_id), ...(reviews ?? []).map((r) => r.reviewer_id)].filter(Boolean)),
  ];
  if (userIds.length === 0) return out;
  const { data: users, error } = await db.from("users").select("id, avatar_url").in("id", userIds);
  if (error) return out; // studio migration 016 not run yet
  const picture = new Map((users ?? []).filter((u) => u.avatar_url).map((u) => [u.id, u.avatar_url as string]));
  for (const c of cases ?? []) {
    const writer = !c.original_author_name ? picture.get(c.author_id) : undefined;
    const latest = (reviews ?? []).filter((r) => r.case_id === c.id).sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))[0];
    const reviewer = latest ? picture.get(latest.reviewer_id) : undefined;
    if (writer || reviewer) out.set(c.id, { writer, reviewer });
  }
  return out;
}

export interface StudioCertificate {
  credentialId: string;
  /** "internship" certificates are issued by hand in the studio (Admin, Certificates); the others are earned. */
  kind: "contributor" | "reviewer" | "advisory_board" | "internship";
  recipientName: string;
  title: string;
  detail: string;
  issuedAt: string;
  revoked: boolean;
}

/** A certificate by its credential id (e.g. MK-2026-00017); null if there is none. Throws if the studio cannot be read. */
export async function studioCertificate(credentialId: string): Promise<StudioCertificate | null> {
  if (!/^MK-\d{4}-\d{3,8}$/.test(credentialId)) return null;
  const db = studio();
  if (!db) throw new Error("The case studio is not connected");
  const { data, error } = await db.from("certificates").select("credential_id, kind, recipient_name, title, detail, issued_at, revoked").eq("credential_id", credentialId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { credentialId: data.credential_id, kind: data.kind, recipientName: data.recipient_name, title: data.title, detail: data.detail, issuedAt: data.issued_at, revoked: data.revoked };
}

// Must stay the same as the studio's own (lib/rewards/config.ts there): the title printed on the certificate, and
// the sentence under the name.
const ADVISORY_BOARD_TITLE = "Clinical Advisory Board";
const ADVISORY_BOARD_DETAIL = "for serving on the Clinical Advisory Board of MediKarya";

/**
 * Issues a Clinical Advisory Board certificate in the studio (where every certificate lives, with its QR code and
 * its page at /verify) for someone who has no studio account, and returns its credential id. Asking twice for the
 * same name gives back the certificate that already exists.
 */
export async function issueAdvisoryCertificate(name: string): Promise<string> {
  const db = studio();
  if (!db) throw new Error("The case studio is not connected, so a certificate cannot be issued from here.");
  const recipient = name.trim().replace(/\s+/g, " ");
  if (recipient.length < 3) throw new Error("A certificate needs the person's full name.");
  const ref = `advisory_board:${recipient.toLowerCase()}:${ADVISORY_BOARD_TITLE}`;

  const { data: existing, error: readError } = await db.from("certificates").select("credential_id").eq("ref", ref).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.credential_id as string;

  const { data: credentialId, error: idError } = await db.rpc("next_credential_id");
  if (idError) throw idError;
  const { error } = await db.from("certificates").insert({
    credential_id: credentialId,
    ref,
    kind: "advisory_board",
    user_id: null,
    recipient_name: recipient,
    title: ADVISORY_BOARD_TITLE,
    detail: ADVISORY_BOARD_DETAIL,
  });
  if (error) throw error;
  return credentialId as string;
}

export interface StudioRecordReview {
  version: number;
  reviewer: string;
  position: string;
  decision: "approved" | "changes_requested";
  comments: string | null;
  showName: boolean;
  decidedAt: string;
}

export interface StudioRecordPayout {
  kind: "case_published" | "review" | "re_review";
  payee: string;
  amount: number;
  status: "owed" | "paid" | "void";
  paidAt: string | null;
}

export interface StudioRecord {
  version: number | null;
  publishedAt: string | null;
  reviews: StudioRecordReview[];
  payouts: StudioRecordPayout[];
}

/** Everything the studio holds about each studio case's journey: every completed queue review, and what was paid for it. */
export async function studioRecords(): Promise<Map<string, StudioRecord>> {
  const out = new Map<string, StudioRecord>();
  const db = studio();
  if (!db) return out;
  const entry = (id: string) => {
    if (!out.has(id)) out.set(id, { version: null, publishedAt: null, reviews: [], payouts: [] });
    return out.get(id)!;
  };

  const [convs, reviews, payouts] = await Promise.all([
    db.from("case_conversions").select("*"),
    db.from("conversion_reviews").select("case_id, version, reviewer_id, decision, comments, show_name, decided_at").not("decision", "is", null).order("decided_at", { ascending: true }),
    db.from("payouts").select("case_id, kind, payee_name, amount, status, paid_at").order("earned_at", { ascending: true }),
  ]);
  for (const c of (convs.data ?? []) as Json[]) {
    const e = entry(c.case_id);
    e.version = c.version;
    e.publishedAt = c.published_at ?? null;
  }
  const reviewerIds = [...new Set((reviews.data ?? []).map((r) => r.reviewer_id))];
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: users }, { data: profiles }] = await Promise.all([
    db.from("users").select("id, name").in("id", reviewerIds.length ? reviewerIds : none),
    db.from("reviewer_profiles").select("user_id, designation, department, institution").in("user_id", reviewerIds.length ? reviewerIds : none),
  ]);
  for (const r of reviews.data ?? []) {
    const p = (profiles ?? []).find((x) => x.user_id === r.reviewer_id);
    entry(r.case_id).reviews.push({
      version: r.version,
      reviewer: (users ?? []).find((u) => u.id === r.reviewer_id)?.name ?? "A reviewer",
      position: [p?.designation, p?.department, p?.institution].filter(Boolean).join(", "),
      decision: r.decision,
      comments: r.comments,
      showName: r.show_name,
      decidedAt: r.decided_at,
    });
  }
  // Before the studio's 011_rewards.sql is run there is no payouts table: the records simply show no payouts.
  for (const p of (payouts.data ?? []) as Json[]) {
    if (!p.case_id) continue;
    entry(p.case_id).payouts.push({ kind: p.kind, payee: p.payee_name, amount: p.amount, status: p.status, paidAt: p.paid_at });
  }
  return out;
}
