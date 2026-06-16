// =========================
// engine/evaluation/QuizGenerator.ts
// =========================
// Three-stage pipeline for generating personalized NEET PG-style MCQs:
//
//   Stage 1: Extract weakness signals from FinalEvaluationResult (deterministic)
//   Stage 2: Cluster weaknesses into knowledge gaps via KNOWLEDGE_GAP_MAP (deterministic)
//   Stage 3: Generate difficulty-progressive MCQs via LLM (Groq)
//
// Key design decisions:
//   - Clustering is deterministic (not LLM) for predictability and analytics
//   - Question count per gap is proportional to gap priority (adaptive allocation)
//   - Difficulty follows a fixed ladder: recall → application → vignette → trap → integration
//   - Student's actual mistakes are fed to LLM for use as distractors

import { Groq } from "groq-sdk";
import { FinalEvaluationResult } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeaknessSignal {
    type: 'missed-red-flag' | 'wrong-diagnosis' | 'missed-test' | 'low-management'
        | 'low-history' | 'low-reasoning' | 'unnecessary-tests';
    detail: string;
    weight: number;
}

export interface KnowledgeGap {
    concept: string;
    relatedWeaknesses: string[];
    priority: number;
    questionCount: number;
}

export interface GeneratedMCQ {
    id: string;
    stem: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    category: string;
    difficulty: 'recall' | 'application' | 'vignette' | 'trap' | 'integration';
    weaknessLink: string;
    knowledgeGap: string;
}

export interface QuizGenerationResult {
    questions: GeneratedMCQ[];
    knowledgeGaps: KnowledgeGap[];
}

// ── Deterministic Knowledge Gap Map ──────────────────────────────────────────
// Maps raw weakness signals (red flag intents, test IDs, etc.) to stable
// knowledge gap concept names. Using stable names is critical for:
//   1. Analytics (consistent across attempts)
//   2. Spaced repetition (same gap name matches across cases)
//   3. Predictable question clustering

