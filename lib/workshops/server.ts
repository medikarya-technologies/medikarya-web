import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { getCases } from "@/data/cases";
import type { PassBatch } from "@/lib/plans/pass-batches";
import { places, rankByCase, type AttemptRow, type Count, type Ranked } from "./rank";

// Reading what a workshop's students did, for Admin → Top scores and the participation certificates.

export interface Member {
  userId: string;
  email: string;
  name: string | null;
}

const PAGE = 1000;

/** Every row of a query, a page at a time (Supabase returns at most 1,000 per request). */
async function everyRow<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** The accounts behind a batch's emails (students who have not signed up yet have none). */
export async function membersOf(emails: readonly string[]): Promise<Member[]> {
  const out: Member[] = [];
  for (let i = 0; i < emails.length; i += 100) {
    const { data, error } = await supabaseServer.from("user_profiles").select("clerk_user_id, email, full_name").in("email", emails.slice(i, i + 100));
    if (error) throw error;
    for (const p of data ?? []) out.push({ userId: p.clerk_user_id, email: String(p.email).toLowerCase(), name: p.full_name ?? null });
  }
  return out;
}

/** Finished attempts by these students between two moments. */
export async function attemptsOf(userIds: readonly string[], from: Date, to: Date): Promise<AttemptRow[]> {
  const out: AttemptRow[] = [];
  for (let i = 0; i < userIds.length; i += 100) {
    const ids = userIds.slice(i, i + 100);
    out.push(
      ...(await everyRow<AttemptRow>((a, b) =>
        supabaseServer
          .from("case_attempts")
          .select("user_id, case_id, score, created_at")
          .in("user_id", ids)
          .gte("created_at", from.toISOString())
          .lt("created_at", to.toISOString())
          .order("created_at")
          .range(a, b)
      ))
    );
  }
  return out;
}

/** Everyone's finished attempts between two moments, without advisors' (no account) or admins' (testing). */
async function everyonesAttempts(from: Date, to: Date): Promise<{ rows: AttemptRow[]; names: Map<string, string | null> }> {
  const rows = (
    await everyRow<AttemptRow>((a, b) =>
      supabaseServer.from("case_attempts").select("user_id, case_id, score, created_at").gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).order("created_at").range(a, b)
    )
  ).filter((r) => r.user_id && !r.user_id.startsWith("advisor:"));
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string | null>();
  const admins = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabaseServer.from("user_profiles").select("clerk_user_id, full_name, role").in("clerk_user_id", ids.slice(i, i + 100));
    if (error) throw error;
    for (const p of data ?? []) {
      names.set(p.clerk_user_id, p.full_name ?? null);
      if (p.role === "admin") admins.add(p.clerk_user_id);
    }
  }
  return { rows: rows.filter((r) => !admins.has(r.user_id)), names };
}

export interface CaseScores {
  caseId: string;
  /** The title students see (it never gives the diagnosis away), so it is safe on a screen in the room. */
  title: string;
  players: number;
  top: Array<Ranked & { name: string | null; place: number }>;
}

/** Each case played in the window, most played first, with its top `limit` students. */
export async function topScores(opts: { from: Date; to: Date; batch: PassBatch | null; count: Count; limit: number }): Promise<CaseScores[]> {
  let rows: AttemptRow[];
  let names: Map<string, string | null>;
  if (opts.batch) {
    const members = await membersOf(opts.batch.emails);
    rows = await attemptsOf(
      members.map((m) => m.userId),
      opts.from,
      opts.to
    );
    names = new Map(members.map((m) => [m.userId, m.name]));
  } else {
    ({ rows, names } = await everyonesAttempts(opts.from, opts.to));
  }

  const titles = new Map((await getCases()).map((c) => [c.id, c.displayTitle]));
  return [...rankByCase(rows, opts.count).entries()]
    .map(([caseId, ranked]) => {
      const place = places(ranked);
      return {
        caseId,
        title: titles.get(caseId) ?? "A case no longer in the library",
        players: ranked.length,
        top: ranked.slice(0, opts.limit).map((r, i) => ({ ...r, name: names.get(r.userId) ?? null, place: place[i] })),
      };
    })
    .sort((a, b) => b.players - a.players || a.title.localeCompare(b.title));
}
