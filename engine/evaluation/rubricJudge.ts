// =========================
// engine/evaluation/rubricJudge.ts
// =========================
// The AI's reading of what the student wrote, for the free-text checks of a rubric-scored case (DualScorer.ts):
// an ECG interpretation, the reasoning box, the plan, the differential, the questions asked, and the diagnosis.
// Keyword lists miss a student who writes "tombstoning across the chest leads" or "Anterior MI"; a clinician
// would not, so the AI judges each check against what the case's own phrases mean.
//
// collectTextChecks is pure (tested); judgeTextChecks makes one AI call and returns null if it fails, in which
// case DualScorer falls back to the phrases and the attempt is saved as provisional.

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ClinicalEvent } from "../../lib/simulation/encounter-events";
import type { ScoringPredicate, SimulationCaseConfig } from "../../lib/simulation/case-schema";
import { DIAGNOSIS_JUDGMENT, textCheckKey, type TextJudgments } from "./DualScorer";

export interface TextCheck {
    key: string;
    /** What the rubric is looking for, in its own words. */
    lookingFor: string;
    /** Phrases the case writer gave as examples of a match. */
    examples: string[];
    /** What the student wrote that this check reads. */
    studentText: string;
}

type Ev<T extends ClinicalEvent["type"]> = Extract<ClinicalEvent, { type: T }>;
const last = <T extends ClinicalEvent["type"]>(events: readonly ClinicalEvent[], type: T): Ev<T> | undefined =>
    [...events].reverse().find((e): e is Ev<T> => e.type === type);

function textFor(p: ScoringPredicate, events: readonly ClinicalEvent[]): { text: string; examples: string[] } | null {
    if ("asked_about" in p) {
        const qs = events.filter((e): e is Ev<"HISTORY_TAKEN"> => e.type === "HISTORY_TAKEN").map((e, i) => `${i + 1}. ${e.question}`);
        return qs.length ? { text: qs.join("\n"), examples: p.asked_about } : null;
    }
    if ("interpretation_mentions" in p) {
        const { testId, any_of } = p.interpretation_mentions;
        const reads = events
            .filter((e): e is Ev<"RESULT_INTERPRETED"> => e.type === "RESULT_INTERPRETED" && (!testId || e.testId === testId))
            .map((e) => e.studentInterpretation)
            .filter((t) => t && t.trim());
        return reads.length ? { text: reads.join("\n"), examples: any_of } : null;
    }
    if ("reasoning_mentions" in p) {
        const dx = last(events, "DIAGNOSIS_SUBMITTED");
        return dx?.reasoning?.trim() ? { text: dx.reasoning, examples: p.reasoning_mentions } : null;
    }
    if ("diagnosis_matches" in p) {
        const dx = last(events, "DIAGNOSIS_SUBMITTED");
        return dx?.primary?.trim() ? { text: dx.primary, examples: p.diagnosis_matches } : null;
    }
    if ("differential_slot" in p) {
        const entry = last(events, "DIFFERENTIAL_SUBMITTED")?.ranked[p.differential_slot.slot - 1];
        return entry?.trim() ? { text: `Differential number ${p.differential_slot.slot}: ${entry}`, examples: p.differential_slot.matches } : null;
    }
    if ("differential_contains" in p) {
        const ranked = last(events, "DIFFERENTIAL_SUBMITTED")?.ranked.filter((r) => r.trim()) ?? [];
        return ranked.length ? { text: ranked.map((r, i) => `${i + 1}. ${r}`).join("\n"), examples: p.differential_contains } : null;
    }
    if ("plan_mentions" in p) {
        const steps = last(events, "MANAGEMENT_SUBMITTED")?.steps.filter((s) => s.trim()) ?? [];
        return steps.length ? { text: steps.map((s) => `- ${s}`).join("\n"), examples: p.plan_mentions } : null;
    }
    return null;
}

/** Every free-text check the rubric makes, with what the student wrote for it (checks with nothing to read are left out). */
export function collectTextChecks(config: SimulationCaseConfig, events: readonly ClinicalEvent[]): TextCheck[] {
    const rubric = config.scoring_rubric;
    if (!rubric) return [];
    const checks = new Map<string, TextCheck>();
    const walk = (p: ScoringPredicate | undefined, lookingFor: string) => {
        if (!p) return;
        if ("all" in p) return p.all.forEach((c) => walk(c, lookingFor));
        if ("any" in p) return p.any.forEach((c) => walk(c, lookingFor));
        if ("not" in p) return walk(p.not, lookingFor);
        const key = textCheckKey(p);
        if (key === null || checks.has(key)) return;
        const found = textFor(p, events);
        if (found) checks.set(key, { key, lookingFor, examples: found.examples, studentText: found.text });
    };
    for (const item of rubric.items) {
        walk(item.met_when, item.label);
        walk(item.partial_when, item.label);
    }
    for (const pen of rubric.penalties ?? []) walk(pen.when, pen.label);
    for (const m of rubric.misconceptions ?? []) walk(m.when, `${m.title}: ${m.error}`);

    const dx = last(events, "DIAGNOSIS_SUBMITTED");
    if (dx?.primary?.trim()) {
        checks.set(DIAGNOSIS_JUDGMENT, {
            key: DIAGNOSIS_JUDGMENT,
            lookingFor: `The correct diagnosis: ${rubric.diagnosis.ground_truth}`,
            examples: rubric.diagnosis.accepted,
            studentText: dx.primary,
        });
    }
    return [...checks.values()];
}

export function judgePrompt(config: SimulationCaseConfig, checks: readonly TextCheck[]): string {
    const list = checks
        .map((c, i) => `CHECK ${i + 1} (key: ${c.key})\nLooking for: ${c.lookingFor}\nExamples of a match: ${c.examples.join("; ")}\nThe student wrote:\n${c.studentText}`)
        .join("\n\n");
    return `You are a senior clinical examiner marking a medical student's written answers in a simulated case (${(config as { title?: string }).title ?? "case"}).
For each check, decide whether what the student wrote meets it, the way a clinician marking by hand would: judge the meaning, not the exact words. Accept synonyms, abbreviations, lay or Indian English phrasing and spelling slips. Do not accept a statement that negates it ("no ST elevation"), a different finding or disease, or something only vaguely related. For the diagnosis, accept the right disease even if worded differently, but not a different one.

${list}

Return STRICTLY valid JSON, one entry per check key: {"verdicts": {"<key>": true | false, ...}}`;
}

/** The AI's verdicts, or null if the call failed (the caller then scores by the phrases and marks the attempt provisional). */
export async function judgeTextChecks(config: SimulationCaseConfig, checks: readonly TextCheck[]): Promise<TextJudgments | null> {
    if (checks.length === 0) return {};
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
            model: "gemini-3.8-flash",
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
        });
        const res = await model.generateContent(judgePrompt(config, checks));
        const parsed = JSON.parse(res.response.text()) as { verdicts?: Record<string, unknown> };
        const out: Record<string, boolean> = {};
        for (const c of checks) {
            const v = parsed.verdicts?.[c.key];
            if (typeof v === "boolean") out[c.key] = v;
        }
        // A reply that answers none of the checks is a failure, not a set of "no"s.
        return Object.keys(out).length > 0 ? out : null;
    } catch (err: any) {
        console.error("rubricJudge: AI call failed, scoring by phrases:", err?.message ?? err);
        return null;
    }
}