const KNOWLEDGE_GAP_MAP: Record<string, string> = {
    // ── Dehydration cluster ──
    severe_dehydration: "Pediatric dehydration assessment and management",
    dehydration: "Pediatric dehydration assessment and management",
    dehydration_signs: "Pediatric dehydration assessment and management",
    serum_electrolytes: "Pediatric dehydration assessment and management",
    urine_output: "Pediatric dehydration assessment and management",
    oral_rehydration: "Pediatric dehydration assessment and management",
    iv_fluids: "Pediatric dehydration assessment and management",
    fluid_management: "Pediatric dehydration assessment and management",

    // ── GI cluster ──
    blood_in_stool: "GI bleeding evaluation and management",
    haematochezia: "GI bleeding evaluation and management",
    melaena: "GI bleeding evaluation and management",
    bilious_vomiting: "Bilious vomiting and intestinal obstruction",
    stool_culture: "Infectious diarrhea workup",
    stool_examination: "Infectious diarrhea workup",
    stool_microscopy: "Infectious diarrhea workup",

    // ── Hematology cluster ──
    cbc: "Basic hematological workup",
    fbc: "Basic hematological workup",
    complete_blood_count: "Basic hematological workup",
    peripheral_smear: "Basic hematological workup",
    iron_studies: "Iron deficiency anemia evaluation",
    serum_ferritin: "Iron deficiency anemia evaluation",
    serum_iron: "Iron deficiency anemia evaluation",
    tibc: "Iron deficiency anemia evaluation",
    hemoglobin: "Iron deficiency anemia evaluation",
    reticulocyte_count: "Iron deficiency anemia evaluation",

    // ── Neurological cluster ──
    altered_consciousness: "Neurological emergency recognition",
    seizure: "Neurological emergency recognition",
    focal_neurology: "Neurological emergency recognition",
    glasgow_coma_scale: "Neurological emergency recognition",
    meningism: "Meningeal signs and CNS infection",
    neck_stiffness: "Meningeal signs and CNS infection",
    photophobia: "Meningeal signs and CNS infection",
    lumbar_puncture: "Meningeal signs and CNS infection",
    ct_head: "Neurological emergency recognition",
    mri_brain: "Neurological emergency recognition",
    visual_aura: "Migraine and headache disorders",
    headache: "Migraine and headache disorders",
    migraine: "Migraine and headache disorders",

    // ── Cardiac cluster ──
    chest_pain: "Cardiac emergency evaluation",
    syncope: "Cardiac emergency evaluation",
    ecg: "Cardiac emergency evaluation",
    troponin: "Cardiac emergency evaluation",
    palpitation: "Cardiac emergency evaluation",

    // ── Respiratory cluster ──
    shortness_of_breath: "Respiratory distress assessment",
    haemoptysis: "Respiratory distress assessment",
    dyspnea: "Respiratory distress assessment",
    chest_xray: "Respiratory distress assessment",
    spo2: "Respiratory distress assessment",
    abg: "Respiratory distress assessment",

    // ── Infection / Sepsis cluster ──
    blood_culture: "Sepsis workup and management",
    procalcitonin: "Sepsis workup and management",
    crp: "Inflammatory markers interpretation",

    // ── Renal cluster ──
    urine_analysis: "Renal function assessment",
    serum_creatinine: "Renal function assessment",
    bun: "Renal function assessment",
    renal_function_test: "Renal function assessment",

    // ── Imaging cluster ──
    ct_abdomen: "Abdominal imaging indications",
    usg_abdomen: "Abdominal imaging indications",
    xray_abdomen: "Abdominal imaging indications",
    mri: "Advanced imaging indications",

    // ── Liver cluster ──
    lft: "Liver function assessment",
    liver_function_test: "Liver function assessment",
    bilirubin: "Neonatal jaundice evaluation",
    serum_bilirubin: "Neonatal jaundice evaluation",
    direct_bilirubin: "Neonatal jaundice evaluation",
    indirect_bilirubin: "Neonatal jaundice evaluation",
    coomb_test: "Neonatal jaundice evaluation",
    g6pd: "Neonatal jaundice evaluation",

    // ── Thyroid cluster ──
    tsh: "Thyroid function assessment",
    thyroid_function_test: "Thyroid function assessment",
    t3_t4: "Thyroid function assessment",

    // ── Generic clinical domains (fallback for score-based signals) ──
    low_management: "Clinical management principles",
    low_history: "Systematic clinical history taking",
    low_reasoning: "Clinical reasoning and differential diagnosis",
    wrong_diagnosis: "Diagnostic accuracy and differential diagnosis",
    unnecessary_tests: "Investigation appropriateness and clinical restraint",
};

// ── Difficulty Ladder ────────────────────────────────────────────────────────

const DIFFICULTY_LADDER: GeneratedMCQ['difficulty'][] = [
    'recall',
    'application',
    'vignette',
    'trap',
    'integration',
];

const DIFFICULTY_DESCRIPTIONS: Record<GeneratedMCQ['difficulty'], string> = {
    recall: "Straightforward factual recall — test a single concept directly",
    application: "Apply a concept to a clinical sign or finding — requires one step of reasoning",
    vignette: "Full NEET PG clinical vignette with patient demographics, history, and findings — multi-step reasoning",
    trap: "Include a commonly believed but incorrect option as the most tempting distractor — tests misconceptions",
    integration: "Connect multiple concepts — next-step management or combining pathophysiology with treatment",
};

// ── QuizGenerator ────────────────────────────────────────────────────────────

export class QuizGenerator {

    // ── Stage 1: Extract weakness signals (deterministic) ──────────────────

