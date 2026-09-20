// =========================
// cases/lib/investigation-result-builder.ts
// =========================
// Builds InvestigationRules keyed by test.id from caseData.patient.investigations.tests[].
// This is the ONLY place test result data should be constructed.
// Case JSON is the single source of medical truth.

import { InvestigationRules } from "../types";

// ── Value shape the UI modal expects ─────────────────────────────────────────
export interface TestValue {
    parameter: string;
    value: string;
    unit: string;
    normalRange: string;
    status: "normal" | "low" | "high" | "critical" | string;
}

// ── Rule entry shape ──────────────────────────────────────────────────────────
export interface InvestigationRuleEntry {
    summary: string;
    values: TestValue[];
    interpretation: string;
    criticalFindings: string[];
    ecg_parameters?: Record<string, any>;   // present only for ECG tests
    // Pass-through fields from JSON (not consumed by current UI but preserved for future)
    _meta: {
        id: string;
        name: string;
        category: string;
        cost: number;
        duration: string;
        imageUrl?: string;
    };
}

// ── JSON parameters[] entry shape ──────────────────────────────────────────────
// Add this array to a test in the JSON when you need explicit normalRange + status.
// The builder prefers this over result-object parsing.
export interface JsonParameter {
    name: string;         // display label, e.g. "Hemoglobin"
    value: string;        // numeric string, e.g. "8.2"
    unit: string;         // e.g. "g/dL"
    normalRange: string;  // e.g. "11-15" — shown in the results modal
    status: "normal" | "low" | "high" | "critical";
}

/**
 * Tries to parse a unit-carrying string like "8.2 g/dL" or "10 µg/L (Low)".
 * Returns { numericValue, unit, status } if parseable, else null.
 * Designed for extension: add more patterns without touching callers.
 */
function parseValueString(
    raw: string
): { numericValue: string; unit: string; statusHint: string } | null {
    if (typeof raw !== "string") return null;

    // Pattern: "8.2 g/dL" or "10 µg/L (Low)" or "10% (Low)"
    const match = raw.match(/^([\d.]+)\s*([^\s(]+)(?:\s*\(([^)]+)\))?$/);
    if (!match) return null;

    return {
        numericValue: match[1],
        unit: match[2],
        statusHint: (match[3] ?? "").toLowerCase(), // "low", "high", "normal", ""
    };
}

function resolveStatus(hint: string): TestValue["status"] {
    if (hint === "low") return "low";
    if (hint === "high") return "high";
    if (hint === "critical") return "critical";
    if (hint === "normal") return "normal";
    return "normal"; // safe default
}

/**
 * Builds a values[] array from a result object like:
 *   { hemoglobin: "8.2 g/dL", mcv: "72 fL", mchc: "28 g/dL" }
 *
 * Each key becomes a `parameter`, the string is parsed for value + unit.
 * If parsing fails, value = raw string, unit = "", status = "normal".
 */
function buildValuesFromObject(resultObj: Record<string, string>): TestValue[] {
    return Object.entries(resultObj).map(([key, raw]) => {
        const parsed = typeof raw === "string" ? parseValueString(raw) : null;

        if (parsed) {
            return {
                parameter: key.charAt(0).toUpperCase() + key.slice(1), // "hemoglobin" → "Hemoglobin"
                value: parsed.numericValue,
                unit: parsed.unit,
                normalRange: "",  // not in current JSON — extendable
                status: resolveStatus(parsed.statusHint),
            };
        }

        // Fallback: treat whole raw as the display value
        return {
            parameter: key.charAt(0).toUpperCase() + key.slice(1),
            value: String(raw),
            unit: "",
            normalRange: "",
            status: "normal" as const,
        };
    });
}

/**
 * Main builder.
 * Priority:
 *   1. caseData.patient.investigations.tests  (legacy inline format)
 *   2. caseData.tests                         (new top-level format with rich result objects)
 * Returns InvestigationRules keyed by test.id.
 */
