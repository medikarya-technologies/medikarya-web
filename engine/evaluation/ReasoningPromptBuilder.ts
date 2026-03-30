// =========================
// engine/evaluation/ReasoningPromptBuilder.ts
// =========================
// Layer 3: Builds a structured, token-efficient prompt for the LLM.
//
// Key rules:
//  - NO numeric history sub-score passed to LLM (prevents anchoring)
//  - Red flags passed with human-readable descriptions (not just slugs)
//  - Full transcript sent (guaranteed turns: first5 + last5 + intent-mapped)
//  - historyQualityScore only requested when needsLLMHistoryScore = true
//  - Constrained rubric with hard max_score ceiling

import { ExtractedConsultation, RedFlag, CoverageEntry } from "./types";

interface PromptOptions {
    /** Pre-extracted consultation data from IntentExtractor */
    extracted: ExtractedConsultation;
    /** Student's submitted primary diagnosis */
    diagnosis: string;
    /** Student's management plan */
    management: string[];
    /** Critical red flags from evaluation_config.red_flags */
    criticalRedFlags: RedFlag[];
    /** Coverage matrix from DeterministicScorer (gaps only passed, no score) */
    coverageGaps: CoverageEntry[];      // entries where covered === false
    /** Whether to request historyQualityScore from LLM */
    needsHistoryScore: boolean;
    /** Core management steps expected */
    coreManagementSteps: string[];
    /** Dangerous management steps to penalise */
    dangerousManagementSteps: string[];
    /** Full case metadata */
    caseData: any;
}

export class ReasoningPromptBuilder {
    static buildPrompt(options: PromptOptions): string {
        const {
            extracted,
            diagnosis,
            management,
            criticalRedFlags,
            coverageGaps,
            needsHistoryScore,
            coreManagementSteps,
            dangerousManagementSteps,
            caseData,
        } = options;

        const evalConfig = caseData.evaluation_config;
        const acceptedDx: string = evalConfig?.diagnosis?.accepted_primary?.join(", ")
            ?? caseData.patient?.final_diagnosis ?? "N/A";
        const keywords: string = evalConfig?.diagnosis?.must_include_keywords?.join(", ") ?? "";

        // ── Format coverage gaps (NO numeric score) ──────────────────────────
        const gapText = coverageGaps.length > 0
            ? coverageGaps.map(g => `- ${g.requiredQuestion}`).join("\n")
            : "None — all required history areas were covered.";

        // ── Format red flags WITH descriptions ───────────────────────────────
        const redFlagLines = criticalRedFlags
            .filter(f => f.present_in_case) // only flags the patient actually has
            .map(f => {
                // Human-readable description from the intent slug
                const desc = intentDescription(f.intent);
                return `  { "intent": "${f.intent}", "description": "${desc}" }`;
            })
            .join(",\n");

        // ── Format suspected ignored flags ───────────────────────────────────
        const ignoredFlagText = extracted.suspectedIgnoredFlags.length > 0
            ? `SUSPECTED IGNORED FLAGS (student asked, but may not have actioned):\n` +
              extracted.suspectedIgnoredFlags.map(f => `- ${f.replace(/_/g, " ")}`).join("\n")
            : "";

        // ── Management text ───────────────────────────────────────────────────
        const mgmtText = management.length > 0
            ? management.join(", ")
            : "None provided";

        // ── History quality rubric (only when needed) ─────────────────────────
        const historyRubricSection = needsHistoryScore ? `
HISTORY QUALITY SCORING (0–7.5):
Score ONLY the qualitative depth of history taking. Do NOT consider coverage — coverage is already scored separately.
Rubric:
  - relevance (0–2.5): Did questions target the chief complaint, or was it a generic checklist?
  - depth     (0–2.5): Were follow-up questions asked after the patient revealed key findings?
  - focus     (0–2.5): Did the student avoid redundant questioning on the same topic?
Hard ceiling: historyQualityScore MUST NOT exceed 7.5. Exceeding this is a grading error.` : `
HISTORY QUALITY SCORING: SKIP — output historyQualityScore: 0`;

        // ── Build JSON schema ─────────────────────────────────────────────────
        const jsonSchema = `{
  "reasoningScore":      <number 0–30>,
  "historyQualityScore": <number 0–7.5>,
  "diagnosisScore":      <number 0–15>,
  "managementScore":     <number 0–10>,
  "missedRedFlags":      [<intent slugs where student failed to address the flag semantically>],
  "feedback": {
    "strengths":    [<3–5 specific observations>],
    "improvements": [<3–5 specific, actionable suggestions>]
  }
}`;

        return `You are a senior clinical examiner evaluating a medical student's case simulation.

CASE:
Title:    ${caseData.title ?? "Unknown"}
Patient:  ${caseData.patient?.name}, ${caseData.patient?.age}y, ${caseData.patient?.gender}
Complaint: ${caseData.patient?.chiefComplaint}
Correct Diagnosis: ${caseData.patient?.final_diagnosis}

CONSULTATION TRANSCRIPT (Doctor ↔ Patient):
${extracted.transcript}

PRE-EXTRACTED SIGNALS:
Coverage gaps (history areas NOT addressed by the student):
${gapText}
${ignoredFlagText}

STUDENT PERFORMANCE:
Submitted Diagnosis: ${diagnosis || "Not provided"}
Management Plan: ${mgmtText}

SCORING GUIDE:

1. reasoningScore (0–30):
   Overall clinical reasoning quality. Did the student think systematically? Did they connect symptoms logically? Did they use findings to refine their differential?
   Penalise significantly if the student asked about something but completely ignored the patient's answer in their reasoning.

2. diagnosisScore (0–15):
   Accepted answers: ${acceptedDx}
   Must include keywords: ${keywords || "N/A"}

3. managementScore (0–10):
   Core expected steps: ${coreManagementSteps.join(", ") || "N/A"}
   Dangerous/incorrect steps to penalise: ${dangerousManagementSteps.join(", ") || "N/A"}

4. missedRedFlags:
   For each red flag below, assess whether the student semantically addressed it in the transcript.
   A question qualifies even if it uses lay language (e.g. "red colour in motion" counts for blood_in_stool).
   Return the intent slug ONLY for flags the student clearly never addressed.
   Red flags to assess:
[
${redFlagLines || "  (none with present_in_case = true)"}
]

${historyRubricSection}

OUTPUT:
Return STRICTLY valid JSON — no markdown, no extra text, no explanation:
${jsonSchema}`.trim();
    }
}

// ── Helper: human-readable descriptions for red flag intents ──────────────────

function intentDescription(intent: string): string {
    const descriptions: Record<string, string> = {
        blood_in_stool:       "Did the student ask about blood or bleeding in stool?",
        bilious_vomiting:     "Did the student ask about green or bile-coloured vomit?",
        severe_dehydration:   "Did the student ask about signs of severe dehydration (no urine, sunken eyes, dry mouth)?",
        altered_consciousness:"Did the student ask about altered consciousness, drowsiness, or seizures?",
        chest_pain:           "Did the student ask about chest pain or tightness?",
        syncope:              "Did the student ask about fainting or loss of consciousness?",
        focal_neurology:      "Did the student ask about focal neurological symptoms (weakness, vision loss)?",
        shortness_of_breath:  "Did the student ask about breathing difficulty or shortness of breath?",
        haemoptysis:          "Did the student ask about coughing up blood?",
        meningism:            "Did the student ask about neck stiffness or photophobia?",
    };
    return descriptions[intent] ?? `Did the student ask about ${intent.replace(/_/g, " ")}?`;
}
