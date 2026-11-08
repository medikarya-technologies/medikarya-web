import path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { scoreHistory } from '../engine/evaluation/historyCoverage';
import { EvaluationEngine } from '../engine/evaluation/EvaluationEngine';
import { classicInputsFromEvents } from '../lib/simulation/classic-inputs';
import { historyChecks } from '../lib/studio/validate';

// Checks the history scoring against the real thing (EVALUATION_ENGINE.md, "History, version 2"). Read-only.
//
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/check-history-scoring.ts          cases + replay (no AI)
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/check-history-scoring.ts --ai     also the real examiner
//
// 1. Every published case: does the history rubric have the required structure and review examples?
// 2. Every real attempt whose questions were stored (HISTORY_TAKEN events): the history score the student saw,
//    an offline keyword estimate (provisional only), and with --ai the current semantic examiner's score.
//
// Prints case ids, dates and numbers only, never who the student was or what they typed (add --show for the typed
// questions, on your own screen only: never paste them anywhere public).

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const args = process.argv.slice(2);
const AI = args.includes('--ai');
const SHOW = args.includes('--show');

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials in .env.local');
  const db = createClient(url, key, { auth: { persistSession: false } });

  // ── 1. The cases ─────────────────────────────────────────────────────────
  const { data: caseRows, error: caseError } = await db.from('cases').select('id, status, case_json').eq('status', 'published');
  if (caseError) throw caseError;
  const cases = new Map<string, any>(caseRows!.map((r) => [r.id, r.case_json]));
  console.log(`\n== ${cases.size} published cases ==`);
  let withProblems = 0;
  for (const [id, c] of [...cases].sort(([a], [b]) => a.localeCompare(b))) {
    const h = c?.evaluation_config?.history;
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!h || !Array.isArray(h.required_questions)) errors.push('no history.required_questions');
    else historyChecks(h.required_questions, h.reference_questions, errors, warnings);
    const notes = [...errors.map((e) => `ERROR ${e}`), ...warnings.filter((w) => !w.includes('reference_questions is missing')).map((w) => `warn  ${w}`)];
    if (notes.length) {
      withProblems++;
      console.log(`- ${id}`);
      for (const n of notes) console.log(`    ${n}`);
    }
  }
  const noReference = [...cases.values()].filter((c) => !Array.isArray(c?.evaluation_config?.history?.reference_questions)).length;
  console.log(`${withProblems} case(s) with problems above; ${noReference} without a reference history yet.`);

  // ── 2. Real attempts ─────────────────────────────────────────────────────
  const rows: any[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from('case_attempts').select('case_id, created_at, score, fj:feedback_json').order('created_at').range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const replayable = rows
    .map((r) => ({ ...r, events: (r.fj?.simulation?.events ?? []) as any[] }))
    .filter((r) => r.events.some((e: any) => e.type === 'HISTORY_TAKEN') && cases.get(r.case_id)?.evaluation_config?.history);
  console.log(`\n== ${replayable.length} real attempts with their questions stored (of ${rows.length}) ==`);
  console.log('date        questions  saved rev  saved /25  stored v2 (asked/of,coverage,quality)  offline est.  ' + (AI ? 'current AI (asked/of, quality)  ' : '') + 'case');
  const band = (n: number) => (n >= 20 ? 'strong' : n >= 8 ? 'middle' : 'low');
  const tally: Record<string, Record<string, number>> = { savedV1: {}, savedV2: {}, storedV2: {}, offline: {}, currentAI: {} };
  for (const r of replayable) {
    const c = cases.get(r.case_id);
    const questions = r.events.filter((e: any) => e.type === 'HISTORY_TAKEN').map((e: any) => String(e.question));
    const savedHistory = Number(r.fj?.historyScore ?? NaN);
    const savedVersion = r.fj?.scoringVersion?.history === 2 ? 'v2' : 'v1/legacy';
    const storedV2Detail = r.fj?.historyScoring?.v2;
    const storedV2 = Number(storedV2Detail?.total ?? NaN);
    const storedV2Summary = storedV2Detail
      ? `${storedV2Detail.asked}/${storedV2Detail.of},${storedV2Detail.coverage},${storedV2Detail.quality}`
      : '—';
    const offline = scoreHistory({ required: c.evaluation_config.history.required_questions, questions });
    let aiText = '';
    if (AI) {
      const inputs = classicInputsFromEvents(r.events);
      const result: any = await EvaluationEngine.evaluate(inputs.diagnosis, inputs.orderedTests, inputs.chatHistory, c);
      const v2 = result.historyScoring?.v2;
      if (v2) {
        aiText = `${String(v2.total).padStart(5)} (${v2.asked}/${v2.of} by ${v2.coverageBy}, q ${v2.quality})`.padEnd(28);
        tally.currentAI[band(v2.total)] = (tally.currentAI[band(v2.total)] ?? 0) + 1;
      }
    }
    const savedKey = savedVersion === 'v2' ? 'savedV2' : 'savedV1';
    if (Number.isFinite(savedHistory)) tally[savedKey][band(savedHistory)] = (tally[savedKey][band(savedHistory)] ?? 0) + 1;
    if (Number.isFinite(storedV2)) tally.storedV2[band(storedV2)] = (tally.storedV2[band(storedV2)] ?? 0) + 1;
    tally.offline[band(offline.total)] = (tally.offline[band(offline.total)] ?? 0) + 1;
    console.log(
      `${String(r.created_at).slice(0, 10)}  ${String(questions.length).padStart(9)}  ${savedVersion.padStart(9)}  ${String(savedHistory).padStart(8)}  ${`${storedV2}/${storedV2Summary}`.padStart(27)}  ${String(offline.total).padStart(11)}  ${aiText}${r.case_id}`
    );
    if (SHOW) questions.forEach((q: string, i: number) => console.log(`      ${i + 1}. ${q.slice(0, 140)}`));
  }
  console.log('\nbands (strong >= 20, middle 8-20, low < 8):');
  console.log('  saved history v1/legacy: ', JSON.stringify(tally.savedV1));
  console.log('  saved history v2:        ', JSON.stringify(tally.savedV2));
  console.log('  stored v2 history:        ', JSON.stringify(tally.storedV2));
  console.log('  offline estimate:         ', JSON.stringify(tally.offline));
  if (AI) console.log('  current AI estimate:      ', JSON.stringify(tally.currentAI));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
