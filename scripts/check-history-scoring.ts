import path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { scoreHistory } from '../engine/evaluation/historyCoverage';
import { EvaluationEngine } from '../engine/evaluation/EvaluationEngine';
import { scoreClassicAttempt } from '../lib/scoring/score-attempt';
import { classicInputsFromEvents } from '../lib/simulation/classic-inputs';
import { isSimulationCase } from '../lib/simulation/case-schema';
import { upgradeLegacyCase } from '../lib/simulation/legacy-adapter';
import { withLivePlan } from '../lib/simulation/live-plan';
import { appearanceOverlays } from '../data/cases/simulation/appearance';
import { historyChecks } from '../lib/studio/validate';
import { GRADING_ENGINE_REVISION } from '../engine/evaluation/gradingVersion';

// Checks the history scoring against the real thing (EVALUATION_ENGINE.md, "History, version 2"). Read-only.
//
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/check-history-scoring.ts          cases + replay (no AI)
//   npx ts-node --project scripts/tsconfig.migrate.json scripts/check-history-scoring.ts --ai     also the real examiner
//   ... --same-user-as=<attempt-id>                                                          inspect that user's attempts
//   ... --attempt-id=<id>[,<id>]                                                             inspect selected attempts
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
const SHOW_V2 = args.includes('--show-v2');
const SHOW_ITEMS = args.includes('--show-items');
const ATTEMPT_IDS = new Set((args.find((arg) => arg.startsWith('--attempt-id='))?.slice('--attempt-id='.length) ?? '').split(',').filter(Boolean));
const SAME_USER_AS = args.find((arg) => arg.startsWith('--same-user-as='))?.slice('--same-user-as='.length);

