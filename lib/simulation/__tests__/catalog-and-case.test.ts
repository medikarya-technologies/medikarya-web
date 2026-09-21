import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    CATALOG_TEST_IDS,
    CLINICAL_CATALOG,
    assistTypeForTest,
    defaultNormalValue,
    deriveStatus,
    formatReferenceRange,
    getCatalogTest,
    resolveRange,
    searchCatalog,
} from "../../clinical-catalog";
import { INTERVENTION_IDS, interventionsForCase } from "../intervention-catalog";
import { formatValidation, validateSimulationCase } from "../validate-config";
import { bundledSimulationCases } from "../../../data/cases/simulation";

describe("master catalog", () => {
    it("has 150+ tests with unique ids", () => {
        assert.ok(CLINICAL_CATALOG.length >= 150, `only ${CLINICAL_CATALOG.length} tests`);
        assert.equal(new Set(CATALOG_TEST_IDS).size, CATALOG_TEST_IDS.length, "duplicate test ids");
    });

    it("gives every test a positive turnaround and every lab at least one parameter", () => {
        for (const t of CLINICAL_CATALOG) {
            assert.ok(t.turnaroundMinutes > 0, `${t.id}: turnaround`);
            if (t.kind === "lab") assert.ok((t.parameters ?? []).length > 0, `${t.id}: lab without parameters`);
        }
    });

    it("keeps reference ranges internally consistent", () => {
        for (const t of CLINICAL_CATALOG) {
            for (const p of t.parameters ?? []) {
                for (const sex of ["male", "female"] as const) {
                    const { low, high } = resolveRange(p, sex);
                    if (low !== undefined && high !== undefined) assert.ok(low < high, `${t.id}.${p.key} (${sex}): low ≥ high`);
                    if (p.criticalLow !== undefined && low !== undefined) assert.ok(p.criticalLow < low, `${t.id}.${p.key}: criticalLow ≥ low`);
                    if (p.criticalHigh !== undefined && high !== undefined) assert.ok(p.criticalHigh > high, `${t.id}.${p.key}: criticalHigh ≤ high`);
                }
            }
        }
    });

    it("every parameter's generated normal value is itself normal", () => {
        for (const t of CLINICAL_CATALOG) {
            for (const p of t.parameters ?? []) {
                for (const sex of ["male", "female"] as const) {
                    const v = defaultNormalValue(p, sex);
                    assert.equal(deriveStatus(p, v, sex), "normal", `${t.id}.${p.key} (${sex}) default ${String(v)}`);
                }
            }
        }
    });

    it("derives status against sex-specific ranges", () => {
        const hb = getCatalogTest("cbc")!.parameters!.find((p) => p.key === "hb")!;
        assert.equal(deriveStatus(hb, 12.8, "male"), "low");
        assert.equal(deriveStatus(hb, 12.8, "female"), "normal");
        assert.equal(deriveStatus(hb, 6.5, "female"), "critical");
        assert.equal(formatReferenceRange(hb, "male"), "13.5–17.5");
    });

    it("formats one-sided and qualitative ranges", () => {
        const trop = getCatalogTest("troponin_i")!.parameters![0];
        assert.equal(formatReferenceRange(trop), "< 0.04");
        assert.equal(deriveStatus(trop, 4.82), "high");
        const hbsag = getCatalogTest("hbsag")!.parameters![0];
        assert.equal(deriveStatus(hbsag, "Non-reactive"), "normal");
        assert.equal(deriveStatus(hbsag, "Reactive"), "high");
    });

    it("searches by name, id and alias, optionally within a category", () => {
        assert.ok(searchCatalog("troponin").length >= 3);
        assert.ok(searchCatalog("ekg").some((t) => t.id === "ecg_12_lead"));
        assert.ok(searchCatalog("u&e").some((t) => t.id === "bmp"));
        assert.ok(searchCatalog("", "imaging").every((t) => t.category === "imaging"));
        assert.equal(searchCatalog("zzzz-nothing").length, 0);
    });

    it("maps a test's kind to the assist that unlocks its expert read", () => {
        assert.equal(assistTypeForTest(getCatalogTest("ecg_12_lead")!), "ecg_interpretation_hint");
        assert.equal(assistTypeForTest(getCatalogTest("cxr_pa")!), "radiology_impression");
        assert.equal(assistTypeForTest(getCatalogTest("cbc")!), "explain_abnormal");
    });
});

describe("intervention tray", () => {
    it("has unique ids across the four plan groups", () => {
        assert.equal(new Set(INTERVENTION_IDS).size, INTERVENTION_IDS.length);
        const groups = new Set(interventionsForCase({}).map((i) => i.group));
        assert.deepEqual(groups, new Set(["airway", "circulation", "medications", "cardiac_procedures"]));
    });

    it("offers only a case's chosen subset when it declares one", () => {
        const subset = interventionsForCase({ available_interventions: ["aspirin_300mg", "iv_access"] });
        assert.deepEqual(subset.map((i) => i.id).sort(), ["aspirin_300mg", "iv_access"]);
    });
});

describe("bundled simulation cases", () => {
    for (const caseData of bundledSimulationCases) {
        it(`${caseData.id} passes schema validation with no errors or warnings`, () => {
            const result = validateSimulationCase(caseData, {
                knownActions: INTERVENTION_IDS,
                knownTestIds: CATALOG_TEST_IDS,
            });
            assert.ok(result.ok && result.warnings.length === 0, `\n${formatValidation(result)}\n`);
        });
    }
});
