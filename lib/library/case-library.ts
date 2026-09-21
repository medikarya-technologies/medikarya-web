// =========================
// lib/library/case-library.ts
// =========================
// The logic behind the case library and the dashboard home: what a student can filter by, how the
// list is ordered, which case to suggest next, how a score is graded. All of it is a pure function
// of the case list and the student's progress, so the screens are thin and this can be tested.
//
// Two rules the list follows:
//   - Nothing gives a diagnosis away. Search looks only at the anonymised fields (the display
//     title, the display tags and the specialty), never at the diagnosis or the full case.
//   - "Recommended" means what a good tutor would say: what you have not tried yet, easiest first,
//     then the cases you did worst on.
//
// Pure: no React, no I/O, no `@/` imports.

export interface LibraryCase {
    id: string;
    title: string;
    displayTitle?: string;
    displayDescription?: string;
    displayTags?: string[];
    tags?: string[];
    category: string;
    /** "Beginner" | "Intermediate" | "Advanced" (any case). */
    difficulty: string;
    estimatedTime: number;
    /** The most XP the case can award: the score is a percentage of this. */
    xpReward?: number;
    createdAt?: string;
    updatedAt?: string;
    /** Who the patient is: enough to draw them, nothing about the illness. */
    patient?: { age?: number; gender?: string };
    /** An authored live simulation (treatments, a patient who changes) rather than a consultation. */
    live?: boolean;
}

/** What a student has done on one case. */
export interface CaseProgress {
    attempts: number;
    /** The best score, 0–100. */
    best: number;
    /** ISO time of the most recent attempt. */
    last: string;
}

export type ProgressMap = Readonly<Record<string, CaseProgress>>;

/** One row of the attempts table, as much of it as progress needs. */
export interface AttemptRow {
    case_id: string;
    score: number | null;
    created_at: string;
}

/** Attempts grouped by case: how many, the best score, and the latest. A missing score counts as 0. */
export function summariseAttempts(rows: readonly AttemptRow[]): Record<string, CaseProgress> {
    const out: Record<string, CaseProgress> = {};
    for (const row of rows) {
        if (!row || typeof row.case_id !== "string" || !row.case_id) continue;
        const score = typeof row.score === "number" && Number.isFinite(row.score) ? row.score : 0;
        const at = Date.parse(row.created_at);
        const seen = out[row.case_id];
        if (!seen) {
            out[row.case_id] = { attempts: 1, best: score, last: row.created_at };
        } else {
            seen.attempts++;
            seen.best = Math.max(seen.best, score);
            if (!Number.isNaN(at) && (Number.isNaN(Date.parse(seen.last)) || at > Date.parse(seen.last))) seen.last = row.created_at;
        }
    }
    return out;
}

export type DifficultyLevel = 1 | 2 | 3;

export function difficultyLevel(difficulty: string | undefined): DifficultyLevel {
    const d = (difficulty ?? "").trim().toLowerCase();
    if (d === "beginner" || d === "easy") return 1;
    if (d === "advanced" || d === "hard") return 3;
    return 2;
}

export const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };

// ── Filtering ───────────────────────────────────────────────────────────────

export type SortKey = "recommended" | "shortest" | "easiest" | "hardest" | "newest";
export type StatusFilter = "all" | "new" | "attempted";

export interface Filters {
    query: string;
    /** A specialty name, or "all". */
    specialty: string;
    /** 0 is any difficulty. */
    difficulty: 0 | DifficultyLevel;
    status: StatusFilter;
    /** Only the cases the student has saved for later (which ones is passed to filterCases: it lives in the browser). */
    saved?: boolean;
}

export const NO_FILTERS: Filters = { query: "", specialty: "all", difficulty: 0, status: "all" };

export const SORT_LABEL: Record<SortKey, string> = {
    recommended: "Recommended",
    shortest: "Shortest first",
    easiest: "Easiest first",
    hardest: "Hardest first",
    newest: "Newest",
};

