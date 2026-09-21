import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    activeFilterCount,
    buildDashboardStats,
    caseXp,
    cumulative,
    formatDuration,
    ledgerLabel,
    scoreTrend,
    sparkline,
    weekActivity,
    xpLedger,
    countByDifficulty,
    difficultyLevel,
    facetCounts,
    filterCases,
    isNewCase,
    firstNameOf,
    greetingFor,
    matchesQuery,
    NO_FILTERS,
    normalise,
    pinFirst,
    relativeDay,
    scoreBand,
    sortCases,
    specialtiesOf,
    specialtyStrength,
    suggestNext,
    summarise,
    summariseAttempts,
    xpLabel,
    type LibraryCase,
    type ProgressMap,
} from "../case-library";

const make = (id: string, over: Partial<LibraryCase> = {}): LibraryCase => ({
    id,
    title: `Title ${id}`,
    displayTitle: `Patient ${id}`,
    displayTags: [],
    category: "Cardiology",
    difficulty: "Intermediate",
    estimatedTime: 20,
    xpReward: 50,
    ...over,
});

// A library shaped like the real one.
const LIBRARY: LibraryCase[] = [
    make("adpkd", { displayTitle: "49-year-old woman with recurrent flank pain and blood in urine", category: "Nephrology", estimatedTime: 30, displayTags: ["nephrology", "haematuria", "flank-pain"] }),
    make("malaria", { displayTitle: "24-year-old man with three days of fever after returning from Nigeria", category: "Infectious Disease", estimatedTime: 25, displayTags: ["infectious-disease", "fever", "returning-traveller"] }),
    make("b12", { displayTitle: "63-year-old woman with tiredness, breathlessness and numb feet", category: "Haematology", estimatedTime: 25 }),
    make("gastro", { displayTitle: "2-year-old boy with vomiting and watery diarrhea", category: "Pediatrics", difficulty: "Beginner", estimatedTime: 20 }),
    make("migraine", { displayTitle: "21-year-old female with recurrent visual disturbances and headache", category: "Neurology", estimatedTime: 25 }),
    make("goitre", { displayTitle: "54-year-old woman with a 15-day neck swelling", category: "Internal Medicine", estimatedTime: 20 }),
    make("neonate", { displayTitle: "4-week-old male infant with yellow eyes and face", category: "Pediatrics", difficulty: "Beginner", estimatedTime: 20 }),
    make("chb", { displayTitle: "72-year-old man with recurrent fainting episodes", category: "Cardiology", estimatedTime: 25 }),
    make("stemi", { displayTitle: "58-year-old man with severe chest pain and sweating", category: "Cardiology", difficulty: "Advanced", estimatedTime: 25, xpReward: 100, live: true }),
];

const ids = (list: readonly LibraryCase[]) => list.map((c) => c.id);

describe("library: difficulty", () => {
    it("reads any spelling of the three levels, and defaults to the middle", () => {
        assert.equal(difficultyLevel("Beginner"), 1);
        assert.equal(difficultyLevel(" beginner "), 1);
        assert.equal(difficultyLevel("Intermediate"), 2);
        assert.equal(difficultyLevel("ADVANCED"), 3);
        assert.equal(difficultyLevel(undefined), 2);
        assert.equal(difficultyLevel("whatever"), 2);
    });

    it("counts the cases at each level", () => {
        assert.deepEqual(countByDifficulty(LIBRARY), { 1: 2, 2: 6, 3: 1 });
    });
});

describe("library: search", () => {
    it("matches words in any order, ignoring case, accents and hyphens", () => {
        assert.ok(matchesQuery(LIBRARY[0], "FLANK pain"));
        assert.ok(matchesQuery(LIBRARY[0], "pain flank"));
        assert.ok(matchesQuery(LIBRARY[1], "returning traveller"), "the tag returning-traveller");
        assert.ok(matchesQuery(make("x", { displayTitle: "Café patient" }), "cafe"));
        assert.equal(normalise("Vitamin-B12  Deficiency!"), "vitamin b12 deficiency");
    });

    it("needs every word, and matches everything when nothing is typed", () => {
        assert.ok(!matchesQuery(LIBRARY[0], "flank fever"));
        assert.ok(matchesQuery(LIBRARY[0], ""));
        assert.ok(matchesQuery(LIBRARY[0], "   "));
    });

    it("looks at the specialty as well as the title and tags", () => {
        assert.deepEqual(ids(filterCases(LIBRARY, { ...NO_FILTERS, query: "haematology" })), ["b12"]);
    });

    it("never looks at anything but the anonymised fields (the title on the card is all it can see)", () => {
        const secret = make("secret", { title: "Acute pulmonary embolism", displayTitle: "58-year-old with sudden breathlessness", displayTags: ["breathlessness"] }) as LibraryCase & { diagnosis: string };
        secret.diagnosis = "pulmonary embolism";
        assert.ok(!matchesQuery(secret, "pulmonary"), "the real title is not searched");
        assert.ok(!matchesQuery(secret, "embolism"));
        assert.ok(matchesQuery(secret, "breathlessness"));
    });
});

