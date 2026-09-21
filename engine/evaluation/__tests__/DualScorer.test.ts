import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeAssistance, evaluateClinicalPerformance, scoreEncounter } from "../DualScorer";
import { EncounterEngine } from "../../../lib/simulation/encounter-engine";
import type { ClinicalEvent } from "../../../lib/simulation/encounter-events";
import { SCORING_DOMAINS } from "../../../lib/simulation/case-schema";
import {
    DIAGNOSIS,
    ECG_READ,
    EXCELLENT_ASSIST_COST,
    REASONING,
    newEngine,
    playAspirinOnly,
    playExcellent,
    playNoAction,
    stemiCase,
} from "../../../lib/simulation/__tests__/players";

const min = (m: number) => m * 60;
const score = (e: EncounterEngine) => scoreEncounter(e.events, stemiCase());
const item = (r: ReturnType<typeof score>, id: string) => r.items.find((i) => i.id === id)!;

// ── Plan verification #3 ────────────────────────────────────────────────────

describe("dual scorer (plan verification)", () => {
    const plain = newEngine();
    playExcellent(plain);
    const assisted = newEngine();
    playExcellent(assisted, { assists: true });
    const a = score(plain);
    const b = score(assisted);

    it("the same encounter with and without assists has an identical Clinical score", () => {
        assert.equal(b.clinicalScore, a.clinicalScore);
        assert.deepEqual(b.domains, a.domains);
        assert.deepEqual(b.items, a.items, "every rubric item is credited identically");
        assert.deepEqual(b.didWell, a.didWell);
        assert.deepEqual(b.missed, a.missed);
    });

    it("the Independent score is reduced by exactly the assist costs", () => {
        assert.equal(a.assistanceCost, 0);
        assert.equal(a.independentScore, a.clinicalScore);

        assert.equal(b.assistanceCost, EXCELLENT_ASSIST_COST);
        assert.equal(b.independentScore, b.clinicalScore - EXCELLENT_ASSIST_COST);
    });

    it("every point of difference traces to a specific, timestamped event", () => {
        assert.deepEqual(
            b.assistance.map((x) => [x.label, x.cost, x.clock]),
            [
                ["Vital abnormality highlights", 1, "00:12"],
                ["ECG interpretation assist", 3, "02:05"],
                ["Socratic hint", 3, "03:25"],
                ["Abnormal value explained", 2, "05:05"],
            ]
        );
        assert.equal(b.assistance.reduce((s, x) => s + x.cost, 0), b.clinicalScore - b.independentScore);
    });

    it("the audit trail is derived from the same log the clinical track reads", () => {
        const fromLog = assisted.events.filter((e) => e.type === "ASSIST_USED").length;
        assert.equal(b.assistance.length, fromLog);
    });

    it("the Independent score never goes below zero", () => {
        const e = newEngine();
        e.takeHistory("Anything?", "Pain.", 10);
        for (let i = 0; i < 40; i++) e.requestAssist("socratic_hint", 20 + i, `hint:t${i}`);
        const r = score(e);
        assert.ok(r.assistanceCost > r.clinicalScore);
        assert.equal(r.independentScore, 0);
    });

    it("a refused assist costs nothing, so it cannot reduce the score", () => {
        const e = newEngine();
        playExcellent(e);
        e.requestAssist("reveal_diagnosis", 800); // disabled in this case
        assert.equal(score(e).assistanceCost, 0);
    });
});

// ── Archetypes ──────────────────────────────────────────────────────────────

