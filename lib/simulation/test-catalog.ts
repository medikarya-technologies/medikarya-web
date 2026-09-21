// =========================
// lib/simulation/test-catalog.ts
// =========================
// The order menu as ONE case sees it: the case's own tests first, then (unless
// the case says otherwise) the master catalog.
//
// Everything that needs to know "what is this test?" (the resolver, the replay
// check, the ordering UI, the result viewer) asks here instead of the master
// catalog directly, so a case that defines its own tests behaves like any other.

import {
    CATALOG_CATEGORIES,
    CLINICAL_CATALOG,
    getCatalogTest,
    type CatalogTest,
    type TestCategory,
} from "../clinical-catalog";
import type { CustomTestDef, SimulationCaseConfig } from "./case-schema";

type CaseTests = Pick<SimulationCaseConfig, "custom_tests" | "order_menu">;

/** Fallback for a custom test that doesn't say how long it takes. */
const DEFAULT_CUSTOM_TURNAROUND_MINUTES = 30;

function fromCustom(t: CustomTestDef): CatalogTest {
    return {
        id: t.id,
        name: t.name,
        category: t.category,
        kind: t.kind,
        turnaroundMinutes: t.turnaround_minutes ?? DEFAULT_CUSTOM_TURNAROUND_MINUTES,
        specimen: t.specimen,
        // Custom tests carry their result lines in the case (`rows`), not a parameter table.
        parameters: [],
    };
}

/** The test with this id as this case defines it: the case's own version wins over the catalog's. */
export function getTestDef(config: CaseTests, id: string): CatalogTest | undefined {
    const custom = config.custom_tests?.find((t) => t.id === id);
    if (custom) return fromCustom(custom);
    // In a case-only menu the master catalog is not orderable, so it is not resolvable either.
    if (config.order_menu === "case_only") return undefined;
    return getCatalogTest(id);
}

/** Everything the student can order in this case, filtered like the catalog search. */
export function listOrderableTests(config: CaseTests, query = "", category: TestCategory | "all" = "all"): CatalogTest[] {
    const q = query.trim().toLowerCase();
    const custom = (config.custom_tests ?? []).map(fromCustom);
    const customIds = new Set(custom.map((t) => t.id));
    const pool =
        config.order_menu === "case_only"
            ? custom
            : [...custom, ...CLINICAL_CATALOG.filter((t) => !customIds.has(t.id))];
    return pool.filter((t) => {
        if (category !== "all" && t.category !== category) return false;
        if (!q) return true;
        return (
            t.name.toLowerCase().includes(q) ||
            t.id.replace(/[_-]/g, " ").includes(q) ||
            (t.aliases ?? []).some((a) => a.toLowerCase().includes(q))
        );
    });
}

/** Categories that have at least one orderable test in this case. */
export function orderableCategories(config: CaseTests): Array<{ id: TestCategory; label: string }> {
    const present = new Set(listOrderableTests(config).map((t) => t.category));
    return CATALOG_CATEGORIES.filter((c) => present.has(c.id)).map((c) => ({ id: c.id, label: c.label }));
}
