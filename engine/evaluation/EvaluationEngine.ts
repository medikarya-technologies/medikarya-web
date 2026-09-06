// =========================
// engine/evaluation/EvaluationEngine.ts
// =========================
// Orchestrates the 4-layer evaluation pipeline:
//
//   Layer 1: IntentExtractor        → structured signals from chat
//   Layer 2: DeterministicScorer    → testingScore + 70% historyScore
//   Layer 3: LLM (via ReasoningPromptBuilder) → reasoning, diagnosis,
//                                               management, historyQuality,
//                                               missedRedFlags (semantic)
//   Layer 4: Red Flag Resolver      → tiered penalty (full/partial/none)

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { IntentExtractor } from "./IntentExtractor";
import { DeterministicScorer } from "./DeterministicScorer";
import { ReasoningPromptBuilder } from "./ReasoningPromptBuilder";
import {
    FinalEvaluationResult,
    LLMReasoningResult,
    RedFlag,
} from "./types";
import {
    getRuleEngineMissedFlags,
    resolveRedFlagPenalties,
    totalRedFlagPenalty,
} from "../../cases/lib/red-flag-detector";

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

        // ── Layer 2b: History Coverage Score (deterministic, 70%) ────────────
        console.log("EvaluationEngine: Layer 2 — scoring history coverage...");
        const coverageResult = evalConfig
            ? DeterministicScorer.scoreCoverage(extracted, evalConfig)
            : { structuredHistoryScore: 10, needsLLMHistoryScore: true, matrix: [] };

        const coverageGaps = coverageResult.matrix.filter(e => !e.covered);

        // ── Layer 3: LLM Scoring ──────────────────────────────────────────────
        console.log(
            `EvaluationEngine: Layer 3 — calling LLM ` +
            `(needsHistoryScore=${coverageResult.needsLLMHistoryScore})...`
        );

        let llmResult: LLMReasoningResult;
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
                coverageGaps,
                needsHistoryScore: coverageResult.needsLLMHistoryScore,
                coreManagementSteps: evalConfig?.management?.core_steps ?? [],
                dangerousManagementSteps: evalConfig?.management?.dangerous_steps ?? [],
                caseData,
            });

            const result = await model.generateContent(
                `${systemPrompt}\n\nEvaluate this student's performance. Return a JSON object with keys: reasoningScore, historyQualityScore, diagnosisScore, managementScore, missedRedFlags (array), feedback (object with strengths and improvements arrays).`
            );

            const content = result.response.text();
            if (!content) throw new Error("Empty LLM response");

            const parsed = JSON.parse(content) as any;

            llmResult = {
                reasoningScore:      Math.min(30,  Math.max(0, Number(parsed.reasoningScore)      || 0)),
                historyQualityScore: Math.min(7.5, Math.max(0, Number(parsed.historyQualityScore) || 0)),
                diagnosisScore:      Math.min(15,  Math.max(0, Number(parsed.diagnosisScore)      || 0)),
                managementScore:     Math.min(10,  Math.max(0, Number(parsed.managementScore)     || 0)),
                missedRedFlags:      Array.isArray(parsed.missedRedFlags) ? parsed.missedRedFlags : [],
                feedback: {
                    strengths:    Array.isArray(parsed.feedback?.strengths)    ? parsed.feedback.strengths    : ["Good effort evaluating the case."],
                    improvements: Array.isArray(parsed.feedback?.improvements) ? parsed.feedback.improvements : ["Review the case discussion for key takeaways."],
                },
            };

            // If LLM history score wasn't needed, zero it out regardless of LLM response
            if (!coverageResult.needsLLMHistoryScore) {
                llmResult.historyQualityScore = 0;
            }

            console.log(
                `EvaluationEngine: LLM scores — reasoning=${llmResult.reasoningScore}, ` +
                `historyQuality=${llmResult.historyQualityScore}, ` +
                `diagnosis=${llmResult.diagnosisScore}, management=${llmResult.managementScore}, ` +
                `llmMissedFlags=${llmResult.missedRedFlags.join(", ") || "none"}`
            );
        } catch (err: any) {
            console.error("EvaluationEngine: LLM call failed, using fallback:", err.message);
            llmResult = {
                reasoningScore: 10,
                historyQualityScore: coverageResult.needsLLMHistoryScore ? 3 : 0,
                diagnosisScore: 5,
                managementScore: 0,
                missedRedFlags: [],
                feedback: {
                    strengths:    ["Evaluation could not be fully completed due to a connection error."],
                    improvements: ["Ensure a stable connection for complete AI evaluation of your reasoning."],
                },
            };
        }

        // ── Layer 4: Tiered Red Flag Resolution ───────────────────────────────
        console.log("EvaluationEngine: Layer 4 — resolving red flag penalties...");
        const ruleMissed = getRuleEngineMissedFlags(extracted, caseData);
        const redFlagResolutions = resolveRedFlagPenalties(
            llmResult.missedRedFlags,
            ruleMissed,
            caseData
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
        const historyScore = Math.round(
            Math.min(25, coverageResult.structuredHistoryScore + llmResult.historyQualityScore) * 10
        ) / 10;

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
        const keywords: string[] = evalConfig?.diagnosis?.must_include_keywords ?? [];

        const normalise = (s: string) => s.toLowerCase().trim();
        const isExactMatch = acceptedDx.some(dx => normalise(dx) === normalise(studentDx));
        const isKeywordMatch =
            keywords.length > 0 &&
            keywords.every(kw => normalise(studentDx).includes(normalise(kw)));
        const isCorrect = isExactMatch || isKeywordMatch;

        // ── Build UI-compatible testingEfficiency ─────────────────────────────
        const bd = deterministic.breakdown;
        const appropriateTests = bd.coreMatched + bd.optionalMatched;
        const unnecessaryTests = bd.distractorMatched + bd.dangerousMatched;

        return {
            score: finalScore,
            finalScore,
            isCorrect,
            studentDiagnosis: studentDx,
            correctDiagnosis: caseData.patient?.final_diagnosis ?? "",

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