describe("library: filters", () => {
    it("filters by specialty, difficulty and status together", () => {
        assert.deepEqual(ids(filterCases(LIBRARY, { ...NO_FILTERS, specialty: "Cardiology" })), ["chb", "stemi"]);
        assert.deepEqual(ids(filterCases(LIBRARY, { ...NO_FILTERS, difficulty: 1 })), ["gastro", "neonate"]);
        assert.deepEqual(ids(filterCases(LIBRARY, { ...NO_FILTERS, specialty: "Pediatrics", difficulty: 3 })), []);
        const progress: ProgressMap = { chb: { attempts: 2, best: 80, last: "2026-09-01T10:00:00Z" } };
        assert.deepEqual(ids(filterCases(LIBRARY, { ...NO_FILTERS, specialty: "Cardiology", status: "attempted" }, progress)), ["chb"]);
        assert.deepEqual(ids(filterCases(LIBRARY, { ...NO_FILTERS, specialty: "Cardiology", status: "new" }, progress)), ["stemi"]);
    });

    it("counts a case with no recorded attempts as new, even if it has an empty progress row", () => {
        const progress: ProgressMap = { chb: { attempts: 0, best: 0, last: "" } };
        assert.ok(filterCases(LIBRARY, { ...NO_FILTERS, status: "new" }, progress).some((c) => c.id === "chb"));
    });

    it("counts the filters that are on", () => {
        assert.equal(activeFilterCount(NO_FILTERS), 0);
        assert.equal(activeFilterCount({ query: "  ", specialty: "all", difficulty: 0, status: "all" }), 0);
        assert.equal(activeFilterCount({ query: "x", specialty: "Cardiology", difficulty: 2, status: "new" }), 4);
    });

    it("never changes the list it is given", () => {
        const before = ids(LIBRARY);
        filterCases(LIBRARY, { ...NO_FILTERS, query: "man" });
        sortCases(LIBRARY, "shortest");
        assert.deepEqual(ids(LIBRARY), before);
    });
});