    static extractWeaknesses(
        feedback: FinalEvaluationResult,
        caseData: any
    ): WeaknessSignal[] {
        const signals: WeaknessSignal[] = [];

        // Weight 5: Critical safety gaps
        if (feedback.missedRedFlags && feedback.missedRedFlags.length > 0) {
            for (const flag of feedback.missedRedFlags) {
                signals.push({ type: 'missed-red-flag', detail: flag, weight: 5 });
            }
        }

        if (!feedback.isCorrect) {
            signals.push({
                type: 'wrong-diagnosis',
                detail: feedback.correctDiagnosis || 'unknown',
                weight: 5,
            });
        }

        // Weight 3: Clinical decision gaps
        const missedTests = feedback.feedback?.testingEfficiency?.missedTests || [];
        for (const test of missedTests) {
            if (test && test.trim()) {
                signals.push({ type: 'missed-test', detail: test, weight: 3 });
            }
        }

        if (feedback.managementScore !== undefined && feedback.managementScore < 5) {
            signals.push({
                type: 'low-management',
                detail: `${feedback.managementScore}/10`,
                weight: 3,
            });
        }

        const unnecessaryCount = feedback.feedback?.testingEfficiency?.unnecessaryTests || 0;
        if (unnecessaryCount > 0) {
            signals.push({
                type: 'unnecessary-tests',
                detail: `${unnecessaryCount} unnecessary tests ordered`,
                weight: 2,
            });
        }

        // Weight 2: Knowledge depth gaps
        if (feedback.historyScore !== undefined && feedback.historyScore < 15) {
            signals.push({
                type: 'low-history',
                detail: `${feedback.historyScore}/25`,
                weight: 2,
            });
        }

        if (feedback.reasoningScore !== undefined && feedback.reasoningScore < 15) {
            signals.push({
                type: 'low-reasoning',
                detail: `${feedback.reasoningScore}/30`,
                weight: 2,
            });
        }

        return signals;
    }

    // ── Stage 2: Cluster into knowledge gaps (deterministic) ───────────────

    static clusterIntoGaps(signals: WeaknessSignal[], caseData: any): KnowledgeGap[] {
        const gapMap = new Map<string, { weaknesses: string[]; totalWeight: number }>();

        for (const signal of signals) {
            const normalizedDetail = signal.detail
                .toLowerCase()
                .replace(/[-\s]+/g, '_')
                .replace(/[^a-z0-9_]/g, '');

            // Look up in gap map, with fallback
            let concept: string;
            if (signal.type === 'wrong-diagnosis') {
                concept = KNOWLEDGE_GAP_MAP['wrong_diagnosis'] || "Diagnostic accuracy and differential diagnosis";
            } else if (signal.type === 'low-management') {
                concept = KNOWLEDGE_GAP_MAP['low_management'] || "Clinical management principles";
            } else if (signal.type === 'low-history') {
                concept = KNOWLEDGE_GAP_MAP['low_history'] || "Systematic clinical history taking";
            } else if (signal.type === 'low-reasoning') {
                concept = KNOWLEDGE_GAP_MAP['low_reasoning'] || "Clinical reasoning and differential diagnosis";
            } else if (signal.type === 'unnecessary-tests') {
                concept = KNOWLEDGE_GAP_MAP['unnecessary_tests'] || "Investigation appropriateness and clinical restraint";
            } else {
                concept = KNOWLEDGE_GAP_MAP[normalizedDetail] || this.humanize(signal.detail);
            }

            const existing = gapMap.get(concept);
            const weaknessDesc = `${signal.type}: ${signal.detail}`;
            if (existing) {
                existing.weaknesses.push(weaknessDesc);
                existing.totalWeight += signal.weight;
            } else {
                gapMap.set(concept, {
                    weaknesses: [weaknessDesc],
                    totalWeight: signal.weight,
                });
            }
        }

        // Convert to array and sort by priority
        const gaps: KnowledgeGap[] = Array.from(gapMap.entries())
            .map(([concept, data]) => ({
                concept,
                relatedWeaknesses: data.weaknesses,
                priority: data.totalWeight,
                questionCount: 0, // allocated in next step
            }))
            .sort((a, b) => b.priority - a.priority);

        return gaps;
    }

    // ── Adaptive Question Allocation ──────────────────────────────────────