export function buildInvestigationRulesFromCaseData(
    caseData: any
): InvestigationRules {
    // Prefer patient.investigations.tests; fall back to top-level caseData.tests
    let tests = caseData?.patient?.investigations?.tests;

    if (!Array.isArray(tests) || tests.length === 0) {
        // Try the top-level tests array (new format)
        tests = caseData?.tests;
    }

    if (!Array.isArray(tests)) {
        throw new Error(
            `[buildInvestigationRulesFromCaseData] ` +
            `No tests array found for case "${caseData?.id ?? "unknown"}". ` +
            `Add tests to caseData.patient.investigations.tests or caseData.tests.`
        );
    }

    if (tests.length === 0) {
        return {};
    }

    const rules: InvestigationRules = {};

    for (const test of tests) {
        if (!test.id) {
            console.warn(
                `[buildInvestigationRulesFromCaseData] Skipping test without id:`,
                test
            );
            continue;
        }

        const { id, name, category, cost, duration, result, imageUrl } = test;

        let summary = "";
        let values: TestValue[] = [];
        let interpretation = "";
        let ecg_parameters: Record<string, any> | undefined;
        let criticalFindings: string[] = [];

        if (result && typeof result === "object") {
            // ── Rich result object (new format) ───────────────────────────────
            // Fields: summary, values, interpretation, criticalFindings, ecg_parameters
            if (typeof result.summary === "string") {
                summary = result.summary;
            }
            if (typeof result.interpretation === "string") {
                interpretation = result.interpretation;
            }
            if (result.criticalFindings === true) {
                // Boolean true → derive a generic critical finding string
                criticalFindings = [`${name}: Critical findings — see interpretation.`];
            } else if (Array.isArray(result.criticalFindings)) {
                criticalFindings = result.criticalFindings;
            }
            // Pass through ECG parameters for the ECG strip renderer
            if (result.ecg_parameters && typeof result.ecg_parameters === "object") {
                ecg_parameters = result.ecg_parameters;
            }
            // Build values[] from result.values array (new format: { parameter, value, unit, referenceRange })
            if (Array.isArray(result.values) && result.values.length > 0) {
                values = result.values.map((v: any) => ({
                    parameter: v.parameter ?? "",
                    value: String(v.value ?? ""),
                    unit: v.unit ?? "",
                    normalRange: v.referenceRange ?? v.normalRange ?? "",
                    status: deriveStatus(v) as TestValue["status"],
                }));
            }
            // Fallback summary if not provided
            if (!summary) summary = `${name}: Completed.`;
            if (!interpretation) interpretation = "Result available.";

        } else if (Array.isArray(test.parameters) && test.parameters.length > 0) {
            // ── Explicit parameters[] array ───────────────────────────────────
            values = (test.parameters as JsonParameter[]).map((p) => ({
                parameter: p.name,
                value: String(p.value),
                unit: p.unit ?? "",
                normalRange: p.normalRange ?? "",
                status: p.status ?? "normal",
            }));
            const valuesSummary = values
                .map((v) => `${v.parameter}: ${v.value} ${v.unit}`.trim())
                .join(", ");
            summary = `${name}: ${valuesSummary}`;
            interpretation = `${name}: ${valuesSummary}.`;

        } else if (typeof result === "string") {
            // ── Plain string result ────────────────────────────────────────────
            summary = `${name}: ${result}`;
            interpretation = result;

        } else {
            summary = `${name}: Completed.`;
            interpretation = "Result available.";
        }

        const resolvedImageUrl =
            test.imageUrl ||
            test.image ||
            (result && typeof result === "object" ? (result.imageUrl || result.image) : undefined);

        const entry: InvestigationRuleEntry & { imageUrl?: string } = {
            summary,
            values,
            interpretation,
            criticalFindings,
            ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
            _meta: {
                id,
                name: name ?? id,
                category: category ?? "laboratory",
                cost: cost ?? 0,
                duration: duration ?? "Unknown",
                ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
            },
        };

        if (ecg_parameters) {
            entry.ecg_parameters = ecg_parameters;
        }

        rules[id] = entry;
    }

    return rules;
}

/**
 * Derives a status string from a value entry.
 * Tries to compare numeric value against a reference range like "60-100" or "<120" or ">55".
 */
function deriveStatus(v: any): TestValue["status"] {
    if (v.status) return v.status;
    const numVal = parseFloat(String(v.value));
    if (isNaN(numVal)) return "normal";
    const ref: string = String(v.referenceRange ?? v.normalRange ?? "");
    if (!ref) return "normal";

    // Range: "60-100"
    const rangeMatch = ref.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
    if (rangeMatch) {
        const lo = parseFloat(rangeMatch[1]);
        const hi = parseFloat(rangeMatch[2]);
        if (numVal < lo) return "low";
        if (numVal > hi) return "high";
        return "normal";
    }
    // Greater than: ">55"
    const gtMatch = ref.match(/^>\s*([\d.]+)$/);
    if (gtMatch && numVal <= parseFloat(gtMatch[1])) return "low";
    // Less than: "<120"
    const ltMatch = ref.match(/^<\s*([\d.]+)$/);
    if (ltMatch && numVal >= parseFloat(ltMatch[1])) return "high";

    return "normal";
}
