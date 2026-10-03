// Dummy users for test mode (`npm run dev:test`), in the database named in .env.local.
//   node scripts/test-users.mjs create   makes them (safe to run again)
//   node scripts/test-users.mjs clean    removes them and everything they made
//   node scripts/test-users.mjs list     shows what test data exists
// A dummy user's id starts with "dev_", which no real Clerk account can have, so real users are never touched.
// What an admin dummy CHANGES on a real case (a live plan, a review) is not theirs to remove: put it back yourself.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")])
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const USERS = [
  { clerk_user_id: "dev_admin", full_name: "Test Admin", email: "test.admin@example.invalid", role: "admin" },
  { clerk_user_id: "dev_student", full_name: "Test Student", email: "test.student@example.invalid", role: "student" },
];
const DEV = "dev\_%";

const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

async function create() {
  for (const u of USERS) {
    must(await db.from("user_profiles").upsert({ ...u, current_streak: 0, longest_streak: 0 }, { onConflict: "clerk_user_id" }));
    console.log("ready", u.clerk_user_id, `(${u.role})`);
  }
}

async function clean() {
  const invites = must(await db.from("advisor_invites").select("id").like("created_by", DEV)).map((i) => i.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const steps = [
    ["attempts", db.from("case_attempts").delete({ count: "exact" }).like("user_id", DEV)],
    ["attempts made through their advisor links", db.from("case_attempts").delete({ count: "exact" }).in("guest_id", invites.length ? invites : none)],
    ["advisory board members they added", db.from("advisors").delete({ count: "exact" }).like("created_by", DEV)],
    ["advisor links", db.from("advisor_invites").delete({ count: "exact" }).like("created_by", DEV)],
    ["review links", db.from("case_reviews").delete({ count: "exact" }).like("created_by", DEV)],
    ["problem reports", db.from("case_reports").delete({ count: "exact" }).like("user_id", DEV)],
    ["case starts", db.from("case_starts").delete({ count: "exact" }).like("clerk_user_id", DEV)],
    ["subscriptions", db.from("subscriptions").delete({ count: "exact" }).like("clerk_user_id", DEV)],
    ["plan grants they gave", db.from("plan_grants").delete({ count: "exact" }).like("granted_by", DEV)],
    ["users", db.from("user_profiles").delete({ count: "exact" }).like("clerk_user_id", DEV)],
  ];
  for (const [what, query] of steps) {
    const { error, count } = await query;
    console.log(error ? `FAILED ${what}: ${error.message}` : `removed ${count ?? 0} ${what}`);
  }
}

async function list() {
  const users = must(await db.from("user_profiles").select("clerk_user_id, role").like("clerk_user_id", DEV));
  console.log("dummy users:", users.map((u) => `${u.clerk_user_id} (${u.role})`).join(", ") || "none");
  for (const [table, column] of [["case_attempts", "user_id"], ["case_starts", "clerk_user_id"], ["advisor_invites", "created_by"], ["advisors", "created_by"], ["case_reviews", "created_by"]]) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).like(column, DEV);
    console.log(`${table}:`, error ? error.message : count);
  }
}

const command = process.argv[2];
await ({ create, clean, list }[command] ?? (() => console.log("Usage: node scripts/test-users.mjs create | clean | list")))();