    static allocateQuestions(gaps: KnowledgeGap[], totalQuestions: number = 5): KnowledgeGap[] {
        if (gaps.length === 0) return gaps;

        const totalPriority = gaps.reduce((sum, g) => sum + g.priority, 0);
        if (totalPriority === 0) {
            // Edge case: no priority at all — distribute evenly
            const perGap = Math.floor(totalQuestions / gaps.length);
            gaps.forEach((g, i) => {
                g.questionCount = perGap + (i < totalQuestions % gaps.length ? 1 : 0);
            });
            return gaps;
        }

        // Proportional allocation: priority / totalPriority * totalQuestions
        let allocated = 0;
        for (const gap of gaps) {
            gap.questionCount = Math.max(1, Math.round((gap.priority / totalPriority) * totalQuestions));
            allocated += gap.questionCount;
        }

        // Adjust to hit exactly totalQuestions
        while (allocated > totalQuestions) {
            // Remove from lowest-priority gap that has > 1 question
            for (let i = gaps.length - 1; i >= 0; i--) {
                if (gaps[i].questionCount > 1) {
                    gaps[i].questionCount--;
                    allocated--;
                    break;
                }
            }
            // Safety: if all gaps have 1 question and still over, remove from last
            if (allocated > totalQuestions) {
                const last = gaps[gaps.length - 1];
                if (last.questionCount > 0) {
                    last.questionCount--;
                    allocated--;
                }
            }
        }
        while (allocated < totalQuestions) {
            // Add to highest-priority gap
            gaps[0].questionCount++;
            allocated++;
        }

        // Filter out gaps with 0 questions
        return gaps.filter(g => g.questionCount > 0);
    }

    // ── Stage 3: Build LLM prompt ─────────────────────────────────────────

    static buildPrompt(
        gaps: KnowledgeGap[],
        caseData: any,
        feedback: FinalEvaluationResult,
        orderedTestNames: string[]
    ): string {
        const patient = caseData.patient || {};
        const totalQuestions = gaps.reduce((sum, g) => sum + g.questionCount, 0);

        // Build gap descriptions with allocated question counts and difficulty assignments
        const gapInstructions: string[] = [];
        let questionIndex = 0;

        for (const gap of gaps) {
            const difficulties: string[] = [];
            for (let i = 0; i < gap.questionCount; i++) {
                const diffLevel = DIFFICULTY_LADDER[questionIndex % DIFFICULTY_LADDER.length];
                difficulties.push(`Q${questionIndex + 1}: ${diffLevel} — ${DIFFICULTY_DESCRIPTIONS[diffLevel]}`);
                questionIndex++;
            }

            gapInstructions.push(
                `KNOWLEDGE GAP: "${gap.concept}" (priority: ${gap.priority})\n` +
                `Related weaknesses: ${gap.relatedWeaknesses.join('; ')}\n` +
                `Generate ${gap.questionCount} question(s) at these difficulty levels:\n` +
                difficulties.join('\n')
            );
        }

        // Student's mistakes for distractor generation
        const studentMistakes: string[] = [];
        if (!feedback.isCorrect && feedback.studentDiagnosis) {
            studentMistakes.push(`Student's wrong diagnosis: "${feedback.studentDiagnosis}" (correct: "${feedback.correctDiagnosis}")`);
        }
        if (orderedTestNames.length > 0) {
            studentMistakes.push(`Tests student ordered: ${orderedTestNames.join(', ')}`);
        }
        if (feedback.feedback?.testingEfficiency?.missedTests?.length > 0) {
            studentMistakes.push(`Tests student missed: ${feedback.feedback.testingEfficiency.missedTests.join(', ')}`);
        }

        const mistakeSection = studentMistakes.length > 0
            ? `\nSTUDENT'S ACTUAL MISTAKES (use these as distractors where appropriate):\n${studentMistakes.join('\n')}\n`
            : '';

        return `You are a senior medical educator creating NEET PG / USMLE Step 2 CK practice MCQs.

CASE CONTEXT:
Patient: ${patient.name || 'Unknown'}, ${patient.age || '?'}y, ${patient.gender || '?'}
Chief Complaint: ${patient.chiefComplaint || 'Unknown'}
Final Diagnosis: ${patient.final_diagnosis || 'Unknown'}
${mistakeSection}
TASK:
Generate exactly ${totalQuestions} MCQs targeting the student's specific knowledge gaps.
Each question must be a personalized remediation question — not a generic textbook question.
Where possible, use the student's actual mistakes as wrong options (distractors).

${gapInstructions.join('\n\n')}

STRICT FORMAT RULES — VIOLATIONS ARE UNACCEPTABLE:
1. Single best answer format ONLY
2. Exactly four options per question (A, B, C, D)
3. Exactly ONE clearly correct answer
4. NEVER use "All of the above" or "None of the above"
5. NEVER use "Except" or negative stems like "Which is NOT..."
6. Prefer clinical vignette format (patient demographics + presentation + question)
7. Follow NEET PG / USMLE Step 2 CK difficulty standards
8. Explanation MUST be ≤ 150 words
9. Each question MUST include a "weaknessLink" field: 1 sentence explaining which student mistake triggered this question
10. Options must be homogeneous (all drugs, OR all investigations, OR all diagnoses — never mix categories)
11. Where the student made a specific mistake (wrong test, wrong diagnosis), include their wrong choice as one of the distractor options

OUTPUT FORMAT:
Return STRICTLY valid JSON — no markdown, no extra text, no code fences:
{
  "questions": [
    {
      "id": "q1",
      "stem": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "...",
      "category": "diagnosis|investigation|management|pathophysiology|pharmacology|red-flag",
      "difficulty": "recall|application|vignette|trap|integration",
      "weaknessLink": "You missed screening for ... This question reinforces ...",
      "knowledgeGap": "exact concept string from the gap"
    }
  ]
}`.trim();
    }