function caseForAttempt(current: any, currentRevision: string | null, feedback: any, createdAt: string) {
  const audit = feedback?.gradingAudit;
  const config = { ...current };
  if (audit && typeof audit === 'object') {
    if (audit.evaluationConfig && typeof audit.evaluationConfig === 'object') config.evaluation_config = audit.evaluationConfig;
    if (audit.scoringMode) config.scoring_mode = audit.scoringMode;
    if (audit.case && typeof audit.case === 'object') {
      if (audit.case.title) config.title = audit.case.title;
      if (audit.case.displayTitle) config.displayTitle = audit.case.displayTitle;
      if (audit.case.diagnosis) config.diagnosis = audit.case.diagnosis;
      if (audit.case.patient && typeof audit.case.patient === 'object') {
        config.patient = { ...config.patient, ...audit.case.patient };
      }
    }
  }
  const revisionMatches = !!audit?.caseRevisionUpdatedAt && audit.caseRevisionUpdatedAt === currentRevision;
  const revisionPredatesAttempt = !!currentRevision && Date.parse(currentRevision) <= Date.parse(createdAt);
  const snapshot = audit?.evaluationConfig
    ? (audit?.case ? (revisionMatches ? 'saved snapshot (same case revision)' : 'saved grading snapshot (revision differs)') : 'partial saved snapshot')
    : `no snapshot; current rev ${currentRevision?.slice(0, 10) ?? 'unknown'}${revisionPredatesAttempt ? ' predates attempt' : ' may be newer'}`;
  config.caseRevisionUpdatedAt = audit?.caseRevisionUpdatedAt ?? currentRevision;
  return { config, snapshot };
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials in .env.local');
  const db = createClient(url, key, { auth: { persistSession: false } });

  // ── 1. The cases ─────────────────────────────────────────────────────────
  const { data: caseRows, error: caseError } = await db.from('cases').select('id, status, updated_at, case_json').eq('status', 'published');
  if (caseError) throw caseError;
  const cases = new Map<string, { config: any; revision: string | null }>(caseRows!.map((r) => {
    const revision = r.updated_at ?? null;
    const upgraded = upgradeLegacyCase({ ...(r.case_json as any), id: r.id, caseRevisionUpdatedAt: revision }, { appearance: (appearanceOverlays as any)[r.id] });
    const config = isSimulationCase(upgraded) ? withLivePlan(upgraded, false) : upgraded;
    return [r.id, { config, revision }];
  }));
  console.log(`\n== ${cases.size} published cases ==`);
  let withProblems = 0;
  for (const [id, record] of [...cases].sort(([a], [b]) => a.localeCompare(b))) {
    const c = record.config;
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
  const noReference = [...cases.values()].filter(({ config: c }) => !Array.isArray(c?.evaluation_config?.history?.reference_questions)).length;
  console.log(`${withProblems} case(s) with problems above; ${noReference} without a reference history yet.`);

  // ── 2. Real attempts ─────────────────────────────────────────────────────
  const rows: any[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from('case_attempts').select('id, user_id, case_id, created_at, score, fj:feedback_json').order('created_at').range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const anchorUserId = SAME_USER_AS ? rows.find((r) => String(r.id) === SAME_USER_AS)?.user_id : null;
  if (SAME_USER_AS && !anchorUserId) throw new Error(`Could not find anchor attempt ${SAME_USER_AS}`);
  const replayable = rows
    .map((r) => ({ ...r, events: (r.fj?.simulation?.events ?? []) as any[] }))
    .filter((r) => (SAME_USER_AS
      ? r.user_id === anchorUserId && !!cases.get(r.case_id)?.config?.evaluation_config
      : ATTEMPT_IDS.size === 0
      ? r.events.some((e: any) => e.type === 'HISTORY_TAKEN') && cases.get(r.case_id)?.config?.evaluation_config?.history
      : ATTEMPT_IDS.has(String(r.id)) && !!cases.get(r.case_id)?.config?.evaluation_config));
  console.log(`\n== ${replayable.length} real attempts selected (of ${rows.length}) ==`);
  console.log('date        questions  saved rev  saved /25  stored v2 (asked/of,cov,quality)  offline est.  ' + (AI ? 'replay /100  history  snapshot source                 ' : '') + 'case');
  const band = (n: number) => (n >= 20 ? 'strong' : n >= 8 ? 'middle' : 'low');
  const tally: Record<string, Record<string, number>> = { savedV1: {}, savedV2: {}, storedV2: {}, offline: {}, currentAI: {}, currentTotal: {} };
  const deltas: Array<{ id: string; caseId: string; saved: number; rescored: number; history: number; snapshot: string }> = [];
  let provisionalReplays = 0;
  for (const r of replayable) {
    const currentCase = cases.get(r.case_id)!;
    const { config: c, snapshot } = caseForAttempt(currentCase.config, currentCase.revision, r.fj, r.created_at);
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
      // Simulation cases use production replay/blending. Older consultation-only case shapes use the evaluator
      // directly; their historical bedside blend cannot be reconstructed from the current case schema.
      let result: any;
      let scoringPath = 'consultation-only';
      let bedside: any = null;
      if (isSimulationCase(c)) {
        const scored: any = await scoreClassicAttempt(c, r.events, Number(r.fj?.simulation?.timeTaken ?? 0));
        result = scored.result;
        bedside = scored.simulation?.bedside;
        scoringPath = bedside ? 'production + bedside blend' : 'production simulation';
      } else {
        const inputs = classicInputsFromEvents(r.events);
        result = await EvaluationEngine.evaluate(inputs.diagnosis, inputs.orderedTests, inputs.chatHistory, c);
      }
      const v2 = result.historyScoring?.v2;
      if (result.provisional) {
        provisionalReplays++;
        aiText = `PROVISIONAL          ${snapshot.padEnd(34)}`;
      } else if (v2) {
        aiText = `${String(result.score).padStart(5)} ${String(v2.total).padStart(6)} ${snapshot.padEnd(34)}`;
        tally.currentAI[band(v2.total)] = (tally.currentAI[band(v2.total)] ?? 0) + 1;
        tally.currentTotal[band(result.score)] = (tally.currentTotal[band(result.score)] ?? 0) + 1;
        if (Number.isFinite(Number(r.score)) && isSimulationCase(c)) {
          deltas.push({ id: String(r.id), caseId: r.case_id, saved: Number(r.score), rescored: Number(result.score), history: Number(v2.total), snapshot });
        }
        if (SHOW_ITEMS) {
          console.log(`      SAVED COMPONENTS: total ${r.score ?? 'pending'}, reasoning ${r.fj?.reasoningScore ?? '—'}, history ${r.fj?.historyScore ?? '—'}, diagnosis ${r.fj?.diagnosisScore ?? '—'}, tests ${r.fj?.testingScore ?? '—'}, management ${r.fj?.managementScore ?? '—'}, safety ${r.fj?.safetyPenalty ?? '—'}`);
          console.log(`      CURRENT COMPONENTS (${scoringPath}): total ${result.score}, reasoning ${result.reasoningScore}, history ${result.historyScore}, diagnosis ${result.diagnosisScore}, tests ${result.testingScore}, management ${result.managementScore}, safety ${result.safetyPenalty}`);
          if (r.fj?.simulation?.bedside || bedside) {
            console.log(`      LIVE BLEND: saved consultation ${r.fj?.simulation?.bedside?.consultationScore ?? '—'}, saved bedside ${r.fj?.simulation?.bedside?.score ?? '—'}; replay consultation ${bedside?.consultationScore ?? 'not reconstructable'}, replay bedside ${bedside?.score ?? 'not reconstructable'}`);
          }
          if (!isSimulationCase(c)) console.log('      NOTE: current total is consultation-only; no total-score delta is reported because this case lacks a replayable simulation schema.');
          for (const item of v2.items ?? []) {
            const status = item.covered ? `credited at Q${item.message} by ${item.by}` : `not credited (${item.by})`;
            console.log(`      CURRENT ITEM: ${item.required} — ${status}`);
          }
        }
      }
    }
    const savedKey = savedVersion === 'v2' ? 'savedV2' : 'savedV1';
    if (Number.isFinite(savedHistory)) tally[savedKey][band(savedHistory)] = (tally[savedKey][band(savedHistory)] ?? 0) + 1;
    if (Number.isFinite(storedV2)) tally.storedV2[band(storedV2)] = (tally.storedV2[band(storedV2)] ?? 0) + 1;
    tally.offline[band(offline.total)] = (tally.offline[band(offline.total)] ?? 0) + 1;
    console.log(
      `${String(r.created_at).slice(0, 10)}  ${String(questions.length).padStart(9)}  ${savedVersion.padStart(9)}  ${String(savedHistory).padStart(8)}  ${`${storedV2}/${storedV2Summary}`.padStart(27)}  ${String(offline.total).padStart(11)}  ${aiText}${r.case_id}`
    );
    if (SHOW || (SHOW_V2 && savedVersion === 'v2')) {
      if (SHOW_V2 && savedVersion === 'v2') console.log(`      ATTEMPT: ${r.id}`);
      questions.forEach((q: string, i: number) => console.log(`      Q${i + 1}: ${q.slice(0, 180)}`));
      if (SHOW_V2 && savedVersion === 'v2' && Array.isArray(storedV2Detail?.items)) {
        for (const item of storedV2Detail.items) {
          const status = item.covered ? `credited at Q${item.message} by ${item.by}` : `not credited (${item.by})`;
          console.log(`      ITEM: ${item.required} — ${status}`);
        }
      }
    }
  }
  console.log('\nbands (strong >= 20, middle 8-20, low < 8):');
  console.log('  saved history v1/legacy: ', JSON.stringify(tally.savedV1));
  console.log('  saved history v2:        ', JSON.stringify(tally.savedV2));
  console.log('  stored v2 history:        ', JSON.stringify(tally.storedV2));
  console.log('  offline estimate:         ', JSON.stringify(tally.offline));
  if (AI) console.log('  current AI estimate:      ', JSON.stringify(tally.currentAI));
  if (AI) {
    console.log('  current total score:      ', JSON.stringify(tally.currentTotal));
    console.log(`\nAI replay used ${GRADING_ENGINE_REVISION}; replayable simulation cases use the production scoring path. Comparisons are read-only; no database rows are updated.`);
    if (provisionalReplays) console.log(`  ${provisionalReplays} replay(s) remained provisional because the live examiner response was unavailable or invalid.`);
    console.log('Saved total -> current total comparisons:');
    for (const d of deltas) console.log(`  ${d.caseId} ${d.id}: ${d.saved} -> ${d.rescored} (history ${d.history}/25; ${d.snapshot})`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
