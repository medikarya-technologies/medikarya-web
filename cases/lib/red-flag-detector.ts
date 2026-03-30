// =========================
// cases/lib/red-flag-detector.ts
// =========================
// Three purposes (A/B/C) are exported separately:
//
//   A. Simulation  — hasRedFlagPresent(caseData)
//   B. Evaluation  — getRuleEngineMissedFlags(extracted, caseData) [UPGRADED]
//   C. Test class  — isTestJustifiedByRedFlag(testId, caseData, chatHistory)
//
// NEW in this version:
//   - Intent pattern matching (replaces raw keyword matching)
//   - Tiered penalty resolver: full / partial / none
//   - "Asked but ignored" detection forwarded from IntentExtractor

import { ExtractedConsultation, RedFlag, PenaltyLevel, RedFlagResolution } from "../../engine/evaluation/types";

// ── Type re-exported for callers ──────────────────────────────────────────────
export type { RedFlag };

// ── Helper: extract red_flags array from caseData safely ─────────────────────
function getRedFlags(caseData: any): RedFlag[] {
    return caseData?.evaluation_config?.red_flags ?? [];
}

// ── Helper: match a single message against a red flag using intent_patterns ───
// Intent patterns are richer than legacy keywords — they handle semantic variants.
function messageMatchesFlag(message: string, flag: RedFlag): boolean {
    const lower = message.toLowerCase();

    // 1. Try intent_patterns first (preferred — richer coverage)
    if (flag.intent_patterns && flag.intent_patterns.length > 0) {
        if (flag.intent_patterns.some(p => lower.includes(p.toLowerCase()))) {
            return true;
        }
    }

    // 2. Fallback to legacy keywords for backward compat
    if (flag.keywords && flag.keywords.length > 0) {
        if (flag.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
            return true;
        }
    }

    // 3. Try the intent slug itself as a phrase (e.g. "blood_in_stool" → "blood in stool")
    const intentPhrase = flag.intent.replace(/_/g, " ");
    return lower.includes(intentPhrase);
}

// ── Helper: match extracted questions against a flag ──────────────────────────
function extractedQuestionsMatchFlag(
    extracted: ExtractedConsultation,
    flag: RedFlag
): boolean {
    for (const q of extracted.doctorQuestions) {
        if (messageMatchesFlag(q.text, flag)) return true;
        // Also check mapped intents
        if (q.mappedIntents.some(i => i.intent === flag.intent && i.confidence >= 0.5)) {
            return true;
        }
    }
    return false;
}

// ── A. Simulation: does the case have any active red flag symptoms? ───────────
export function hasRedFlagPresent(caseData: any): boolean {
    return getRedFlags(caseData).some(f => f.present_in_case);
}

// ── B. Evaluation: which critical flags did the rule engine think were missed? ─
// Returns an array of intent slugs that the rule engine believes were not asked.
// This is ONE input to the tiered resolver — not the final answer.
export function getRuleEngineMissedFlags(
    extracted: ExtractedConsultation,
    caseData: any
): string[] {
    const flags = getRedFlags(caseData).filter(
        f => f.critical && f.present_in_case
    );

    return flags
        .filter(flag => !extractedQuestionsMatchFlag(extracted, flag))
        .map(f => f.intent);
}

// ── Tiered resolver: compute final red flag resolutions ──────────────────────
// Called after both rule engine and LLM have produced their missed flag lists.
//
//  Rule missed + LLM missed → FULL penalty (-5 pts)
//  Rule missed + LLM covered → PARTIAL penalty (-2 pts) [LLM may be generous]
//  Rule covered + LLM missed → PARTIAL penalty (-2 pts) [LLM hallucination guard]
//  Rule covered + LLM covered → NO penalty

const PENALTY_POINTS: Record<PenaltyLevel, number> = {
    full:    5,
    partial: 2,
    none:    0,
};

export function resolveRedFlagPenalties(
    llmMissed: string[],
    ruleMissed: string[],
    caseData: any
): RedFlagResolution[] {
    const flags = getRedFlags(caseData).filter(
        f => f.critical && f.present_in_case
    );

    const llmSet  = new Set(llmMissed);
    const ruleSet = new Set(ruleMissed);

    return flags.map(flag => {
        const ruleEngineMissed = ruleSet.has(flag.intent);
        const llmMissedFlag    = llmSet.has(flag.intent);

        let penaltyLevel: PenaltyLevel;
        if (ruleEngineMissed && llmMissedFlag)   penaltyLevel = "full";
        else if (ruleEngineMissed && !llmMissedFlag) penaltyLevel = "partial";
        else if (!ruleEngineMissed && llmMissedFlag) penaltyLevel = "partial";
        else penaltyLevel = "none";

        return {
            intent: flag.intent,
            penaltyLevel,
            penaltyPoints: PENALTY_POINTS[penaltyLevel],
            ruleEngineMissed,
            llmMissed: llmMissedFlag,
        };
    });
}

// ── Convenience: total penalty from resolutions ────────────────────────────────
export function totalRedFlagPenalty(resolutions: RedFlagResolution[]): number {
    return resolutions.reduce((sum, r) => sum + r.penaltyPoints, 0);
}

// ── Convenience: did the student ask about at least ONE red flag? ─────────────
export function studentAskedAboutRedFlag(
    chatHistory: { role: string; content: string }[],
    caseData: any
): boolean {
    const flags = getRedFlags(caseData);
    const studentMessages = chatHistory.filter(m => m.role === "user");

    return flags.some(flag =>
        studentMessages.some(msg =>
            messageMatchesFlag(String(msg.content ?? ""), flag)
        )
    );
}

// ── C. Test justification: is a test ID justified by a red flag being raised? ─
export function isTestJustifiedByRedFlag(
    testId: string,
    caseData: any,
    chatHistory: { role: string; content: string }[]
): boolean {
    const flags = getRedFlags(caseData);
    const studentMessages = chatHistory.filter(m => m.role === "user");

    return flags.some(
        flag =>
            flag.justifies_tests?.includes(testId) &&
            studentMessages.some(msg =>
                messageMatchesFlag(String(msg.content ?? ""), flag)
            )
    );
}

// ── Legacy compat: kept for any callers that still use the old function name ──
// Deprecated: use getRuleEngineMissedFlags() + resolveRedFlagPenalties() instead.
export function getUncheckedCriticalFlags(
    chatHistory: { role: string; content: string }[],
    caseData: any
): string[] {
    const flags = getRedFlags(caseData).filter(
        f => f.critical && f.present_in_case
    );
    const studentMessages = chatHistory.filter(m => m.role === "user");

    return flags
        .filter(flag =>
            !studentMessages.some(msg =>
                messageMatchesFlag(String(msg.content ?? ""), flag)
            )
        )
        .map(f => f.intent);
}