describe("library: order", () => {
    it("puts what you have not tried first, easiest first, then the cases you did worst on", () => {
        const progress: ProgressMap = {
            gastro: { attempts: 1, best: 95, last: "2026-09-10T10:00:00Z" },
            chb: { attempts: 3, best: 55, last: "2026-09-12T10:00:00Z" },
            stemi: { attempts: 1, best: 72, last: "2026-09-01T10:00:00Z" },
        };
        const order = ids(sortCases(LIBRARY, "recommended", progress));
        // not tried: neonate (beginner) first, then the intermediates shortest first, alphabetically within a tie
        assert.deepEqual(order.slice(0, 6), ["neonate", "goitre", "b12", "malaria", "migraine", "adpkd"].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
        assert.equal(order[0], "neonate");
        assert.ok(order.indexOf("adpkd") < order.indexOf("chb"), "everything untried comes before anything tried");
        // tried: weakest first
        assert.deepEqual(order.slice(6), ["chb", "stemi", "gastro"]);
    });

    it("recommends the easiest, shortest case to someone who has done nothing", () => {
        const first = sortCases(LIBRARY, "recommended")[0];
        assert.equal(first.difficulty, "Beginner");
        assert.equal(first.estimatedTime, 20);
    });

    it("sorts by time, by difficulty and by date", () => {
        assert.deepEqual(sortCases(LIBRARY, "shortest").map((c) => c.estimatedTime), [20, 20, 20, 25, 25, 25, 25, 25, 30]);
        assert.equal(sortCases(LIBRARY, "easiest")[0].difficulty, "Beginner");
        assert.equal(sortCases(LIBRARY, "hardest")[0].id, "stemi");
        const dated = [make("old", { updatedAt: "2026-01-01T00:00:00Z" }), make("new", { updatedAt: "2026-09-01T00:00:00Z" }), make("undated")];
        assert.deepEqual(ids(sortCases(dated, "newest")), ["new", "old", "undated"]);
    });

    it("breaks ties the same way every time, so the list never shuffles", () => {
        const twins = [make("b", { displayTitle: "Same" }), make("a", { displayTitle: "Same" })];
        for (const sort of ["recommended", "shortest", "easiest", "hardest", "newest"] as const) {
            assert.deepEqual(ids(sortCases(twins, sort)), ids(sortCases([...twins].reverse(), sort)), sort);
            assert.deepEqual(ids(sortCases(twins, sort)), ["a", "b"], "the id is the last tie-break");
        }
        const numbered = [make("n10", { displayTitle: "10-year-old" }), make("n2", { displayTitle: "2-year-old" })];
        assert.deepEqual(ids(sortCases(numbered, "shortest")), ["n2", "n10"], "2 comes before 10, not after");
    });
});

describe("library: summaries and the next case", () => {
    it("lists specialties biggest first", () => {
        const s = specialtiesOf(LIBRARY);
        assert.deepEqual(s.slice(0, 2), [{ name: "Cardiology", count: 2 }, { name: "Pediatrics", count: 2 }]);
        assert.equal(s.length, 7);
        assert.equal(s.reduce((n, x) => n + x.count, 0), LIBRARY.length);
    });

    it("summarises the library and the student's progress in it", () => {
        const progress: ProgressMap = { chb: { attempts: 1, best: 80, last: "2026-09-01T00:00:00Z" }, gone: { attempts: 4, best: 90, last: "2026-09-01T00:00:00Z" } };
        const s = summarise(LIBRARY, progress);
        assert.equal(s.total, 9);
        assert.equal(s.specialties, 7);
        assert.equal(s.attempted, 1, "a case that is no longer in the library is not counted");
        assert.equal(s.averageMinutes, Math.round((30 + 25 + 25 + 20 + 25 + 20 + 20 + 25 + 25) / 9));
        assert.deepEqual(summarise([]), { total: 0, specialties: 0, attempted: 0, averageMinutes: 0 });
    });

    it("suggests the next case, and stops when there is nothing worth suggesting", () => {
        assert.equal(suggestNext(LIBRARY)?.difficulty, "Beginner");
        assert.equal(suggestNext([]), undefined);

        const all: ProgressMap = Object.fromEntries(LIBRARY.map((c, i) => [c.id, { attempts: 1, best: 60 + i * 4, last: "2026-09-01T00:00:00Z" }]));
        assert.equal(suggestNext(LIBRARY, all)?.id, "adpkd", "everything tried: the weakest");
        const done: ProgressMap = Object.fromEntries(LIBRARY.map((c) => [c.id, { attempts: 2, best: 95, last: "2026-09-01T00:00:00Z" }]));
        assert.equal(suggestNext(LIBRARY, done), undefined, "everything mastered: nothing to suggest");
    });
});

describe("library: scores, dates, names", () => {
    it("grades a score", () => {
        assert.equal(scoreBand(100), "ok");
        assert.equal(scoreBand(90), "ok");
        assert.equal(scoreBand(89), "warn");
        assert.equal(scoreBand(70), "warn");
        assert.equal(scoreBand(69), "crit");
        assert.equal(scoreBand(0), "crit");
    });

    it("says how long ago, in words", () => {
        const now = Date.parse("2026-09-21T12:00:00Z");
        const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();
        assert.equal(relativeDay(ago(0), now), "today");
        assert.equal(relativeDay(ago(1), now), "yesterday");
        assert.equal(relativeDay(ago(5), now), "5 days ago");
        assert.equal(relativeDay(ago(21), now), "3 weeks ago");
        assert.equal(relativeDay(ago(100), now), "3 months ago");
        assert.equal(relativeDay(ago(800), now), "2 years ago");
        assert.equal(relativeDay("nonsense", now), "");
        assert.equal(relativeDay(undefined, now), "");
        assert.equal(relativeDay(new Date(now + 3600_000).toISOString(), now), "today", "a clock a little ahead is still today");
    });

    it("greets by the hour", () => {
        assert.equal(greetingFor(8), "Good morning");
        assert.equal(greetingFor(13), "Good afternoon");
        assert.equal(greetingFor(19), "Good evening");
        assert.equal(greetingFor(2), "Good evening");
    });

    it("takes a first name from a display name, and none from a placeholder", () => {
        assert.equal(firstNameOf("Abhishek Singh"), "Abhishek");
        assert.equal(firstNameOf("  Priya  "), "Priya");
        assert.equal(firstNameOf("User"), "");
        assert.equal(firstNameOf("Loading..."), "");
        assert.equal(firstNameOf(undefined), "");
    });

    it("states the XP a case can really award, from the case itself (the old cards said time × 5)", () => {
        assert.equal(xpLabel(make("a", { xpReward: 100 })), "100 XP");
        assert.equal(xpLabel(make("a", { xpReward: undefined })), "50 XP", "the same default the scorer uses");
        assert.equal(xpLabel(make("a", { xpReward: 0 })), "50 XP");
        assert.equal(xpLabel(make("a", { estimatedTime: 30, xpReward: 50 })), "50 XP", "not 150");
    });
});

describe("library: progress from the attempts table", () => {
    it("groups attempts by case: how many, the best score, the latest", () => {
        const p = summariseAttempts([
            { case_id: "chb", score: 55, created_at: "2026-09-01T10:00:00Z" },
            { case_id: "chb", score: 80, created_at: "2026-09-10T10:00:00Z" },
            { case_id: "chb", score: 70, created_at: "2026-09-05T10:00:00Z" },
            { case_id: "stemi", score: 90, created_at: "2026-09-02T10:00:00Z" },
        ]);
        assert.deepEqual(p.chb, { attempts: 3, best: 80, last: "2026-09-10T10:00:00Z" }, "the latest is the latest, whatever order the rows come in");
        assert.deepEqual(p.stemi, { attempts: 1, best: 90, last: "2026-09-02T10:00:00Z" });
    });

    it("copes with a missing score, a bad date, and rows that are not rows", () => {
        const p = summariseAttempts([
            { case_id: "a", score: null, created_at: "not a date" },
            { case_id: "a", score: 40, created_at: "2026-09-01T00:00:00Z" },
            { case_id: "", score: 99, created_at: "2026-09-01T00:00:00Z" },
            null as never,
            { case_id: "b", score: Number.NaN, created_at: "2026-09-01T00:00:00Z" },
        ]);
        assert.deepEqual(p.a, { attempts: 2, best: 40, last: "2026-09-01T00:00:00Z" });
        assert.deepEqual(p.b, { attempts: 1, best: 0, last: "2026-09-01T00:00:00Z" });
        assert.equal(Object.keys(p).length, 2, "a row with no case id is dropped");
        assert.deepEqual(summariseAttempts([]), {});
    });

    it("feeds straight into the filters and the ordering", () => {
        const progress = summariseAttempts([{ case_id: "chb", score: 60, created_at: "2026-09-01T00:00:00Z" }]);
        assert.deepEqual(ids(filterCases(LIBRARY, { ...NO_FILTERS, status: "attempted" }, progress)), ["chb"]);
        assert.equal(sortCases(LIBRARY, "recommended", progress).at(-1)?.id, "chb");
    });
});

describe("library: the numbers beside each filter", () => {
    const progress: ProgressMap = { chb: { attempts: 2, best: 80, last: "2026-09-01T00:00:00Z" }, gastro: { attempts: 1, best: 95, last: "2026-09-02T00:00:00Z" } };
    const count = (f = NO_FILTERS) => facetCounts(LIBRARY, f, progress);

    it("with no filters, counts the whole library", () => {
        const c = count();
        assert.equal(c.specialties.reduce((n, s) => n + s.count, 0), 9);
        assert.deepEqual(c.difficulty, { 1: 2, 2: 6, 3: 1 });
        assert.deepEqual(c.status, { all: 9, new: 7, attempted: 2 });
        assert.deepEqual(c.specialties[0], { name: "Cardiology", count: 2 });
    });

    it("counts each option under the OTHER filters, so it says what choosing it would show", () => {
        const c = count({ ...NO_FILTERS, difficulty: 1 });
        assert.deepEqual(c.specialties.filter((s) => s.count > 0), [{ name: "Pediatrics", count: 2 }]);
        assert.deepEqual(c.difficulty, { 1: 2, 2: 6, 3: 1 }, "the difficulty options ignore the difficulty filter itself");
        assert.deepEqual(c.status, { all: 2, new: 1, attempted: 1 });
    });

    it("still lists a specialty that would show nothing, at zero, and lists every specialty always", () => {
        const c = count({ ...NO_FILTERS, status: "attempted" });
        assert.equal(c.specialties.length, 7);
        assert.deepEqual(c.specialties.filter((s) => s.count > 0).map((s) => s.name).sort(), ["Cardiology", "Pediatrics"]);
        assert.equal(c.specialties.find((s) => s.name === "Neurology")?.count, 0);
    });

    it("agrees with the list itself: choosing an option shows exactly that many cases", () => {
        const start = { ...NO_FILTERS, difficulty: 2 as const };
        for (const s of count(start).specialties) {
            assert.equal(filterCases(LIBRARY, { ...start, specialty: s.name }, progress).length, s.count, s.name);
        }
        for (const status of ["all", "new", "attempted"] as const) {
            assert.equal(filterCases(LIBRARY, { ...start, status }, progress).length, count(start).status[status], status);
        }
    });
});

describe("record: the dashboard numbers", () => {
    const row = (id: number, case_id: string, score: number | null, xp: number | null, at: string, time: number | null = 600) => ({ id, case_id, score, xp_earned: xp, time_taken: time, created_at: at });
    const title = (id: string) => ({ chb: "Complete heart block", stemi: "Acute anterior STEMI" })[id as "chb" | "stemi"];

    it("adds it up: XP over every attempt, distinct cases, the mean score", () => {
        const s = buildDashboardStats(
            [row(1, "chb", 40, 20, "2026-09-01T10:00:00Z"), row(2, "chb", 70, 35, "2026-09-05T10:00:00Z"), row(3, "stemi", 10, 10, "2026-09-03T10:00:00Z", 45)],
            title,
            3
        );
        assert.equal(s.totalXP, 65, "a retake adds XP");
        assert.equal(s.casesSolved, 2);
        assert.equal(s.averageScore, 40);
        assert.equal(s.attempts, 3);
        assert.equal(s.streakDays, 3);
    });

    it("lists the latest five newest first, named by the library, with a readable duration", () => {
        const rows = Array.from({ length: 8 }, (_, i) => row(i + 1, i % 2 ? "chb" : "unknown-case", 50 + i, 20, `2026-09-0${i + 1}T10:00:00Z`, 65 + i * 60));
        const s = buildDashboardStats(rows, title, 0);
        assert.equal(s.recentCases.length, 5);
        assert.deepEqual(s.recentCases.map((r) => r.id), [8, 7, 6, 5, 4]);
        assert.equal(s.recentCases[0].title, "Complete heart block");
        assert.equal(s.recentCases[1].title, "unknown-case", "a case the library does not know falls back to its id");
        assert.equal(s.recentCases[0].timeTaken, "8m 5s");
    });

    it("keeps the latest thirty, oldest first, for the trend lines", () => {
        const rows = Array.from({ length: 40 }, (_, i) => row(i + 1, "chb", i, 1, new Date(Date.UTC(2026, 7, 1 + i)).toISOString()));
        const s = buildDashboardStats([...rows].reverse(), title, 0);
        assert.equal(s.history.length, 30);
        assert.equal(s.history[0].score, 10, "the oldest of the latest thirty");
        assert.equal(s.history[29].score, 39, "the newest is last");
    });

    it("is the same whatever order the rows arrive in", () => {
        const rows = [row(1, "chb", 40, 20, "2026-09-01T10:00:00Z"), row(2, "stemi", 70, 35, "2026-09-05T10:00:00Z"), row(3, "chb", 55, 27, "2026-09-03T10:00:00Z")];
        assert.deepEqual(buildDashboardStats(rows, title, 1), buildDashboardStats([...rows].reverse(), title, 1));
    });

    it("has a sensible empty state and copes with missing numbers", () => {
        const none = buildDashboardStats([], title, 4);
        assert.deepEqual(none, { totalXP: 0, casesSolved: 0, streakDays: 4, averageScore: null, attempts: 0, recentCases: [], history: [] });
        const odd = buildDashboardStats([row(1, "chb", null, null, "bad date", null), null as never, row(2, "", 90, 45, "2026-09-01T00:00:00Z")], title, Number.NaN);
        assert.equal(odd.attempts, 1, "a row with no case id is not an attempt");
        assert.equal(odd.totalXP, 0);
        assert.equal(odd.averageScore, 0);
        assert.equal(odd.streakDays, 0);
        assert.equal(odd.recentCases[0].timeTaken, "0s");
    });

    it("writes a duration the way a person would", () => {
        assert.equal(formatDuration(45), "45s");
        assert.equal(formatDuration(60), "1m 0s");
        assert.equal(formatDuration(860), "14m 20s");
        assert.equal(formatDuration(null), "0s");
        assert.equal(formatDuration(-5), "0s");
    });
});

describe("record: XP, case by case", () => {
    const progress: ProgressMap = {
        chb: { attempts: 3, best: 55, last: "2026-09-10T00:00:00Z" },
        stemi: { attempts: 1, best: 90, last: "2026-09-02T00:00:00Z" },
        gastro: { attempts: 2, best: 100, last: "2026-09-01T00:00:00Z" },
    };
    const byId = (id: string) => LIBRARY.find((c) => c.id === id)!;

    it("pays a case as its best score, as a percentage of what the case is worth", () => {
        assert.deepEqual(caseXp(byId("chb"), progress), { earned: 28, max: 50 }, "55% of 50, rounded");
        assert.deepEqual(caseXp(byId("stemi"), progress), { earned: 90, max: 100 }, "a live simulation is worth 100");
        assert.deepEqual(caseXp(byId("gastro"), progress), { earned: 50, max: 50 });
        assert.deepEqual(caseXp(byId("adpkd"), progress), { earned: 0, max: 50 }, "not tried: nothing earned, and the default worth");
        assert.equal(caseXp({ ...byId("adpkd"), xpReward: 0 }, progress).max, 50);
    });

    it("never pays more than a case is worth, whatever the score says", () => {
        const wild: ProgressMap = { chb: { attempts: 1, best: 250, last: "2026-09-01T00:00:00Z" }, gastro: { attempts: 1, best: -20, last: "2026-09-01T00:00:00Z" } };
        assert.equal(caseXp(byId("chb"), wild).earned, 50);
        assert.equal(caseXp(byId("gastro"), wild).earned, 0);
    });

    it("lists the cases that have paid, most first, then the ones not tried, easiest first", () => {
        const ledger = xpLedger(LIBRARY, progress);
        assert.equal(ledger.length, LIBRARY.length, "every case is on it");
        assert.deepEqual(ledger.slice(0, 3).map((e) => e.id), ["stemi", "gastro", "chb"], "90, 50, 28");
        assert.ok(ledger.slice(3).every((e) => e.attempts === 0 && e.earned === 0 && e.band === null));
        assert.equal(ledger[3].id, "neonate", "the easiest untried case comes first");
        assert.deepEqual(ledger.slice(0, 3).map((e) => e.band), ["ok", "ok", "crit"]);
    });

    it("adds up to what the cases have paid, and no case is counted twice", () => {
        const ledger = xpLedger(LIBRARY, progress);
        assert.equal(ledger.reduce((n, e) => n + e.earned, 0), 28 + 90 + 50);
        assert.equal(new Set(ledger.map((e) => e.id)).size, ledger.length);
        assert.equal(ledger.reduce((n, e) => n + e.max, 0), 8 * 50 + 100);
    });

    it("says what each entry is, in words", () => {
        const ledger = xpLedger(LIBRARY, progress);
        assert.equal(ledgerLabel(ledger[2]), "72-year-old man with recurrent fainting episodes: best 55%, 28 of 50 XP, 3 attempts");
        assert.match(ledgerLabel(ledger[1]), /2 attempts/);
        assert.equal(ledgerLabel(ledger[3]), "4-week-old male infant with yellow eyes and face: not tried yet, worth up to 50 XP");
        assert.equal(ledgerLabel({ ...ledger[0], attempts: 1 }).endsWith("1 attempt"), true, "one attempt, not 1 attempts");
    });
});

describe("record: activity and trend", () => {
    it("marks the days of the last week you did something, by the local calendar", () => {
        const now = new Date(2026, 8, 21, 15, 30);
        const at = (d: number, h = 12) => new Date(2026, 8, d, h).toISOString();
        assert.deepEqual(weekActivity([at(21, 9), at(19), at(15)], now), [true, false, false, false, true, false, true], "today is last; the 15th is six days ago");
        assert.deepEqual(weekActivity([at(14)], now), [false, false, false, false, false, false, false], "seven days ago is outside the week");
        assert.deepEqual(weekActivity([], now), Array(7).fill(false));
        assert.deepEqual(weekActivity(["nonsense"], now), Array(7).fill(false));
        assert.equal(weekActivity([at(21, 0), at(21, 23)], now).filter(Boolean).length, 1, "two attempts on one day is one day");
    });

    it("crosses a month boundary correctly", () => {
        const now = new Date(2026, 9, 2, 10);
        const days = weekActivity([new Date(2026, 8, 30, 20).toISOString(), new Date(2026, 9, 1, 8).toISOString()], now);
        // the last seven days are Sep 26, 27, 28, 29, 30, Oct 1, Oct 2
        assert.deepEqual(days, [false, false, false, false, true, true, false]);
    });

    it("draws a trend line inside its box, first value left and last value right", () => {
        const pts = sparkline([10, 50, 90], 100, 40, { min: 0, max: 100, pad: 2 });
        assert.equal(pts.length, 3);
        assert.equal(pts[0][0], 2);
        assert.equal(pts[2][0], 98);
        assert.ok(pts[0][1] > pts[1][1] && pts[1][1] > pts[2][1], "a higher score is higher on the screen");
        for (const [x, y] of pts) assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 40);
    });

    it("handles one point, none, a flat line and values outside the range", () => {
        assert.deepEqual(sparkline([], 100, 40), []);
        assert.deepEqual(sparkline([50], 100, 40), [[50, 20]]);
        const flat = sparkline([7, 7, 7], 100, 40);
        assert.ok(flat.every(([, y]) => Number.isFinite(y)), "no divide by zero");
        const clamped = sparkline([-50, 500], 100, 40, { min: 0, max: 100, pad: 0 });
        assert.deepEqual(clamped.map(([, y]) => y), [40, 0]);
        assert.equal(sparkline([Number.NaN, 5], 100, 40).length, 1, "a missing value is skipped");
    });

    it("keeps a running total", () => {
        assert.deepEqual(cumulative([5, 3, 4]), [5, 8, 12]);
        assert.deepEqual(cumulative([]), []);
        assert.deepEqual(cumulative([2, Number.NaN, 3]), [2, 2, 5]);
    });

    it("compares the latest score with the ones before it, once there are two", () => {
        assert.equal(scoreTrend([]), null);
        assert.equal(scoreTrend([80]), null);
        assert.deepEqual(scoreTrend([40, 60, 90]), { latest: 90, delta: 40 });
        assert.deepEqual(scoreTrend([90, 30]), { latest: 30, delta: -60 });
    });
});

