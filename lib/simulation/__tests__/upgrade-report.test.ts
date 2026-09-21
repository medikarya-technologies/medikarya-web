import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { upgradeReport } from "../upgrade-report";
import { bundledSimulationCases } from "../../../data/cases/simulation";
import { appearanceOverlays } from "../../../data/cases/simulation/appearance";

const newCase = (over: Record<string, unknown> = {}) => ({
    id: "a-new-case",
    title: "A new case",
    category: "Internal Medicine",
    patient: { name: "Mrs. Test", age: 34, gender: "Female", chiefComplaint: "Tiredness", vitalSigns: { heartRate: { value: 88 } } },
    tests: [{ id: "cbc", name: "Complete blood count", category: "Haematology" }],
    patient_facts: {},
    evaluation_config: {},
    ...over,
});

const text = (r: { headline: string; notes: string[] }) => [r.headline, ...r.notes].join("\n");

describe("upgrade report: what a student will get from a case you add", () => {
    it("says a case with a heart rate and one test will run at the bedside, and what it got", () => {
        const r = upgradeReport(newCase());
        assert.equal(r.bedside, true);
        const t = text(r);
        assert.match(t, /Monitor: sinus normal at 88 bpm/);
        assert.match(t, /Not recorded in the case, so shown as "—": bp, spo2, rr, temperature/);
        assert.match(t, /Investigations: 1 to order, 0 with a result written in the case/);
        assert.match(t, /No findings were recorded for this case/);
        assert.match(t, /no Examine tab/);
        assert.match(t, /nothing found in the examination findings, so a calm face/);
        assert.match(t, /Portrait: adult f, 34 y, female, in a (salwar|saree)/);
    });

    it("says why a case without tests, or without a heart rate, falls back to the old flow", () => {
        const noTests = upgradeReport(newCase({ tests: [] }));
        assert.equal(noTests.bedside, false);
        assert.match(text(noTests), /OLD classic three-step flow/);
        assert.match(text(noTests), /tests\[\] has no test with an id/);

        const noHeartRate = upgradeReport(newCase({ patient: { name: "X", age: 30, gender: "Male", vitalSigns: { bloodPressure: { systolic: 120, diastolic: 80 } } } }));
        assert.equal(noHeartRate.bedside, false);
        assert.match(text(noHeartRate), /heartRate has no value/);

        const both = upgradeReport(newCase({ tests: [], patient: { name: "X", age: 30, gender: "Male" } }));
        assert.equal(both.notes.length, 2, "it names every reason, not just the first");
    });

    it("respects an opt-out and recognises an authored simulation case", () => {
        const out = upgradeReport(newCase({ experience: "classic" }));
        assert.equal(out.bedside, false);
        assert.match(out.headline, /experience": "classic"/);

        const stemi = upgradeReport(bundledSimulationCases[0]);
        assert.equal(stemi.bedside, true);
        assert.match(stemi.headline, /authored simulation case/);
    });

    it("does not throw on anything", () => {
        for (const bad of [undefined, null, 5, "case", [], {}, { patient: null }, { tests: "x" }]) assert.doesNotThrow(() => upgradeReport(bad), JSON.stringify(bad));
        assert.equal(upgradeReport(undefined).bedside, false);
    });

    it("counts only the results the case actually wrote, and reads the findings for the first look", () => {
        const r = upgradeReport(
            newCase({
                tests: [
                    { id: "cbc", name: "CBC", result: { summary: "Hb 8.1 g/dL" } },
                    { id: "ferritin", name: "Ferritin", result: "Low" },
                    { id: "bp", name: "Blood pressure" },
                    { id: "esr", name: "ESR", result: {} },
                ],
                patient: { name: "Mrs. Test", age: 34, gender: "Female", vitalSigns: { heartRate: { value: 104 }, bloodPressure: { systolic: 112, diastolic: 70 }, oxygenSaturation: { value: 97 }, respiratoryRate: { value: 20 }, temperature: { value: 37 } } },
                patient_facts: { general_physical_examination: { pallor: "Present; conjunctivae are pale" } },
            })
        );
        const t = text(r);
        assert.match(t, /4 to order, 2 with a result written/);
        assert.match(t, /The other 2 will say/);
        assert.match(t, /First look: "Looks pale\."/);
        assert.match(t, /Examination: 1 manoeuvres/);
        assert.match(t, /sinus tachycardia at 104 bpm/);
        assert.doesNotMatch(t, /Not recorded/);
    });

    it("describes the portrait the app will draw, and says how to override it", () => {
        const t = text(upgradeReport(newCase({ id: "x", patient: { name: "Old Mr. Test", age: 80, gender: "Male", vitalSigns: { heartRate: { value: 70 } } } })));
        assert.match(t, /Portrait: adult m, 80 y, male, in a (kurta|kurta jacket)/);
        assert.match(t, /appearance\.attire/);

        const baby = text(upgradeReport(newCase({ patient: { name: "Baby", age: 0.1, gender: "Female", vitalSigns: { heartRate: { value: 130 } } } })));
        assert.match(baby, /Portrait: infant, 0\.1 y, female, in a swaddle/);
    });

    it("runs every real case through and finds each one will run at the bedside", () => {
        const dir = path.join(process.cwd(), "data", "cases");
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
        if (files.length === 0) return;
        for (const file of files) {
            const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
            const r = upgradeReport(raw, { appearance: appearanceOverlays[raw.id as string] });
            assert.equal(r.bedside, true, `${file}: ${text(r)}`);
            assert.ok(r.notes.length >= 5, file);
        }
    });
});
