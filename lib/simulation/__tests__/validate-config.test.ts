import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateSimulationCase } from "../validate-config";
import { makeStemiConfig } from "./fixtures";
import type { SimulationCaseConfig } from "../case-schema";

// Deep copy so each test can break its own copy.
const fresh = (): SimulationCaseConfig => JSON.parse(JSON.stringify(makeStemiConfig()));
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("case validator: the fixture is valid", () => {
    it("accepts the plan-shaped fixture", () => {
        const result = validateSimulationCase(fresh());
        assert.deepEqual(result.errors, []);
        assert.equal(result.ok, true);
    });

    it("rejects non-objects", () => {
        assert.equal(validateSimulationCase(null).ok, false);
        assert.equal(validateSimulationCase("nope").ok, false);
        assert.equal(validateSimulationCase([]).ok, false);
    });
});

describe("case validator: catches authoring typos", () => {
    it("flags a rule that waits on an undeclared flag (the silent-typo case)", () => {
        const c = fresh();
        (c.event_rules[1].when as { all: unknown[] }).all.push({ flag: "reperfusion_strat_initiated", is: false });
        const result = validateSimulationCase(c);
        assert.equal(result.ok, false);
        assert.ok(result.errors.some((e) => /reperfusion_strat_initiated.*not declared/.test(e.message)));
    });

    it("flags a consequence that sets an undeclared flag", () => {
        const c = fresh();
        c.action_consequences[0].sets = { aspirin_giv: true };
        assert.ok(validateSimulationCase(c).errors.some((e) => /aspirin_giv/.test(e.message)));
    });

    it("flags duplicate rule ids", () => {
        const c = fresh();
        c.event_rules[1].id = c.event_rules[0].id;
        assert.ok(validateSimulationCase(c).errors.some((e) => /Duplicate rule id/.test(e.message)));
    });

    it("flags an unparseable physiological delta", () => {
        const c = fresh();
        c.event_rules[1].physiological_changes = { hr_delta: "ten" };
        assert.ok(validateSimulationCase(c).errors.some((e) => /hr_delta/.test(e.path)));
    });

    it("flags a malformed blood-pressure delta", () => {
        const c = fresh();
        c.event_rules[1].physiological_changes = { bp_delta: "-14 over -8" };
        assert.ok(validateSimulationCase(c).errors.some((e) => /bp_delta/.test(e.path)));
    });

    it("flags an unknown rhythm and unknown parameter", () => {
        const c = fresh();
        c.event_rules[0].physiological_changes = { rhythm: "sinus_wobble" as never };
        c.state_thresholds![0] = { parameter: "potassium" as never, lt: 3, trigger: "hypok" };
        const result = validateSimulationCase(c);
        assert.ok(result.errors.some((e) => /rhythm/.test(e.path)));
        assert.ok(result.errors.some((e) => /parameter/.test(e.path)));
    });

    it("flags an unknown condition key", () => {
        const c = fresh();
        (c.event_rules[0].when as { all: unknown[] }).all.push({ time_elapsed_gt_minutes: 4 });
        assert.ok(validateSimulationCase(c).errors.some((e) => /Unknown condition key/.test(e.message)));
    });

    it("flags a parameter condition with no comparator", () => {
        const c = fresh();
        (c.event_rules[0].when as { all: unknown[] }).all.push({ parameter: "spo2" });
        assert.ok(validateSimulationCase(c).errors.some((e) => /Needs one of/.test(e.message)));
    });

    it("flags an alarm condition that references no defined threshold", () => {
        const c = fresh();
        (c.event_rules[0].when as { all: unknown[] }).all.push({ alarm: "made_up_alarm" });
        assert.ok(validateSimulationCase(c).errors.some((e) => /made_up_alarm/.test(e.message)));
    });

    it("flags a bad assist configuration", () => {
        const c = fresh();
        c.assist_config = { mode: "expert" as never, allowed: ["telepathy" as never] };
        const result = validateSimulationCase(c);
        assert.ok(result.errors.some((e) => e.path === "assist_config.mode"));
        assert.ok(result.errors.some((e) => /telepathy/.test(e.message)));
    });

    it("flags missing required blocks", () => {
        const result = validateSimulationCase({ id: "x" });
        assert.ok(paths(result.errors).includes("clinical_constraints"));
        assert.ok(paths(result.errors).includes("assist_config"));
        assert.ok(paths(result.errors).includes("initial_state"));
        assert.ok(paths(result.errors).includes("event_rules"));
        assert.ok(paths(result.errors).includes("action_consequences"));
    });

    it("flags nonsense constraints", () => {
        const c = fresh();
        c.clinical_constraints = { recommended_actions: 0, critical_window_minutes: -1, hard_time_limit_minutes: 25 };
        const result = validateSimulationCase(c);
        assert.ok(result.errors.some((e) => /recommended_actions/.test(e.path)));
        assert.ok(result.errors.some((e) => /critical_window_minutes/.test(e.path)));
    });
});

