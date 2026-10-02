import "server-only";

import { cache } from "react";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

// Advisor links (tables advisor_invites and advisors, scripts/create_advisors.sql). An admin makes a link for a
// professor or senior doctor and picks the cases it opens (Admin → Advisors). The person opens /advisor/<token> with
// no account, says who they are, and plays those cases; anything else on the site still needs an account and a plan.
// Only a hash of the token is stored. Once they have said who they are, their browser holds the token in a cookie,
// and that cookie is what the case and AI routes check (lib/plans/access.ts).

export const INVITE_DAYS = 14;
export const INVITE_COOKIE = "mk_advisor";

export interface AdvisorInvite {
  id: string;
  note: string | null;
  case_ids: string[];
  created_at: string;
  expires_at: string;
  name: string | null;
  designation: string | null;
  department: string | null;
  institution: string | null;
  list_name: boolean;
  details_at: string | null;
  feedback: string | null;
  feedback_at: string | null;
}

const COLUMNS = "id, note, case_ids, created_at, expires_at, name, designation, department, institution, list_name, details_at, feedback, feedback_at";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const wellFormed = (token: string) => /^[A-Za-z0-9_-]{20,64}$/.test(token);

/** The tables are not there until scripts/create_advisors.sql has been run: until then there are simply no invites. */
const tableMissing = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "42P01" || error.code === "PGRST205" || /could not find the table|does not exist/i.test(error.message ?? ""));

export const inviteOpen = (i: Pick<AdvisorInvite, "expires_at">, now = Date.now()) => Date.parse(i.expires_at) > now;

export async function createInvite(caseIds: string[], note: string, adminId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const { error } = await supabaseServer.from("advisor_invites").insert({
    token_hash: hash(token),
    note: note.trim().slice(0, 200) || null,
    case_ids: caseIds,
    created_by: adminId,
    expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
  });
  if (error) throw error;
  return token;
}

/** The invite behind a link, however it stands (open or expired); null for a link that never existed. */
export async function inviteForToken(token: string): Promise<AdvisorInvite | null> {
  if (!wellFormed(token)) return null;
  const { data, error } = await supabaseServer.from("advisor_invites").select(COLUMNS).eq("token_hash", hash(token)).maybeSingle();
  if (tableMissing(error)) return null;
  if (error) throw error;
  return data as AdvisorInvite | null;
}

/** The invite this browser is using: it holds the link's token, the link is still open, and they have said who they are. */
export const activeInvite = cache(async (): Promise<AdvisorInvite | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(INVITE_COOKIE)?.value;
  } catch {
    return null; // not in a request
  }
  if (!token) return null;
  const invite = await inviteForToken(token).catch(() => null);
  return invite && invite.details_at && inviteOpen(invite) ? invite : null;
});

/** May this browser open this case through an advisor link? */
export async function invitedTo(caseId: string): Promise<boolean> {
  const invite = await activeInvite();
  return !!invite && invite.case_ids.includes(caseId);
}

export interface AdvisorDetails {
  name: string;
  designation: string;
  department: string;
  institution: string;
  listName: boolean;
}

const clean = (s: string, max: number) => s.trim().replace(/\s+/g, " ").slice(0, max);

/** Saves who they are (they can correct it while the link is open). Returns what is wrong, or null when saved. */
export async function saveDetails(token: string, d: AdvisorDetails): Promise<string | null> {
  const invite = await inviteForToken(token);
  if (!invite) return "This link is not valid.";
  if (!inviteOpen(invite)) return "This link has expired. Please ask the MediKarya team for a new one.";
  if (clean(d.name, 120).length < 3) return "Please enter your full name.";
  if (!clean(d.designation, 120) || !clean(d.institution, 160)) return "Please enter your designation and institution.";
  const { error } = await supabaseServer
    .from("advisor_invites")
    .update({
      name: clean(d.name, 120),
      designation: clean(d.designation, 120),
      department: clean(d.department, 120) || null,
      institution: clean(d.institution, 160),
      list_name: d.listName,
      details_at: invite.details_at ?? new Date().toISOString(),
    })
    .eq("id", invite.id);
  if (error) throw error;
  return null;
}

