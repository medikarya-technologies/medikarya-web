import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MASTERY_BANK, selectReinforcement } from "../reinforcement";
import { replayStudentEvents } from "../replay";
import { scoreEncounter } from "../../../engine/evaluation/DualScorer";
import type { ClinicalEvent, EventOf } from "../encounter-events";
import { newEngine, playAspirinOnly, playExcellent, playNoAction, stemiCase } from "./players";

// ── Reinforcement ───────────────────────────────────────────────────────────

describe("reinforcement selection", () => {
    const config = stemiCase();

    it("targets the exact error: the top gap comes first and gets the most questions", () => {
        const quiz = selectReinforcement(config, ["antiplatelet_vs_reperfusion", "dont_delay_reperfusion", "vt_shock_management"]);
        assert.equal(quiz.questions.length, 5);
        assert.deepEqual(
            quiz.questions.map((q) => q.id),
            ["avr_1", "avr_2", "ddr_1", "ddr_2", "vts_1"],
            "grouped by gap, most important first: 2, 2, 1"
        );
        assert.deepEqual(quiz.knowledgeGaps.map((g) => g.questionCount), [2, 2, 1]);
        assert.equal(quiz.knowledgeGaps[0].concept, "Antiplatelet therapy vs reperfusion", "highest priority first");
        assert.ok(quiz.knowledgeGaps[0].priority > quiz.knowledgeGaps[1].priority);
    });

    it("the exact error is never diluted, however many gaps are flagged", () => {
        const flagged = [
            "antiplatelet_vs_reperfusion", "nitrates_in_hypotension", "dont_delay_reperfusion",
            "vt_shock_management", "reperfusion_strategy_choice", "ecg_within_10_minutes",
        ];
        const quiz = selectReinforcement(config, flagged);
        assert.equal(quiz.questions.length, 5);
        assert.deepEqual(quiz.knowledgeGaps.map((g) => g.questionCount), [2, 1, 1, 1], "the top gap gets two; the least important gaps are dropped");
        assert.equal(quiz.knowledgeGaps.length, 4);
        assert.equal(quiz.knowledgeGaps[0].concept, "Antiplatelet therapy vs reperfusion");
    });

    it("gives the top gap up to three questions when it is the only one flagged", () => {
        const quiz = selectReinforcement(config, ["antiplatelet_vs_reperfusion"]);
        assert.deepEqual(quiz.questions.filter((q) => q.knowledgeGap === "Antiplatelet therapy vs reperfusion").length, 3);
    });

    it("never repeats a question and never exceeds the count", () => {
        const quiz = selectReinforcement(config, Object.keys(config.reinforcement!), {}, 5);
        assert.ok(quiz.questions.length <= 5);
        assert.equal(new Set(quiz.questions.map((q) => q.id)).size, quiz.questions.length);
    });

    it("records why each gap was flagged", () => {
        const quiz = selectReinforcement(config, ["antiplatelet_vs_reperfusion"], {
            antiplatelet_vs_reperfusion: "Aspirin is not reperfusion",
        });
        assert.equal(quiz.questions[0].weaknessLink, "Aspirin is not reperfusion");
        assert.deepEqual(quiz.knowledgeGaps[0].relatedWeaknesses, ["Aspirin is not reperfusion"]);
    });

    it("a flawless run gets a mastery challenge instead of padding", () => {
        const quiz = selectReinforcement(config, []);
        assert.ok(quiz.questions.length > 0 && quiz.questions.length <= 3);
        assert.ok(quiz.questions.every((q) => q.knowledgeGap === config.reinforcement![MASTERY_BANK].title));
    });

    it("ignores gaps the case has no questions for", () => {
        const quiz = selectReinforcement(config, ["made_up_gap", "antiplatelet_vs_reperfusion"]);
        assert.ok(quiz.questions.every((q) => q.knowledgeGap !== "made_up_gap"));
        assert.ok(quiz.questions.length > 0);
    });

    it("produces the shape the existing quiz screen consumes", () => {
        const q = selectReinforcement(config, ["ecg_within_10_minutes"]).questions[0];
        for (const key of ["id", "stem", "options", "correctIndex", "explanation", "category", "difficulty", "weaknessLink", "knowledgeGap"] as const) {
            assert.ok(key in q, key);
        }
        assert.equal(q.options.length, 4);
        assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3);
    });

    it("copies questions rather than aliasing the case's arrays", () => {
        const q = selectReinforcement(config, ["ecg_within_10_minutes"]).questions[0];
        q.options.push("mutated");
        assert.equal(config.reinforcement!.ecg_within_10_minutes.questions[0].options.length, 4);
    });

    it("is stitched to the scorer: the aspirin-only run is sent to the right questions", () => {
        const e = newEngine();
        playAspirinOnly(e);
        const r = scoreEncounter(e.events, config);
        const labels = Object.fromEntries([[r.reasoningError!.knowledgeGap, r.reasoningError!.title]]);
        const quiz = selectReinforcement(config, r.knowledgeGaps, labels);
        assert.equal(quiz.questions[0].knowledgeGap, "Antiplatelet therapy vs reperfusion");
        assert.equal(quiz.questions[0].weaknessLink, "Aspirin is not reperfusion");
    });

    it("every knowledge gap the rubric can raise has authored questions", () => {
        const rubric = config.scoring_rubric!;
        const gaps = new Set<string>();
        rubric.items.forEach((i) => i.knowledge_gap && gaps.add(i.knowledge_gap));
        rubric.penalties?.forEach((p) => p.knowledge_gap && gaps.add(p.knowledge_gap));
        rubric.misconceptions?.forEach((m) => gaps.add(m.knowledge_gap));
        for (const gap of gaps) assert.ok(config.reinforcement?.[gap]?.questions.length, `no questions for "${gap}"`);
    });
});

