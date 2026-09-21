import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { AssistPolicy, ASSIST_MODE_PRESETS, DEFAULT_ASSIST_COSTS } from "../assist-policy";
import { EncounterEngine } from "../encounter-engine";
import { ASSIST_TYPES, type ClinicalEvent, type EventOf } from "../encounter-events";
import { makeStemiConfig } from "./fixtures";

const assists = (events: readonly ClinicalEvent[]) =>
    events.filter((e): e is EventOf<"ASSIST_USED"> => e.type === "ASSIST_USED");

describe("assist ladder presets", () => {
    it("beginner allows every assist", () => {
        const policy = new AssistPolicy({ mode: "beginner" });
        for (const type of ASSIST_TYPES) assert.equal(policy.canUse(type), true, type);
    });

    it("intermediate allows highlights/hints/impressions but not the diagnosis reveal or management guidance", () => {
        const policy = new AssistPolicy({ mode: "intermediate" });
        assert.equal(policy.canUse("highlight_abnormal"), true);
        assert.equal(policy.canUse("explain_abnormal"), true);
        assert.equal(policy.canUse("ecg_interpretation_hint"), true);
        assert.equal(policy.canUse("radiology_impression"), true);
        assert.equal(policy.canUse("socratic_hint"), true);
        assert.equal(policy.canUse("reveal_diagnosis"), false);
        assert.equal(policy.canUse("management_guidance"), false);
    });

    it("advanced allows vital highlights only", () => {
        const policy = new AssistPolicy({ mode: "advanced" });
        assert.deepEqual(
            ASSIST_TYPES.filter((t) => policy.canUse(t)),
            ["highlight_abnormal"]
        );
    });

    it("assessment allows nothing", () => {
        const policy = new AssistPolicy({ mode: "assessment" });
        assert.deepEqual(ASSIST_TYPES.filter((t) => policy.canUse(t)), []);
    });

    it("every preset only allows types it doesn't also disable", () => {
        for (const [mode, preset] of Object.entries(ASSIST_MODE_PRESETS)) {
            for (const t of preset.allowed) {
                assert.equal(preset.disabled.includes(t), false, `${mode}: ${t} is both allowed and disabled`);
            }
        }
    });
});

describe("assist policy configuration", () => {
    it("an explicit allowlist overrides the preset; disabled always wins", () => {
        const policy = new AssistPolicy({
            mode: "beginner",
            allowed: ["socratic_hint", "highlight_abnormal"],
            disabled: ["highlight_abnormal"],
        });
        assert.equal(policy.canUse("socratic_hint"), true);
        assert.equal(policy.canUse("highlight_abnormal"), false, "disabled wins over allowed");
        assert.equal(policy.canUse("explain_abnormal"), false, "not on the allowlist");
    });

    it("reports why an assist is unavailable", () => {
        const policy = new AssistPolicy(makeStemiConfig().assist_config);
        assert.equal(policy.availability("reveal_diagnosis").reason, "disabled");
        assert.equal(policy.availability("diagnostic_hint").reason, "not_allowed");
        assert.equal(policy.availability("socratic_hint").available, true);
    });

    it("prices from the case, falling back to engine defaults", () => {
        const policy = new AssistPolicy({ mode: "beginner", costs: { socratic_hint: { independent_penalty: 4 } } });
        assert.equal(policy.costOf("socratic_hint"), 4);
        assert.equal(policy.costOf("explain_abnormal"), DEFAULT_ASSIST_COSTS.explain_abnormal);
    });

    it("ignores nonsense costs rather than charging NaN", () => {
        const policy = new AssistPolicy({
            mode: "beginner",
            costs: { socratic_hint: { independent_penalty: -3 }, explain_abnormal: { independent_penalty: NaN } },
        });
        assert.equal(policy.costOf("socratic_hint"), DEFAULT_ASSIST_COSTS.socratic_hint);
        assert.equal(policy.costOf("explain_abnormal"), DEFAULT_ASSIST_COSTS.explain_abnormal);
    });
});

describe("assist enforcement in the engine", () => {
    it("refuses a disabled assist and logs nothing", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        const result = engine.requestAssist("reveal_diagnosis", 60);

        assert.deepEqual(result, { ok: false, reason: "disabled" });
        assert.equal(engine.events.length, 0);
    });

    it("charges the case's price and records who/when/what", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        const result = engine.requestAssist("socratic_hint", 134, "hint:ecg");

        assert.equal(result.ok && result.cost, 3);
        assert.deepEqual(assists(engine.events), [
            { type: "ASSIST_USED", timestamp: 134, assistType: "socratic_hint", cost: 3, target: "hint:ecg" },
        ]);
    });

    it("asking again for the same target is free — you already paid for that help", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.requestAssist("explain_abnormal", 100, "troponin_i@100");
        const again = engine.requestAssist("explain_abnormal", 130, "troponin_i@100");

        assert.equal(again.ok && again.charged, false);
        assert.equal(assists(engine.events).length, 1);
    });

    it("a different target is charged separately", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        engine.requestAssist("explain_abnormal", 100, "troponin_i@100");
        engine.requestAssist("explain_abnormal", 130, "bmp@120");
        assert.equal(assists(engine.events).length, 2);
    });

    it("revealing a result logs both the assist and the reveal, and only once per order", () => {
        const engine = new EncounterEngine(makeStemiConfig());
        const args = {
            testId: "ecg_12_lead",
            orderTimestamp: 60,
            revealType: "hint" as const,
            assistType: "ecg_interpretation_hint" as const,
            timestamp: 200,
        };
        const first = engine.revealResult(args);
        assert.equal(first.ok && first.cost, 3);

        const types = engine.events.map((e) => e.type);
        assert.deepEqual(types, ["ASSIST_USED", "RESULT_REVEALED"]);

        engine.revealResult({ ...args, timestamp: 260 });
        assert.equal(engine.events.length, 2, "second reveal of the same order adds nothing");

        // A repeat ECG is a different order and is charged again.
        engine.revealResult({ ...args, orderTimestamp: 600, timestamp: 700 });
        assert.equal(assists(engine.events).length, 2);
    });

    it("a reveal the case disallows is refused end to end", () => {
        const engine = new EncounterEngine(
            makeStemiConfig({ assist_config: { mode: "assessment" } })
        );
        const result = engine.revealResult({
            testId: "ecg_12_lead",
            orderTimestamp: 10,
            revealType: "hint",
            assistType: "ecg_interpretation_hint",
            timestamp: 20,
        });
        assert.equal(result.ok, false);
        assert.equal(engine.events.length, 0, "no RESULT_REVEALED without a paid-for assist");
    });
});
