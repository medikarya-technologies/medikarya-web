// Checks a live plan exactly as the site does, then plays it through the real engine:
//   untreated, every essential treatment on time (scored through the server's replay), and with the harmful ones.
// Usage (from the repo root):
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/check-live-plan.ts data/cases/<id>.json <plan.json>
import fs from "fs";
import path from "path";
const R = "../lib/simulation/";
const { upgradeLegacyCase } = require(R + "legacy-adapter");
const { isSimulationCase } = require(R + "case-schema");
const { normaliseLivePlan, checkLivePlan, compileLivePlan, measuredOnArrival, scoreBedside, blendLiveScore } = require(R + "live-plan");
const { validateSimulationCase } = require(R + "validate-config");
const { EncounterEngine } = require(R + "encounter-engine");
const { replayStudentEvents } = require(R + "replay");
const { interventionsForCase } = require(R + "intervention-catalog");

const [caseFile, planFile] = process.argv.slice(2);
const caseJson = JSON.parse(fs.readFileSync(path.resolve(caseFile), "utf8"));
const raw = JSON.parse(fs.readFileSync(path.resolve(planFile), "utf8"));
const base = upgradeLegacyCase(caseJson);
if (!isSimulationCase(base)) throw new Error("case cannot run at the bedside");
const measured = measuredOnArrival(base);
console.log("ARRIVAL (from the case):", JSON.stringify(measured));

const plan = normaliseLivePlan(raw.plan ?? raw, "ai");
const check = checkLivePlan(plan, measured);
console.log(`CHECK: ${check.errors.length} errors, ${check.warnings.length} warnings`);
for (const e of check.errors) console.log("  ERROR:", e);
for (const w of check.warnings) console.log("  warning:", w);
if (check.errors.length) process.exit(1);

const c = compileLivePlan(base, plan);
const v = validateSimulationCase(c);
console.log(`ENGINE VALIDATION: ${v.errors.length} errors${v.errors.length ? ": " + JSON.stringify(v.errors) : ""}`);
console.log("TRAY:", interventionsForCase(c).map((i: any) => `${i.id} [${plan.treatments.find((t: any) => t.id === i.id)?.role ?? "?"}]`).join(", "));
const MIN = 60;
const limit = plan.time_limit_minutes;
const snap = (e: any) => { const s = e.state; return `HR ${s.rate}, BP ${s.systolic}/${s.diastolic}, SpO2 ${s.spo2}, RR ${s.rr}${s.temperature !== undefined ? ", T " + s.temperature : ""}, ${s.consciousness}, ${s.stability}, ${s.rhythm}`; };
const timeline = (e: any) => e.events.filter((x: any) => ["PATIENT_DETERIORATED", "STATE_TRANSITION", "INTERVENTION_GIVEN"].includes(x.type))
  .map((x: any) => `    ${(x.timestamp / 60).toFixed(1)} min ${x.type}${x.action ? " " + x.action : ""}${x.narrative ? ": " + x.narrative : ""}${x.consequence ? ": " + x.consequence : ""}`).join("\n");

// 1. untreated
const a = new EncounterEngine(c);
for (let m = 1; m <= limit; m++) { a.advanceTo(m * MIN); }
console.log(`\nUNTREATED to ${limit} min -> ${snap(a)}\n${timeline(a)}`);

// 2. every essential on time, in plan order, a minute apart from minute 1 (or by its within_minutes)
// A treatment required or available only in some states, or with prerequisites, is left to the shared playthroughs at the end.
const essentials = plan.treatments.filter((t: any) => t.role === "essential" && !t.required_when && !t.available_when && !t.requires?.length);
const events: any[] = []; let t = 1;
// A treatment that needs several doses gets each further dose as soon as its minimum interval allows.
const doses = (tr: any, first: number) => Array.from({ length: tr.doses_required ?? 1 }, (_, n) => first + n * Math.max(1, tr.min_interval_minutes ?? 1));
// The playthroughs' own rule for doses (a reassessment before each further dose that needs one).
const { dosesAt, playthroughs } = require(R + "live-plan-playthrough");
for (const tr of essentials) { const at = Math.min(t, tr.within_minutes ?? limit); events.push(...dosesAt(tr, doses(tr, at))); t = at + 1; }
events.sort((x, y) => x.timestamp - y.timestamp);
const b = replayStudentEvents(c, events);
for (let m = 1; m <= limit; m++) b.advanceTo(m * MIN);
const sb = scoreBedside(c, plan, b.events);
console.log(`\nCORRECT CARE, FIXED-SCHEDULE TREATMENTS ONLY (server replay; the full correct care is under SHARED PLAYTHROUGHS): ${essentials.map((x: any) => (x.doses_required ?? 1) > 1 ? `${x.id} x${x.doses_required}` : x.id).join(", ")} -> ${snap(b)}\n  bedside score ${sb.score}, outcome ${JSON.stringify(sb.outcome)}; final if consultation were 80: ${blendLiveScore(80, sb.score)}\n${timeline(b)}`);

// 3. correct care plus every harmful treatment
const harmful = plan.treatments.filter((t: any) => t.role === "harmful");
const ev2 = [...events, ...harmful.map((h: any, i: number) => ({ type: "INTERVENTION_GIVEN", timestamp: (t + i) * MIN, action: h.id, consequence: "x" }))].sort((x, y) => x.timestamp - y.timestamp);
const d = replayStudentEvents(c, ev2);
for (let m = 1; m <= limit; m++) d.advanceTo(m * MIN);
const sd = scoreBedside(c, plan, d.events);
console.log(`\nWITH HARMFUL (${harmful.map((x: any) => x.id).join(", ")}): bedside ${sd.score}, harmful flagged ${JSON.stringify(sd.harmful.map((h: any) => h.id))} -> ${snap(d)}`);

// 4. late: essentials given just after their window
const late = essentials.flatMap((tr: any) => dosesAt(tr, doses(tr, Math.min(limit - 1, (tr.within_minutes ?? 5) + 2)).map((d) => Math.min(limit - 1, d)))).sort((x: any, y: any) => x.timestamp - y.timestamp);
const l = replayStudentEvents(c, late);
for (let m = 1; m <= limit; m++) l.advanceTo(m * MIN);
const sl = scoreBedside(c, plan, l.events);
console.log(`\nLATE (each essential 2 min past its window): bedside ${sl.score}, outcome ${JSON.stringify(sl.outcome)} -> ${snap(l)}`);

// 5. the shared playthroughs, as the golden tests run them (with a rescue path when the plan has conditional treatments)
const shared = playthroughs(base, plan);
console.log("\nSHARED PLAYTHROUGHS:");
for (const [name, r] of Object.entries(shared) as Array<[string, any]>) console.log(`  ${name.padEnd(9)} bedside ${r.score}, ${JSON.stringify(r.outcome)}; ${r.items.map(([i, st]: string[]) => `${i}:${st}`).join(" ")}`);