export async function saveFeedback(token: string, feedback: string): Promise<string | null> {
  const invite = await inviteForToken(token);
  if (!invite || !invite.details_at) return "This link is not valid.";
  const text = feedback.trim().slice(0, 6000);
  if (!text) return "Please write a line or two first.";
  const { error } = await supabaseServer.from("advisor_invites").update({ feedback: text, feedback_at: new Date().toISOString() }).eq("id", invite.id);
  if (error) throw error;
  return null;
}

// ── For the admin ───────────────────────────────────────────────────────────

export interface InviteWithPlays extends AdvisorInvite {
  /** Their finished attempts on the invited cases (saved under the invite's id, like a guest's). */
  plays: Array<{ caseId: string; score: number | null; at: string }>;
}

export async function listInvites(): Promise<{ invites: InviteWithPlays[]; available: boolean }> {
  const { data, error } = await supabaseServer.from("advisor_invites").select(COLUMNS).order("created_at", { ascending: false });
  if (tableMissing(error)) return { invites: [], available: false };
  if (error) throw error;
  const invites = (data ?? []) as AdvisorInvite[];
  const ids = invites.map((i) => i.id);
  const { data: attempts } = ids.length
    ? await supabaseServer.from("case_attempts").select("guest_id, case_id, score, completed_at").in("guest_id", ids).order("completed_at", { ascending: true })
    : { data: [] as any[] };
  return {
    available: true,
    invites: invites.map((i) => ({
      ...i,
      plays: (attempts ?? []).filter((a) => a.guest_id === i.id).map((a) => ({ caseId: a.case_id, score: a.score, at: a.completed_at })),
    })),
  };
}

/** Ends a link now (it stops opening cases at once). What the person told us and played is kept. */
export async function endInvite(id: string): Promise<void> {
  const { error } = await supabaseServer.from("advisor_invites").update({ expires_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ── The advisory board ──────────────────────────────────────────────────────

export interface Advisor {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  institution: string | null;
  listed: boolean;
  invite_id: string | null;
  credential_id: string | null;
  created_at: string;
}

const ADVISOR_COLUMNS = "id, name, designation, department, institution, listed, invite_id, credential_id, created_at";

/** Every member, oldest first (the order they joined). Empty until the tables exist. */
export async function listAdvisors(onlyListed = false): Promise<Advisor[]> {
  let query = supabaseServer.from("advisors").select(ADVISOR_COLUMNS).order("created_at", { ascending: true });
  if (onlyListed) query = query.eq("listed", true);
  const { data, error } = await query;
  if (tableMissing(error)) return [];
  if (error) throw error;
  return (data ?? []) as Advisor[];
}

export interface NewAdvisor {
  name: string;
  designation: string;
  department: string;
  institution: string;
  listed: boolean;
  inviteId?: string | null;
}

export async function addAdvisor(a: NewAdvisor, adminId: string): Promise<Advisor> {
  const name = clean(a.name, 120);
  if (name.length < 3) throw new Error("Enter their full name, with the title they use (for example Dr.).");
  const { data, error } = await supabaseServer
    .from("advisors")
    .insert({
      name,
      designation: clean(a.designation, 120) || null,
      department: clean(a.department, 120) || null,
      institution: clean(a.institution, 160) || null,
      listed: a.listed,
      invite_id: a.inviteId ?? null,
      created_by: adminId,
    })
    .select(ADVISOR_COLUMNS)
    .single();
  if (error) throw error;
  return data as Advisor;
}

export async function updateAdvisor(id: string, patch: Partial<Pick<Advisor, "listed" | "credential_id">>): Promise<void> {
  const { error } = await supabaseServer.from("advisors").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeAdvisor(id: string): Promise<void> {
  const { error } = await supabaseServer.from("advisors").delete().eq("id", id);
  if (error) throw error;
}
