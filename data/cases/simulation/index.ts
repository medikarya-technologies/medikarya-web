// =========================
// data/cases/simulation/index.ts
// =========================
// Simulation cases that ship with the app.
//
// Case JSON normally lives in Supabase (authored in data/cases/*.json, which is
// gitignored, then pushed by scripts/migrate-cases.ts). Simulation cases are
// engine-native: they are code-reviewed data that the engine's tests run
// against, so they are versioned here and bundled with a static import (no
// runtime filesystem access, so it works on serverless hosts).
//
// `getCaseById` / `getCases` consult Supabase first, so an admin can still
// override a bundled case by id.

import acuteAnteriorStemi from "./acute-anterior-stemi.json";

// The JSON is far richer than CaseData's loosely-typed shape; it is validated
// against the simulation schema by the test-suite, not by the compiler.
export const bundledSimulationCases: ReadonlyArray<Record<string, unknown> & { id: string }> = [
    acuteAnteriorStemi as unknown as Record<string, unknown> & { id: string },
];

export function getBundledSimulationCase(id: string): (Record<string, unknown> & { id: string }) | null {
    return bundledSimulationCases.find((c) => c.id === id) ?? null;
}