/** Lower case, no accents, hyphens and punctuation as spaces: "Vitamin-B12" matches "vitamin b12". */
export function normalise(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/** Every word typed must appear in the anonymised text of the case: title, tags, specialty. */
export function matchesQuery(c: LibraryCase, query: string): boolean {
    const words = normalise(query).split(" ").filter(Boolean);
    if (words.length === 0) return true;
    const haystack = normalise([c.displayTitle || c.title, ...(c.displayTags ?? c.tags ?? []), c.category].join(" "));
    return words.every((w) => haystack.includes(w));
}

const hasAttempts = (progress: ProgressMap, id: string): boolean => (progress[id]?.attempts ?? 0) > 0;

export function activeFilterCount(f: Filters): number {
    return (f.query.trim() ? 1 : 0) + (f.specialty !== "all" ? 1 : 0) + (f.difficulty !== 0 ? 1 : 0) + (f.status !== "all" ? 1 : 0) + (f.saved ? 1 : 0);
}

export function filterCases<T extends LibraryCase>(cases: readonly T[], f: Filters, progress: ProgressMap = {}, saved: ReadonlySet<string> = new Set()): T[] {
    return cases.filter((c) => {
        if (f.saved && !saved.has(c.id)) return false;
        if (f.specialty !== "all" && c.category !== f.specialty) return false;
        if (f.difficulty !== 0 && difficultyLevel(c.difficulty) !== f.difficulty) return false;
        if (f.status === "new" && hasAttempts(progress, c.id)) return false;
        if (f.status === "attempted" && !hasAttempts(progress, c.id)) return false;
        return matchesQuery(c, f.query);
    });
}

/**
 * A case added in the last two weeks that the student has not tried: worth pointing at. Once it has been tried it
 * is just a case. `now` is a parameter so it can be tested.
 */
export function isNewCase(c: LibraryCase, progress: ProgressMap = {}, now: number = Date.now(), days = 14): boolean {
    if (hasAttempts(progress, c.id)) return false;
    const added = Date.parse(c.createdAt ?? "");
    if (Number.isNaN(added)) return false;
    const age = now - added;
    return age >= 0 && age < days * 86_400_000;
}

// ── Ordering ────────────────────────────────────────────────────────────────

const titleOf = (c: LibraryCase): string => c.displayTitle || c.title;
// The last tie-break is the id, so two cases with the same title never swap places when the input order changes.
const byTitle = (a: LibraryCase, b: LibraryCase): number => titleOf(a).localeCompare(titleOf(b), "en", { numeric: true }) || a.id.localeCompare(b.id);
const stamp = (c: LibraryCase): number => {
    const t = Date.parse(c.updatedAt || c.createdAt || "");
    return Number.isNaN(t) ? 0 : t;
};

export function sortCases<T extends LibraryCase>(cases: readonly T[], sort: SortKey, progress: ProgressMap = {}): T[] {
    const list = [...cases];
    const level = (c: LibraryCase) => difficultyLevel(c.difficulty);
    switch (sort) {
        case "shortest":
            return list.sort((a, b) => a.estimatedTime - b.estimatedTime || level(a) - level(b) || byTitle(a, b));
        case "easiest":
            return list.sort((a, b) => level(a) - level(b) || a.estimatedTime - b.estimatedTime || byTitle(a, b));
        case "hardest":
            return list.sort((a, b) => level(b) - level(a) || b.estimatedTime - a.estimatedTime || byTitle(a, b));
        case "newest":
            return list.sort((a, b) => stamp(b) - stamp(a) || byTitle(a, b));
        case "recommended":
        default:
            return list.sort((a, b) => {
                const pa = progress[a.id];
                const pb = progress[b.id];
                const aNew = !hasAttempts(progress, a.id);
                const bNew = !hasAttempts(progress, b.id);
                if (aNew !== bNew) return aNew ? -1 : 1;
                // not tried yet: the easiest and shortest first
                if (aNew) return level(a) - level(b) || a.estimatedTime - b.estimatedTime || byTitle(a, b);
                // tried: the weakest first, then the one you left longest
                return (pa?.best ?? 0) - (pb?.best ?? 0) || Date.parse(pa?.last ?? "") - Date.parse(pb?.last ?? "") || byTitle(a, b);
            });
    }
}

// ── Summaries ───────────────────────────────────────────────────────────────

export interface Specialty {
    name: string;
    count: number;
}

/** The specialties in the list, biggest first, then alphabetical. */
export function specialtiesOf(cases: readonly LibraryCase[]): Specialty[] {
    const counts = new Map<string, number>();
    for (const c of cases) counts.set(c.category || "Other", (counts.get(c.category || "Other") ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function countByDifficulty(cases: readonly LibraryCase[]): Record<DifficultyLevel, number> {
    const out: Record<DifficultyLevel, number> = { 1: 0, 2: 0, 3: 0 };
    for (const c of cases) out[difficultyLevel(c.difficulty)]++;
    return out;
}

export interface FacetCounts {
    /** Every specialty in the library, with how many cases it would show under the OTHER filters. */
    specialties: Specialty[];
    difficulty: Record<DifficultyLevel, number>;
    status: Record<StatusFilter, number>;
}

/**
 * The numbers beside each filter option: how many cases you would see if you chose it, given the
 * other filters already on. So choosing "Beginner" changes the specialty counts to match, and an
 * option that would show nothing reads 0 instead of promising a result.
 */
export function facetCounts(cases: readonly LibraryCase[], f: Filters, progress: ProgressMap = {}, saved: ReadonlySet<string> = new Set()): FacetCounts {
    const forSpecialties = filterCases(cases, { ...f, specialty: "all" }, progress, saved);
    const shown = new Map(specialtiesOf(forSpecialties).map((s) => [s.name, s.count]));
    const specialties = specialtiesOf(cases).map((s) => ({ name: s.name, count: shown.get(s.name) ?? 0 }));
    const forStatus = filterCases(cases, { ...f, status: "all" }, progress, saved);
    return {
        specialties,
        difficulty: countByDifficulty(filterCases(cases, { ...f, difficulty: 0 }, progress, saved)),
        status: { all: forStatus.length, new: forStatus.filter((c) => !hasAttempts(progress, c.id)).length, attempted: forStatus.filter((c) => hasAttempts(progress, c.id)).length },
    };
}

export interface LibrarySummary {
    total: number;
    specialties: number;
    /** How many of these cases the student has tried. */
    attempted: number;
    averageMinutes: number;
}

export function summarise(cases: readonly LibraryCase[], progress: ProgressMap = {}): LibrarySummary {
    const minutes = cases.reduce((s, c) => s + (Number.isFinite(c.estimatedTime) ? c.estimatedTime : 0), 0);
    return {
        total: cases.length,
        specialties: new Set(cases.map((c) => c.category)).size,
        attempted: cases.filter((c) => hasAttempts(progress, c.id)).length,
        averageMinutes: cases.length ? Math.round(minutes / cases.length) : 0,
    };
}

/** These first, in the order given, then the rest in theirs: a stable partition. Ids not in the list are ignored. */
export function pinFirst<T extends { id: string }>(items: readonly T[], ids: ReadonlySet<string>): T[] {
    if (ids.size === 0) return [...items];
    return [...items.filter((i) => ids.has(i.id)), ...items.filter((i) => !ids.has(i.id))];
}

/** How the student is doing in one specialty. */
export interface SpecialtyStrength {
    name: string;
    /** Cases in the library under this specialty. */
    total: number;
    /** How many of them the student has tried. */
    tried: number;
    /** The mean of the best score on each tried case, 0–100; null until the first attempt (not 0: nothing is known yet). */
    average: number | null;
    band: ScoreBand | null;
}

/**
 * Every specialty in the library and how the student is doing in it: how many of its cases they have tried,
 * and the mean of their best score on each. Strongest first, then the ones not started, by name.
 */
export function specialtyStrength(cases: readonly LibraryCase[], progress: ProgressMap = {}): SpecialtyStrength[] {
    const groups = new Map<string, { total: number; best: number[] }>();
    for (const c of cases) {
        const name = c.category || "Other";
        const group = groups.get(name) ?? { total: 0, best: [] };
        group.total++;
        if (hasAttempts(progress, c.id)) group.best.push(Math.max(0, Math.min(100, progress[c.id].best)));
        groups.set(name, group);
    }
    return [...groups]
        .map(([name, g]) => {
            const average = g.best.length > 0 ? Math.round(g.best.reduce((sum, n) => sum + n, 0) / g.best.length) : null;
            return { name, total: g.total, tried: g.best.length, average, band: average === null ? null : scoreBand(average) };
        })
        .sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.name.localeCompare(b.name));
}

/**
 * The case to suggest next: the first one not tried, easiest first; once everything has been tried,
 * the one done worst, if it is not already a good score.
 */
export function suggestNext<T extends LibraryCase>(cases: readonly T[], progress: ProgressMap = {}): T | undefined {
    const [first] = sortCases(cases, "recommended", progress);
    if (!first) return undefined;
    if (!hasAttempts(progress, first.id)) return first;
    return (progress[first.id]?.best ?? 0) < 90 ? first : undefined;
}

// ── Scores ──────────────────────────────────────────────────────────────────

export type ScoreBand = "ok" | "warn" | "crit";

/** 90 and above is good, 70 and above is passing, below that needs work. */
export function scoreBand(score: number): ScoreBand {
    return score >= 90 ? "ok" : score >= 70 ? "warn" : "crit";
}

export { relativeDay } from "./relative-day";

// ── Greeting ────────────────────────────────────────────────────────────────

export function greetingFor(hour: number): string {
    if (hour < 5) return "Good evening";
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

/** "Abhishek Singh" → "Abhishek"; an empty or placeholder name → "". */
export function firstNameOf(displayName: string | undefined | null): string {
    const first = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
    return ["", "User", "Loading...", "Doctor"].includes(first) ? "" : first;
}

/** What a student can earn from a case, as text: "50 XP". Never invented: it is the case's own reward. */
export function xpLabel(c: LibraryCase): string {
    return `${c.xpReward && c.xpReward > 0 ? c.xpReward : 50} XP`;
}

// ── The student's record ────────────────────────────────────────────────────

/** One attempt, as the record keeps it: enough to draw a trend. */
export interface AttemptPoint {
    score: number;
    xp: number;
    /** ISO time. */
    at: string;
}

export interface RecentAttempt {
    id: number | string;
    caseId?: string;
    title: string;
    score: number;
    xpEarned: number;
    timeTaken: string;
    createdAt?: string;
}

export interface DashboardStats {
    /** Every attempt counts, so a retake adds to it. */
    totalXP: number;
    casesSolved: number;
    streakDays: number;
    /** The mean score over every attempt, or null before the first. */
    averageScore: number | null;
    attempts: number;
    /** The latest five, newest first. */
    recentCases: RecentAttempt[];
    /** The latest thirty, oldest first, for the trend lines. */
    history: AttemptPoint[];
}

export const NO_STATS: DashboardStats = { totalXP: 0, casesSolved: 0, streakDays: 0, averageScore: null, attempts: 0, recentCases: [], history: [] };

/** A row of the attempts table. */
export interface AttemptRecord extends AttemptRow {
    id: number | string;
    xp_earned: number | null;
    time_taken: number | null;
}

/** "14m 20s", "45s". */
export function formatDuration(totalSeconds: number | null | undefined): string {
    const s = Math.max(0, Math.round(Number.isFinite(totalSeconds as number) ? (totalSeconds as number) : 0));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * The numbers on the dashboard, from the attempts table. `titleOf` names a case (the library knows), so a case
 * that is in the library but not the database still has a name. Order does not matter: it is sorted here.
 */
export function buildDashboardStats(rows: readonly AttemptRecord[], titleOf: (caseId: string) => string | undefined, streakDays: number): DashboardStats {
    const valid = rows.filter((r) => r && typeof r.case_id === "string" && r.case_id);
    if (valid.length === 0) return { ...NO_STATS, streakDays: Math.max(0, num(streakDays)) };

    const newestFirst = [...valid].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
    const totalScore = valid.reduce((n, r) => n + num(r.score), 0);

    return {
        totalXP: valid.reduce((n, r) => n + num(r.xp_earned), 0),
        casesSolved: new Set(valid.map((r) => r.case_id)).size,
        streakDays: Math.max(0, num(streakDays)),
        averageScore: Math.round(totalScore / valid.length),
        attempts: valid.length,
        recentCases: newestFirst.slice(0, 5).map((r) => ({
            id: r.id,
            caseId: r.case_id,
            title: titleOf(r.case_id) || r.case_id,
            score: num(r.score),
            xpEarned: num(r.xp_earned),
            timeTaken: formatDuration(r.time_taken),
            createdAt: r.created_at,
        })),
        history: newestFirst
            .slice(0, 30)
            .reverse()
            .map((r) => ({ score: num(r.score), xp: num(r.xp_earned), at: r.created_at })),
    };
}

// ── XP, case by case ────────────────────────────────────────────────────────

/** What a case has paid so far, from the best attempt (the score is a percentage of the case's own XP), and what it could. */
export function caseXp(c: LibraryCase, progress: ProgressMap): { earned: number; max: number } {
    const max = c.xpReward && c.xpReward > 0 ? c.xpReward : 50;
    const best = progress[c.id];
    const earned = best && best.attempts > 0 ? Math.round((Math.min(100, Math.max(0, best.best)) / 100) * max) : 0;
    return { earned, max };
}

export interface LedgerEntry {
    id: string;
    title: string;
    earned: number;
    max: number;
    best: number;
    attempts: number;
    /** How the best attempt went, or null for a case not tried. */
    band: ScoreBand | null;
    patient?: { age?: number; gender?: string };
}

/**
 * The library as a ledger of XP: the cases you have earned from, most first, then the ones you have not
 * tried, easiest first. Each is what it has paid against what it could.
 */
export function xpLedger(cases: readonly LibraryCase[], progress: ProgressMap): LedgerEntry[] {
    const entry = (c: LibraryCase): LedgerEntry => {
        const { earned, max } = caseXp(c, progress);
        const p = progress[c.id];
        const tried = !!p && p.attempts > 0;
        return { id: c.id, title: c.displayTitle || c.title, earned, max, best: tried ? p.best : 0, attempts: tried ? p.attempts : 0, band: tried ? scoreBand(p.best) : null, patient: c.patient };
    };
    const tried = cases.filter((c) => hasAttempts(progress, c.id)).map(entry);
    const untried = sortCases(
        cases.filter((c) => !hasAttempts(progress, c.id)),
        "recommended",
        progress
    ).map(entry);
    tried.sort((a, b) => b.earned - a.earned || b.best - a.best || a.title.localeCompare(b.title, "en", { numeric: true }) || a.id.localeCompare(b.id));
    return [...tried, ...untried];
}

/** A sentence for a screen reader and a tooltip: "72-year-old man…: best 55%, 28 of 50 XP, 3 attempts". */
export function ledgerLabel(e: LedgerEntry): string {
    if (e.attempts === 0) return `${e.title}: not tried yet, worth up to ${e.max} XP`;
    return `${e.title}: best ${e.best}%, ${e.earned} of ${e.max} XP, ${e.attempts} ${e.attempts === 1 ? "attempt" : "attempts"}`;
}

// ── Activity and trend ──────────────────────────────────────────────────────

const localDay = (d: Date): number => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/** For each of the last seven days (oldest first, today last): did the student do anything that day? By the local calendar. */
export function weekActivity(timestamps: readonly string[], now: Date = new Date()): boolean[] {
    const days = new Set<number>();
    for (const t of timestamps) {
        const d = new Date(t);
        if (!Number.isNaN(d.getTime())) days.add(localDay(d));
    }
    return Array.from({ length: 7 }, (_, i) => days.has(localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i)))));
}

/** The points of a trend line inside a `width` × `height` box, the first value at the left and the last at the right. */
export function sparkline(values: readonly number[], width: number, height: number, opts: { min?: number; max?: number; pad?: number } = {}): Array<[number, number]> {
    const v = values.filter((n) => Number.isFinite(n));
    if (v.length === 0) return [];
    const pad = opts.pad ?? 2;
    const lo = opts.min ?? Math.min(...v);
    const hi = opts.max ?? Math.max(...v);
    const flat = hi === lo;
    const span = hi - lo || 1;
    const x = (i: number) => (v.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (v.length - 1));
    // A flat series (one point, or every value the same) runs along the middle, not the floor.
    const y = (n: number) => (flat ? height / 2 : height - pad - ((Math.min(hi, Math.max(lo, n)) - lo) / span) * (height - 2 * pad));
    return v.map((n, i) => [Math.round(x(i) * 10) / 10, Math.round(y(n) * 10) / 10]);
}

/** Running total of a list: 5, 3, 4 → 5, 8, 12. */
export function cumulative(values: readonly number[]): number[] {
    let sum = 0;
    return values.map((n) => (sum += Number.isFinite(n) ? n : 0));
}

/** How the latest attempt compares with the ones before it: null until there are two. */
export function scoreTrend(scores: readonly number[]): { latest: number; delta: number } | null {
    if (scores.length < 2) return null;
    const latest = scores[scores.length - 1];
    const before = scores.slice(0, -1);
    return { latest, delta: Math.round(latest - before.reduce((a, b) => a + b, 0) / before.length) };
}