// ── Server-side replay ──────────────────────────────────────────────────────

describe("server-side replay", () => {
    const config = stemiCase();

    it("faithfully reproduces an honest encounter, event for event", () => {
        const original = newEngine();
        playExcellent(original, { assists: true });
        const replayed = replayStudentEvents(config, original.events);
        assert.deepEqual(replayed.events, original.events);
    });

    it("reproduces a deteriorating encounter too, including the system events", () => {
        const original = newEngine();
        playNoAction(original);
        const replayed = replayStudentEvents(config, original.events);
        assert.deepEqual(replayed.events, original.events);
    });

    it("a client that strips out the deterioration cannot hide it", () => {
        const original = newEngine();
        playNoAction(original);
        const forged = original.events.filter((e) => e.type !== "STATE_TRANSITION" && e.type !== "PATIENT_DETERIORATED");
        assert.ok(forged.length < original.events.length);

        const replayed = replayStudentEvents(config, forged);
        assert.ok(replayed.events.some((e) => e.type === "PATIENT_DETERIORATED"), "deterioration regenerated from the rules");
        assert.deepEqual(scoreEncounter(replayed.events, config), scoreEncounter(original.events, config));
    });

    it("a client that invents a stabilisation cannot use it", () => {
        const original = newEngine();
        playNoAction(original);
        const forged: ClinicalEvent[] = [
            ...original.events,
            { type: "STATE_TRANSITION", timestamp: 30, from: "cardiogenic_shock", to: "reperfused", trigger: "pci_reperfusion" },
        ];
        const replayed = replayStudentEvents(config, forged);
        assert.equal(replayed.state.flags.reperfusion_achieved, false);
        assert.ok(!replayed.events.some((e) => e.type === "STATE_TRANSITION" && e.to === "reperfused"));
    });

    it("re-prices assists from the case: a forged zero cost is restored", () => {
        const original = newEngine();
        playExcellent(original, { assists: true });
        const forged = original.events.map((e) => (e.type === "ASSIST_USED" ? { ...e, cost: 0 } : e));

        const honest = scoreEncounter(original.events, config);
        const replayed = scoreEncounter(replayStudentEvents(config, forged).events, config);
        assert.equal(replayed.assistanceCost, honest.assistanceCost);
        assert.equal(replayed.independentScore, honest.independentScore);
    });

    it("drops an assist the case disallows even if the client logged it", () => {
        const original = newEngine();
        playAspirinOnly(original);
        const forged: ClinicalEvent[] = [
            ...original.events,
            { type: "ASSIST_USED", timestamp: 24 * 60 + 25, assistType: "reveal_diagnosis", cost: 0 },
        ];
        const replayed = replayStudentEvents(config, forged);
        assert.ok(!replayed.events.some((e) => e.type === "ASSIST_USED"));
    });

    it("a reveal without an assist behind it is not honoured", () => {
        const original = newEngine();
        original.orderTest("ecg_12_lead", "ECG", 60);
        const forged: ClinicalEvent[] = [
            ...original.events,
            { type: "RESULT_REVEALED", timestamp: 100, testId: "ecg_12_lead", revealType: "hint", orderTimestamp: 60 },
        ];
        const replayed = replayStudentEvents(config, forged);
        // Honoured only because the replay itself buys the assist — so the cost is on the books.
        const assists = replayed.events.filter((e): e is EventOf<"ASSIST_USED"> => e.type === "ASSIST_USED");
        assert.equal(assists.length, 1);
        assert.equal(assists[0].cost, 3);
    });

    it("recomputes intervention consequences, so a forged 'all clear' note is replaced", () => {
        const original = newEngine();
        original.giveIntervention("gtn_sublingual", 60);
        const forged = original.events.map((e) => (e.type === "INTERVENTION_GIVEN" ? { ...e, consequence: "All good." } : e));
        const replayed = replayStudentEvents(config, forged);
        const given = replayed.events.find((e): e is EventOf<"INTERVENTION_GIVEN"> => e.type === "INTERVENTION_GIVEN")!;
        assert.match(given.consequence, /contraindicated/i);
        assert.equal(replayed.state.safetyEvents.length, 1, "and the safety issue is still recorded");
    });

    it("clamps impossible timestamps to the encounter limit", () => {
        const forged: ClinicalEvent[] = [{ type: "HISTORY_TAKEN", timestamp: 9_999_999, question: "q", response: "r" }];
        const replayed = replayStudentEvents(config, forged);
        assert.equal(replayed.events.at(-1)!.timestamp <= 25 * 60, true);
    });

    it("survives garbage without throwing", () => {
        for (const junk of [null, undefined, "x", 42, {}, [null, 1, "a", { type: "NOPE" }]]) {
            assert.doesNotThrow(() => replayStudentEvents(config, junk));
        }
        assert.equal(replayStudentEvents(config, "junk").events.length, 0);
    });

    it("ignores out-of-order input by sorting it", () => {
        const original = newEngine();
        playAspirinOnly(original);
        const shuffled = [...original.events].reverse();
        const replayed = replayStudentEvents(config, shuffled);
        assert.deepEqual(replayed.events, original.events);
    });
});