    // ── High Performer Prompt ─────────────────────────────────────────────

    static buildHighPerformerPrompt(caseData: any): string {
        const patient = caseData.patient || {};

        return `You are a senior medical educator creating advanced NEET PG / USMLE Step 2 CK practice MCQs.

CASE CONTEXT:
Patient: ${patient.name || 'Unknown'}, ${patient.age || '?'}y, ${patient.gender || '?'}
Chief Complaint: ${patient.chiefComplaint || 'Unknown'}
Final Diagnosis: ${patient.final_diagnosis || 'Unknown'}

TASK:
The student scored ≥90/100 on this case — excellent performance. Generate 3 CHALLENGE questions to push them further:

Q1: vignette — A complex clinical scenario involving a rare differential diagnosis of ${patient.final_diagnosis || 'this condition'}
Q2: trap — A commonly believed but incorrect management step for ${patient.final_diagnosis || 'this condition'}
Q3: integration — A question connecting pathophysiology to clinical presentation to treatment for ${patient.final_diagnosis || 'this condition'}

STRICT FORMAT RULES — VIOLATIONS ARE UNACCEPTABLE:
1. Single best answer format ONLY
2. Exactly four options per question (A, B, C, D)
3. Exactly ONE clearly correct answer
4. NEVER use "All of the above" or "None of the above"
5. NEVER use "Except" or negative stems
6. Clinical vignette format required for all 3 questions
7. Follow NEET PG / USMLE Step 2 CK difficulty — these should be HARD
8. Explanation MUST be ≤ 150 words
9. Each question MUST include a "weaknessLink" field: e.g. "This challenge question tests deeper understanding of [topic]."
10. Options must be homogeneous

OUTPUT FORMAT:
Return STRICTLY valid JSON — no markdown, no extra text, no code fences:
{
  "questions": [
    {
      "id": "q1",
      "stem": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "...",
      "category": "diagnosis|investigation|management|pathophysiology|pharmacology",
      "difficulty": "vignette|trap|integration",
      "weaknessLink": "...",
      "knowledgeGap": "Advanced ${patient.final_diagnosis || 'clinical'} concepts"
    }
  ]
}`.trim();
    }

