import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { certificateProblem, finishedAll, places, printableName, rankByCase, shortName, workshopDetail, type AttemptRow } from "../rank";

const at = (minute: number) => `2026-10-24T05:${String(minute).padStart(2, "0")}:00.000Z`;
const row = (user_id: string, case_id: string, score: number | null, minute: number): AttemptRow => ({ user_id, case_id, score, created_at: at(minute) });

describe("rankByCase", () => {
  const rows = [
    row("asha", "stemi", 70, 10),
    row("asha", "stemi", 95, 30), // a retry
    row("ravi", "stemi", 80, 12),
    row("neha", "stemi", 80, 11),
    row("kabir", "stemi", null, 5),
    row("ravi", "diarrhoea", 60, 2),
  ];

  it("counts each student's first attempt, best first, and a tie goes to whoever finished first", () => {
    const stemi = rankByCase(rows, "first").get("stemi")!;
    assert.deepEqual(
      stemi.map((r) => [r.userId, r.score, r.attempts]),
      [
        ["neha", 80, 1],
        ["ravi", 80, 1],
        ["asha", 70, 2],
      ]
    );
  });

  it("can count each student's best attempt instead", () => {
    const stemi = rankByCase(rows, "best").get("stemi")!;
    assert.deepEqual(stemi[0], { userId: "asha", score: 95, at: at(30), attempts: 2 });
  });

  it("keeps cases apart and ignores attempts with no score", () => {
    const ranked = rankByCase(rows, "first");
    assert.deepEqual([...ranked.keys()].sort(), ["diarrhoea", "stemi"]);
    assert.ok(!ranked.get("stemi")!.some((r) => r.userId === "kabir"));
  });
});

describe("places", () => {
  it("shares a place between equal scores", () => {
    const ranked = [90, 90, 85, 85, 85, 70].map((score, i) => ({ userId: `s${i}`, score, at: at(i), attempts: 1 }));
    assert.deepEqual(places(ranked), [1, 1, 3, 3, 3, 6]);
  });
});

describe("shortName", () => {
  it("shows a first name and an initial", () => {
    assert.equal(shortName("Riya Sharma"), "Riya S.");
    assert.equal(shortName("  aman  kumar  verma "), "aman V.");
    assert.equal(shortName("Zoya"), "Zoya");
    assert.equal(shortName(null), "A student");
  });
});

describe("finishedAll", () => {
  it("is the students who finished every required case", () => {
    const rows = [row("asha", "a", 50, 1), row("asha", "b", 60, 2), row("ravi", "a", 70, 3), row("neha", "b", null, 4), row("neha", "a", 40, 5)];
    assert.deepEqual([...finishedAll(rows, ["a", "b"])], ["asha"]);
    assert.deepEqual([...finishedAll(rows, ["a"])].sort(), ["asha", "neha", "ravi"]);
    assert.equal(finishedAll(rows, []).size, 0);
  });
});

describe("certificate wording", () => {
  it("says where, when and how many cases", () => {
    assert.equal(
      workshopDetail("Maulana Azad Medical College, New Delhi", "2026-10-24", 2),
      "held at Maulana Azad Medical College, New Delhi on 24 October 2026, working through 2 simulated patient cases on MediKarya"
    );
    assert.equal(workshopDetail("  ", "2026-10-24", 1), "held on 24 October 2026, working through 1 simulated patient case on MediKarya");
  });

  it("refuses a missing title, day or case", () => {
    const ok = { title: "Clinical Reasoning Workshop", venue: "MAMC", day: "2026-10-24", cases: ["a"] };
    assert.equal(certificateProblem(ok), null);
    assert.ok(certificateProblem({ ...ok, title: "x" }));
    assert.ok(certificateProblem({ ...ok, day: "" }));
    assert.ok(certificateProblem({ ...ok, cases: [] }));
  });

  it("prints only real-looking names", () => {
    assert.equal(printableName("  Riya   Sharma "), "Riya Sharma");
    assert.equal(printableName("ab"), null);
    assert.equal(printableName("12345"), null);
    assert.equal(printableName("Ananya Iyer"), "Ananya Iyer");
  });
});
