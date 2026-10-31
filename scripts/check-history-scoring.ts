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
// 1. Every published case: can its history be scored? (required questions that name a topic, a reference history
//    the keyword matcher credits, diagnosis keywords a correct answer can contain)
// 2. Every real attempt whose questions were stored (HISTORY_TAKEN events): the history score the student saw,
//    version 2 by keywords alone, and with --ai version 2 as the examiner AI marks it now (one AI call each).
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
    const d = c?.evaluation_config?.diagnosis;
    const kws: string[] = Array.isArray(d?.must_include_keywords) ? d.must_include_keywords : [];
    if (kws.length > 1 && Array.isArray(d?.accepted_primary) && !d.accepted_primary.some((dx: string) => kws.every((k) => String(dx).toLowerCase().includes(String(k).toLowerCase())))) {
      errors.push(`diagnosis keywords "${kws.join('", "')}" look like alternatives: no accepted wording contains them all, so the keyword route can never pass`);
    }
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
  console.log('date        questions  seen(v1)  v2-keywords  ' + (AI ? 'v2-AI (asked/of, quality)  ' : '') + 'case');
  const band = (n: number) => (n >= 20 ? 'strong' : n >= 8 ? 'middle' : 'low');
  const tally: Record<string, Record<string, number>> = { v1: {}, v2k: {}, v2ai: {} };
  for (const r of replayable) {
    const c = cases.get(r.case_id);
    const questions = r.events.filter((e: any) => e.type === 'HISTORY_TAKEN').map((e: any) => String(e.question));
    const v1 = Number(r.fj?.historyScore ?? NaN);
    const v2k = scoreHistory({ required: c.evaluation_config.history.required_questions, questions });
    let aiText = '';
    if (AI) {
      process.env.HISTORY_SCORING = 'shadow';
      const inputs = classicInputsFromEvents(r.events);
      const result: any = await EvaluationEngine.evaluate(inputs.diagnosis, inputs.orderedTests, inputs.chatHistory, c);
      const v2 = result.historyScoring?.v2;
      if (v2) {
        aiText = `${String(v2.total).padStart(5)} (${v2.asked}/${v2.of} by ${v2.coverageBy}, q ${v2.quality})`.padEnd(28);
        tally.v2ai[band(v2.total)] = (tally.v2ai[band(v2.total)] ?? 0) + 1;
      }
    }
    tally.v1[band(v1)] = (tally.v1[band(v1)] ?? 0) + 1;
    tally.v2k[band(v2k.total)] = (tally.v2k[band(v2k.total)] ?? 0) + 1;
    console.log(
      `${String(r.created_at).slice(0, 10)}  ${String(questions.length).padStart(9)}  ${String(v1).padStart(8)}  ${String(v2k.total).padStart(11)}  ${aiText}${r.case_id}`
    );
    if (SHOW) questions.forEach((q: string, i: number) => console.log(`      ${i + 1}. ${q.slice(0, 140)}`));
  }
  console.log('\nbands (strong >= 20, middle 8-20, low < 8):');
  console.log('  seen (v1):    ', JSON.stringify(tally.v1));
  console.log('  v2, keywords: ', JSON.stringify(tally.v2k));
  if (AI) console.log('  v2, with AI:  ', JSON.stringify(tally.v2ai));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
