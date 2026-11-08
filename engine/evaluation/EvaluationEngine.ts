// =========================
// engine/evaluation/EvaluationEngine.ts
// =========================
// Orchestrates the evaluation pipeline:
//
//   1. IntentExtractor              → structured signals from chat
//   2. DeterministicScorer           → structured investigation and safety marks
//   3. AI examiner                   → reasoning, history, diagnosis, management and red flags
//   4. Red Flag Resolver             → penalty from the examiner's clinical verdict

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { IntentExtractor } from "./IntentExtractor";
import { DeterministicScorer } from "./DeterministicScorer";
import { ReasoningPromptBuilder } from "./ReasoningPromptBuilder";
import { hasCompleteAiCoverage, historyReview, historyScoringMode, scoreHistory, type HistoryV2 } from "./historyCoverage";
import { DIAGNOSIS_CORRECT_FROM, diagnosisMatches } from "./diagnosisMatch";
import {
    FinalEvaluationResult,
    LLMReasoningResult,
    RedFlag,
} from "./types";
import {
    getRuleEngineMissedFlags,
    resolveRedFlagPenalties,
    totalRedFlagPenalty,
} from "./red-flag-detector";

function requiredScore(value: unknown, label: string, max: number): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
        throw new Error(`Examiner returned an invalid ${label}`);
    }
    return value;
}

