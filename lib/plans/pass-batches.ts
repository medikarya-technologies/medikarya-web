import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { PASS_REASON_PREFIX, monthsLabel, passDays, type PassCheck } from "./passes";

// Workshop passes in the database (plan_grants rows whose reason starts "workshop: "), for Admin → Workshop passes.
// A batch is every row with the same reason; its name is the event's.

export interface PassBatch {
  reason: string;
  name: string;
  plan: "intern" | "resident";
  startsAt: string;
  endsAt: string;
  days: number;
  emails: string[];
  /** Emails that already have a MediKarya account (the pass applies as soon as they sign in). */
  withAccount: string[];
  createdAt: string;
}

interface Row {
  email: string;
  tier: "intern" | "resident";
  starts_at: string;
  ends_at: string;
  reason: string;
  created_at: string;
}

/** Which of these emails have signed up, asked in small groups so the request stays short. */
export async function emailsWithAccounts(emails: readonly string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < emails.length; i += 100) {
    const { data, error } = await supabaseServer.from("user_profiles").select("email").in("email", emails.slice(i, i + 100));
    if (error) throw error;
    for (const r of data ?? []) if (r.email) found.add(String(r.email).toLowerCase());
  }
  return found;
}

async function rowsOf(reason?: string): Promise<Row[]> {
  const query = supabaseServer.from("plan_grants").select("email, tier, starts_at, ends_at, reason, created_at");
  const { data, error } = await (reason ? query.eq("reason", reason) : query.like("reason", `${PASS_REASON_PREFIX}%`)).order("created_at");
  if (error) throw error;
  return (data ?? []) as Row[];
}

/**
 * Every batch, newest first, or only the one with this event name. available = false until
 * scripts/create_reviews_and_grants.sql has been run. accounts: false skips finding out who has signed up.
 */
export async function listPassBatches(options: { name?: string; accounts?: boolean } = {}): Promise<{ available: boolean; batches: PassBatch[] }> {
  let rows: Row[];
  try {
    rows = await rowsOf(options.name ? `${PASS_REASON_PREFIX}${options.name}` : undefined);
  } catch (error) {
    console.error("Could not read workshop passes:", error);
    return { available: false, batches: [] };
  }
  const byReason = new Map<string, Row[]>();
  for (const r of rows) byReason.set(r.reason, [...(byReason.get(r.reason) ?? []), r]);
  const accounts = options.accounts === false ? new Set<string>() : await emailsWithAccounts([...new Set(rows.map((r) => r.email))]);

  const batches = [...byReason.entries()].map(([reason, group]): PassBatch => {
    const first = group[0];
    const emails = group.map((r) => r.email);
    return {
      reason,
      name: reason.slice(PASS_REASON_PREFIX.length),
      plan: first.tier,
      startsAt: first.starts_at,
      endsAt: first.ends_at,
      days: passDays(new Date(first.starts_at), new Date(first.ends_at)),
      emails,
      withAccount: emails.filter((e) => accounts.has(e)),
      createdAt: first.created_at,
    };
  });
  return { available: true, batches: batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

/** One batch by its event name, or null. */
export async function getPassBatch(name: string): Promise<PassBatch | null> {
  const { batches } = await listPassBatches({ name, accounts: false });
  return batches[0] ?? null;
}

/**
 * Gives the pass to every email not already in this batch. A batch keeps one plan and one set of dates: adding late
 * registrations under the same name works, the same name with different dates is refused (use a new name).
 */
export async function givePasses(pass: Extract<PassCheck, { ok: true }>, adminId: string): Promise<{ given: number; already: number }> {
  const existing = await rowsOf(pass.reason);
  const sameTime = (r: Row) =>
    r.tier === pass.plan && new Date(r.starts_at).getTime() === pass.startsAt.getTime() && new Date(r.ends_at).getTime() === pass.endsAt.getTime();
  if (existing.length && !existing.every(sameTime)) {
    throw new Error("A batch with this name already exists with a different plan or dates. Give this one a new name.");
  }
  const had = new Set(existing.map((r) => r.email));
  const fresh = pass.emails.filter((e) => !had.has(e));
  const days = passDays(pass.startsAt, pass.endsAt);
  const rows = fresh.map((email) => ({
    email,
    tier: pass.plan,
    months: monthsLabel(days),
    starts_at: pass.startsAt.toISOString(),
    ends_at: pass.endsAt.toISOString(),
    reason: pass.reason,
    case_id: null,
    granted_by: adminId,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseServer.from("plan_grants").insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
  return { given: fresh.length, already: pass.emails.length - fresh.length };
}

/** Takes the whole batch away at once: those students go back to whatever plan they had without it. */
export async function removePassBatch(reason: string): Promise<number> {
  if (!reason.startsWith(PASS_REASON_PREFIX)) throw new Error("That is not a workshop pass.");
  const { error, count } = await supabaseServer.from("plan_grants").delete({ count: "exact" }).eq("reason", reason);
  if (error) throw error;
  return count ?? 0;
}