describe("clinical track: archetypes", () => {
    it("an excellent run scores high with nothing missed and no reasoning error", () => {
        const e = newEngine();
        playExcellent(e);
        const r = score(e);
        assert.ok(r.clinicalScore >= 90, `got ${r.clinicalScore}`);
        assert.equal(r.reasoningError, null);
        assert.deepEqual(r.missed, []);
        assert.equal(r.safetyIssues.length, 0);
        assert.equal(r.diagnosis.isCorrect, true);
        assert.ok(r.didWell.includes("Recognised the ST elevation on the ECG"));
        assert.ok(r.didWell.includes("Ordered the ECG within the first three actions"));
    });

    it("aspirin-only is caught as THE reasoning error: antiplatelet ≠ reperfusion", () => {
        const e = newEngine();
        playAspirinOnly(e);
        const r = score(e);
        assert.equal(r.reasoningError?.id, "m_aspirin_not_reperfusion");
        assert.match(r.reasoningError!.error, /antiplatelet therapy and reperfusion are distinct/);
        assert.match(r.reasoningError!.whyItMattered, /ischaemic clock kept running/);
        assert.equal(r.knowledgeGaps[0], "antiplatelet_vs_reperfusion");
        assert.ok(r.missed.some((m) => m.text === "No reperfusion pathway initiated" && m.critical));
        assert.ok(r.didWell.includes("Gave aspirin (antiplatelet therapy)"));
        assert.ok(r.clinicalScore < 60);
    });

    it("no action scores near the floor and is told the ECG was the missing piece", () => {
        const e = newEngine();
        playNoAction(e);
        const r = score(e);
        assert.ok(r.clinicalScore <= 15, `got ${r.clinicalScore}`);
        assert.equal(r.reasoningError?.id, "m_no_ecg");
        assert.equal(r.diagnosis.isCorrect, false);
        assert.ok(r.missed.some((m) => /Never ordered a 12-lead ECG/.test(m.text) && m.critical));
    });

    it("scores are ordered: excellent > aspirin-only > no action", () => {
        const [x, y, z] = [playExcellent, playAspirinOnly, playNoAction].map((play) => {
            const e = newEngine();
            play(e);
            return score(e).clinicalScore;
        });
        assert.ok(x > y && y > z, `${x} > ${y} > ${z}`);
    });
});

// ── Mechanics ───────────────────────────────────────────────────────────────

describe("clinical track: mechanics", () => {
    it("the overall score is the weighted average of the four domains", () => {
        const e = newEngine();
        playAspirinOnly(e);
        const r = score(e);
        const total = SCORING_DOMAINS.reduce((s, d) => s + r.weights[d], 0);
        const expected = Math.round(SCORING_DOMAINS.reduce((s, d) => s + r.weights[d] * r.domains[d], 0) / total);
        assert.equal(r.clinicalScore, expected);
    });

    it("scoring is deterministic", () => {
        const e = newEngine();
        playAspirinOnly(e);
        assert.deepEqual(score(e), score(e));
    });

    it("an empty encounter scores without throwing", () => {
        const r = scoreEncounter([], stemiCase());
        assert.equal(Number.isInteger(r.clinicalScore), true);
        assert.ok(r.clinicalScore >= 0 && r.clinicalScore <= 100);
        assert.equal(r.diagnosis.studentDiagnosis, "");
    });

    it("a case with no rubric cannot be scored, and says why", () => {
        const config = stemiCase();
        delete config.scoring_rubric;
        assert.throws(() => evaluateClinicalPerformance([], config), /no scoring_rubric/);
    });

    it("expert impressions reach every student, including one who never used an assist", () => {
        const e = newEngine();
        playNoAction(e);
        const r = score(e);
        assert.equal(r.assistanceCost, 0);
        assert.deepEqual(r.expertImpressions.map((x) => x.testId), ["ecg_12_lead", "cxr_portable", "echo_pocus"]);
        assert.match(r.expertImpressions[0].text, /Acute anterior STEMI/);
        assert.ok(r.keyLearningPoints.length > 0);
    });

    it("unmet critical items are listed before unmet minor ones", () => {
        const e = newEngine();
        playNoAction(e);
        const { missed } = score(e);
        const firstMinor = missed.findIndex((m) => !m.critical);
        const lastCritical = missed.map((m) => m.critical).lastIndexOf(true);
        assert.ok(firstMinor === -1 || lastCritical < firstMinor, "critical items first");
    });
});

