// =========================
// engine/evaluation/DeterministicScorer.ts
// =========================
// Pure, deterministic scoring — no AI, fully testable.
//
// scoreTesting()  → 0–20 pts (test ordering, unchanged)
// scoreCoverage() → 0–17.5 pts (deterministic 70% of history score)
//
// LLM handles: reasoning, diagnosisScore, managementScore,
//              historyQualityScore (0–7.5 rubric, conditional 30%)

import {
    DeterministicResult,
    EvaluationConfig,
    ExtractedConsultation,
    CoverageResult,
    CoverageEntry,
} from "./types";

// ── History scoring constants ──────────────────────────────────────────────────
const HISTORY_MAX = 17.5;
const LLM_TRIGGER_LOW  = 8;   // below this → clear fail, skip LLM history call
const LLM_TRIGGER_HIGH = 14;  // above this → clear pass, skip LLM history call

/**
 * Compute timing weight based on when in the consultation the question was asked.
 * Only applied to history questions, not tests or diagnosis.
 */
function timingWeight(questionTurnIndex: number, totalQuestions: number): number {
    if (totalQuestions === 0) return 1.0;
    const position = questionTurnIndex / totalQuestions;
    if (position < 0.35) return 1.0;  // first third → full credit
    if (position < 0.65) return 0.7;  // middle third → partial credit
    return 0.4;                        // last third → late question penalty
}

/**
 * Normalise composite specificityScore (0–10) to a multiplier (0–1.3).
 * A specificityScore of 7.5+ gives the full 1.3× boost.
 */
function specificityMultiplier(score: number): number {
    return Math.min(1.3, score / 7.5);
}

/**
 * Check if a required question is covered by any of the doctor's extracted questions.
 * Match strategy: any mapped intent contains a word from the required question string.
 */
function findCoveringQuestion(
    requiredQuestion: string,
    extracted: ExtractedConsultation
): ExtractedConsultation["doctorQuestions"][0] | null {
    const reqWords = requiredQuestion
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3); // skip short words like "of", "the"

    // Specificity threshold: question must name at least the topic
    // Minimum specificity to count a question as clinically valid.
    // Score 0–0.5: catch-alls ("anything else?", "tell me more") → excluded
    // Score 1.0+:  topic-level questions ("any fever?", "hygiene issues?") → included
    // Score 3.0+:  precise clinical questions ("any bilious vomiting?") → full multiplier
    const SPECIFICITY_THRESHOLD = 1.0;

    for (const q of extracted.doctorQuestions) {
        if (q.specificityScore < SPECIFICITY_THRESHOLD) continue; // vague questions don't count
        if (!q.intentSeen) continue; // no mapped high-confidence intent

        const questionLower = q.text.toLowerCase();
        const intentNames = q.mappedIntents.map(i => i.intent.replace(/_/g, " "));

        // Check if question text or intent names overlap with required question words
        const overlaps = reqWords.some(word =>
            questionLower.includes(word) ||
            intentNames.some(name => name.includes(word))
        );

        if (overlaps) return q;
    }
    return null;
}

export class DeterministicScorer {
    /**
     * Score the student's test ordering against evaluation_config.testing.
     * Matches by test ID (exact, from a Set) — no fuzzy logic.
     *
     * Scoring breakdown (max 20):
     *   +8  per core test ordered
     *   −5  per core test missed
     *   +3  per optional test ordered
     *   −4  per distractor test ordered
     *   −10 per dangerous test ordered  (also added to safetyPenalty)
     *
     * evaluation_config.testing lists IDs (e.g. "cbc", "ctpa")
     * If testing_required === false and student ordered nothing → full 20 pts.
     * Final testingScore is clamped to [0, 20].
     */
    static scoreTesting(
        orderedTests: { id: string; name: string }[],
        evaluationConfig: EvaluationConfig
    ): DeterministicResult {
        const cfg = evaluationConfig.testing;

        const core = cfg.core_tests ?? [];
        const optional = cfg.optional_tests ?? [];
        const distractor = cfg.distractor_tests ?? [];
        const dangerous = cfg.dangerous_tests ?? [];

        // If testing not required, reward clinician restraint
        if (!cfg.testing_required) {
            if (orderedTests.length === 0) {
                return {
                    testingScore: 20,
                    safetyPenalty: 0,
                    breakdown: {
                        coreMatched: 0,
                        optionalMatched: 0,
                        distractorMatched: 0,
                        dangerousMatched: 0,
                        missedCore: [],
                    },
                };
            }
            // Penalise ordering tests when not needed
            return {
                testingScore: Math.max(0, 20 - orderedTests.length * 3),
                safetyPenalty: 0,
                breakdown: {
                    coreMatched: 0,
                    optionalMatched: 0,
                    distractorMatched: 0,
                    dangerousMatched: 0,
                    missedCore: [],
                },
            };
        }

        // Exact ID lookup — no fuzzy, no collisions
        const orderedIds = new Set(orderedTests.map((t) => t.id));

        let score = 0;
        let safetyPenalty = 0;

        let coreMatched = 0;
        let optionalMatched = 0;
        let distractorMatched = 0;
        let dangerousMatched = 0;
        const missedCore: string[] = [];

        // ── Core tests ──────────────────────────────────────────────────────────
        for (const id of core) {
            if (orderedIds.has(id)) {
                score += 8;
                coreMatched++;
            } else {
                score -= 5;
                missedCore.push(id);
            }
        }

        // ── Optional tests ───────────────────────────────────────────────────────
        for (const id of optional) {
            if (orderedIds.has(id)) {
                score += 3;
                optionalMatched++;
            }
        }

        // ── Distractor tests (unnecessary but not clinically dangerous) ──────────
        for (const id of distractor) {
            if (orderedIds.has(id)) {
                score -= 4;
                distractorMatched++;
            }
        }

        // ── Dangerous tests (radiation / clearly inappropriate) ──────────────────
        for (const id of dangerous) {
            if (orderedIds.has(id)) {
                score -= 10;
                safetyPenalty += 10;
                dangerousMatched++;
            }
        }

        console.log(
            `DeterministicScorer: core=${coreMatched}/${core.length}, optional=${optionalMatched}, ` +
            `distractor=${distractorMatched}, dangerous=${dangerousMatched}, rawScore=${score}`
        );

        return {
            testingScore: Math.max(0, Math.min(20, score)),
            safetyPenalty,
            breakdown: {
                coreMatched,
                optionalMatched,
                distractorMatched,
                dangerousMatched,
                missedCore,
            },
        };
    }

