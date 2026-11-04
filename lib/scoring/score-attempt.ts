// Scores one bedside attempt from its event log, without saving it: the part of app/actions/evaluate.ts that
// turns what the student did into a result. Kept out of that "use server" file so its exports are not callable
// from the browser, and so scripts/rescore-provisional.ts scores exactly as the site does.
//
// Relative imports only: the scripts load it through ts-node, which does not know the "@/" alias.

import { EvaluationEngine } from "../../engine/evaluationEngine";
import { computeAssistance, scoreEncounter } from "../../engine/evaluation/DualScorer";
import { collectTextChecks, judgeTextChecks } from "../../engine/evaluation/rubricJudge";
import type { SimulationCaseConfig } from "../simulation/case-schema";
import { replayStudentEvents } from "../simulation/replay";
import { classicInputsFromEvents } from "../simulation/classic-inputs";
import { countBudgetedActions, type ClinicalEvent } from "../simulation/encounter-events";
import { BEDSIDE_SHARE, blendLiveScore, isLivePlanCase, scoreBedside } from "../simulation/live-plan";

type Config = SimulationCaseConfig & Record<string, any>;

/**
 * A classic case run at the bedside. The Clinical score is the classic evaluator's, from the case's own
 * `evaluation_config`; the Independent score is that minus what the student spent on assists. The event log is
 * replayed first, so assist prices and the record of what the student did are the server's, not the client's.
 */
export async function scoreClassicAttempt(config: Config, events: unknown, timeTaken: number) {
    const replayed = replayStudentEvents(config, events);
    const log: readonly ClinicalEvent[] = replayed.events;
    const inputs = classicInputsFromEvents(log);
    const result = await EvaluationEngine.evaluate(inputs.diagnosis, inputs.orderedTests, inputs.chatHistory, config);

    // A live case (one running on a live plan) is also scored on what was done at the bedside and when: the
    // ordinary scoring knows nothing about the tray or the clock. The two are blended in fixed shares.
    const consultationScore = Math.round(result.score);
    const bedside = isLivePlanCase(config) ? scoreBedside(config, config.live_plan, log) : null;
    if (bedside) {
        result.score = blendLiveScore(consultationScore, bedside.score);
        result.finalScore = result.score;
    }

    const assistance = computeAssistance(log);
    const clinicalScore = Math.round(result.score);
    const independentScore = Math.min(100, Math.max(0, clinicalScore - assistance.total));

    const firstOrderedAt: Record<string, number> = {};
    for (const e of log) if (e.type === "TEST_ORDERED" && !(e.testId in firstOrderedAt)) firstOrderedAt[e.testId] = e.timestamp;

    const simulation = {
        version: 2,
        scoring: "classic" as const,
        clinicalScore,
        independentScore,
        assistanceCost: assistance.total,
        assistance: assistance.lines,
        // only in a live case: what the bedside scored, and what the score would have been without it
        ...(bedside ? { bedside: { ...bedside, share: BEDSIDE_SHARE, consultationScore } } : {}),
        milestones: {
            firstOrderedAt,
            budgetedActions: countBudgetedActions(log),
            endedAt: log.length > 0 ? log[log.length - 1].timestamp : 0,
        },
        events: log,
        timeTaken,
    };

    const xpEarned = Math.round((result.score / 100) * (config.xpReward || 50));
    return { result, simulation, xpEarned };
}

/**
 * A rubric case (the built-in trial case). What the student wrote is judged by the AI; if that fails the case's
 * phrases decide and the attempt is provisional (scripts/rescore-provisional.ts marks it again).
 */
export async function scoreRubricAttempt(config: Config, events: unknown, timeTaken: number) {
    const rubric = config.scoring_rubric;
    if (!rubric) throw new Error(`Case "${config.id}" has no scoring rubric`);

    const replayed = replayStudentEvents(config, events);
    const checks = collectTextChecks(config, replayed.events);
    const judgments = await judgeTextChecks(config, checks);
    const provisional = judgments === null && checks.length > 0;
    const scored = scoreEncounter(replayed.events, config, judgments ?? undefined);

    const baseXP = config.xpReward || 50;
    const xpEarned = Math.round((scored.clinicalScore / 100) * baseXP);

    const investigation = scored.items.filter((i) => i.domain === "investigation_accuracy");
    const result = {
        // Top-level fields the rest of the app already understands. The headline score is Clinical;
        // the Independent score rides along in `simulation`.
        score: scored.clinicalScore,
        finalScore: scored.clinicalScore,
        isCorrect: scored.diagnosis.isCorrect,
        studentDiagnosis: scored.diagnosis.studentDiagnosis,
        correctDiagnosis: scored.diagnosis.groundTruth,
        testingScore: Math.round((scored.domains.investigation_accuracy / 100) * 20),
        reasoningScore: Math.round((scored.domains.clinical_reasoning / 100) * 30),
        historyScore: 0,
        diagnosisScore: scored.diagnosis.isCorrect ? 15 : 0,
        managementScore: Math.round((scored.domains.management / 100) * 10),
        safetyPenalty:
            scored.safetyIssues.length * (rubric.safety_penalty_points ?? 15) +
            scored.penalties.reduce((s, p) => s + p.points, 0),
        missedRedFlags: [] as string[],
        redFlagResolutions: [] as unknown[],
        feedback: {
            strengths: scored.didWell,
            improvements: scored.missed.map((m) => m.text),
            testingEfficiency: {
                appropriateTests: investigation.filter((i) => i.credit >= 0.5).length,
                unnecessaryTests: scored.penalties.filter((p) => p.domain === "investigation_accuracy").length,
                missedTests: investigation.filter((i) => i.credit < 0.5 && i.critical).map((i) => i.label),
            },
        },
        simulation: {
            version: 1,
            ...scored,
            events: replayed.events,
            timeTaken,
            // The AI's verdicts, kept so the score can be explained and replayed exactly.
            ...(judgments ? { textJudgments: judgments } : {}),
        },
        ...(provisional ? { provisional: true } : {}),
    };
    return { result, xpEarned };
}