// ── Recognition and ranking ─────────────────────────────────────────────────

describe("clinical track: reasoning quality", () => {
    const withEcg = (text: string) => {
        const e = newEngine();
        e.orderTest("ecg_12_lead", "ECG", 60);
        e.interpretResult("ecg_12_lead", text, 100, 60);
        return score(e);
    };

    it("credits recognising the pattern and the territory separately", () => {
        const r = withEcg("ST elevation in V2 to V4");
        assert.equal(item(r, "cr_recognise_ecg").credit, 1);
        assert.equal(item(r, "cr_territory").credit, 1);
        assert.equal(item(r, "cr_reciprocal").credit, 0);
    });

    it("recognising STEMI without localising it earns the first item only", () => {
        const r = withEcg("Inferior... actually just a STEMI");
        assert.equal(item(r, "cr_recognise_ecg").credit, 1);
        assert.equal(item(r, "cr_territory").credit, 0);
    });

    it("'no ST elevation' is not recognition", () => {
        const r = withEcg("Sinus tachycardia. There is no ST elevation.");
        assert.equal(item(r, "cr_recognise_ecg").credit, 0);
    });

    it("an NSTEMI read is not credited as a STEMI read", () => {
        const r = withEcg("Looks like an NSTEMI");
        assert.equal(item(r, "cr_recognise_ecg").credit, 0);
    });

    it("recognising the STEMI only later, in the diagnosis, earns partial credit for the ECG read", () => {
        const e = newEngine();
        e.orderTest("ecg_12_lead", "ECG", 60);
        e.interpretResult("ecg_12_lead", "Sinus tachycardia, some changes.", 100, 60);
        e.submitDiagnosis(DIAGNOSIS, REASONING, 200);
        const r = score(e);
        assert.equal(item(r, "cr_recognise_ecg").credit, 0.5);
        assert.equal(item(r, "cr_recognise_ecg").basis, "partial");
    });

    it("ranking matters, not just presence: STEMI in slot 1 beats STEMI in slot 2", () => {
        const rank = (ranked: string[]) => {
            const e = newEngine();
            e.submitDifferential(ranked, 100);
            return item(score(e), "cr_dx_slot1").credit;
        };
        assert.equal(rank(["Acute anterior STEMI", "Pericarditis", "Aortic dissection"]), 1);
        assert.equal(rank(["Pericarditis", "Acute anterior STEMI", "Aortic dissection"]), 0.4);
        assert.equal(rank(["Pericarditis", "GORD", "Anxiety"]), 0);
    });

    it("credits a sensible alternative in slot 2 and a can't-miss in slot 3", () => {
        const e = newEngine();
        e.submitDifferential(["Anterior STEMI", "Takotsubo cardiomyopathy", "Pulmonary embolism"], 100);
        const r = score(e);
        assert.equal(item(r, "cr_dx_alternative").credit, 1);
        assert.equal(item(r, "cr_dx_cant_miss").credit, 1);
    });

    it("a can't-miss diagnosis in the wrong slot earns partial credit", () => {
        const e = newEngine();
        e.submitDifferential(["Anterior STEMI", "Aortic dissection", "Pericarditis"], 100);
        assert.equal(item(score(e), "cr_dx_cant_miss").credit, 0.5);
    });

    it("only the LAST differential counts", () => {
        const e = newEngine();
        e.submitDifferential(["GORD", "Anxiety", "Costochondritis"], 50);
        e.submitDifferential(["Anterior STEMI", "Pericarditis", "Aortic dissection"], 150);
        assert.equal(item(score(e), "cr_dx_slot1").credit, 1);
    });

    it("NSTEMI as the primary diagnosis is not the correct diagnosis", () => {
        const e = newEngine();
        e.submitDiagnosis("NSTEMI", "", 100);
        const r = score(e);
        assert.equal(r.diagnosis.isCorrect, false);
        assert.equal(item(r, "cr_diagnosis").credit, 0);
    });

    it("'STEMI' and the full name are both accepted", () => {
        for (const dx of ["STEMI", "Acute anterior wall myocardial infarction", DIAGNOSIS]) {
            const e = newEngine();
            e.submitDiagnosis(dx, "", 100);
            assert.equal(score(e).diagnosis.isCorrect, true, dx);
        }
    });

    it("a negated diagnosis is not a diagnosis", () => {
        const e = newEngine();
        e.submitDiagnosis("Not a STEMI", "", 100);
        assert.equal(score(e).diagnosis.isCorrect, false);
    });

    it("rewards reasoning that cites both the ECG and the clinical picture; half for one", () => {
        const both = newEngine();
        both.submitDiagnosis(DIAGNOSIS, REASONING, 100);
        assert.equal(item(score(both), "cr_reasoning_text").credit, 1);

        const one = newEngine();
        one.submitDiagnosis(DIAGNOSIS, "ST elevation in V1-V4.", 100);
        assert.equal(item(score(one), "cr_reasoning_text").credit, 0.5);

        const none = newEngine();
        none.submitDiagnosis(DIAGNOSIS, "Just a feeling.", 100);
        assert.equal(item(score(none), "cr_reasoning_text").credit, 0);
    });

    it("history items read the questions asked, and asking 'any bleeding?' counts", () => {
        const e = newEngine();
        e.takeHistory("Any bleeding problems or previous stroke?", "No.", 30);
        const r = score(e);
        assert.equal(item(r, "hx_safety_screen").credit, 1);
        assert.equal(item(r, "hx_pain_features").credit, 0);
    });
});