    /**
     * Score the student's history-taking against evaluation_config.history.required_questions.
     * Returns the deterministic 70% slice of the history score (0–17.5 pts).
     *
     * The remaining 30% (0–7.5) is scored by the LLM with a constrained rubric,
     * but ONLY when the structured score falls in the borderline range 8–14.
     *
     * Scoring per required question:
     *   perQuestionMax = 17.5 / requiredQuestions.length
     *   rawScore       = perQuestionMax × timingWeight × specificityMultiplier
     *   coveredScore   = min(rawScore, perQuestionMax)   ← per-question cap
     *   finalScore     = coveredScore × redundancyMultiplier (0.5 if repeated intent)
     */
    static scoreCoverage(
        extracted: ExtractedConsultation,
        evaluationConfig: EvaluationConfig
    ): CoverageResult {
        const requiredQuestions = evaluationConfig.history?.required_questions ?? [];
        const totalQuestions = extracted.doctorQuestions.length;

        if (requiredQuestions.length === 0) {
            // No required questions defined → full 17.5 by default
            console.warn("DeterministicScorer.scoreCoverage: No required_questions in evaluation_config.");
            return {
                matrix: [],
                structuredHistoryScore: HISTORY_MAX,
                needsLLMHistoryScore: false,
            };
        }

        const perQuestionMax = HISTORY_MAX / requiredQuestions.length;
        const matrix: CoverageEntry[] = [];
        let total = 0;

        for (const req of requiredQuestions) {
            const coveringQ = findCoveringQuestion(req, extracted);

            if (!coveringQ) {
                matrix.push({
                    requiredQuestion: req,
                    covered: false,
                    turnIndex: null,
                    specificityScore: 0,
                    score: 0,
                });
                continue;
            }

            const tw = timingWeight(coveringQ.turnIndex, totalQuestions);
            const sm = specificityMultiplier(coveringQ.specificityScore);
            const rawScore = perQuestionMax * tw * sm;

            // Cap: one question can't earn more than its fair share
            const coveredScore = Math.min(rawScore, perQuestionMax);

            // Redundancy: if same primary intent was already credited, halve the score
            const redundancyMult = coveringQ.isRedundant ? 0.5 : 1.0;
            const finalScore = coveredScore * redundancyMult;

            total += finalScore;

            matrix.push({
                requiredQuestion: req,
                covered: true,
                turnIndex: coveringQ.turnIndex,
                specificityScore: coveringQ.specificityScore,
                score: finalScore,
            });
        }

        const structuredHistoryScore = Math.min(HISTORY_MAX, Math.max(0, total));
        const needsLLMHistoryScore =
            structuredHistoryScore >= LLM_TRIGGER_LOW &&
            structuredHistoryScore <= LLM_TRIGGER_HIGH;

        const coveredCount = matrix.filter(e => e.covered).length;
        console.log(
            `DeterministicScorer.scoreCoverage: ${coveredCount}/${requiredQuestions.length} ` +
            `required questions covered, structuredScore=${structuredHistoryScore.toFixed(1)}, ` +
            `needsLLM=${needsLLMHistoryScore}`
        );

        return { matrix, structuredHistoryScore, needsLLMHistoryScore };
    }
}
