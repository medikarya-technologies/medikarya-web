import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildSkillProfile, NO_SKILLS, prettyGap, type AttemptFeedback } from "../skills";

const at = (day: number) => new Date(Date.UTC(2026, 8, day, 10)).toISOString();
const classic = (day: number, over: Partial<AttemptFeedback> = {}): AttemptFeedback => ({
    case_id: "malaria",
    created_at: at(day),
    historyScore: 12.5,
    testingScore: 10,
    reasoningScore: 15,
    diagnosisScore: 15,
    managementScore: 0,
    missedRedFlags: [],
    ...over,
});

describe("skills: classic scoring", () => {
    it("turns each part into a percentage of what it is marked out of", () => {
        const p = buildSkillProfile([classic(10)]);
        const by = Object.fromEntries(p.skills.map((s) => [s.id, s.average]));
        assert.deepEqual(by, { history: 50, investigations: 50, reasoning: 50, diagnosis: 100, management: 0 });
        assert.equal(p.attempts, 1);
    });

    it("averages across attempts, and lists the weakest first (ties in the order of the case)", () => {
        const p = buildSkillProfile([classic(10), classic(11, { historyScore: 25, testingScore: 20, managementScore: 10, reasoningScore: 30, diagnosisScore: 0 })]);
        assert.deepEqual(
            p.skills.map((s) => [s.id, s.average]),
            [
                ["diagnosis", 50],
                ["management", 50],
                ["history", 75],
                ["investigations", 75],
                ["reasoning", 75],
            ]
        );
    });

    it("keeps a value inside 0 to 100 however odd the stored number", () => {
        const p = buildSkillProfile([classic(10, { historyScore: 99, testingScore: -5 })]);
        const by = Object.fromEntries(p.skills.map((s) => [s.id, s.average]));
        assert.equal(by.history, 100);
        assert.equal(by.investigations, 0);
    });

    it("counts only what an attempt scored", () => {
        const p = buildSkillProfile([{ case_id: "x", created_at: at(10), testingScore: 20 }]);
        assert.deepEqual(p.skills.map((s) => [s.id, s.average, s.attempts]), [["investigations", 100, 1]]);
    });
});

describe("skills: rubric scoring", () => {
    const rubric = (day: number): AttemptFeedback => ({
        case_id: "acute-anterior-stemi",
        created_at: at(day),
        simDomains: { clinical_reasoning: 8, investigation_accuracy: 45, management: 0, efficiency: 70 },
        // classic-named fields exist on a rubric attempt too, but they are not what scored it
        historyScore: 25,
        testingScore: 20,
    });

    it("reads the four domains as they are, and ignores the classic fields beside them", () => {
        const by = Object.fromEntries(buildSkillProfile([rubric(10)]).skills.map((s) => [s.id, s.average]));
        assert.deepEqual(by, { reasoning: 8, investigations: 45, management: 0, efficiency: 70 });
    });

    it("puts both kinds of case into the same skills", () => {
        const p = buildSkillProfile([classic(10), rubric(11)]);
        const reasoning = p.skills.find((s) => s.id === "reasoning");
        assert.equal(reasoning?.attempts, 2);
        assert.equal(reasoning?.average, Math.round((50 + 8) / 2));
        assert.equal(p.skills.find((s) => s.id === "efficiency")?.attempts, 1);
    });
});

describe("skills: what is missed", () => {
    it("counts the attempts a gap was missed in, most often first, then latest first", () => {
        const p = buildSkillProfile([
            classic(10, { missedRedFlags: ["severe_bradycardia", "exertional_syncope"] }),
            classic(11, { missedRedFlags: ["severe_bradycardia"], case_id: "chb" }),
            classic(12, { missedRedFlags: ["exertional_syncope", "severe_bradycardia"] }),
            classic(13, { missedRedFlags: ["macroscopic_haematuria"], case_id: "adpkd" }),
        ]);
        assert.deepEqual(p.gaps.map((g) => [g.key, g.count]), [["severe_bradycardia", 3], ["exertional_syncope", 2], ["macroscopic_haematuria", 1]]);
        assert.deepEqual(p.gaps[0].cases, ["chb", "malaria"]);
        assert.equal(p.gaps[0].last, at(12));
    });

    it("counts a gap once per attempt even when it is listed twice, and reads rubric gaps too", () => {
        const p = buildSkillProfile([classic(10, { missedRedFlags: ["a_gap", "a_gap"] }), { case_id: "stemi", created_at: at(11), simGaps: ["a_gap", "stemi_ecg_recognition"] }]);
        assert.equal(p.gaps.find((g) => g.key === "a_gap")?.count, 2);
        assert.equal(p.gaps.find((g) => g.key === "stemi_ecg_recognition")?.label, "STEMI ECG recognition");
    });

    it("keeps to the limit, and ignores things that are not ids", () => {
        const flags = Array.from({ length: 12 }, (_, i) => `gap_${i}`);
        assert.equal(buildSkillProfile([classic(10, { missedRedFlags: flags })]).gaps.length, 6);
        assert.equal(buildSkillProfile([classic(10, { missedRedFlags: ["", "  ", 3, null, {}] })]).gaps.length, 0);
    });

    it("makes a readable label", () => {
        assert.equal(prettyGap("severe_bradycardia"), "Severe bradycardia");
        assert.equal(prettyGap("antiplatelet_vs_reperfusion"), "Antiplatelet vs reperfusion");
        assert.equal(prettyGap("stemi-ecg_recognition"), "STEMI ECG recognition");
        assert.equal(prettyGap("  "), "");
    });
});

describe("skills: the cost of help", () => {
    it("averages what hints and help cost, where both scores were recorded", () => {
        const p = buildSkillProfile([classic(10, { clinicalScore: 60, independentScore: 50 }), classic(11, { clinicalScore: 70, independentScore: 66 }), classic(12)]);
        assert.deepEqual(p.helpCost, { average: 7, attempts: 2 });
    });

    it("says nothing when help was not used or not recorded", () => {
        assert.equal(buildSkillProfile([classic(10, { clinicalScore: 60, independentScore: 60 })]).helpCost, null);
        assert.equal(buildSkillProfile([classic(10)]).helpCost, null);
    });
});

describe("skills: odd input", () => {
    it("gives an empty profile for nothing, and never throws on what a database might hold", () => {
        assert.deepEqual(buildSkillProfile([]), NO_SKILLS);
        const junk = [null, undefined, {}, { case_id: 1 }, { case_id: "x", created_at: "no" }, { case_id: "x", created_at: at(10), simDomains: "text", missedRedFlags: "text" }] as unknown as AttemptFeedback[];
        assert.doesNotThrow(() => buildSkillProfile(junk));
        assert.equal(buildSkillProfile(junk).attempts, 1);
    });
});