describe("record: strength by specialty", () => {
    const lib: LibraryCase[] = [
        make("c1", { category: "Cardiology" }),
        make("c2", { category: "Cardiology" }),
        make("n1", { category: "Nephrology" }),
        make("p1", { category: "Pediatrics" }),
        make("x1", { category: "" }),
    ];
    const at = "2026-09-01T00:00:00.000Z";

    it("averages the best score on each tried case, out of what the library has", () => {
        const progress: ProgressMap = { c1: { attempts: 3, best: 90, last: at }, c2: { attempts: 1, best: 71, last: at } };
        const cardiology = specialtyStrength(lib, progress).find((s) => s.name === "Cardiology");
        // (90 + 71) / 2 = 80.5, which rounds up
        assert.deepEqual(cardiology, { name: "Cardiology", total: 2, tried: 2, average: 81, band: "warn" });
    });

    it("counts only the tried cases in the average, and says how many that is", () => {
        const progress: ProgressMap = { c1: { attempts: 1, best: 40, last: at } };
        const cardiology = specialtyStrength(lib, progress).find((s) => s.name === "Cardiology");
        assert.deepEqual(cardiology, { name: "Cardiology", total: 2, tried: 1, average: 40, band: "crit" });
    });

    it("is null, not zero, where nothing has been tried", () => {
        const untried = specialtyStrength(lib, {}).find((s) => s.name === "Nephrology");
        assert.deepEqual(untried, { name: "Nephrology", total: 1, tried: 0, average: null, band: null });
    });

    it("lists the strongest first, then the specialties not started, by name", () => {
        const progress: ProgressMap = { c1: { attempts: 1, best: 60, last: at }, p1: { attempts: 1, best: 95, last: at } };
        assert.deepEqual(
            specialtyStrength(lib, progress).map((s) => s.name),
            ["Pediatrics", "Cardiology", "Nephrology", "Other"]
        );
    });

    it("ranks equal averages by name so the order never jumps between renders", () => {
        const progress: ProgressMap = { n1: { attempts: 1, best: 80, last: at }, p1: { attempts: 1, best: 80, last: at } };
        const names = specialtyStrength(lib, progress).map((s) => s.name);
        assert.deepEqual(names.slice(0, 2), ["Nephrology", "Pediatrics"]);
    });

    it("ignores progress on a case that is no longer in the library, and keeps scores between 0 and 100", () => {
        const progress: ProgressMap = { gone: { attempts: 2, best: 99, last: at }, n1: { attempts: 1, best: 140, last: at } };
        const all = specialtyStrength(lib, progress);
        assert.equal(all.length, 4);
        assert.equal(all.find((s) => s.name === "Nephrology")?.average, 100);
    });

    it("files a case with no specialty under Other", () => {
        assert.ok(specialtyStrength(lib, {}).some((s) => s.name === "Other" && s.total === 1));
    });
});

