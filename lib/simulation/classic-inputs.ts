// =========================
// lib/simulation/classic-inputs.ts
// =========================
// A bedside encounter of a classic case is scored by the classic evaluator, which
// wants what it has always wanted: the student's diagnosis and plan, the tests
// they ordered, and the consultation as a chat transcript. The encounter's event
// log holds all three; this reads them back out.
//
// Pure: no I/O, no React. The evaluator itself (which calls a model) lives on the
// server; this is only the translation.

import type { ClinicalEvent } from "./encounter-events";

export interface ClassicDiagnosisInput {
    primaryDiagnosis?: string;
    differentials: string[];
    supportingFindings: string[];
    missingInformation: string[];
    managementPlan: string[];
    submittedAt: string;
}

export interface ClassicInputs {
    diagnosis: ClassicDiagnosisInput;
    orderedTests: Array<{ id: string; name: string }>;
    chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

function lastOf<T extends ClinicalEvent["type"]>(events: readonly ClinicalEvent[], type: T): Extract<ClinicalEvent, { type: T }> | undefined {
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].type === type) return events[i] as Extract<ClinicalEvent, { type: T }>;
    }
    return undefined;
}

export function classicInputsFromEvents(events: readonly ClinicalEvent[], now: Date = new Date()): ClassicInputs {
    const dx = lastOf(events, "DIAGNOSIS_SUBMITTED");
    const differential = lastOf(events, "DIFFERENTIAL_SUBMITTED");
    const plan = lastOf(events, "MANAGEMENT_SUBMITTED");

    const primary = dx?.primary.trim() || undefined;

    // The ranked differential's first slot is the working diagnosis; the classic form asks for the alternatives.
    const differentials = (differential?.ranked ?? [])
        .map((d) => d.trim())
        .filter((d) => d && d.toLowerCase() !== primary?.toLowerCase());

    const orderedTests: ClassicInputs["orderedTests"] = [];
    const chatHistory: ClassicInputs["chatHistory"] = [];
    for (const e of events) {
        if (e.type === "TEST_ORDERED" && !orderedTests.some((t) => t.id === e.testId)) {
            orderedTests.push({ id: e.testId, name: e.testName });
        } else if (e.type === "HISTORY_TAKEN") {
            chatHistory.push({ role: "user", content: e.question }, { role: "assistant", content: e.response });
        }
    }

    return {
        diagnosis: {
            primaryDiagnosis: primary,
            differentials,
            supportingFindings: (dx?.reasoning ?? "")
                .split(/\n+/)
                .map((s) => s.trim())
                .filter(Boolean),
            missingInformation: [],
            managementPlan: (plan?.steps ?? []).map((s) => s.trim()).filter(Boolean),
            submittedAt: now.toISOString(),
        },
        orderedTests,
        chatHistory,
    };
}
