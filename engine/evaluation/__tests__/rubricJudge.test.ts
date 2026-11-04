import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { collectTextChecks, judgePrompt } from "../rubricJudge";
import { DIAGNOSIS_JUDGMENT, scoreEncounter, textCheckKey } from "../DualScorer";
import type { ClinicalEvent } from "../../../lib/simulation/encounter-events";
import type { SimulationCaseConfig } from "../../../lib/simulation/case-schema";

// The built-in trial case (committed in full): a rubric with ECG, reasoning, plan and diagnosis checks.
const config = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "cases", "simulation", "acute-anterior-stemi.json"), "utf8")
) as SimulationCaseConfig;

// A student who is right but uses none of the case's phrases.
const events: ClinicalEvent[] = [
    { type: "TEST_ORDERED", timestamp: 30, testId: "ecg_12_lead", testName: "12-lead ECG" },
    { type: "RESULT_INTERPRETED", timestamp: 90, testId: "ecg_12_lead", orderTimestamp: 30, studentInterpretation: "Big ST rise across the chest leads, heart attack of the front wall" } as ClinicalEvent,
    { type: "DIAGNOSIS_SUBMITTED", timestamp: 300, primary: "Front wall heart attack", reasoning: "Chest pain with ST rise in the chest leads" },
];

const ecgItem = config.scoring_rubric!.items.find((i) => i.id === "cr_recognise_ecg")!;

describe("rubric free-text checks", () => {
    it("collects each check once, with what the student wrote, plus the diagnosis", () => {
        const checks = collectTextChecks(config, events);
        const keys = checks.map((c) => c.key);
        assert.equal(new Set(keys).size, keys.length);
        assert.ok(keys.includes(DIAGNOSIS_JUDGMENT));
        const ecg = checks.find((c) => c.key === textCheckKey(ecgItem.met_when!));
        assert.ok(ecg, "the ECG recognition check is collected");
        assert.match(ecg!.studentText, /chest leads/);
        assert.equal(ecg!.lookingFor, ecgItem.label);
    });

    it("leaves out checks with nothing written for them", () => {
        const keys = collectTextChecks(config, events).map((c) => c.key);
        assert.ok(!keys.some((k) => k.startsWith("plan_mentions:")), "no plan was submitted");
    });

    it("the prompt names every check key", () => {
        const checks = collectTextChecks(config, events);
        const prompt = judgePrompt(config, checks);
        for (const c of checks) assert.ok(prompt.includes(c.key));
    });

    it("the AI's verdicts decide; without them the phrases do", () => {
        const byPhrase = scoreEncounter(events, config);
        assert.equal(byPhrase.diagnosis.isCorrect, false);
        assert.equal(byPhrase.items.find((i) => i.id === "cr_recognise_ecg")!.credit < 1, true);

        const judgments = Object.fromEntries(collectTextChecks(config, events).map((c) => [c.key, true]));
        const byAi = scoreEncounter(events, config, judgments);
        assert.equal(byAi.diagnosis.isCorrect, true);
        assert.equal(byAi.items.find((i) => i.id === "cr_recognise_ecg")!.credit, 1);
        assert.ok(byAi.clinicalScore > byPhrase.clinicalScore);
    });

    it("a verdict of false is respected even when a phrase would match", () => {
        const withPhrase: ClinicalEvent[] = [...events.slice(0, 2), { type: "DIAGNOSIS_SUBMITTED", timestamp: 300, primary: "STEMI", reasoning: "" }];
        const judgments = { [DIAGNOSIS_JUDGMENT]: false };
        assert.equal(scoreEncounter(withPhrase, config, judgments).diagnosis.isCorrect, false);
        assert.equal(scoreEncounter(withPhrase, config).diagnosis.isCorrect, true);
    });
});
