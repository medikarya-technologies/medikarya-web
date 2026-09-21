import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { appearanceAtArrival } from "../arrival";
import { describeLook, figureFor, resolveLook } from "../appearance";
import { PatientState, snapshotContext } from "../patient-state";
import { upgradeLegacyCase } from "../legacy-adapter";
import { isSimulationCase, type SimulationCaseConfig } from "../case-schema";
import { bundledSimulationCases } from "../../../data/cases/simulation";
import { appearanceOverlays } from "../../../data/cases/simulation/appearance";
import { makeStemiConfig } from "./fixtures";

describe("arrival: the patient as first seen, before the encounter starts", () => {
    const stemi = bundledSimulationCases[0] as unknown as SimulationCaseConfig;

    it("is the bedside rail's first frame: the appearance against the patient at minute zero", () => {
        const a = appearanceAtArrival(stemi);
        const start = PatientState.initial(stemi);
        const expected = resolveLook(stemi.appearance, snapshotContext(start.snapshot(), 0));
        assert.deepEqual(a.look, expected);
        assert.equal(a.observation, describeLook(expected));
        assert.ok(a.observation.length > 0, "the STEMI patient is visibly unwell on arrival");
        assert.equal(a.persona.figure, figureFor(stemi.patient?.age, stemi.patient?.gender));
        assert.equal(a.rr, start.rr, "the portrait breathes at the patient's real respiratory rate");
    });

    it("resolves a variant that already holds at minute zero, not just the base look", () => {
        const config = makeStemiConfig({
            appearance: {
                pallor: 0,
                variants: [{ when: { flag: "reperfusion_strategy_initiated", is: false }, pallor: 3, note: "Ashen." }],
            },
        });
        const a = appearanceAtArrival(config);
        assert.equal(a.look.pallor, 3);
        assert.equal(a.observation, "Ashen.");
    });

    it("does not apply a variant that only holds later", () => {
        const config = makeStemiConfig({
            appearance: { pallor: 1, variants: [{ when: { flag: "reperfusion_strategy_initiated", is: true }, pallor: 0 }] },
        });
        assert.equal(appearanceAtArrival(config).look.pallor, 1);
    });

    it("still gives a case that was never upgraded a face, from what it carries", () => {
        const plain = {
            patient: { age: 70, gender: "Female", vitalSigns: { respiratoryRate: { value: 22 } } },
            appearance: { pallor: 2 },
        };
        const a = appearanceAtArrival(plain);
        assert.equal(a.look.pallor, 2);
        assert.match(a.observation, /pale/i);
        assert.equal(a.persona.figure, "adult_f");
        assert.ok(a.persona.lines > 0.6 && a.persona.grey > 0.5, "a 70-year-old looks it");
        assert.equal(a.rr, 22);
    });

    it("says nothing when the case says nothing", () => {
        const a = appearanceAtArrival({ patient: { age: 30, gender: "Male" } });
        assert.equal(a.observation, "");
        assert.equal(a.look.expression, "calm");
        assert.equal(a.rr, 16);
        assert.ok(["medium", "brown"].includes(a.persona.tone), "an ordinary skin tone when the case does not say");
    });

    it("never throws on missing or malformed input", () => {
        for (const bad of [undefined, null, {}, { patient: null }, { initial_state: {}, event_rules: [], action_consequences: [] }]) {
            assert.doesNotThrow(() => appearanceAtArrival(bad), JSON.stringify(bad));
        }
    });

    it("keeps the authored skin tone", () => {
        assert.equal(appearanceAtArrival({ patient: { age: 40, gender: "Male" }, appearance: { skin_tone: "deep" } }).persona.tone, "deep");
    });
});

describe("arrival: the real classic cases, upgraded as the app serves them", () => {
    const dir = path.join(process.cwd(), "data", "cases");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
    if (files.length === 0) {
        it.skip("no local case JSON files here", () => {});
        return;
    }

    for (const file of files) {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        const served = upgradeLegacyCase(raw, { appearance: appearanceOverlays[raw.id as string] }) as Record<string, any>;

        it(`${raw.id}: the briefing and the bedside show the same person`, () => {
            assert.ok(isSimulationCase(served), "the served case runs at the bedside");
            const a = appearanceAtArrival(served);
            const first = resolveLook(served.appearance, snapshotContext(PatientState.initial(served as SimulationCaseConfig).snapshot(), 0));
            assert.deepEqual(a.look, first);
            assert.equal(a.persona.figure, figureFor(raw.patient.age, raw.patient.gender));
            assert.ok(Number.isFinite(a.rr) && a.rr >= 4 && a.rr <= 80, `rr ${a.rr}`);
        });
    }

    it("a jaundiced newborn is seen to be yellow before the case starts", () => {
        const file = path.join(dir, "neonatal-jaundice-breastmilk.json");
        if (!fs.existsSync(file)) return;
        const served = upgradeLegacyCase(JSON.parse(fs.readFileSync(file, "utf8"))) as Record<string, any>;
        const a = appearanceAtArrival(served);
        assert.equal(a.persona.figure, "infant");
        assert.ok(a.look.jaundice >= 2);
        assert.match(a.observation, /yellow/i);
    });
});
