// Read-only: weekly counts of new accounts, case starts and completions, and paid subscriptions, as a CSV for Excel.
// Counts only, no names or emails. Written to private/exports/ (git-ignored), never into the repo.
//
//   node --env-file=.env.local scripts/export-metrics.mjs
//
// Accounts come from user_profiles (the keys in .env.local are Clerk's test instance, so Clerk itself cannot be read
// from here), plus any account that played or opened a case without a profile row, dated by its first activity. An
// account that signed up and never came back may be missing. Test users ("dev_"),
// admins and advisor-link plays are left out. A "start" is one student opening one case on one day (case_starts keeps
// one row per student, case and day); guests on /try have no starts, only completions. Website traffic is not in
// the database: it lives in Clarity and Search Console.

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

async function all(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

/** Monday of the week, as YYYY-MM-DD in India time. */
function weekOf(when) {
  const ist = new Date(new Date(when).getTime() + 5.5 * 3600e3);
  const day = (ist.getUTCDay() + 6) % 7;
  ist.setUTCDate(ist.getUTCDate() - day);
  return ist.toISOString().slice(0, 10);
}

const [profiles, starts, attempts, subs] = await Promise.all([
  all("user_profiles", "clerk_user_id, role, created_at"),
  all("case_starts", "clerk_user_id, case_id, live, created_at"),
  all("case_attempts", "user_id, case_id, created_at"),
  all("subscriptions", "clerk_user_id, tier, status, current_start, current_end, created_at"),
]);

const firstSeen = new Map(profiles.map((p) => [p.clerk_user_id, new Date(p.created_at)]));
for (const [id, at] of [...starts.map((s) => [s.clerk_user_id, s.created_at]), ...attempts.map((a) => [a.user_id, a.created_at])]) {
  if (!id || !id.startsWith("user_")) continue;
  const when = new Date(at);
  if (!firstSeen.has(id) || firstSeen.get(id) > when) firstSeen.set(id, when);
}
const users = [...firstSeen].map(([id, createdAt]) => ({ id, createdAt }));
const admins = new Set(profiles.filter((p) => p.role === "admin").map((p) => p.clerk_user_id));
const real = (id) => id && !id.startsWith("dev_") && !admins.has(id);
const students = users.filter((u) => real(u.id));
const studentStarts = starts.filter((s) => real(s.clerk_user_id));
const studentDone = attempts.filter((a) => real(a.user_id) && !a.user_id.startsWith("guest:") && !a.user_id.startsWith("advisor:"));
const guestDone = attempts.filter((a) => a.user_id?.startsWith("guest:"));
const studentSubs = subs.filter((s) => real(s.clerk_user_id));
// Razorpay statuses that mean money was taken for the current period
const PAYING = new Set(["active", "authenticated", "charged"]);

const weeks = new Map();
const row = (w) => {
  if (!weeks.has(w)) weeks.set(w, { week: w, newAccounts: 0, caseStarts: 0, liveStarts: 0, studentsStarting: new Set(), completions: 0, guestCompletions: 0, newSubscriptions: 0 });
  return weeks.get(w);
};
for (const u of students) row(weekOf(u.createdAt)).newAccounts++;
for (const s of studentStarts) { const r = row(weekOf(s.created_at)); r.caseStarts++; if (s.live) r.liveStarts++; r.studentsStarting.add(s.clerk_user_id); }
for (const a of studentDone) row(weekOf(a.created_at)).completions++;
for (const a of guestDone) row(weekOf(a.created_at)).guestCompletions++;
for (const s of studentSubs) if (s.status !== "created") row(weekOf(s.created_at)).newSubscriptions++;

const now = Date.now();
const payingNow = studentSubs.filter((s) => PAYING.has(s.status) && (!s.current_end || new Date(s.current_end).getTime() > now));
const ordered = [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
let total = 0;
const lines = [
  "Week starting (Mon),New accounts,Accounts to date,Case starts,Live case starts,Students who started a case,Cases completed (accounts),Cases completed (guests on /try),Subscription checkouts started",
  ...ordered.map((r) => [r.week, r.newAccounts, (total += r.newAccounts), r.caseStarts, r.liveStarts, r.studentsStarting.size, r.completions, r.guestCompletions, r.newSubscriptions].join(",")),
];

const startedEver = new Set(studentStarts.map((s) => s.clerk_user_id));
const doneEver = new Set(studentDone.map((a) => a.user_id));
const statusCounts = Object.fromEntries([...new Set(studentSubs.map((s) => s.status))].map((st) => [st, studentSubs.filter((s) => s.status === st).length]));
const summary = [
  "",
  "Totals",
  `Accounts,${students.length}`,
  `Accounts that started a case,${[...new Set(students.map((u) => u.id))].filter((id) => startedEver.has(id)).length}`,
  `Accounts that completed a case,${[...new Set(students.map((u) => u.id))].filter((id) => doneEver.has(id)).length}`,
  `Case starts,${studentStarts.length}`,
  `Cases completed (accounts),${studentDone.length}`,
  `Cases completed (guests on /try),${guestDone.length}`,
  `Students who ever paid (a subscription period started),${new Set(studentSubs.filter((s) => s.current_start).map((s) => s.clerk_user_id)).size}`,
  `Students who started a checkout,${new Set(studentSubs.map((s) => s.clerk_user_id)).size}`,
  `Paying subscribers now,${payingNow.length}`,
  ...["intern", "resident"].map((t) => `  of them ${t[0].toUpperCase() + t.slice(1)},${payingNow.filter((s) => s.tier?.toLowerCase() === t).length}`),
  `Subscription records by status,"${Object.entries(statusCounts).map(([k, v]) => `${k} ${v}`).join("; ") || "none"}"`,
  "",
  `Note,"Case starts were recorded only from 2026-09-27, when that table was added"`,
  `Left out,"test users, ${admins.size} admin accounts, advisor-link plays"`,
  `Exported,${new Date().toISOString()}`,
];

mkdirSync("private/exports", { recursive: true });
const file = `private/exports/medikarya-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
writeFileSync(file, "﻿" + [...lines, ...summary].join("\r\n"));
console.log([...lines, ...summary].join("\n"));
console.log(`\nWritten to ${file}`);
