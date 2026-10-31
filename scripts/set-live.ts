// Switches a case's live plan on for students, or back off: the Admin > Live switch (app/admin/live/actions.ts,
// setLiveAction) from the command line, with the same checks. Switching on needs a plan that passes the check and has
// no open release blocker (scripts/release-blocker.ts); without a clinician's sign-off it is recorded as the team's check.
// Snapshots the case first. The library's list of live cases catches up within a minute.
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/set-live.ts <case id> on|off
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
const { upgradeLegacyCase } = require("../lib/simulation/legacy-adapter");
const { isSimulationCase } = require("../lib/simulation/case-schema");
const { isLivePlan, checkLivePlan, measuredOnArrival, openReleaseBlockers } = require("../lib/simulation/live-plan");
const S = require("os").tmpdir();
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
(async () => {
  const [id, state] = process.argv.slice(2);
  if (state !== "on" && state !== "off") throw new Error("say on or off");
  const { data, error } = await db.from("cases").select("status, case_json").eq("id", id).single();
  if (error) throw error;
  const caseJson = data.case_json as Record<string, any>;
  const plan = caseJson.live_plan;
  if (!isLivePlan(plan)) throw new Error(`${id} has no live plan`);
  let next = { ...plan, status: state === "on" ? "approved" : "proposed" };
  if (state === "on") {
    const base = upgradeLegacyCase(caseJson);
    if (!isSimulationCase(base)) throw new Error("this case cannot run at the bedside, so it cannot be made live");
    const check = checkLivePlan(plan, measuredOnArrival(base), base.patient?.age);
    if (check.errors.length > 0) throw new Error(`the plan does not pass the check:\n  ${check.errors.join("\n  ")}`);
    const blockers = openReleaseBlockers(plan);
    if (blockers.length > 0) throw new Error(`still blocked: ${blockers.map((b: { id: string }) => b.id).join(", ")}`);
    if (plan.sign_off?.decision !== "approved") next = { ...next, team_checked_at: new Date().toISOString() };
  }
  fs.writeFileSync(`${S}/${id}.snapshot.json`, JSON.stringify(caseJson, null, 2));
  const { error: e2 } = await db.from("cases").update({ case_json: { ...caseJson, live_plan: next }, updated_at: new Date().toISOString() }).eq("id", id);
  if (e2) throw e2;
  console.log(`${id}: live plan ${next.status}${state === "on" && data.status !== "published" ? " (the case is still a draft: students get it once it is published)" : ""}`);
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
