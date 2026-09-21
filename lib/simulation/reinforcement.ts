// =========================
// lib/simulation/reinforcement.ts
// =========================
// Layer 4: mistake → knowledge gap → targeted questions.
//
//   encounter events → scorer (misconceptions, missed items) → knowledge gaps
//                    → the case's authored question banks → 5 MCQs
//
// The questions are authored, clinically reviewed content keyed by knowledge
// gap in the case JSON (`reinforcement`) — deliberately NOT LLM-generated, so a
// medical quiz can never invent a fact. The output matches the shape the
// existing quiz screen already consumes.

import type { ReinforcementQuestion, SimulationCaseConfig } from "./case-schema";

export interface QuizQuestion {
    id: string;
    stem: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    category: string;
    difficulty: "recall" | "application" | "vignette" | "trap" | "integration";
    weaknessLink: string;
    knowledgeGap: string;
}

export interface QuizKnowledgeGap {
    concept: string;
    relatedWeaknesses: string[];
    /** Higher = more important. */
    priority: number;
    questionCount: number;
}

export interface ReinforcementQuiz {
    questions: QuizQuestion[];
    knowledgeGaps: QuizKnowledgeGap[];
}

/** Bank used when there is nothing to remediate: harder integration questions. */
export const MASTERY_BANK = "mastery_challenge";

/** No single gap gets more than this many questions. */
const MAX_PER_GAP = 3;

/**
 * Picks `count` questions for the gaps the scorer flagged, most important first.
 *
 * The first gap is the EXACT error, so it must never be treated like a minor
 * one: the quiz covers at most `count − 1` gaps, which always leaves room for
 * an extra question on the top gap. Every included gap gets one question, then
 * the rest are dealt out from the top down (2, 2, 1 for three gaps; 2, 1, 1, 1
 * for four or more).
 */
export function selectReinforcement(
    config: Pick<SimulationCaseConfig, "reinforcement">,
    knowledgeGaps: readonly string[],
    /** Optional: why each gap was flagged (e.g. the misconception's title). */
    weaknessLabels: Readonly<Record<string, string>> = {},
    count = 5
): ReinforcementQuiz {
    const banks = config.reinforcement ?? {};
    const flagged = knowledgeGaps.filter((g) => g !== MASTERY_BANK && banks[g]?.questions?.length);
    const included = flagged.slice(0, Math.max(1, count - 1));

    const picked: Array<{ gap: string; q: ReinforcementQuestion }> = [];

    if (included.length > 0) {
        const cap = (gap: string) => Math.min(MAX_PER_GAP, banks[gap].questions.length);
        const quota = included.map(() => 1);
        let remaining = count - included.length;
        while (remaining > 0) {
            let dealt = false;
            for (let i = 0; i < included.length && remaining > 0; i++) {
                if (quota[i] < cap(included[i])) {
                    quota[i] += 1;
                    remaining -= 1;
                    dealt = true;
                }
            }
            if (!dealt) break; // every included bank is exhausted
        }
        included.forEach((gap, i) => {
            for (const q of banks[gap].questions.slice(0, quota[i])) picked.push({ gap, q });
        });
    }

    // Nothing wrong (or the flagged banks ran out): a mastery challenge instead of padding.
    const challenge = banks[MASTERY_BANK];
    if (challenge) {
        const want = included.length === 0 ? Math.min(count, 3) : count;
        const used = new Set(picked.map((p) => p.q.id));
        for (const q of challenge.questions) {
            if (picked.length >= want) break;
            if (!used.has(q.id)) picked.push({ gap: MASTERY_BANK, q });
        }
    }

    const questions: QuizQuestion[] = picked.map(({ gap, q }) => ({
        id: q.id,
        stem: q.stem,
        options: [...q.options],
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        category: q.category ?? "Clinical reasoning",
        difficulty: q.difficulty ?? "application",
        weaknessLink: weaknessLabels[gap] ?? banks[gap]?.title ?? gap,
        knowledgeGap: banks[gap]?.title ?? gap,
    }));

    const represented = [...new Set(picked.map((p) => p.gap))];
    return {
        questions,
        knowledgeGaps: represented.map((gap, index) => ({
            concept: banks[gap]?.title ?? gap,
            relatedWeaknesses: [weaknessLabels[gap] ?? banks[gap]?.summary ?? gap],
            priority: represented.length - index,
            questionCount: picked.filter((p) => p.gap === gap).length,
        })),
    };
}