    // ── Orchestrator ──────────────────────────────────────────────────────

    static async generate(
        feedback: FinalEvaluationResult,
        caseData: any,
        orderedTestNames: string[] = []
    ): Promise<QuizGenerationResult> {
        const isHighPerformer = feedback.score >= 90;

        if (isHighPerformer) {
            return this.generateHighPerformerQuiz(caseData);
        }

        // Stage 1: Extract weaknesses
        const weaknesses = this.extractWeaknesses(feedback, caseData);
        console.log(`QuizGenerator: Extracted ${weaknesses.length} weakness signals`);

        if (weaknesses.length === 0) {
            // Fallback: generate challenge questions if no weaknesses detected
            return this.generateHighPerformerQuiz(caseData);
        }

        // Stage 2: Cluster into knowledge gaps (deterministic)
        const rawGaps = this.clusterIntoGaps(weaknesses, caseData);
        console.log(`QuizGenerator: Clustered into ${rawGaps.length} knowledge gaps`);

        // Adaptive allocation
        const gaps = this.allocateQuestions(rawGaps, 5);
        console.log(`QuizGenerator: Allocated questions: ${gaps.map(g => `${g.concept}(${g.questionCount})`).join(', ')}`);

        // Stage 3: Generate MCQs via LLM
        const prompt = this.buildPrompt(gaps, caseData, feedback, orderedTestNames);
        const questions = await this.callLLM(prompt);

        return { questions, knowledgeGaps: gaps };
    }

    // ── High Performer Path ───────────────────────────────────────────────

    private static async generateHighPerformerQuiz(caseData: any): Promise<QuizGenerationResult> {
        const patient = caseData.patient || {};
        const prompt = this.buildHighPerformerPrompt(caseData);
        const questions = await this.callLLM(prompt);

        const challengeGap: KnowledgeGap = {
            concept: `Advanced ${patient.final_diagnosis || 'clinical'} concepts`,
            relatedWeaknesses: ['High performer challenge'],
            priority: 10,
            questionCount: 3,
        };

        return { questions, knowledgeGaps: [challengeGap] };
    }

    // ── LLM Call ──────────────────────────────────────────────────────────

    private static async callLLM(prompt: string): Promise<GeneratedMCQ[]> {
        try {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error("Missing GROQ_API_KEY");

            const groq = new Groq({ apiKey });

            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: "Generate the MCQs now." },
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                response_format: { type: "json_object" },
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) throw new Error("Empty LLM response for quiz generation");

            const parsed = JSON.parse(content);
            const questions: GeneratedMCQ[] = (parsed.questions || []).map(
                (q: any, index: number) => ({
                    id: q.id || `q${index + 1}`,
                    stem: String(q.stem || ""),
                    options: Array.isArray(q.options) ? q.options.map(String) : [],
                    correctIndex: Math.min(3, Math.max(0, Number(q.correctIndex) || 0)),
                    explanation: String(q.explanation || ""),
                    category: String(q.category || "general"),
                    difficulty: this.validateDifficulty(q.difficulty),
                    weaknessLink: String(q.weaknessLink || ""),
                    knowledgeGap: String(q.knowledgeGap || ""),
                })
            );

            // Validate: each question must have exactly 4 options
            const valid = questions.filter(q =>
                q.options.length === 4 &&
                q.stem.length > 0 &&
                q.correctIndex >= 0 &&
                q.correctIndex <= 3
            );

            console.log(`QuizGenerator: Generated ${valid.length} valid MCQs (${questions.length} total from LLM)`);
            return valid;

        } catch (err: any) {
            console.error("QuizGenerator: LLM call failed:", err.message);
            return [];
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static validateDifficulty(d: any): GeneratedMCQ['difficulty'] {
        const valid: GeneratedMCQ['difficulty'][] = ['recall', 'application', 'vignette', 'trap', 'integration'];
        return valid.includes(d) ? d : 'recall';
    }

    private static humanize(slug: string): string {
        return slug
            .replace(/_/g, ' ')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }
}