describe("case validator: warns about things that are legal but probably wrong", () => {
    it("warns when a rule waits on a flag nothing can ever set", () => {
        const c = fresh();
        c.initial_state.flags.stress_tested = false;
        (c.event_rules[0].when as { all: unknown[] }).all.push({ flag: "stress_tested", is: true });
        const result = validateSimulationCase(c);
        assert.equal(result.ok, true, "legal");
        assert.ok(result.warnings.some((w) => /stress_tested.*can never fire/.test(w.message)));
    });

    it("warns when a rule waits on a state that is never entered", () => {
        const c = fresh();
        (c.event_rules[2].when as { all: unknown[] }).all.push({ state: "worsening_ischaemia" }); // UK spelling typo
        const result = validateSimulationCase(c);
        assert.ok(result.warnings.some((w) => /worsening_ischaemia.*never entered/.test(w.message)));
    });

    it("warns when a rule emits an action nothing defines", () => {
        const c = fresh();
        c.event_rules[4].emits = "reperfusion_achievd";
        assert.ok(validateSimulationCase(c).warnings.some((w) => /reperfusion_achievd/.test(w.message)));
    });

    it("warns when an assist is both allowed and disabled", () => {
        const c = fresh();
        c.assist_config.disabled = [...(c.assist_config.disabled ?? []), "socratic_hint"];
        assert.ok(validateSimulationCase(c).warnings.some((w) => /socratic_hint.*disabled wins/.test(w.message)));
    });

    it("warns when the legacy vitals block disagrees with initial_state", () => {
        const c = fresh();
        c.patient = { vitalSigns: { heartRate: { value: 96 } } };
        assert.ok(validateSimulationCase(c).warnings.some((w) => /differs from patient\.vitalSigns\.heartRate/.test(w.message)));
    });

    it("warns about tray ids that nothing triggers, when told what the tray offers", () => {
        const c = fresh();
        c.action_consequences.push({ action: "aspirin_300mgg", sets: { aspirin_given: true } });
        const result = validateSimulationCase(c, { knownActions: ["aspirin_300mg"] });
        assert.ok(result.warnings.some((w) => /aspirin_300mgg/.test(w.message)));
        // Derived and system actions are legitimate and must not be flagged.
        assert.ok(!result.warnings.some((w) => /ecg_12_lead_ordered|stemi_recognized_by_student|reperfusion_achieved/.test(w.message)));
    });
});

describe("case validator: missing rubric", () => {
    it("warns that a case without a rubric cannot be scored", () => {
        const result = validateSimulationCase(fresh());
        assert.equal(result.ok, true, "legal: the encounter still runs");
        assert.ok(result.warnings.some((w) => w.path === "scoring_rubric" && /cannot be scored/.test(w.message)));
    });
});

describe("case validator: rubric", () => {
    const withRubric = (): SimulationCaseConfig => {
        const c = fresh();
        c.scoring_rubric = {
            weights: { clinical_reasoning: 1, investigation_accuracy: 1, management: 1, efficiency: 1 },
            diagnosis: { ground_truth: "STEMI", accepted: ["stemi"] },
            items: [
                { id: "a", label: "A", domain: "clinical_reasoning", weight: 1, met_when: { flag: "ecg_obtained", is: true } },
                { id: "b", label: "B", domain: "investigation_accuracy", weight: 1, met_when: { ordered: "ecg_12_lead" } },
                { id: "c", label: "C", domain: "management", weight: 1, met_when: { gave: "aspirin_300mg" } },
                { id: "d", label: "D", domain: "efficiency", weight: 1, met_when: { budgeted_actions_lte: "recommended" } },
            ],
        };
        return c;
    };

    it("accepts a well-formed rubric", () => {
        assert.deepEqual(validateSimulationCase(withRubric()).errors, []);
    });

    it("rejects an item with neither met_when nor graded", () => {
        const c = withRubric();
        delete (c.scoring_rubric!.items[0] as { met_when?: unknown }).met_when;
        assert.ok(validateSimulationCase(c).errors.some((e) => /met_when.*graded/.test(e.message)));
    });

    it("rejects duplicate rubric ids and non-positive weights", () => {
        const c = withRubric();
        c.scoring_rubric!.items[1].id = "a";
        c.scoring_rubric!.items[2].weight = 0;
        const result = validateSimulationCase(c);
        assert.ok(result.errors.some((e) => /Duplicate rubric id/.test(e.message)));
        assert.ok(result.errors.some((e) => /weight/.test(e.path)));
    });

    it("rejects an encounter predicate written with the wrong shape", () => {
        const c = withRubric();
        c.scoring_rubric!.items[1].met_when = { ordered: [] } as never;
        assert.ok(validateSimulationCase(c).errors.some((e) => /ordered/.test(e.path)));
    });

    it("rejects a graded item whose zero point precedes its full-credit point", () => {
        const c = withRubric();
        c.scoring_rubric!.items[3] = {
            id: "d", label: "D", domain: "efficiency", weight: 1,
            graded: { measure: { ordered: "ecg_12_lead" }, full_within_minutes: 10, zero_after_minutes: 5 },
        };
        assert.ok(validateSimulationCase(c).errors.some((e) => /graded/.test(e.path)));
    });

    it("warns when a rubric names a knowledge gap that has no reinforcement", () => {
        const c = withRubric();
        c.scoring_rubric!.items[0].knowledge_gap = "some_gap";
        c.reinforcement = {};
        assert.ok(validateSimulationCase(c).warnings.some((w) => /some_gap/.test(w.message)));
    });

    it("rejects malformed reinforcement questions", () => {
        const c = withRubric();
        c.reinforcement = {
            gap: { title: "G", summary: "s", questions: [{ id: "q", stem: "?", options: ["a", "b", "c"], correctIndex: 5, explanation: "e" }] },
        };
        const result = validateSimulationCase(c);
        assert.ok(result.errors.some((e) => /options/.test(e.path)));
        assert.ok(result.errors.some((e) => /correctIndex/.test(e.path)));
    });
});