// ── Time-graded credit ──────────────────────────────────────────────────────

describe("clinical track: time-graded items", () => {
    const ecgAt = (t: number) => {
        const e = newEngine();
        e.orderTest("ecg_12_lead", "ECG", t);
        return item(score(e), "ef_ecg_time");
    };

    it("full credit inside the target, none after the cut-off, linear in between", () => {
        assert.equal(ecgAt(min(5)).credit, 1);
        assert.equal(ecgAt(min(10)).credit, 1, "boundary is inclusive");
        assert.ok(Math.abs(ecgAt(min(17.5)).credit - 0.5) < 1e-9);
        assert.equal(ecgAt(min(25)).credit, 0);
        assert.equal(ecgAt(min(30)).credit, 0);
    });

    it("no ECG at all is zero, not NaN", () => {
        const r = score(newEngine());
        assert.equal(item(r, "ef_ecg_time").credit, 0);
        assert.equal(item(r, "ef_ecg_time").basis, "unmet");
    });

    it("the reperfusion decision is timed from the first of cath-lab / PCI / lysis", () => {
        const e = newEngine();
        e.giveIntervention("fibrinolysis_given", min(10));
        e.giveIntervention("activate_cath_lab", min(20));
        assert.equal(item(score(e), "ef_reperfusion_time").credit, 1, "first pathway action counts");
    });

    it("'within the first three actions' counts orders and interventions, not questions or exams", () => {
        const e = newEngine();
        for (let i = 0; i < 8; i++) e.takeHistory(`q${i}`, "a", i);
        e.performExam("jvp", "…", 20);
        e.orderTest("ecg_12_lead", "ECG", 30); // action #1
        assert.equal(item(score(e), "ef_ecg_early_action").credit, 1);

        const late = newEngine();
        late.orderTest("cbc", "CBC", 10);
        late.orderTest("bmp", "BMP", 11);
        late.giveIntervention("iv_access", 12);
        late.orderTest("ecg_12_lead", "ECG", 13); // action #4
        assert.equal(item(score(late), "ef_ecg_early_action").credit, 0);
    });
});

