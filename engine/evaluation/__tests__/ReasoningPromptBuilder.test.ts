import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ReasoningPromptBuilder } from "../ReasoningPromptBuilder";

function promptFor(caseData: Record<string, unknown>): string {
    return ReasoningPromptBuilder.buildPrompt({
        extracted: {
            transcript: "Doctor: Any wee?\nPatient: Yes.",
            doctorQuestions: [{ text: "Any wee?" }],
            suspectedIgnoredFlags: [],
        } as any,
        diagnosis: "Hypertension",
        management: [],
        criticalRedFlags: [],
        coreManagementSteps: [],
        dangerousManagementSteps: [],
        caseData,
    });
}

describe("classic examiner prompt", () => {
    it("does not pass legacy diagnosis keywords to the grader", () => {
        const prompt = promptFor({
            title: "A case",
            evaluation_config: {
                diagnosis: {
                    accepted_primary: ["Hypertension"],
                    must_include_keywords: ["legacy_keyword_must_not_grade"],
                },
                history: { required_questions: ["urine output"] },
            },
        });
        assert.match(prompt, /Hypertension/);
        assert.doesNotMatch(prompt, /legacy_keyword_must_not_grade/);
    });

    it("always includes the history-quality rubric, even when a legacy caller says not to", () => {
        const prompt = ReasoningPromptBuilder.buildPrompt({
            extracted: {
                transcript: "",
                doctorQuestions: [],
                suspectedIgnoredFlags: [],
            } as any,
            diagnosis: "",
            management: [],
            criticalRedFlags: [],
            coreManagementSteps: [],
            dangerousManagementSteps: [],
            caseData: { evaluation_config: { history: { required_questions: ["fever"] } } },
            needsHistoryScore: false,
        });
        assert.match(prompt, /HISTORY QUALITY SCORING \(0-7\.5\), always/);
        assert.match(prompt, /"historyQualityScore": <number 0–7\.5>/);
    });
});
