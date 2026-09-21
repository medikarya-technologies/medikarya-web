// =========================
// lib/simulation/case-resolvers.ts
// =========================
// Turns (case JSON + event log + patient state) into what the student sees:
// investigation results, examination findings and hints.
//
// Everything here is a PURE FUNCTION of the case config and the event log —
// nothing is stored. A result is not "saved" when it is ordered; it is
// re-derived from the log, evaluated against the patient as they were at the
// moment of the order. That keeps the log the single source of truth and means
// a repeat ECG after reperfusion genuinely differs from the first.

import {
    defaultNormalValue,
    deriveStatus,
    formatReferenceRange,
    formatValue,
    type Sex,
    type TestCategory,
    type TestKind,
} from "../clinical-catalog";
import type { ClinicalEvent } from "./encounter-events";
import { orderKey } from "./encounter-events";
import type {
    CaseInvestigationResult,
    ImagingReport,
    LeadMorphology,
    LeadName,
    RhythmType,
    SimulationCaseConfig,
    ValueStatus,
} from "./case-schema";
import { evaluateCondition } from "./conditions";
import { getTestDef } from "./test-catalog";
import {
    interpolateVitals,
    PatientState,
    snapshotContext,
    type PatientSnapshot,
} from "./patient-state";

// ── Demographics ────────────────────────────────────────────────────────────

export interface Demographics {
    sex: Sex;
    age?: number;
}

/** Legacy case JSON stores gender as free text ("Male", "female"). */
export function demographicsOf(caseData: { patient?: { gender?: string; age?: number } }): Demographics {
    const gender = caseData.patient?.gender?.trim().toLowerCase() ?? "";
    return {
        sex: gender.startsWith("f") ? "female" : "male",
        age: caseData.patient?.age,
    };
}

// ── The patient at a point in the log ───────────────────────────────────────

/** The patient as they were immediately after `events[index]` was applied. */
export function patientAtEvent(
    config: SimulationCaseConfig,
    events: readonly ClinicalEvent[],
    index: number
): PatientSnapshot {
    return PatientState.fromEvents(config, events.slice(0, index + 1)).snapshot();
}

// ── Orders ──────────────────────────────────────────────────────────────────

export interface InvestigationOrder {
    key: string;
    testId: string;
    testName: string;
    orderedAt: number;
    /** Index of the TEST_ORDERED event in the log. */
    eventIndex: number;
}

export function listOrders(events: readonly ClinicalEvent[]): InvestigationOrder[] {
    const orders: InvestigationOrder[] = [];
    events.forEach((e, eventIndex) => {
        if (e.type === "TEST_ORDERED") {
            orders.push({
                key: orderKey(e.testId, e.timestamp),
                testId: e.testId,
                testName: e.testName,
                orderedAt: e.timestamp,
                eventIndex,
            });
        }
    });
    return orders;
}

/** Sim minutes until the result is back: the case's override, else the catalog's standard. */
export function turnaroundMinutes(config: SimulationCaseConfig, testId: string): number {
    const override = config.investigation_results?.[testId]?.turnaround_minutes;
    if (typeof override === "number") return override;
    return getTestDef(config, testId)?.turnaroundMinutes ?? 30;
}

export function readyAt(config: SimulationCaseConfig, order: InvestigationOrder): number {
    return order.orderedAt + turnaroundMinutes(config, order.testId) * 60;
}

export function isResultReady(config: SimulationCaseConfig, order: InvestigationOrder, now: number): boolean {
    return now >= readyAt(config, order);
}

function forOrder<T extends ClinicalEvent>(
    events: readonly ClinicalEvent[],
    order: InvestigationOrder,
    type: T["type"]
): T[] {
    return events.filter(
        (e): e is T =>
            e.type === type &&
            (e as { testId?: string }).testId === order.testId &&
            (e as { orderTimestamp?: number }).orderTimestamp === order.orderedAt
    );
}