describe("library: pinning what is in progress", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

    it("puts the pinned ones first and keeps everyone else's order", () => {
        assert.deepEqual(pinFirst(items, new Set(["c", "a"])).map((i) => i.id), ["a", "c", "b", "d"]);
    });

    it("changes nothing when nothing is pinned, and ignores ids that are not in the list", () => {
        assert.deepEqual(pinFirst(items, new Set()).map((i) => i.id), ["a", "b", "c", "d"]);
        assert.deepEqual(pinFirst(items, new Set(["zzz"])).map((i) => i.id), ["a", "b", "c", "d"]);
    });

    it("returns a copy, not the same array", () => {
        assert.notEqual(pinFirst(items, new Set()), items);
    });
});

describe("library: saved cases and new cases", () => {
    const saved = new Set(["adpkd", "stemi"]);

    it("shows only the saved cases when asked, and all of them when not", () => {
        assert.deepEqual(filterCases(LIBRARY, { ...NO_FILTERS, saved: true }, {}, saved).map((c) => c.id).sort(), ["adpkd", "stemi"]);
        assert.equal(filterCases(LIBRARY, NO_FILTERS, {}, saved).length, LIBRARY.length);
    });

    it("combines with the other filters", () => {
        const cardiologySaved = filterCases(LIBRARY, { ...NO_FILTERS, saved: true, specialty: "Cardiology" }, {}, saved);
        assert.deepEqual(cardiologySaved.map((c) => c.id), ["stemi"]);
    });

    it("shows nothing when the saved filter is on and nothing is saved", () => {
        assert.deepEqual(filterCases(LIBRARY, { ...NO_FILTERS, saved: true }), []);
    });

    it("counts the saved filter as an active filter", () => {
        assert.equal(activeFilterCount({ ...NO_FILTERS, saved: true }), 1);
        assert.equal(activeFilterCount({ ...NO_FILTERS, saved: false }), 0);
    });

    it("makes the facet counts follow the saved filter too", () => {
        const facets = facetCounts(LIBRARY, { ...NO_FILTERS, saved: true }, {}, saved);
        assert.equal(facets.status.all, 2);
        assert.equal(facets.specialties.find((s) => s.name === "Nephrology")?.count, 1);
        assert.equal(facets.specialties.find((s) => s.name === "Neurology")?.count, 0);
    });

    const NOW = Date.parse("2026-09-21T12:00:00Z");
    const added = (daysAgo: number) => make("x", { createdAt: new Date(NOW - daysAgo * 86_400_000).toISOString() });

    it("calls a case new for two weeks after it was added, and not after", () => {
        assert.equal(isNewCase(added(0), {}, NOW), true);
        assert.equal(isNewCase(added(13), {}, NOW), true);
        assert.equal(isNewCase(added(14), {}, NOW), false);
        assert.equal(isNewCase(added(90), {}, NOW), false);
    });

    it("stops calling it new once the student has tried it", () => {
        const tried: ProgressMap = { x: { attempts: 1, best: 60, last: "2026-09-20T00:00:00Z" } };
        assert.equal(isNewCase(added(2), tried, NOW), false);
    });

    it("is not fooled by a missing or future date", () => {
        assert.equal(isNewCase(make("x"), {}, NOW), false);
        assert.equal(isNewCase(make("x", { createdAt: "not a date" }), {}, NOW), false);
        assert.equal(isNewCase(added(-3), {}, NOW), false);
    });
});
