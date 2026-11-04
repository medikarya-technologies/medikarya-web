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
import builtInStemi from "../data/cases/simulation/acute-anterior-stemi.json";

const APPLY = process.argv.includes("--apply");
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// The case as the site scores it (data/cases/index.ts, forEncounter), or the bundled one.
async function caseFor(id: string): Promise<any | null> {
    const { data } = await db.from("cases").select("case_json").eq("id", id).maybeSingle();
    if (data?.case_json) {
        const upgraded = upgradeLegacyCase({ ...(data.case_json as any), id }, { appearance: (appearanceOverlays as any)[id] });
        return isSimulationCase(upgraded) ? withLivePlan(upgraded, false) : upgraded;
    }
    return (builtInStemi as any).id === id ? builtInStemi : null;
}

(async () => {
    const { data: rows, error } = await db
        .from("case_attempts")
        .select("id, case_id, score, xp_earned, time_taken, feedback_json")
        .eq("feedback_json->>provisional", "true");
    if (error) throw error;
    console.log(`${rows?.length ?? 0} provisional attempt(s)${APPLY ? "" : " (dry run: add --apply to save)"}`);

    for (const row of rows ?? []) {
        const f = row.feedback_json as any;
        const events = f?.simulation?.events;
        const config = await caseFor(row.case_id);
        if (!Array.isArray(events) || !config || !isSimulationCase(config)) {
            console.log(`  ${row.id}: skipped (no event log or case)`);
            continue;
        }
        const timeTaken = row.time_taken ?? f.simulation?.timeTaken ?? 0;
        const scored = (config as any).scoring_mode === "classic"
            ? await scoreClassicAttempt(config as any, events, timeTaken).then(({ result, simulation, xpEarned }) => ({ result: { ...result, simulation }, xpEarned }))
            : await scoreRubricAttempt(config as any, events, timeTaken);
        if ((scored.result as any).provisional) {
            console.log(`  ${row.id}: the examiner is still unavailable; left for later`);
            continue;
        }
        const next = { ...scored.result, xpEarned: scored.xpEarned, caseId: f.caseId, caseTitle: f.caseTitle, timestamp: f.timestamp, rescoredAt: new Date().toISOString() };
        console.log(`  ${row.id} (${row.case_id}): ${row.score} -> ${scored.result.score}, XP ${row.xp_earned} -> ${scored.xpEarned}`);
        if (!APPLY) continue;
        const { error: e2 } = await db.from("case_attempts").update({ score: scored.result.score, xp_earned: scored.xpEarned, feedback_json: next }).eq("id", row.id);
        if (e2) throw e2;
    }
})().catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
});
