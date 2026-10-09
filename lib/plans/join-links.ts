import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { getPassBatch, givePasses } from "./pass-batches";
import { PASS_REASON_PREFIX, joinCodeFor, joinState, type JoinCheck, type JoinState } from "./passes";

// Join links for workshop passes in the database (scripts/create_pass_codes.sql): making one, listing them, switching
// one off, and joining through one. The rules themselves are in lib/plans/passes.ts.

export interface JoinLink {
  code: string;
  event: string;
  plan: "intern" | "resident";
  startsAt: string;
  endsAt: string;
  opensAt: string;
  closesAt: string;
  maxJoins: number;
  active: boolean;
  joined: number;
  state: JoinState;
  createdAt: string;
}

interface CodeRow {
  code: string;
  event: string;
  tier: "intern" | "resident";
  starts_at: string;
  ends_at: string;
  opens_at: string;
  closes_at: string;
  max_joins: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

const COLUMNS = "code, event, tier, starts_at, ends_at, opens_at, closes_at, max_joins, active, created_by, created_at";

async function joinedCount(code: string): Promise<number> {
  const { count, error } = await supabaseServer.from("pass_code_joins").select("code", { count: "exact", head: true }).eq("code", code);
  if (error) throw error;
  return count ?? 0;
}

function toLink(row: CodeRow, joined: number): JoinLink {
  const link = { active: row.active, opensAt: row.opens_at, closesAt: row.closes_at, maxJoins: row.max_joins };
  return {
    code: row.code,
    event: row.event,
    plan: row.tier,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    maxJoins: row.max_joins,
    active: row.active,
    joined,
    state: joinState(link, joined),
    createdAt: row.created_at,
  };
}

/** Every join link, newest first. available = false until scripts/create_pass_codes.sql has been run. */
export async function listJoinLinks(): Promise<{ available: boolean; links: JoinLink[] }> {
  const { data, error } = await supabaseServer.from("pass_codes").select(COLUMNS).order("created_at", { ascending: false });
  if (error) {
    console.error("Could not read join links:", error.message);
    return { available: false, links: [] };
  }
  const rows = (data ?? []) as CodeRow[];
  const counts = await Promise.all(rows.map((r) => joinedCount(r.code)));
  return { available: true, links: rows.map((r, i) => toLink(r, counts[i])) };
}

/** One join link by its code, or null. */
export async function getJoinLink(code: string): Promise<JoinLink | null> {
  const { data, error } = await supabaseServer.from("pass_codes").select(COLUMNS).eq("code", code).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toLink(data as CodeRow, await joinedCount(code));
}

/**
 * Makes a join link. A workshop keeps one plan and one set of dates, so a link for an event that already has passes
 * (pasted emails, or another link) must give the same ones.
 */
export async function createJoinLink(j: Extract<JoinCheck, { ok: true }>, adminId: string): Promise<JoinLink> {
  const batch = await getPassBatch(j.pass.name);
  const same = (a: string, b: Date) => new Date(a).getTime() === b.getTime();
  if (batch && (batch.plan !== j.pass.plan || !same(batch.startsAt, j.pass.startsAt) || !same(batch.endsAt, j.pass.endsAt))) {
    throw new Error("This workshop already has passes with a different plan or dates. Use the same ones, or a new name.");
  }
  // a new random ending if the first one happens to be taken
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = {
      code: joinCodeFor(j.pass.name),
      event: j.pass.name,
      tier: j.pass.plan,
      starts_at: j.pass.startsAt.toISOString(),
      ends_at: j.pass.endsAt.toISOString(),
      opens_at: j.opensAt.toISOString(),
      closes_at: j.closesAt.toISOString(),
      max_joins: j.maxJoins,
      active: true,
      created_by: adminId,
    };
    const { data, error } = await supabaseServer.from("pass_codes").insert(row).select(COLUMNS).single();
    if (!error) return toLink(data as CodeRow, 0);
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not make a new link. Try again.");
}

/** Whether this account has already joined through this link. */
export async function hasJoined(code: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseServer.from("pass_code_joins").select("code").eq("code", code).eq("clerk_user_id", userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function setJoinLinkActive(code: string, active: boolean): Promise<void> {
  const { error } = await supabaseServer.from("pass_codes").update({ active }).eq("code", code);
  if (error) throw error;
}

/** Switches off every link of a workshop (when its passes are removed, so nobody can bring them back by joining). */
export async function switchOffLinksOf(event: string): Promise<void> {
  const { error } = await supabaseServer.from("pass_codes").update({ active: false }).eq("event", event);
  // before scripts/create_pass_codes.sql there are no links to switch off
  if (error && !/pass_codes/.test(error.message)) throw error;
}

export type JoinResult =
  | { ok: true; already: boolean; event: string; plan: "intern" | "resident"; endsAt: string }
  | { ok: false; state: JoinState | "missing"; error: string };

const REFUSED: Record<Exclude<JoinState, "open">, string> = {
  off: "This link has been switched off. Ask the organisers for help.",
  not_yet: "This link is not open yet.",
  closed: "This link has closed.",
  full: "This workshop is full: everyone it was made for has joined.",
};

/**
 * Gives this account the workshop's pass, once. Joining again just says so. The pass goes to the email the account
 * signed up with, which is the one its plan is read from (lib/plans/server.ts).
 */
export async function joinWithLink(code: string, userId: string, email: string): Promise<JoinResult> {
  const link = await getJoinLink(code);
  if (!link) return { ok: false, state: "missing", error: "There is no workshop link like this one. Check the link, or scan the code again." };

  const { data: mine, error: mineError } = await supabaseServer.from("pass_code_joins").select("code").eq("code", code).eq("clerk_user_id", userId).maybeSingle();
  if (mineError) throw mineError;
  if (mine) return { ok: true, already: true, event: link.event, plan: link.plan, endsAt: link.endsAt };
  if (link.state !== "open") return { ok: false, state: link.state, error: REFUSED[link.state] };

  // Two people joining at the very same moment for the last place could both get in; a place or two over is fine.
  const { error: joinError } = await supabaseServer.from("pass_code_joins").insert({ code, clerk_user_id: userId, email });
  if (joinError && joinError.code !== "23505") throw joinError;

  const { data: creator } = await supabaseServer.from("pass_codes").select("created_by").eq("code", code).single();
  await givePasses(
    {
      ok: true,
      reason: `${PASS_REASON_PREFIX}${link.event}`,
      plan: link.plan,
      startsAt: new Date(link.startsAt),
      endsAt: new Date(link.endsAt),
      emails: [email],
      invalid: [],
    },
    // filed under the admin who made the link, like passes they give by email
    creator?.created_by ?? `join:${code}`
  );
  return { ok: true, already: false, event: link.event, plan: link.plan, endsAt: link.endsAt };
}
