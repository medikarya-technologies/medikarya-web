// =========================
// lib/library/skills.ts
// =========================
// "Where you lose marks": what a student's attempts say about which parts of a case they do well and which cost
// them marks, and what they keep missing. Every attempt already stores this, in two shapes:
//
//   classic scoring   historyScore (of 25), testingScore (of 20), reasoningScore (of 30), diagnosisScore (of 15),
//                     managementScore (of 10), and missedRedFlags (ids of red flags the student did not pick up)
//   rubric scoring    simulation.domains: clinical_reasoning, investigation_accuracy, management, efficiency
//                     (each already 0-100), and simulation.knowledgeGaps (ids)
//
// Both are turned into the same six skills as a percentage, so a student who has done both kinds of case gets
// one picture. Only skills an attempt actually scored are counted for that attempt. The rows come from a light
// JSON-path select (app/actions/skills.ts), not the whole stored feedback.
//
// Pure: no React, no I/O, no `@/` imports.

export type SkillId = "history" | "investigations" | "reasoning" | "diagnosis" | "management" | "efficiency";

export const SKILL_ORDER: readonly SkillId[] = ["history", "investigations", "reasoning", "diagnosis", "management", "efficiency"];

export const SKILL_LABEL: Record<SkillId, string> = {
    history: "History taking",
    investigations: "Investigations",
    reasoning: "Clinical reasoning",
    diagnosis: "Diagnosis",
    management: "Management",
    efficiency: "Efficiency",
};

export const SKILL_HINT: Record<SkillId, string> = {
    history: "Asking the questions that matter",
    investigations: "Ordering what helps, skipping what does not",
    reasoning: "Weighing what you found",
    diagnosis: "Getting to the right answer",
    management: "What you do next",
    efficiency: "Doing it in good time, with few wasted steps",
};

/** What the classic scorer marks each part out of (see the README's evaluation table). */
const CLASSIC_MAX = { history: 25, investigations: 20, reasoning: 30, diagnosis: 15, management: 10 } as const;

/** One stored attempt, as much of it as this needs. Every field but the case and the time may be missing. */
export interface AttemptFeedback {
    case_id: string;
    created_at: string;
    historyScore?: unknown;
    testingScore?: unknown;
    reasoningScore?: unknown;
    diagnosisScore?: unknown;
    managementScore?: unknown;
    /** simulation.domains */
    simDomains?: unknown;
    /** simulation.knowledgeGaps */
    simGaps?: unknown;
    missedRedFlags?: unknown;
    /** simulation.clinicalScore and simulation.independentScore: the score, and the score without what was spent on help */
    clinicalScore?: unknown;
    independentScore?: unknown;
}

export interface SkillRow {
    id: SkillId;
    label: string;
    /** 0-100: the mean over the attempts that scored it. */
    average: number;
    /** How many attempts scored it. */
    attempts: number;
}

export interface Gap {
    /** The stored id. */
    key: string;
    label: string;
    /** In how many attempts it was missed. */
    count: number;
    /** ISO time of the latest one. */
    last: string;
    /** The cases it was missed in. */
    cases: string[];
}

export interface SkillProfile {
    attempts: number;
    /** Weakest first: the top row is where the most marks are. */
    skills: SkillRow[];
    /** Missed most often first. */
    gaps: Gap[];
    /** Points a case costs on average in hints and other help; null when help is not used or not recorded. */
    helpCost: { average: number; attempts: number } | null;
}

export const NO_SKILLS: SkillProfile = { attempts: 0, skills: [], gaps: [], helpCost: null };

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const clampPct = (n: number): number => Math.round(Math.max(0, Math.min(100, n)));

const ACRONYMS = new Set(["ecg", "ekg", "stemi", "nstemi", "ct", "mri", "cbc", "icu", "iv", "bp", "cxr", "usg", "uti", "dka", "copd", "ards", "dvt", "lad", "rca", "lcx", "hiv", "tb", "gcs", "abg", "lft", "rft", "tsh"]);

