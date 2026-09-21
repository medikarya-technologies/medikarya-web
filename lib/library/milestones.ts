// =========================
// lib/library/milestones.ts
// =========================
// Milestones: a few real things a student can have done, worked out from their attempts and the library, and
// nothing else (the mock Achievements page that used to be here invented its numbers). They are derived, not
// stored, so they are always true of the attempts and cannot go wrong; the one consequence is that a milestone
// about "every case" waits for a case that is added later.
//
//   first case · a 3-day streak · a 7-day streak · a score of 90 or more · every case in a specialty tried
//   (a specialty with at least two cases) · every case in the library tried
//
// A "day" is a UTC date, the same as the streak the dashboard keeps (app/actions/evaluate.ts).
//
// Pure: no React, no I/O, no `@/` imports.

export type MilestoneId = "first_case" | "streak_3" | "streak_7" | "score_90" | "specialty_complete" | "all_cases";

export interface AttemptLike {
    case_id: string;
    score: number | null;
    created_at: string;
}

export interface CaseLike {
    id: string;
    category: string;
}

export interface Milestone {
    id: MilestoneId;
    title: string;
    /** What it means, or (when earned) what did it. */
    detail: string;
    earned: boolean;
    /** ISO time of the attempt that earned it. */
    earnedAt?: string;
    /** How far along, while it is not earned: "2 of 3 days". */
    progress?: string;
    /** The same as 0 to 1, for a bar; left out once it is earned or when there is nothing to measure it against. */
    fraction?: number;
}

const DAY = 86_400_000;

const valid = (a: AttemptLike): boolean => typeof a?.case_id === "string" && a.case_id !== "" && !Number.isNaN(Date.parse(a.created_at));
const dayNumber = (iso: string): number => Math.floor(Date.parse(iso) / DAY);

/** The longest run of consecutive days, and the attempt that first completed a run of `target` days (if any). */
function streaks(attempts: readonly AttemptLike[], target: number): { best: number; earnedAt?: string } {
    const firstOnDay = new Map<number, string>();
    for (const a of attempts) {
        const d = dayNumber(a.created_at);
        const seen = firstOnDay.get(d);
        if (seen === undefined || Date.parse(a.created_at) < Date.parse(seen)) firstOnDay.set(d, a.created_at);
    }
    const days = [...firstOnDay.keys()].sort((x, y) => x - y);
    let run = 0;
    let best = 0;
    let earnedAt: string | undefined;
    days.forEach((d, i) => {
        run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1;
        best = Math.max(best, run);
        if (run >= target && earnedAt === undefined) earnedAt = firstOnDay.get(d);
    });
    return { best, earnedAt };
}

const earliest = (times: readonly string[]): string | undefined => (times.length ? [...times].sort((a, b) => Date.parse(a) - Date.parse(b))[0] : undefined);

export function computeMilestones({ attempts: all, cases }: { attempts: readonly AttemptLike[]; cases: readonly CaseLike[] }): Milestone[] {
    const attempts = all.filter(valid);
    const out: Milestone[] = [];

    // first case
    const first = earliest(attempts.map((a) => a.created_at));
    out.push({ id: "first_case", title: "First case", detail: "You finished your first case.", earned: first !== undefined, earnedAt: first, progress: first === undefined ? "Finish any case" : undefined, fraction: first === undefined ? 0 : undefined });

    // streaks
    for (const days of [3, 7] as const) {
        const { best, earnedAt } = streaks(attempts, days);
        out.push({
            id: days === 3 ? "streak_3" : "streak_7",
            title: `${days}-day streak`,
            detail: `Practised ${days === 3 ? "three" : "seven"} days in a row.`,
            earned: earnedAt !== undefined,
            earnedAt,
            progress: earnedAt === undefined ? `Best run so far: ${best} of ${days} days` : undefined,
            fraction: earnedAt === undefined ? best / days : undefined,
        });
    }

    // a score of 90 or more
    const high = attempts.filter((a) => typeof a.score === "number" && a.score >= 90).map((a) => a.created_at);
    const bestScore = attempts.reduce((m, a) => Math.max(m, typeof a.score === "number" ? a.score : 0), 0);
    out.push({ id: "score_90", title: "A score of 90+", detail: "You scored 90 or more on a case.", earned: high.length > 0, earnedAt: earliest(high), progress: high.length === 0 ? (attempts.length ? `Best so far: ${Math.round(bestScore)}` : "Score 90 or more on any case") : undefined, fraction: high.length === 0 ? Math.min(1, bestScore / 90) : undefined });

    // every case in a specialty, and every case
    const firstTried = new Map<string, string>();
    for (const a of attempts) {
        const seen = firstTried.get(a.case_id);
        if (seen === undefined || Date.parse(a.created_at) < Date.parse(seen)) firstTried.set(a.case_id, a.created_at);
    }
    const bySpecialty = new Map<string, CaseLike[]>();
    for (const c of cases) bySpecialty.set(c.category || "Other", [...(bySpecialty.get(c.category || "Other") ?? []), c]);

    const complete: Array<{ name: string; at: string }> = [];
    let closest: { name: string; tried: number; total: number } | undefined;
    for (const [name, list] of bySpecialty) {
        if (list.length < 2) continue;
        const tried = list.filter((c) => firstTried.has(c.id));
        if (tried.length === list.length) complete.push({ name, at: latest(list.map((c) => firstTried.get(c.id) as string)) });
        else if (!closest || tried.length / list.length > closest.tried / closest.total) closest = { name, tried: tried.length, total: list.length };
    }
    const names = complete.map((c) => c.name).sort();
    out.push({
        id: "specialty_complete",
        title: "Specialty complete",
        detail: names.length ? `You have tried every ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`} case.` : "Try every case in one specialty.",
        earned: complete.length > 0,
        earnedAt: earliest(complete.map((c) => c.at)),
        progress: complete.length === 0 && closest ? `Closest: ${closest.name}, ${closest.tried} of ${closest.total}` : undefined,
        fraction: complete.length === 0 && closest ? closest.tried / closest.total : undefined,
    });

    const testedAll = cases.length >= 3 && cases.every((c) => firstTried.has(c.id));
    const triedCount = cases.filter((c) => firstTried.has(c.id)).length;
    out.push({
        id: "all_cases",
        title: "Every case tried",
        detail: "You have tried every case in the library.",
        earned: testedAll,
        earnedAt: testedAll ? latest(cases.map((c) => firstTried.get(c.id) as string)) : undefined,
        progress: testedAll ? undefined : `${triedCount} of ${cases.length} cases`,
        fraction: testedAll || cases.length === 0 ? undefined : triedCount / cases.length,
    });

    return out;
}

function latest(times: readonly string[]): string {
    return [...times].sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

/** The milestones `after` has and `before` did not: what one new attempt earned. */
export function newlyEarned(before: readonly Milestone[], after: readonly Milestone[]): Milestone[] {
    const had = new Set(before.filter((m) => m.earned).map((m) => m.id));
    return after.filter((m) => m.earned && !had.has(m.id));
}
