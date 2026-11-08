// Re-scores the attempts that were saved as provisional because the AI examiner could not be reached
// (feedback_json.provisional). Scores each one again exactly as the site does (lib/scoring/score-attempt.ts) from
// its stored event log, and saves the new score, XP and feedback. Other attempts are never touched.
//
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/rescore-provisional.ts            list what would change
//   node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/rescore-provisional.ts --apply    save it
//
// An attempt whose re-score is still provisional (the AI is still down) is left as it is, to try again later.

import { createClient } from "@supabase/supabase-js";
import { upgradeLegacyCase } from "../lib/simulation/legacy-adapter";
import { isSimulationCase } from "../lib/simulation/case-schema";
import { withLivePlan } from "../lib/simulation/live-plan";
import { appearanceOverlays } from "../data/cases/simulation/appearance";
import { scoreClassicAttempt, scoreRubricAttempt } from "../lib/scoring/score-attempt";
import { GRADING_ENGINE_REVISION } from "../engine/evaluation/gradingVersion";
import builtInStemi from "../data/cases/simulation/acute-anterior-stemi.json";

const APPLY = process.argv.includes("--apply");
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// The case as the site scores it (data/cases/index.ts, forEncounter), with the database revision alongside it.
async function caseFor(id: string): Promise<{ config: any; revision: string | null } | null> {
    const { data } = await db.from("cases").select("case_json, updated_at").eq("id", id).maybeSingle();
    if (data?.case_json) {
        const upgraded = upgradeLegacyCase({ ...(data.case_json as any), id }, { appearance: (appearanceOverlays as any)[id] });
        const config = isSimulationCase(upgraded) ? withLivePlan(upgraded, false) : upgraded;
        config.caseRevisionUpdatedAt = data.updated_at ?? null;
        return { config, revision: data.updated_at ?? null };
    }
    return (builtInStemi as any).id === id ? { config: builtInStemi, revision: null } : null;
}

function withSavedScoringRules(config: any, audit: any): any {
    if (!audit || typeof audit !== "object") return config;
    const restored = { ...config };
    if (audit.scoringMode) restored.scoring_mode = audit.scoringMode;
    if (audit.evaluationConfig && typeof audit.evaluationConfig === "object") restored.evaluation_config = audit.evaluationConfig;
    if (audit.scoringRubric && typeof audit.scoringRubric === "object") restored.scoring_rubric = audit.scoringRubric;
    const rules = audit.simulationRules;
    if (rules && typeof rules === "object") {
        if (rules.initialState) restored.initial_state = rules.initialState;
        if (rules.eventRules) restored.event_rules = rules.eventRules;
        if (rules.actionConsequences) restored.action_consequences = rules.actionConsequences;
        if (rules.clinicalConstraints) restored.clinical_constraints = rules.clinicalConstraints;
        if (rules.livePlan) restored.live_plan = rules.livePlan;
    }
    if (audit.case && typeof audit.case === "object") {
        if (audit.case.title) restored.title = audit.case.title;
        if (audit.case.displayTitle) restored.displayTitle = audit.case.displayTitle;
        if (audit.case.diagnosis) restored.diagnosis = audit.case.diagnosis;
        if (audit.case.patient && typeof audit.case.patient === "object") {
            restored.patient = { ...restored.patient, ...audit.case.patient };
        }
    }
    restored.caseRevisionUpdatedAt = audit.caseRevisionUpdatedAt ?? null;
    return restored;
}

(async () => {
    const { data: rows, error } = await db
        .from("case_attempts")
        .select("id, case_id, score, xp_earned, time_taken, created_at, feedback_json")
        .eq("feedback_json->>provisional", "true");
    if (error) throw error;
    console.log(`${rows?.length ?? 0} provisional attempt(s)${APPLY ? "" : " (dry run: add --apply to save)"}`);

    for (const row of rows ?? []) {
        const f = row.feedback_json as any;
        const events = f?.simulation?.events;
        const current = await caseFor(row.case_id);
        if (!Array.isArray(events) || !current || !isSimulationCase(current.config)) {
            console.log(`  ${row.id}: skipped (no event log or case)`);
            continue;
        }
        const audit = f?.gradingAudit;
        const hasCaseRevision = typeof audit?.caseRevisionUpdatedAt === "string" && audit.caseRevisionUpdatedAt.length > 0;
        const revisionMatches = hasCaseRevision && current.revision === audit.caseRevisionUpdatedAt;
        const config = withSavedScoringRules(current.config, audit);
        if (!revisionMatches) {
            const reason = hasCaseRevision ? "case changed since this attempt" : "no saved case revision";
            if (APPLY) {
                console.log(`  ${row.id}: skipped (cannot safely apply: ${reason}; dry-run comparison may use current rules)`);
                continue;
            }
            console.log(`  ${row.id}: preview only (${reason})`);
        }
        const timeTaken = row.time_taken ?? f.simulation?.timeTaken ?? 0;
        const scored = (config as any).scoring_mode === "classic"
            ? await scoreClassicAttempt(config as any, events, timeTaken).then(({ result, simulation, xpEarned }) => ({ result: { ...result, simulation }, xpEarned }))
            : await scoreRubricAttempt(config as any, events, timeTaken);
        if ((scored.result as any).provisional) {
            console.log(`  ${row.id}: the examiner is still unavailable; left for later`);
            continue;
        }
        const rescoredAt = new Date().toISOString();
        const next = {
            ...scored.result,
            xpEarned: scored.xpEarned,
            caseId: f.caseId,
            caseTitle: f.caseTitle,
            timestamp: f.timestamp,
            gradingAudit: audit,
            rescoreAudit: {
                engineRevision: GRADING_ENGINE_REVISION,
                previousScore: row.score,
                previousXp: row.xp_earned,
                previousCaseRevision: audit?.caseRevisionUpdatedAt ?? null,
                currentCaseRevision: current.revision,
                rescoredAt,
            },
            rescoredAt,
        };
        console.log(`  ${row.id} (${row.case_id}): ${row.score ?? "pending"} -> ${scored.result.score}, XP ${row.xp_earned ?? 0} -> ${scored.xpEarned}`);
        if (!APPLY) continue;
        const { error: e2 } = await db.from("case_attempts").update({ score: scored.result.score, xp_earned: scored.xpEarned, feedback_json: next }).eq("id", row.id);
        if (e2) throw e2;
    }
})().catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
});
