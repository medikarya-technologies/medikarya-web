import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeMilestones, newlyEarned, type AttemptLike, type CaseLike } from "../milestones";

const CASES: CaseLike[] = [
    { id: "c1", category: "Cardiology" },
    { id: "c2", category: "Cardiology" },
    { id: "n1", category: "Nephrology" },
    { id: "p1", category: "Pediatrics" },
];

const at = (day: number, hour = 10) => new Date(Date.UTC(2026, 8, day, hour)).toISOString();
const attempt = (case_id: string, day: number, score: number | null = 60, hour = 10): AttemptLike => ({ case_id, score, created_at: at(day, hour) });
const by = (attempts: AttemptLike[], cases: CaseLike[] = CASES) => Object.fromEntries(computeMilestones({ attempts, cases }).map((m) => [m.id, m]));

describe("milestones: the first case and a good score", () => {
    it("has nothing earned before the first attempt, and says what to do", () => {
        const m = by([]);
        assert.equal(Object.values(m).filter((x) => x.earned).length, 0);
        assert.equal(m.first_case.progress, "Finish any case");
        assert.equal(m.score_90.progress, "Score 90 or more on any case");
    });

    it("earns the first case at the earliest attempt, whatever order they arrive in", () => {
        const m = by([attempt("c2", 12), attempt("c1", 10), attempt("n1", 11)]);
        assert.equal(m.first_case.earned, true);
        assert.equal(m.first_case.earnedAt, at(10));
    });

    it("earns 90+ only at 90 or above, at the earliest such attempt, and shows the best so far until then", () => {
        assert.equal(by([attempt("c1", 10, 89)]).score_90.earned, false);
        assert.equal(by([attempt("c1", 10, 89)]).score_90.progress, "Best so far: 89");
        const m = by([attempt("c1", 12, 95), attempt("c1", 10, 90), attempt("n1", 11, 40)]);
        assert.equal(m.score_90.earned, true);
        assert.equal(m.score_90.earnedAt, at(10));
    });

    it("counts a missing score as nothing", () => {
        assert.equal(by([attempt("c1", 10, null)]).score_90.earned, false);
    });
});

describe("milestones: streaks", () => {
    it("needs consecutive days, and says how far the best run got", () => {
        const m = by([attempt("c1", 10), attempt("c2", 11), attempt("n1", 13)]);
        assert.equal(m.streak_3.earned, false);
        assert.equal(m.streak_3.progress, "Best run so far: 2 of 3 days");
    });

    it("earns three days at the attempt that made the third, and seven at the seventh", () => {
        const week = [10, 11, 12, 13, 14, 15, 16].map((d) => attempt("c1", d));
        const m = by(week);
        assert.equal(m.streak_3.earned, true);
        assert.equal(m.streak_3.earnedAt, at(12));
        assert.equal(m.streak_7.earned, true);
        assert.equal(m.streak_7.earnedAt, at(16));
    });

    it("counts a day once however many cases were done, and does not need them in order", () => {
        const m = by([attempt("c1", 12, 60, 23), attempt("c2", 12, 60, 1), attempt("n1", 10), attempt("p1", 11)]);
        assert.equal(m.streak_3.earned, true);
        assert.equal(m.streak_3.earnedAt, at(12, 1));
    });

    it("finds a run later in the history, after a break", () => {
        const m = by([attempt("c1", 1), attempt("c2", 2), attempt("c1", 10), attempt("c2", 11), attempt("n1", 12)]);
        assert.equal(m.streak_3.earned, true);
        assert.equal(m.streak_3.earnedAt, at(12));
    });
});