// ── Penalties and safety ────────────────────────────────────────────────────

describe("clinical track: penalties and safety", () => {
    it("per-match penalties scale with distinct tests and respect their cap", () => {
        const one = newEngine();
        one.orderTest("ctpa", "CTPA", 10);
        assert.equal(score(one).penalties.find((p) => p.id === "pen_delaying_imaging")!.points, 12);

        const four = newEngine();
        for (const [i, id] of ["ctpa", "ct_aortogram", "ct_chest", "mri_brain"].entries()) four.orderTest(id, id, 10 + i);
        assert.equal(score(four).penalties.find((p) => p.id === "pen_delaying_imaging")!.points, 30, "48 capped at 30");
    });

    it("ordering the same delaying test twice is charged once", () => {
        const e = newEngine();
        e.orderTest("ctpa", "CTPA", 10);
        e.orderTest("ctpa", "CTPA", 20);
        assert.equal(score(e).penalties.find((p) => p.id === "pen_delaying_imaging")!.points, 12);
    });

    it("a stress test in acute MI is a critical penalty and the top reasoning error", () => {
        const e = newEngine();
        e.giveIntervention("aspirin_300mg", 20);
        e.orderTest("exercise_stress_test", "Treadmill", 40);
        const r = score(e);
        assert.equal(r.reasoningError?.id, "m_stress_test");
        assert.ok(r.otherErrors.some((m) => m.id === "m_aspirin_not_reperfusion"));
        assert.ok(r.penalties.some((p) => p.id === "pen_stress_test" && p.critical));
        assert.equal(r.missed[0].critical, true);
    });

    it("an unsafe drug costs the management domain 15 points and appears as a critical miss", () => {
        const safe = newEngine();
        safe.giveIntervention("aspirin_300mg", 20);
        const risky = newEngine();
        risky.giveIntervention("aspirin_300mg", 20);
        risky.giveIntervention("gtn_sublingual", 30);

        const a = score(safe);
        const b = score(risky);
        assert.equal(b.safetyIssues.length, 1);
        assert.equal(b.domains.management, Math.max(0, a.domains.management - 15));
        assert.ok(b.missed.some((m) => m.critical && /^Safety:/.test(m.text)));
    });

    it("a beta-blocker mistake surfaces the beta-blocker error; with aspirin also given, the aspirin error ranks higher", () => {
        const beta = newEngine();
        beta.giveIntervention("metoprolol_iv", 30);
        assert.equal(score(beta).reasoningError?.id, "m_beta_blocker_shock");

        const both = newEngine();
        both.giveIntervention("aspirin_300mg", 20);
        both.giveIntervention("metoprolol_iv", 30);
        const r = score(both);
        assert.equal(r.reasoningError?.id, "m_aspirin_not_reperfusion", "priority 95 beats 92");
        assert.deepEqual(r.otherErrors.map((m) => m.id).slice(0, 1), ["m_beta_blocker_shock"]);
    });

    it("untreated VT is a critical management penalty; cardioverting it removes it", () => {
        const untreated = newEngine();
        untreated.advanceTo(min(22));
        assert.ok(score(untreated).penalties.some((p) => p.id === "pen_vt_untreated"));

        const treated = newEngine();
        treated.advanceTo(min(20));
        treated.giveIntervention("synchronised_cardioversion", min(20) + 20);
        treated.giveIntervention("primary_pci_initiated", min(20) + 30); // stops recurrence
        treated.advanceTo(min(22));
        assert.ok(!score(treated).penalties.some((p) => p.id === "pen_vt_untreated"));
    });

    it("a fluid bolus in pulmonary congestion is penalised", () => {
        const e = newEngine();
        e.giveIntervention("fluid_bolus_250ml", 30);
        assert.ok(score(e).penalties.some((p) => p.id === "pen_fluid_loading"));
    });
});

