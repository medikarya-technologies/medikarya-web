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
    getCatalogTest,
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

/** The longest a student waits for any result, in real seconds. A virtual case is not a real lab queue. */
export const MAX_RESULT_WAIT_SECONDS = 30;

/** Real minutes for a test the catalog does not list, by kind, in a case with real result times. */
const REAL_MINUTES_BY_KIND: Record<TestKind, number> = { bedside: 1, ecg: 1, lab: 30, imaging: 30, procedure: 30 };

/**
 * Sim minutes until the result is back.
 *
 * A case's own times (an override in investigation_results, or its own test's turnaround: see TURNAROUND_MINUTES in
 * legacy-adapter.ts) are already playing times. The catalog's are real clinical ones (a CT head 25 minutes, a blood
 * culture a day), so a catalog test the case did not write is scaled down 60x: a 20-minute troponin is back in 20
 * seconds, and quick tests still come back before slow ones. Either way nothing takes longer than
 * MAX_RESULT_WAIT_SECONDS of real time, in an ordinary case or a live one.
 *
 * A case with real result times (clinical_constraints.result_times "real") uses the catalog's real minutes instead,
 * uncapped: the case's own playing times would be seconds. A test the catalog does not have takes its kind's usual time.
 */
export function turnaroundMinutes(config: SimulationCaseConfig, testId: string): number {
    if (config.clinical_constraints?.result_times === "real") {
        return getCatalogTest(testId)?.turnaroundMinutes ?? REAL_MINUTES_BY_KIND[getTestDef(config, testId)?.kind ?? "lab"];
    }
    const override = config.investigation_results?.[testId]?.turnaround_minutes;
    const isCaseAuthored = config.custom_tests?.some((t) => t.id === testId) ?? false;
    const catalogMinutes = getTestDef(config, testId)?.turnaroundMinutes ?? 30;
    const minutes = typeof override === "number" ? override : isCaseAuthored ? catalogMinutes : catalogMinutes / 60;
    const cap = (MAX_RESULT_WAIT_SECONDS / 60) * (config.clinical_constraints?.time_scale ?? 1);
    return Math.min(minutes, cap);
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

/**
 * A real, reusable image for a catalog imaging test nobody authored a case-specific result for —
 * same idea as NORMAL_REPORT, but a picture. A normal scan looks the same regardless of the
 * patient's unrelated diagnosis, so one file covers every case that reaches this fallback for that
 * test id. Deliberately short: only test ids with a real, licence-checked image on file are listed
 * (see public/investigation-images/CREDITS.md) — everything else still gets NORMAL_REPORT with no
 * image, same as before this existed, rather than a guessed or mismatched picture.
 */
const NORMAL_IMAGE: Partial<Record<string, string>> = {
    cxr_pa: "/investigation-images/cxr-pa-normal.jpg",
    cxr_portable: "/investigation-images/cxr-pa-normal.jpg",
    ct_abdomen_pelvis: "/investigation-images/ct-abdomen-pelvis-normal.png",
    ct_head_noncontrast: "/investigation-images/ct-brain-normal.png",
    usg_abdomen: "/investigation-images/usg-abdomen-liver-normal.jpg",
    xray_abdomen: "/investigation-images/xray-abdomen-normal.jpg",
    mri_brain: "/investigation-images/mri-brain-normal.jpg",
    echo_tte: "/investigation-images/echo-4chamber-normal.jpg",
    echo_pocus: "/investigation-images/echo-4chamber-normal.jpg",
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

    const isUnauthoredImaging = test.kind === "imaging" && !authored;
    const report = body.report ?? (isUnauthoredImaging ? NORMAL_REPORT : undefined);

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
        imageUrl: body.image_url ?? (isUnauthoredImaging ? NORMAL_IMAGE[testId] : undefined),
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
