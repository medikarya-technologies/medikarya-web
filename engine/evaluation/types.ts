// =========================
// engine/evaluation/types.ts
// =========================

// ── IntentExtractor output ─────────────────────────────────────────────────

/** A single clinical intent mapped from a doctor's question, with confidence. */
export interface MappedIntent {
    intent: string;      // e.g. "past_gi_history", "blood_in_stool"
    confidence: number;  // 0.0–1.0
}

/** A single doctor question turn, fully enriched by IntentExtractor. */
export interface ExtractedQuestion {
    text: string;
    turnIndex: number;        // 0-indexed position in the full consultation
    specificityScore: number; // composite 0–10 (keyword depth + medical terms + structure)
    mappedIntents: MappedIntent[]; // multi-label, always present (empty = unresolved)
    intentSeen: boolean;      // true if any mapped intent has confidence > 0.5
    isRedundant: boolean;     // same primary intent was already credited earlier
}

/** Full structured output of Layer 1 — IntentExtractor. */
export interface ExtractedConsultation {
    turns: number;
    transcript: string;              // "Doctor: ...\nPatient: ..." full format
    doctorQuestions: ExtractedQuestion[];
    patientRevealedFacts: string[];  // key facts extracted from patient replies
    tokenCount: number;              // estimated tokens for budget decisions
    suspectedIgnoredFlags: string[]; // intents asked but not followed up / actioned
}

// ── Coverage Matrix (Layer 2 output) ─────────────────────────────────────────

export interface CoverageEntry {
    requiredQuestion: string;  // from evaluation_config.history.required_questions
    covered: boolean;
    turnIndex: number | null;  // which turn covered it (null if missed)
    specificityScore: number;  // of the covering question
    score: number;             // final per-question score contribution
}

export interface CoverageResult {
    matrix: CoverageEntry[];
    structuredHistoryScore: number;  // 0–17.5
    needsLLMHistoryScore: boolean;   // true if score is in borderline range 8–14
}

// ── Raw evaluation_config shape from case JSON ──────────────────────────────

export interface EvaluationConfigHistory {
    required_questions: string[];
    important_questions: string[];
    red_flag_questions: string[];
}

export interface EvaluationConfigTesting {
    testing_required: boolean;
    core_tests: string[];
    optional_tests: string[];
    distractor_tests: string[];
    dangerous_tests: string[];
}

export interface EvaluationConfigDiagnosis {
    accepted_primary: string[];
    must_include_keywords: string[];
}

/** Upgraded red flag — adds intent_patterns alongside legacy keywords. */
export interface RedFlag {
    intent: string;
    intent_patterns: string[];  // richer semantic patterns for rule engine
    keywords: string[];         // legacy exact-phrase matching (kept for compat)
    present_in_case: boolean;
    critical: boolean;
    justifies_tests?: string[];
}

export interface EvaluationConfigManagement {
    core_steps: string[];
    dangerous_steps: string[];
}

export interface EvaluationConfig {
    history: EvaluationConfigHistory;
    testing: EvaluationConfigTesting;
    diagnosis: EvaluationConfigDiagnosis;
    management: EvaluationConfigManagement;
    red_flags: RedFlag[];
}

// ── Deterministic scorer output ──────────────────────────────────────────────

export interface TestingBreakdown {
    coreMatched: number;
    optionalMatched: number;
    distractorMatched: number;
    dangerousMatched: number;
    missedCore: string[];
}

export interface DeterministicResult {
    testingScore: number;   // 0–20
    safetyPenalty: number;  // from dangerous tests only
    breakdown: TestingBreakdown;
}

// ── LLM reasoning output ─────────────────────────────────────────────────────

export interface LLMReasoningResult {
    reasoningScore: number;       // 0–30
    historyQualityScore: number;  // 0–7.5 (the 30% LLM slice of history)
    diagnosisScore: number;       // 0–15
    managementScore: number;      // 0–10
    missedRedFlags: string[];     // intent slugs the LLM thinks were not addressed
    feedback: {
        strengths: string[];
        improvements: string[];
    };
}

// ── Tiered red flag penalty ───────────────────────────────────────────────────

export type PenaltyLevel = "full" | "partial" | "none";

export interface RedFlagResolution {
    intent: string;
    penaltyLevel: PenaltyLevel;
    penaltyPoints: number;  // full=5, partial=2, none=0
    ruleEngineMissed: boolean;
    llmMissed: boolean;
}

// ── Final result returned to the UI ──────────────────────────────────────────

export interface FinalEvaluationResult {
    // top-level compat fields
    score: number;
    finalScore: number;
    isCorrect: boolean;
    studentDiagnosis: string;
    correctDiagnosis: string;

    // per-domain breakdown
    testingScore: number;
    reasoningScore: number;
    historyScore: number;          // structured (17.5) + quality (7.5)
    diagnosisScore: number;
    managementScore: number;
    safetyPenalty: number;         // total: dangerous tests + red flag penalties
    missedRedFlags: string[];      // final resolved intents that incurred penalty
    redFlagResolutions: RedFlagResolution[];  // full tiered breakdown for UI

    // feedback
    feedback: {
        strengths: string[];
        improvements: string[];
        testingEfficiency: {
            appropriateTests: number;
            unnecessaryTests: number;
            missedTests: string[];
        };
    };
}
