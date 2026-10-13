// Saves a checked live plan onto a case as "proposed" (admins only; the admin switches it on in Admin > Live).
// Snapshots the case first, and refuses to overwrite an existing plan unless --replace is given, and even then never a
// plan that is switched on for students (that one has to be switched off in Admin > Live first).
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/save-live-plan.ts <case id> <plan.json> [--replace]
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
const R = "../lib/simulation/";
const { upgradeLegacyCase } = require(R + "legacy-adapter");
const { isSimulationCase } = require(R + "case-schema");
const { normaliseLivePlan, checkLivePlan, measuredOnArrival } = require(R + "live-plan");
const S = require("os").tmpdir();
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
(async () => {
  const args = process.argv.slice(2);
  const replace = args.includes("--replace");
  const [id, planFile] = args.filter((a) => a !== "--replace");
  const { data, error } = await db.from("cases").select("case_json").eq("id", id).single();
  if (error) throw error;
  const caseJson = data.case_json as Record<string, any>;
  fs.writeFileSync(`${S}/${id}.snapshot.json`, JSON.stringify(caseJson, null, 2));
  const old = caseJson.live_plan;
  if (old && !replace) throw new Error(`${id} already has a live plan; not overwriting (pass --replace to swap a proposed plan)`);
  if (old && old.status === "approved") throw new Error(`${id}: its live plan is switched on for students; switch it off in Admin > Live first`);
  const raw = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const plan = { ...normaliseLivePlan(raw.plan ?? raw, "ai"), drafted_at: new Date().toISOString(), ...(old ? { version: (old.version ?? 1) + 1 } : {}) };
  const base = upgradeLegacyCase(caseJson);
  if (!isSimulationCase(base)) throw new Error("not playable");
  const check = checkLivePlan(plan, measuredOnArrival(base));
  if (check.errors.length || check.warnings.length) throw new Error(`${id}: ${JSON.stringify(check)}`);
  const { error: e2 } = await db.from("cases").update({ case_json: { ...caseJson, live_plan: plan }, updated_at: new Date().toISOString() }).eq("id", id);
  if (e2) throw e2;
  console.log(`saved live plan on ${id}: ${plan.status}, ${plan.stages.length} stages, ${plan.treatments.length} treatments`);
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