/** The student's most recent written interpretation of this order. */
export function interpretationFor(events: readonly ClinicalEvent[], order: InvestigationOrder): string | undefined {
    const all = forOrder<Extract<ClinicalEvent, { type: "RESULT_INTERPRETED" }>>(events, order, "RESULT_INTERPRETED");
    return all.length > 0 ? all[all.length - 1].studentInterpretation : undefined;
}

export function isRevealed(events: readonly ClinicalEvent[], order: InvestigationOrder): boolean {
    return forOrder(events, order, "RESULT_REVEALED").length > 0;
}

// ── Investigation results ───────────────────────────────────────────────────

export interface ResolvedValue {
    key: string;
    parameter: string;
    value: string;
    unit: string;
    referenceRange: string;
    status: ValueStatus;
    /** Why this value matters. Revealed by the explain-abnormal assist. */
    note?: string;
}

export interface ResolvedEcg {
    rhythm: RhythmType;
    rate: number;
    pr_ms?: number;
    qrs_ms?: number;
    qt_ms?: number;
    axis_deg?: number;
    leads: Partial<Record<LeadName, LeadMorphology>>;
}

export interface ResolvedResult {
    testId: string;
    testName: string;
    kind: TestKind;
    category: TestCategory;
    turnaroundMinutes: number;
    summary: string;
    values: ResolvedValue[];
    criticalFindings: string[];
    /** Expert interpretation — gated behind an assist during the case, shown to everyone in the debrief. */
    interpretation?: string;
    /** Guided nudge for the hint-level assist. */
    hint?: string;
    report?: ImagingReport;
    imageUrl?: string;
    ecg?: ResolvedEcg;
    /** True when the case authored this result; false for the generic normal. */
    caseSpecific: boolean;
    stateConsequence?: string;
}

const NORMAL_REPORT: ImagingReport = {
    findings: "No acute abnormality identified.",
    impression: "No acute abnormality.",
};

function rowKey(parameter: string, index: number): string {
    const slug = parameter.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return slug ? `${slug}_${index}` : `row_${index}`;
}

/**
 * The result of `testId` for a patient in state `patient`, as ordered at
 * `orderedAt`. Returns null for an id the catalog doesn't know.
 */