export class EvaluationEngine {
    static async evaluate(
        diagnosis: any,
        orderedTests: any[],
        chatHistory: any[],
        caseData: any
    ): Promise<FinalEvaluationResult> {
        console.log("EvaluationEngine: Starting 4-layer evaluation for:", caseData.patient?.name);

        const evalConfig = caseData.evaluation_config;

        // ── Normalise inputs ──────────────────────────────────────────────────
        const orderedTestItems: { id: string; name: string }[] = orderedTests.map(t => ({
            id: String(t.id ?? t.name ?? ""),
            name: String(t.name ?? ""),
        }));

        const management: string[] = Array.isArray(diagnosis.managementPlan)
            ? diagnosis.managementPlan
            : diagnosis.managementPlan
                ? [String(diagnosis.managementPlan)]
                : [];

        const primaryDiagnosis = diagnosis.primaryDiagnosis ?? "Not provided";

        // ── Get critical red flags from case ─────────────────────────────────
        const criticalRedFlags: RedFlag[] = (evalConfig?.red_flags ?? []).filter(
            (f: RedFlag) => f.critical && f.present_in_case
        );
        const criticalIntents = criticalRedFlags.map((f: RedFlag) => f.intent);

        // ── Layer 1: Intent Extraction ────────────────────────────────────────
        console.log("EvaluationEngine: Layer 1 — extracting intents...");
        const extracted = IntentExtractor.extract(chatHistory, criticalIntents);

        // ── Layer 2a: Test Ordering Score (deterministic, unchanged) ──────────
        let deterministic;
        if (evalConfig?.testing) {
            deterministic = DeterministicScorer.scoreTesting(orderedTestItems, evalConfig);
            console.log(
                `EvaluationEngine: testingScore=${deterministic.testingScore}, ` +
                `safetyPenalty=${deterministic.safetyPenalty}`
            );
        } else {
            console.warn("EvaluationEngine: No evaluation_config.testing — using fallback");
            deterministic = {
                testingScore: 10,
                safetyPenalty: 0,
                breakdown: {
                    coreMatched: 0, optionalMatched: 0,
                    distractorMatched: 0, dangerousMatched: 0,
                    missedCore: [],
                },
            };
        }

        // ── Layer 2b: History ─────────────────────────────────────────────────
        // Keep the retired rule-based score for comparison in the audit, but never let a deployment setting select
        // it for a student's mark. New attempts always use the AI-semantic v2 score.
        const historyMode = historyScoringMode();
        console.log(`EvaluationEngine: Layer 2 — scoring history coverage (mode ${historyMode})...`);
        const coverageResult = evalConfig
            ? DeterministicScorer.scoreCoverage(extracted, evalConfig)
            : { structuredHistoryScore: 10, needsLLMHistoryScore: true, matrix: [] };


        // ── Layer 3: LLM Scoring ──────────────────────────────────────────────
        console.log(
            `EvaluationEngine: Layer 3 — calling LLM ` +
            `(needsHistoryScore=${coverageResult.needsLLMHistoryScore})...`
        );

        let llmResult: LLMReasoningResult;
        // False when the examiner call failed: the attempt is then scored by the deterministic checks alone and saved
        // as provisional, so scripts/rescore-provisional.ts can mark it properly once the AI is back.
        let aiOk = true;
        // The examiner's raw history answers, for version 2 (checked there, not trusted). Undefined if the call failed.
        let aiHistoryCoverage: unknown = undefined;
        let aiHistoryQuality: unknown = undefined;
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-3.8-flash",
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json",
                },
            });

            const systemPrompt = ReasoningPromptBuilder.buildPrompt({
                extracted,
                diagnosis: primaryDiagnosis,
                management,
                criticalRedFlags,
                coreManagementSteps: evalConfig?.management?.core_steps ?? [],
                dangerousManagementSteps: evalConfig?.management?.dangerous_steps ?? [],
                caseData,
            });

            const result = await model.generateContent(
                `${systemPrompt}\n\nEvaluate this student's performance. Return a JSON object with keys: reasoningScore, historyQualityScore, historyCoverage (array, one entry per required history item), diagnosisScore, managementScore, missedRedFlags (array), feedback (object with strengths and improvements arrays).`
            );

            const content = result.response.text();
            if (!content) throw new Error("Empty LLM response");

            const parsed = JSON.parse(content) as any;
            const requiredQuestions: string[] = evalConfig?.history?.required_questions ?? [];
            if (!Array.isArray(parsed.historyCoverage) || !hasCompleteAiCoverage(
                parsed.historyCoverage,
                requiredQuestions.length,
                extracted.doctorQuestions.map((q) => q.text)
            )) throw new Error("Examiner returned incomplete history coverage");
            if (!Array.isArray(parsed.missedRedFlags) || parsed.missedRedFlags.some((flag: unknown) => typeof flag !== "string")) {
                throw new Error("Examiner returned invalid red-flag results");
            }
            aiHistoryCoverage = parsed.historyCoverage;
            aiHistoryQuality = parsed.historyQualityScore;

            llmResult = {
                reasoningScore:      requiredScore(parsed.reasoningScore, "reasoning score", 30),
                historyQualityScore: requiredScore(parsed.historyQualityScore, "history quality score", 7.5),
                diagnosisScore:      requiredScore(parsed.diagnosisScore, "diagnosis score", 15),
                managementScore:     requiredScore(parsed.managementScore, "management score", 10),
                missedRedFlags:      parsed.missedRedFlags,
                feedback: {
                    strengths:    Array.isArray(parsed.feedback?.strengths)    ? parsed.feedback.strengths    : ["Good effort evaluating the case."],
                    improvements: Array.isArray(parsed.feedback?.improvements) ? parsed.feedback.improvements : ["Review the case discussion for key takeaways."],
                },
            };

            console.log(
                `EvaluationEngine: LLM scores — reasoning=${llmResult.reasoningScore}, ` +
                `historyQuality=${llmResult.historyQualityScore}, ` +
                `diagnosis=${llmResult.diagnosisScore}, management=${llmResult.managementScore}, ` +
                `llmMissedFlags=${llmResult.missedRedFlags.join(", ") || "none"}`
            );
        } catch (err: any) {
            console.error("EvaluationEngine: LLM call failed, using fallback:", err.message);
            aiOk = false;
            const dxOk = diagnosisMatches(primaryDiagnosis, evalConfig?.diagnosis?.accepted_primary ?? [], []);
            llmResult = {
                reasoningScore: 10,
                historyQualityScore: coverageResult.needsLLMHistoryScore ? 3 : 0,
                diagnosisScore: dxOk ? 15 : 0,
                managementScore: 0,
                missedRedFlags: [],
                feedback: {
                    strengths:    ["Your attempt is saved. The examiner could not be reached, so this score is provisional."],
                    improvements: ["Your reasoning and plan will be marked again shortly, and your score updated."],
                },
            };
        }

        // A case-authored answer (or a one-letter slip in one long word) must not
        // be scored below the correct-diagnosis threshold when the examiner misses it.
        if (aiOk && diagnosisMatches(primaryDiagnosis, evalConfig?.diagnosis?.accepted_primary ?? [], [])) {
            llmResult.diagnosisScore = Math.max(llmResult.diagnosisScore, DIAGNOSIS_CORRECT_FROM);
        }

        // ── Layer 4: Tiered Red Flag Resolution ───────────────────────────────
        console.log("EvaluationEngine: Layer 4 — resolving red flag penalties...");
        const ruleMissed = getRuleEngineMissedFlags(extracted, caseData);
        const redFlagResolutions = resolveRedFlagPenalties(
            llmResult.missedRedFlags,
            ruleMissed,
            caseData,
            aiOk
        );
        const redFlagPenalty = totalRedFlagPenalty(redFlagResolutions);

        const penaltiedFlags = redFlagResolutions
            .filter(r => r.penaltyLevel !== "none")
            .map(r => `${r.intent}(${r.penaltyLevel},-${r.penaltyPoints})`);

        console.log(
            `EvaluationEngine: redFlagPenalty=${redFlagPenalty}, ` +
            `resolutions=${penaltiedFlags.join(", ") || "none"}`
        );

        // ── Aggregate scores ──────────────────────────────────────────────────
        // Round to avoid floating-point display artifacts (e.g. 7.6999999999)
        // Retain the old score as a comparison only. Its quality marks were deliberately conditional on the old
        // 8–14 coverage band; the student's v2 score below always uses the examiner's quality judgement.
        const historyV1Quality = coverageResult.needsLLMHistoryScore ? llmResult.historyQualityScore : 0;
        const historyV1 = Math.round(
            Math.min(25, coverageResult.structuredHistoryScore + historyV1Quality) * 10
        ) / 10;
        const historyV2: HistoryV2 = scoreHistory({
            required: evalConfig?.history?.required_questions ?? [],
            questions: extracted.doctorQuestions.map(q => q.text),
            aiCoverage: aiHistoryCoverage,
            aiQuality: aiHistoryQuality,
        });
        const historyScore = historyV2.total;
        console.log(
            `EvaluationEngine: history v1=${historyV1}, v2=${historyV2.total} ` +
            `(asked ${historyV2.asked}/${historyV2.of} by ${historyV2.coverageBy}, quality ${historyV2.quality} by ${historyV2.qualityBy}), ` +
            `showing ${historyMode}`
        );

        const baseScore =
            llmResult.reasoningScore +
            historyScore +
            llmResult.diagnosisScore +
            deterministic.testingScore +
            llmResult.managementScore;

        const totalPenalty = deterministic.safetyPenalty + redFlagPenalty;
        // Integer final score — Supabase column is integer type
        const finalScore = Math.round(Math.max(0, Math.min(100, baseScore - totalPenalty)));

        console.log(
            `EvaluationEngine: base=${baseScore.toFixed(1)}, ` +
            `history=${historyScore.toFixed(1)} (structured=${coverageResult.structuredHistoryScore.toFixed(1)} ` +
            `+ quality=${llmResult.historyQualityScore.toFixed(1)}), ` +
            `testPenalty=${deterministic.safetyPenalty}, redFlagPenalty=${redFlagPenalty}, ` +
            `final=${finalScore}`
        );

        // ── Determine isCorrect ───────────────────────────────────────────────
        const studentDx = primaryDiagnosis;
        const acceptedDx: string[] = evalConfig?.diagnosis?.accepted_primary ?? [];
        // The examiner reads the answer the way a clinician would (typos, word order, abbreviations), so its mark
        // decides: 12 of 15 or more is correct. An exact accepted wording is a safety net; configured keywords do
        // not affect diagnosis marks, even when the examiner is unavailable.
        const isCorrect = aiOk
            ? llmResult.diagnosisScore >= DIAGNOSIS_CORRECT_FROM || diagnosisMatches(studentDx, acceptedDx, [])
            : diagnosisMatches(studentDx, acceptedDx, []);

        // ── Build UI-compatible testingEfficiency ─────────────────────────────
        const bd = deterministic.breakdown;
        const appropriateTests = bd.coreMatched + bd.optionalMatched;
        const unnecessaryTests = bd.distractorMatched + bd.dangerousMatched;

        return {
            score: finalScore,
            finalScore,
            isCorrect,
            studentDiagnosis: studentDx,
            correctDiagnosis: caseData.patient?.final_diagnosis 
                || caseData.evaluation_config?.diagnosis?.accepted_primary?.[0]
                || caseData.diagnosis
                || caseData.displayTitle
                || caseData.title
                || "Clinical Diagnosis",

            testingScore:    deterministic.testingScore,
            reasoningScore:  llmResult.reasoningScore,
            historyScore,
            diagnosisScore:  llmResult.diagnosisScore,
            managementScore: llmResult.managementScore,
            safetyPenalty:   totalPenalty,
            missedRedFlags:  redFlagResolutions
                .filter(r => r.penaltyLevel !== "none")
                .map(r => r.intent),
            redFlagResolutions,

            // Which history scorer marked this attempt, so trends, skills and workshop ranks never mix the two silently.
            scoringVersion: { history: 2, diagnosis: 2 },
            // Scored without the examiner (the AI call failed): re-scored later by scripts/rescore-provisional.ts.
            ...(aiOk ? {} : { provisional: true }),
            // Keep the legacy heuristic only for internal comparison; it never contributes to the student's score.
            historyScoring: { mode: historyMode, v1: historyV1, v2: historyV2 },
            // What the debrief lists ("You did not ask about: ..."), from the version the student sees. Version 1's
            // list was often wrong, so it is derived only from version 2.
            historyReview: historyReview(historyV2),

            feedback: {
                strengths:    llmResult.feedback.strengths,
                improvements: llmResult.feedback.improvements,
                testingEfficiency: {
                    appropriateTests,
                    unnecessaryTests,
                    missedTests: bd.missedCore,
                },
            },
        };
    }
}
