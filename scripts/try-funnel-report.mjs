// Read-only: where guests stop in the free case on /try (lib/try-funnel.ts), over the last N days. Counts only.
// Our own testing (internal) is left out. "From Meta ads" = visits that began with a Meta ad click.
//
//   node --env-file=.env.local scripts/try-funnel-report.mjs [days, default 7]
//
// Needs scripts/create_try_funnel.sql run in the main project first.

import { createClient } from "@supabase/supabase-js";

const days = Number(process.argv[2] || 7);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const since = new Date(Date.now() - days * 86400e3).toISOString();

const STEPS = [
  ["viewed", "saw the case briefing"],
  ["started", "opened the case"],
  ["asked", "got a first answer from the patient"],
  ["examined", "examined the patient"],
  ["ordered", "ordered a test"],
  ["submitted", "submitted a diagnosis and plan"],
  ["finished", "saw the debrief"],
  ["signed_up", "signed up with that play"],
];

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from("try_funnel")
    .select("guest_id, step, ad_source")
    .eq("internal", false)
    .gte("created_at", since)
    .range(from, from + 999);
  if (error) {
    console.error(`try_funnel: ${error.message} (has scripts/create_try_funnel.sql been run in the main project?)`);
    process.exit(1);
  }
  rows.push(...data);
  if (data.length < 1000) break;
}

// A guest who arrived from an ad at any step counts as from an ad.
const fromAd = new Set(rows.filter((r) => r.ad_source === "meta").map((r) => r.guest_id));
function count(filter) {
  const seen = new Map(STEPS.map(([s]) => [s, new Set()]));
  for (const r of rows) if (filter(r.guest_id)) seen.get(r.step)?.add(r.guest_id);
  return STEPS.map(([s]) => seen.get(s).size);
}
const all = count(() => true);
const ads = count((g) => fromAd.has(g));
const pct = (n, base) => (base ? `${Math.round((n / base) * 100)}%` : "-");

console.log(`Free case on /try, last ${days} days (our own testing left out)\n`);
console.log("step                                   | all guests | of viewers | from Meta ads | of ad viewers");
STEPS.forEach(([, label], i) => {
  console.log(`${label.padEnd(38)} | ${String(all[i]).padStart(10)} | ${pct(all[i], all[0]).padStart(10)} | ${String(ads[i]).padStart(13)} | ${pct(ads[i], ads[0]).padStart(13)}`);
});