export function resolveInvestigation(
    config: SimulationCaseConfig,
    testId: string,
    patient: PatientSnapshot,
    orderedAt: number,
    demographics: Demographics
): ResolvedResult | null {
    const test = getTestDef(config, testId);
    if (!test) return null;

    const authored: CaseInvestigationResult | undefined = config.investigation_results?.[testId];
    const { variants, ...base } = authored ?? {};

    // First variant whose condition holds for the patient AT ORDER TIME wins.
    const ctx = snapshotContext(patient, orderedAt);
    const variant = variants?.find((v) => evaluateCondition(v.when, ctx));
    const { when: _when, ...variantBody } = variant ?? ({} as { when?: unknown });
    const body = { ...base, ...variantBody } as Omit<CaseInvestigationResult, "variants">;

    const sex = demographics.sex;
    // Authored rows replace the catalog table outright: they are how a case defines the
    // parameters of a test the master catalog knows nothing about.
    const authoredRows: ResolvedValue[] | null = body.rows
        ? body.rows.map((row, index) => ({
              key: rowKey(row.parameter, index),
              parameter: row.parameter,
              value: String(row.value),
              unit: row.unit ?? "",
              referenceRange: row.reference_range ?? "",
              status: row.status ?? "normal",
              ...(row.note ? { note: row.note } : {}),
          }))
        : null;

    const values: ResolvedValue[] = authoredRows ?? (test.parameters ?? []).map((param, index) => {
        const override =
            body.values?.[param.key] ??
            (index === 0 && body.value !== undefined
                ? { value: body.value, status: body.status, note: body.note }
                : undefined);
        const value = override?.value ?? defaultNormalValue(param, sex);
        const numeric = typeof value === "number" ? value : Number(value);
        const status =
            override?.status ??
            deriveStatus(param, param.normalText === undefined && Number.isFinite(numeric) ? numeric : value, sex);
        return {
            key: param.key,
            parameter: param.name,
            value: formatValue(value, param),
            unit: param.unit,
            referenceRange: formatReferenceRange(param, sex),
            status,
            ...(override?.note ? { note: override.note } : {}),
        };
    });

    const abnormal = values.filter((v) => v.status !== "normal");
    const summary =
        body.summary ??
        (test.kind === "lab"
            ? abnormal.length === 0
                ? `${test.name}: all values within reference range.`
                : `${test.name}: ${abnormal.length} value${abnormal.length === 1 ? "" : "s"} outside the reference range.`
            : `${test.name}: completed.`);

    let ecg: ResolvedEcg | undefined;
    if (test.kind === "ecg") {
        const spec = body.ecg ?? {};
        ecg = {
            rhythm: spec.rhythm ?? patient.rhythm,
            rate: spec.rate ?? patient.rate,
            pr_ms: spec.pr_ms,
            qrs_ms: spec.qrs_ms,
            qt_ms: spec.qt_ms,
            axis_deg: spec.axis_deg,
            leads: spec.leads ?? {},
        };
    }

    const report =
        body.report ?? (test.kind === "imaging" && !authored ? NORMAL_REPORT : undefined);

    return {
        testId,
        testName: test.name,
        kind: test.kind,
        category: test.category,
        turnaroundMinutes: turnaroundMinutes(config, testId),
        summary,
        values,
        criticalFindings: body.critical_findings ?? [],
        interpretation: body.interpretation ?? (authored ? undefined : "No abnormality detected."),
        hint: body.hint,
        report,
        imageUrl: body.image_url,
        ecg,
        caseSpecific: authored !== undefined,
        stateConsequence: body.state_consequence,
    };
}

// ── Examination ─────────────────────────────────────────────────────────────

/**
 * What the student finds for a manoeuvre right now. The first matching
 * state-variant wins; vitals placeholders are filled from the live patient so
 * the prose can never disagree with the monitor.
 */
export function resolveExamFindings(
    config: SimulationCaseConfig,
    manoeuvreId: string,
    patient: PatientSnapshot,
    time: number
): string | null {
    const def = config.examination?.find((m) => m.id === manoeuvreId);
    if (!def) return null;
    const ctx = snapshotContext(patient, time);
    const variant = def.findings_by_state?.find((v) => evaluateCondition(v.when, ctx));
    return interpolateVitals(variant?.findings ?? def.findings, patient);
}

// ── Socratic hints ──────────────────────────────────────────────────────────

/** Prefix used as the ASSIST_USED target so each hint is charged once. */
export const HINT_TARGET_PREFIX = "hint:";

/**
 * The first authored hint that applies to the situation right now and hasn't
 * been given yet. Hints nudge; they never state the diagnosis.
 */
export function selectSocraticHint(
    config: SimulationCaseConfig,
    patient: PatientSnapshot,
    time: number,
    shownHintIds: readonly string[]
): { id: string; hint: string } | null {
    const ctx = snapshotContext(patient, time);
    for (const candidate of config.socratic_hints ?? []) {
        if (shownHintIds.includes(candidate.id)) continue;
        if (evaluateCondition(candidate.when, ctx)) {
            return { id: candidate.id, hint: interpolateVitals(candidate.hint, patient) };
        }
    }
    return null;
}

/** Ids of hints already given, read from the assist audit trail. */
export function shownHintIds(events: readonly ClinicalEvent[]): string[] {
    return events
        .filter((e): e is Extract<ClinicalEvent, { type: "ASSIST_USED" }> => e.type === "ASSIST_USED")
        .filter((e) => e.assistType === "socratic_hint" && e.target?.startsWith(HINT_TARGET_PREFIX))
        .map((e) => (e.target as string).slice(HINT_TARGET_PREFIX.length));
}