/** "severe_bradycardia" becomes "Severe bradycardia"; the usual medical abbreviations keep their capitals. */
export function prettyGap(id: string): string {
    const words = id.replace(/[_-]+/g, " ").trim().split(/\s+/).filter(Boolean);
    const text = words.map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.toLowerCase())).join(" ");
    return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export function buildSkillProfile(rows: readonly AttemptFeedback[], gapLimit = 6): SkillProfile {
    const sums = new Map<SkillId, { total: number; n: number }>();
    const add = (id: SkillId, value: number | undefined) => {
        if (value === undefined) return;
        const s = sums.get(id) ?? { total: 0, n: 0 };
        s.total += clampPct(value);
        s.n += 1;
        sums.set(id, s);
    };

    const gaps = new Map<string, { label: string; count: number; last: string; cases: Set<string> }>();
    let helpTotal = 0;
    let helpN = 0;
    let used = 0;

    for (const row of rows) {
        if (!row || typeof row.case_id !== "string" || Number.isNaN(Date.parse(row.created_at))) continue;
        used++;

        const rubric = obj(row.simDomains);
        const rubricScores = rubric ? [num(rubric.clinical_reasoning), num(rubric.investigation_accuracy), num(rubric.management), num(rubric.efficiency)] : [];
        if (rubricScores.some((v) => v !== undefined)) {
            add("reasoning", rubricScores[0]);
            add("investigations", rubricScores[1]);
            add("management", rubricScores[2]);
            add("efficiency", rubricScores[3]);
        } else {
            const c = { history: num(row.historyScore), investigations: num(row.testingScore), reasoning: num(row.reasoningScore), diagnosis: num(row.diagnosisScore), management: num(row.managementScore) };
            if (Object.values(c).some((v) => v !== undefined)) {
                for (const id of Object.keys(CLASSIC_MAX) as Array<keyof typeof CLASSIC_MAX>) {
                    const v = c[id];
                    add(id, v === undefined ? undefined : (v / CLASSIC_MAX[id]) * 100);
                }
            }
        }

        const misses = new Set<string>();
        for (const list of [row.missedRedFlags, row.simGaps]) {
            if (Array.isArray(list)) for (const g of list) if (typeof g === "string" && g.trim()) misses.add(g.trim());
        }
        for (const key of misses) {
            const g = gaps.get(key) ?? { label: prettyGap(key), count: 0, last: row.created_at, cases: new Set<string>() };
            g.count += 1;
            if (Date.parse(row.created_at) > Date.parse(g.last)) g.last = row.created_at;
            g.cases.add(row.case_id);
            gaps.set(key, g);
        }

        const clinical = num(row.clinicalScore);
        const independent = num(row.independentScore);
        if (clinical !== undefined && independent !== undefined && clinical >= independent) {
            helpTotal += clinical - independent;
            helpN += 1;
        }
    }

    const skills: SkillRow[] = SKILL_ORDER.flatMap((id) => {
        const s = sums.get(id);
        return s ? [{ id, label: SKILL_LABEL[id], average: Math.round(s.total / s.n), attempts: s.n }] : [];
    }).sort((a, b) => a.average - b.average || SKILL_ORDER.indexOf(a.id) - SKILL_ORDER.indexOf(b.id));

    const gapList: Gap[] = [...gaps]
        .map(([key, g]) => ({ key, label: g.label, count: g.count, last: g.last, cases: [...g.cases].sort() }))
        .sort((a, b) => b.count - a.count || Date.parse(b.last) - Date.parse(a.last) || a.label.localeCompare(b.label))
        .slice(0, gapLimit);

    const helpAverage = helpN > 0 ? helpTotal / helpN : 0;
    return { attempts: used, skills, gaps: gapList, helpCost: helpAverage >= 0.5 ? { average: Math.round(helpAverage * 10) / 10, attempts: helpN } : null };
}
