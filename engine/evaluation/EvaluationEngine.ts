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
import { historyReview, historyScoringMode, scoreHistory, type HistoryV2 } from "./historyCoverage";
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
        // Two versions (EVALUATION_ENGINE.md, "History, version 2"). Version 1 is worked out here as before; version
        // 2 needs the examiner's coverage answer, so it is worked out after Layer 3. HISTORY_SCORING decides which
        // one the student sees: version 2 by default; "v1" is the way back, "shadow" shows version 1 and stores both.
        const historyMode = historyScoringMode(process.env.HISTORY_SCORING);
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
            aiHistoryCoverage = parsed.historyCoverage;
            aiHistoryQuality = parsed.historyQualityScore;

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

            // Version 1 used the quality score only in its 8-14 band (version 2 always uses it).
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
            aiOk = false;
            const dxOk = diagnosisMatches(primaryDiagnosis, evalConfig?.diagnosis?.accepted_primary ?? [], evalConfig?.diagnosis?.must_include_keywords ?? []);
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
        const historyV1 = Math.round(
            Math.min(25, coverageResult.structuredHistoryScore + llmResult.historyQualityScore) * 10
        ) / 10;
        const historyV2: HistoryV2 = scoreHistory({
            required: evalConfig?.history?.required_questions ?? [],
            questions: extracted.doctorQuestions.map(q => q.text),
            aiCoverage: aiHistoryCoverage,
            aiQuality: aiHistoryQuality,
        });
        const historyScore = historyMode === "v2" ? historyV2.total : historyV1;
        console.log(
            `EvaluationEngine: history v1=${historyV1}, v2=${historyV2.total} ` +
            `(asked ${historyV2.asked}/${historyV2.of} by ${historyV2.coverageBy}, quality ${historyV2.quality} by ${historyV2.qualityBy}), ` +
            `showing ${historyMode === "v2" ? "v2" : "v1"}`
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
        const keywords: string[] = evalConfig?.diagnosis?.must_include_keywords ?? [];

        // The examiner reads the answer the way a clinician would (typos, word order, abbreviations), so its mark
        // decides: 12 of 15 or more is correct. An exact accepted wording always counts. Only without the examiner
        // do the keywords decide.
        const isCorrect = aiOk
            ? llmResult.diagnosisScore >= DIAGNOSIS_CORRECT_FROM || diagnosisMatches(studentDx, acceptedDx, [])
            : diagnosisMatches(studentDx, acceptedDx, keywords);

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
            scoringVersion: { history: historyMode === "v2" ? 2 : 1, diagnosis: 2 },
            // Scored without the examiner (the AI call failed): re-scored later by scripts/rescore-provisional.ts.
            ...(aiOk ? {} : { provisional: true }),
            // Both versions, always: the comparison behind the switch, and the way back if it is ever switched off.
            historyScoring: { mode: historyMode, v1: historyV1, v2: historyV2 },
            // What the debrief lists ("You did not ask about: ..."), from the version the student sees. Version 1's
            // list was often wrong, so it is only given with version 2.
            ...(historyMode === "v2" ? { historyReview: historyReview(historyV2) } : {}),

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
