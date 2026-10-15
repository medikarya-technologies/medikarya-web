// Records, lists or clears a release blocker on a case's live plan (lib/simulation/live-plan.ts, release_blockers).
// While a blocker is open the plan cannot be switched on in Admin > Live, and students never get it live.
// Snapshots the case first. Never changes the plan's status.
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/release-blocker.ts <case id> list
//   ... scripts/release-blocker.ts <case id> add <blocker id> "<what has to be done, by whom>"
//   ... scripts/release-blocker.ts <case id> clear <blocker id> "<who settled it>" "<how>"
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
const { isLivePlan, openReleaseBlockers } = require("../lib/simulation/live-plan");
const S = require("os").tmpdir();
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
(async () => {
  const [id, action, blockerId, a, b] = process.argv.slice(2);
  const { data, error } = await db.from("cases").select("case_json").eq("id", id).single();
  if (error) throw error;
  const caseJson = data.case_json as Record<string, any>;
  const plan = caseJson.live_plan;
  if (!isLivePlan(plan)) throw new Error(`${id} has no live plan`);
  const blockers = [...(plan.release_blockers ?? [])];
  if (action === "list") {
    for (const x of blockers) console.log(`${x.cleared_at ? "cleared" : "OPEN   "} ${x.id}: ${x.text}${x.cleared_at ? ` (by ${x.cleared_by} on ${x.cleared_at}: ${x.resolution})` : ""}`);
    console.log(`${openReleaseBlockers(plan).length} open; plan status ${plan.status}`);
    return;
  }
  if (!/^[a-z][a-z0-9_]{1,59}$/.test(blockerId ?? "")) throw new Error("blocker id: lower-case letters, digits and underscores");
  if (action === "add") {
    if (!a || a.length < 20) throw new Error("say what has to be done, and by whom");
    if (blockers.some((x) => x.id === blockerId)) throw new Error(`${blockerId} is already recorded`);
    blockers.push({ id: blockerId, text: a, raised_at: new Date().toISOString() });
  } else if (action === "clear") {
    const x = blockers.find((y) => y.id === blockerId);
    if (!x) throw new Error(`no blocker ${blockerId}`);
    if (!a || !b) throw new Error("say who settled it and how");
    Object.assign(x, { cleared_at: new Date().toISOString(), cleared_by: a, resolution: b });
  } else throw new Error("action: list, add or clear");
  fs.writeFileSync(`${S}/${id}.snapshot.json`, JSON.stringify(caseJson, null, 2));
  const { error: e2 } = await db.from("cases").update({ case_json: { ...caseJson, live_plan: { ...plan, release_blockers: blockers } }, updated_at: new Date().toISOString() }).eq("id", id);
  if (e2) throw e2;
  console.log(`${action === "add" ? "recorded" : "cleared"} ${blockerId} on ${id}; ${blockers.filter((x) => !x.cleared_at).length} open; plan status ${plan.status} (unchanged)`);
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