// ── Partial credit and plan-only actions ────────────────────────────────────

describe("clinical track: plan versus action", () => {
    it("writing 'aspirin' in the plan earns partial credit; giving it earns full", () => {
        const planned = newEngine();
        planned.submitManagement(["Give aspirin", "Monitor"], 100);
        const given = newEngine();
        given.giveIntervention("aspirin_300mg", 50);

        const p = item(score(planned), "mg_aspirin");
        assert.equal(p.credit, 0.6);
        assert.equal(p.basis, "partial");
        assert.equal(item(score(given), "mg_aspirin").credit, 1);
    });

    it("naming reperfusion in the plan but never doing it is not the same as doing it", () => {
        const e = newEngine();
        e.submitManagement(["Primary PCI"], 100);
        assert.equal(item(score(e), "mg_reperfusion_decision").credit, 0.35);
    });

    it("lysis earns the decision but only half the 'preferred strategy' credit", () => {
        const e = newEngine();
        e.giveIntervention("fibrinolysis_given", 200);
        const r = score(e);
        assert.equal(item(r, "mg_reperfusion_decision").credit, 1);
        assert.equal(item(r, "mg_prefers_pci").credit, 0.5);
    });
});

// ── Assistance accounting ───────────────────────────────────────────────────

describe("assistance accounting", () => {
    it("sums costs and labels each line from the events alone", () => {
        const events: ClinicalEvent[] = [
            { type: "ASSIST_USED", timestamp: 134, assistType: "explain_abnormal", cost: 2 },
            { type: "HISTORY_TAKEN", timestamp: 140, question: "q", response: "a" },
            { type: "ASSIST_USED", timestamp: 347, assistType: "ecg_interpretation_hint", cost: 3, target: "ecg_12_lead@300" },
            { type: "ASSIST_USED", timestamp: 502, assistType: "radiology_impression", cost: 3 },
        ];
        const { total, lines } = computeAssistance(events);
        assert.equal(total, 8);
        assert.deepEqual(
            lines.map((l) => [l.label, l.cost, l.clock]),
            [
                ["Abnormal value explained", 2, "02:14"],
                ["ECG interpretation assist", 3, "05:47"],
                ["Radiology impression revealed", 3, "08:22"],
            ]
        );
        assert.equal(lines[1].target, "ecg_12_lead@300");
    });

    it("an encounter with no assists costs nothing", () => {
        assert.deepEqual(computeAssistance([]), { total: 0, lines: [] });
    });
});

// ── Milestones for the debrief ──────────────────────────────────────────────

describe("milestones", () => {
    it("records first-order and first-gave times, deterioration and the action budget", () => {
        const e = newEngine();
        e.orderTest("ecg_12_lead", "ECG", 90);
        e.giveIntervention("aspirin_300mg", 120);
        e.orderTest("ecg_12_lead", "ECG", 500); // repeat
        e.advanceTo(min(16));
        const m = score(e).milestones;

        assert.equal(m.firstOrderedAt.ecg_12_lead, 90);
        assert.equal(m.firstGaveAt.aspirin_300mg, 120);
        assert.equal(m.budgetedActions, 3);
        assert.equal(m.recommendedActions, 10);
        assert.deepEqual(m.deteriorations.map((d) => d.ruleId), ["critical_window_no_reperfusion"]);
        assert.equal(m.flagSetAt.aspirin_given, 120);
    });
});

// A sanity check that the shipped case really can be played to a high score.
describe("the shipped case is winnable", () => {
    it("a textbook encounter reaches at least 90", () => {
        const e = newEngine();
        playExcellent(e);
        assert.ok(score(e).clinicalScore >= 90);
    });
});

// ECG_READ is exercised through the players; referenced here so an accidental edit is caught.
describe("fixtures", () => {
    it("the textbook ECG read is a real STEMI read", () => {
        assert.match(ECG_READ, /STEMI/);
    });
});