describe("milestones: specialties and the whole library", () => {
    it("earns a specialty when every one of its cases has been tried, at the attempt that finished it", () => {
        const m = by([attempt("c1", 10), attempt("c2", 14)]);
        assert.equal(m.specialty_complete.earned, true);
        assert.equal(m.specialty_complete.earnedAt, at(14));
        assert.match(m.specialty_complete.detail, /every Cardiology case/);
    });

    it("does not count a specialty with a single case", () => {
        const m = by([attempt("n1", 10), attempt("p1", 11)]);
        assert.equal(m.specialty_complete.earned, false);
    });

    it("shows the specialty that is closest while none is complete", () => {
        const m = by([attempt("c1", 10), attempt("n1", 11)]);
        assert.equal(m.specialty_complete.earned, false);
        assert.equal(m.specialty_complete.progress, "Closest: Cardiology, 1 of 2");
    });

    it("names several complete specialties together", () => {
        const cases: CaseLike[] = [...CASES, { id: "n2", category: "Nephrology" }];
        const m = by([attempt("c1", 10), attempt("c2", 11), attempt("n1", 12), attempt("n2", 13)], cases);
        assert.match(m.specialty_complete.detail, /Cardiology and Nephrology/);
    });

    it("earns every case tried only when all of them have been, and counts the rest", () => {
        assert.equal(by([attempt("c1", 10), attempt("c2", 11), attempt("n1", 12)]).all_cases.progress, "3 of 4 cases");
        const m = by([attempt("c1", 10), attempt("c2", 11), attempt("n1", 12), attempt("p1", 13)]);
        assert.equal(m.all_cases.earned, true);
        assert.equal(m.all_cases.earnedAt, at(13));
    });

    it("does not call a library of two cases 'every case'", () => {
        const m = by([attempt("c1", 10), attempt("c2", 11)], CASES.slice(0, 2));
        assert.equal(m.all_cases.earned, false);
    });

    it("ignores attempts on cases that are no longer in the library, and attempts that make no sense", () => {
        const m = by([attempt("gone", 10), { case_id: "", score: 50, created_at: at(10) }, { case_id: "c1", score: 50, created_at: "not a date" }]);
        assert.equal(m.first_case.earned, true);
        assert.equal(m.specialty_complete.earned, false);
    });
});

describe("milestones: what one attempt earned", () => {
    const cases = CASES;
    const state = (attempts: AttemptLike[]) => computeMilestones({ attempts, cases });

    it("reports only what is new", () => {
        const before = state([attempt("c1", 10, 50), attempt("c2", 11, 50)]);
        const after = state([attempt("c1", 10, 50), attempt("c2", 11, 50), attempt("n1", 12, 95)]);
        assert.deepEqual(newlyEarned(before, after).map((m) => m.id).sort(), ["score_90", "streak_3"]);
    });

    it("reports the first case on the first attempt, and nothing when nothing changed", () => {
        assert.deepEqual(newlyEarned(state([]), state([attempt("c1", 10, 50)])).map((m) => m.id), ["first_case"]);
        assert.deepEqual(newlyEarned(state([attempt("c1", 10, 50)]), state([attempt("c1", 10, 50), attempt("c1", 10, 55)])), []);
    });
});

describe("milestones: how far along, for a bar", () => {
    it("is nothing before the first attempt, and is left out once a milestone is earned", () => {
        const none = by([]);
        assert.equal(none.first_case.fraction, 0);
        assert.equal(none.streak_3.fraction, 0);
        assert.equal(none.score_90.fraction, 0);
        const done = by([attempt("c1", 10, 95)]);
        assert.equal(done.first_case.fraction, undefined);
        assert.equal(done.score_90.fraction, undefined);
    });

    it("measures a streak by its best run", () => {
        const m = by([attempt("c1", 10), attempt("c2", 11), attempt("n1", 13)]);
        assert.equal(m.streak_3.fraction, 2 / 3);
        assert.equal(m.streak_7.fraction, 2 / 7);
    });

    it("measures a score against 90", () => {
        assert.equal(by([attempt("c1", 10, 72)]).score_90.fraction, 72 / 90);
    });

    it("measures the closest specialty and the whole library", () => {
        const m = by([attempt("c1", 10), attempt("n1", 11), attempt("p1", 12)]);
        assert.equal(m.specialty_complete.fraction, 1 / 2);
        assert.equal(m.all_cases.fraction, 3 / 4);
    });

    it("has no bar for a specialty milestone when no specialty has two cases", () => {
        const cases: CaseLike[] = [
            { id: "a", category: "X" },
            { id: "b", category: "Y" },
        ];
        assert.equal(by([attempt("a", 10)], cases).specialty_complete.fraction, undefined);
    });
});
