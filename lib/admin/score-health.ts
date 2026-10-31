// Score health (Admin → Attempts): each part of the classic score as a share of its maximum, averaged over the most
// recent attempts, flagged when it sits where no fair scoring should leave a whole cohort. History averaged 7% of
// its maximum for months before anyone noticed (EVALUATION_ENGINE.md, "History, version 2"); a part averaging
// under 15% or over 90% of its maximum now shows up here the same day.
//
// Pure: no I/O, no `@/` imports.

export const HEALTH_LOW = 15;
export const HEALTH_HIGH = 90;

const PARTS = [
    { id: "history", label: "History", key: "historyScore", max: 25 },
    { id: "tests", label: "Tests", key: "testingScore", max: 20 },
    { id: "reasoning", label: "Reasoning", key: "reasoningScore", max: 30 },
    { id: "diagnosis", label: "Diagnosis", key: "diagnosisScore", max: 15 },
    { id: "management", label: "Management", key: "managementScore", max: 10 },
] as const;

export interface PartHealth {
    id: (typeof PARTS)[number]["id"];
    label: string;
    /** Mean of score / max, as a percentage. */
    average: number;
    flag: "low" | "high" | null;
}

export interface ScoreHealth {
    /** How many attempts the averages are over. */
    attempts: number;
    parts: PartHealth[];
    /** Of those, how many were marked by history scoring version 2. */
    historyV2: number;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * `rows` newest first, each an attempt's stored feedback. Only attempts scored by the classic evaluator count (a
 * rubric-scored simulation stores a placeholder history of 0, which would read as a broken scorer).
 */
export function scoreHealth(rows: ReadonlyArray<{ feedback_json?: unknown }>, last = 50): ScoreHealth {
    const classic = rows
        .map((r) => (r && typeof r.feedback_json === "object" && r.feedback_json ? (r.feedback_json as Record<string, any>) : null))
        .filter((f): f is Record<string, any> => !!f && num(f.historyScore) !== undefined && f.simulation?.scoring !== "rubric" && !f.simulation?.domains)
        .slice(0, last);
    const parts = PARTS.map((p) => {
        const values = classic.map((f) => num(f[p.key])).filter((v): v is number => v !== undefined);
        const average = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length / p.max) * 100) : 0;
        const flag: PartHealth["flag"] = values.length === 0 ? null : average < HEALTH_LOW ? "low" : average > HEALTH_HIGH ? "high" : null;
        return { id: p.id, label: p.label, average, flag };
    });
    return { attempts: classic.length, parts, historyV2: classic.filter((f) => num(f.scoringVersion?.history) === 2).length };
}
