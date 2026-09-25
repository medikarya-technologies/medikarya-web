// =========================
// lib/simulation/legacy-adapter.ts
// =========================
// Runs a classic case at the bedside.
//
// A classic case has a patient, their vitals, a chat script, a list of tests
// with their results and an evaluation config. That is enough for most of the
// bedside encounter: a live monitor, the clock, an examination, investigations
// that come back after a short wait, the paid assists and the timeline. This
// module derives all of it from the case's OWN data and adds nothing clinical:
//
//   • vitals, rhythm and monitor alarm limits come from `patient.vitalSigns`
//     (and from the ECG test's parameters, if the case has one);
//   • the examination is the case's `*_examination` sections;
//   • the order menu is the case's own `tests` PLUS the master catalog (lib/clinical-catalog.ts) —
//     order anything, the same as the STEMI case, not just what the case happened to author;
//   • a test the case didn't author resolves to a normal result from the catalog's own reference ranges;
//   • scoring is the case's `evaluation_config`, run by the classic evaluator — its test-ordering score
//     only knows about ids listed in `evaluation_config.testing`, so a case's `distractor_tests` and
//     `dangerous_tests` need to name catalog ids too, not just the case's own tests, or ordering
//     something irrelevant from the wider catalog costs nothing (see scripts/*_testing_rubric.sql).
//
// What it will NOT do is invent physiology. A classic case carries no rules for
// how the patient changes over time or what a treatment does, so the patient
// stays as presented and there is no treatment tray; those have to be authored
// for a case (see the STEMI case). Anything the case doesn't define is left out
// rather than filled in: no Examine tab without examination findings, no hints
// without authored hints, "—" for a vital that was never measured.
//
// Pure and idempotent. A case that is already a simulation case, has opted out
// (`experience: "classic"`) or lacks what a monitor needs comes back untouched.

import type {
    CaseInvestigationResult,
    CustomTestDef,
    Ecg12LeadSpec,
    ExamManoeuvreDef,
    ExamRegion,
    ResultRow,
    RhythmType,
    SimulationCaseConfig,
    StateThreshold,
    ValueStatus,
} from "./case-schema";
import { isSimulationCase } from "./case-schema";
import type { TestCategory, TestKind } from "../clinical-catalog";
import { vitalLimitsForAge } from "./vitals-assess";
import { deriveAppearance, type AppearanceSpec } from "./appearance";

type Json = Record<string, any>;

// ── Small readers ───────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

function num(v: unknown): number | undefined {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const m = v.match(/-?\d+(?:\.\d+)?/);
        if (m) return Number(m[0]);
    }
    return undefined;
}

function str(v: unknown): string | undefined {
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// ── Vitals ──────────────────────────────────────────────────────────────────

export interface Vitals {
    hr: number;
    sys?: number;
    dia?: number;
    spo2?: number;
    rr?: number;
    temp?: number;
}

/** The monitor needs at least a heart rate; without one there is nothing to show. */
export function readVitals(vs: unknown): Vitals | null {
    if (!isObj(vs)) return null;
    const hr = num(isObj(vs.heartRate) ? vs.heartRate.value : vs.heartRate);
    if (hr === undefined) return null;

    let sys: number | undefined;
    let dia: number | undefined;
    if (isObj(vs.bloodPressure)) {
        sys = num(vs.bloodPressure.systolic);
        dia = num(vs.bloodPressure.diastolic);
    } else if (typeof vs.bloodPressure === "string") {
        const m = vs.bloodPressure.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
        if (m) {
            sys = Number(m[1]);
            dia = Number(m[2]);
        }
    }

    let temp = num(isObj(vs.temperature) ? vs.temperature.value : vs.temperature);
    // The monitor is in °C; a case entered in °F is converted rather than shown as a 98 °C fever.
    if (temp !== undefined && temp > 45) temp = Math.round(((temp - 32) * 5) / 9 * 10) / 10;

    return {
        hr,
        sys,
        dia,
        spo2: num(isObj(vs.oxygenSaturation) ? vs.oxygenSaturation.value : vs.oxygenSaturation),
        rr: num(isObj(vs.respiratoryRate) ? vs.respiratoryRate.value : vs.respiratoryRate),
        temp,
    };
}

// ── Rhythm ──────────────────────────────────────────────────────────────────

function rhythmFromText(text: string): RhythmType | undefined {
    const t = text.toLowerCase();
    if (/complete (av|atrioventricular|heart) block|third[- ]degree/.test(t)) return "complete_heart_block";
    if (/atrial fibrillation|\bafib\b/.test(t)) return "afib";
    if (/flutter/.test(t)) return "flutter";
    if (/ventricular fibrillation/.test(t)) return "vf";
    if (/ventricular tachycardia/.test(t)) return "vt_sustained";
    if (/sinus bradycardia/.test(t)) return "sinus_bradycardia";
    if (/sinus tachycardia/.test(t)) return "sinus_tachycardia";
    if (/sinus/.test(t)) return "sinus_normal";
    return undefined;
}

function ecgSpecOf(params: unknown): Ecg12LeadSpec | undefined {
    if (!isObj(params)) return undefined;
    const spec: Ecg12LeadSpec = {};
    const rhythm = rhythmFromText(`${params.rhythm ?? ""} ${params.finding ?? ""}`);
    if (rhythm) spec.rhythm = rhythm;
    const rate = num(params.ventricularRate) ?? num(params.rate) ?? num(params.heartRate);
    if (rate !== undefined) spec.rate = rate;
    const qrs = num(params.qrsDuration);
    if (qrs !== undefined) spec.qrs_ms = qrs;
    const axis = String(params.axis ?? "").toLowerCase();
    if (/left axis/.test(axis)) spec.axis_deg = -45;
    else if (/right axis/.test(axis)) spec.axis_deg = 110;
    return spec;
}

/**
 * The monitor's rhythm: what the case's own ECG shows, else sinus at a rate that
 * is (or is not) normal for the patient's age. A child at 130/min is in normal
 * sinus rhythm, not sinus tachycardia.
 */
function monitorRhythm(tests: Json[], hr: number, age: number | undefined): RhythmType {
    for (const t of tests) {
        const r = isObj(t.result) ? rhythmFromText(`${t.result.ecg_parameters?.rhythm ?? ""}`) : undefined;
        if (r) return r;
    }
    const limits = vitalLimitsForAge(age);
    if (hr > limits.hrHigh) return "sinus_tachycardia";
    if (hr < limits.hrLow) return "sinus_bradycardia";
    return "sinus_normal";
}

// ── Investigations ──────────────────────────────────────────────────────────

/** Sim minutes until a result is back. Short on purpose: this is a consultation, not a race. */
const TURNAROUND_MINUTES: Record<TestKind, number> = {
    bedside: 0.05,
    ecg: 0.1,
    lab: 0.25,
    imaging: 0.4,
    procedure: 0.4,
};

function kindOf(test: Json): TestKind {
    const category = String(test.category ?? "").toLowerCase();
    const hay = `${test.id ?? ""} ${test.name ?? ""}`.toLowerCase();
    if (/vital|examination/.test(category)) return "bedside";
    if (/monitor|holter/.test(hay)) return "bedside";
    // Only a 12-lead with parameters can be drawn; without them a tracing would be invented.
    if (isObj(test.result) && isObj(test.result.ecg_parameters) && /ecg|ekg|electrocardiogram/.test(hay)) return "ecg";
    if (
        category === "imaging" ||
        /ultrasound|\busg\b|x-?ray|\bct\b|\bmri\b|\bmra\b|echocardiograph|doppler|angiograph|ctpa|\bscan\b/.test(hay)
    ) {
        return "imaging";
    }
    return "lab";
}

function categoryOf(test: Json, kind: TestKind): TestCategory {
    if (kind === "imaging") return "imaging";
    if (kind === "ecg") return "cardiac";
    const category = String(test.category ?? "").toLowerCase();
    const hay = `${test.id ?? ""} ${test.name ?? ""} ${category}`.toLowerCase();
    if (/cardio/.test(category)) return "cardiac";
    if (/haemat|hemat/.test(category)) return "haematology";
    if (/immun|serolog/.test(category)) return "serology";
    if (/endocrin/.test(category)) return "endocrine";
    if (/microbio/.test(category)) return "microbiology";
    if (/special|cytolog|patholog|histolog|vital|examination/.test(category)) return "special";
    // "Laboratory" says nothing about which one: read the test's own name.
    if (/urin/.test(hay)) return "urine";
    if (/cbc|blood count|smear|film|retic|haemoglobin|hemoglobin|ferritin|\biron\b|transferrin|coombs|blood group|electrophoresis|g6pd|coagul/.test(hay)) return "haematology";
    if (/thyroid|\btft\b|tsh|hormone|cortisol/.test(hay)) return "endocrine";
    if (/culture|stool|sepsis/.test(hay)) return "microbiology";
    if (/elisa|antibod|antigen|serolog/.test(hay)) return "serology";
    return "biochemistry";
}

/** A bare number with at most a unit after it: "8.2", "12 mm", "<0.5". Not "Mild (IVSd 12 mm)". */
const PLAIN_NUMBER = /^[<>≤≥~]?\s*-?\d+(?:\.\d+)?(?:\s*[^\s\d(]\S*)?$/;

const norm = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * A textual finding against a textual reference ("Present" vs "Absent", "Innumerable cysts"
 * vs "None"): normal when it says what the reference says, abnormal otherwise. A numeric
 * range can't judge a phrase, so that case is left alone.
 */
function qualitativeStatus(finding: string, range: string): ValueStatus | undefined {
    if (!range || /^n\/?a$|^not applicable$/i.test(range)) return undefined;
    const expected = range
        .split(/\s*(?:\/|;|\bor\b)\s*/i)
        .map(norm)
        .filter((alt) => alt && !/\d/.test(alt));
    if (expected.length === 0) return undefined;
    const seen = norm(finding);
    return expected.some((alt) => seen.includes(alt)) ? "normal" : "abnormal";
}

function statusOf(v: Json): ValueStatus {
    const raw = String(v.status ?? "").toLowerCase();
    if (raw) {
        if (/crit|panic/.test(raw)) return "critical";
        if (/^low|decreas|reduc|below/.test(raw)) return "low";
        if (/high|elevat|raised|increas|above/.test(raw)) return "high";
        if (/abnormal|positive|present|detected/.test(raw)) return "abnormal";
        if (/normal|within|unremarkable|negative/.test(raw)) return "normal";
    }
    const range = String(v.referenceRange ?? v.normalRange ?? "").trim();
    if (!range) return "normal";

    const text = String(v.value ?? "").trim();
    // No stated status: compare with the reference range, as the classic viewer does for numbers...
    if (PLAIN_NUMBER.test(text)) {
        const value = num(text);
        if (value === undefined) return "normal";
        const between = range.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
        if (between) return value < Number(between[1]) ? "low" : value > Number(between[2]) ? "high" : "normal";
        const below = range.match(/^[<≤]\s*([\d.]+)$/);
        if (below) return value > Number(below[1]) ? "high" : "normal";
        const above = range.match(/^[>≥]\s*([\d.]+)$/);
        if (above) return value < Number(above[1]) ? "low" : "normal";
        return "normal";
    }
    // ...and, unlike it, read a finding that is words rather than a number.
    return qualitativeStatus(text, range) ?? "normal";
}

function rowsOf(values: unknown): ResultRow[] {
    if (!Array.isArray(values)) return [];
    const rows: ResultRow[] = [];
    for (const v of values) {
        if (!isObj(v)) continue;
        const parameter = str(v.parameter) ?? str(v.name);
        const value = v.value ?? v.result;
        if (!parameter || value === undefined || value === null || value === "") continue;
        const unit = str(v.unit);
        const referenceRange = str(v.referenceRange) ?? str(v.normalRange);
        rows.push({
            parameter,
            value: typeof value === "number" ? value : String(value),
            ...(unit ? { unit } : {}),
            ...(referenceRange ? { reference_range: referenceRange } : {}),
            status: statusOf(v),
        });
    }
    return rows;
}

/**
 * One classic test result as a bedside result.
 *
 * The wording is the case's, unchanged. What changes is WHEN it is seen: numbers
 * and findings are on view when the result arrives; the expert's conclusion sits
 * behind the paid reveal, as it does for an authored bedside case.
 */
function resultOf(test: Json, kind: TestKind): CaseInvestigationResult {
    const name = str(test.name) ?? String(test.id);
    // A plain-string result is the whole result: treat it as a summary.
    const r = typeof test.result === "string" && test.result.trim() ? { summary: test.result.trim() } : test.result;
    const body: CaseInvestigationResult = {};

    const imageUrl = str(test.imageUrl) ?? str(test.image) ?? (isObj(r) ? (str(r.imageUrl) ?? str(r.image)) : undefined);
    if (imageUrl) body.image_url = imageUrl;

    if (!isObj(r)) {
        // Say plainly that nothing was recorded. A scan shows its wording as a report; anything else as its result.
        const none = `${name}: completed. No findings were recorded for this case.`;
        if (kind === "imaging") body.report = { findings: none, impression: "" };
        else body.summary = none;
        return body;
    }

    const summary = str(r.summary);
    const interpretation = str(r.interpretation);
    // Many classic results repeat the same sentence as both: there is nothing further to reveal then.
    const primary = summary ?? interpretation;
    const distinct = interpretation && interpretation !== primary ? interpretation : undefined;
    const rows = rowsOf(Array.isArray(r.values) && r.values.length > 0 ? r.values : test.parameters);
    // `criticalFindings: true` carries no wording; only real findings are worth a banner.
    const critical = Array.isArray(r.criticalFindings) ? r.criticalFindings.filter((f: unknown): f is string => typeof f === "string" && !!f.trim()) : [];

    if (kind === "ecg") {
        const spec = ecgSpecOf(r.ecg_parameters);
        if (spec) body.ecg = spec;
        // Nothing diagnostic is on view before the student commits to a read: the measurements and the
        // expert's words all sit behind the reveal, next to the tracing they explain.
        // A unit only belongs on a number ("82 bpm"), not on a phrase ("Variable (dissociated)").
        const measured = rows
            .map((row) => `${row.parameter}: ${row.unit && /^-?[\d.]+$/.test(String(row.value)) ? `${row.value} ${row.unit}` : row.value}`)
            .join("; ");
        const words = [primary, distinct, measured ? `Measurements: ${measured}.` : undefined].filter(Boolean).join(" ");
        if (words) body.interpretation = words;
        if (critical.length) body.critical_findings = critical;
        return body;
    }

    if (kind === "imaging") {
        body.report = { findings: primary ?? `${name}: completed.`, impression: distinct ?? "" };
        if (rows.length) body.rows = rows;
        if (critical.length) body.critical_findings = critical;
        return body;
    }

    // Labs and bedside checks: the table is the result; with no table, the summary is.
    if (rows.length) body.rows = rows;
    if (primary) body.summary = primary;
    if (distinct) body.interpretation = distinct;
    if (critical.length) body.critical_findings = critical;
    if (!body.summary && !rows.length) body.summary = `${name}: completed. No findings were recorded for this case.`;
    return body;
}

// ── Examination ─────────────────────────────────────────────────────────────

const ACRONYMS: Record<string, string> = { jvp: "JVP", bp: "BP", hr: "HR", rr: "RR", ecg: "ECG", spo2: "SpO₂", cns: "CNS", ent: "ENT", gcs: "GCS" };

function humanize(key: string): string {
    const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[_\s-]+/).filter(Boolean);
    const text = words.map((w) => ACRONYMS[w.toLowerCase()] ?? w.toLowerCase()).join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A facts object as readable lines: "Pallor: Present; conjunctivae are pale". */
function factLines(value: unknown, prefix = ""): string[] {
    if (!isObj(value)) return [];
    const lines: string[] = [];
    for (const [key, v] of Object.entries(value)) {
        const label = prefix ? `${prefix} — ${humanize(key).toLowerCase()}` : humanize(key);
        if (typeof v === "string" && v.trim()) lines.push(`${label}: ${v.trim()}`);
        else if (typeof v === "number") lines.push(`${label}: ${v}`);
        else if (typeof v === "boolean") lines.push(`${label}: ${v ? "Yes" : "No"}`);
        else if (Array.isArray(v) && v.length) lines.push(`${label}: ${v.map(String).join("; ")}`);
        else if (isObj(v)) lines.push(...factLines(v, label));
    }
    return lines;
}

function regionOf(key: string): ExamRegion {
    if (/cardio|heart|cvs/.test(key)) return "cardiovascular";
    if (/resp|chest|lung/.test(key)) return "respiratory";
    if (/abdom/.test(key)) return "abdomen";
    if (/neuro|cns/.test(key)) return "neuro";
    if (/limb|extrem|musculo|peripher/.test(key)) return "extremities";
    return "general";
}

const REGION_ORDER: ExamRegion[] = ["general", "cardiovascular", "respiratory", "abdomen", "neuro", "extremities"];

/** One manoeuvre per `*_examination` section of the case's facts. No sections, no examination. */
function examinationOf(facts: unknown): ExamManoeuvreDef[] {
    if (!isObj(facts)) return [];
    const out: ExamManoeuvreDef[] = [];
    for (const [key, section] of Object.entries(facts)) {
        const m = key.match(/^(.*)_examination$/);
        if (!m) continue;
        const findings = factLines(section).join("\n");
        if (!findings) continue;
        const stem = m[1];
        const general = /^general/.test(stem);
        const label = general ? "General examination" : stem === "local" ? "Local examination" : `${humanize(stem)} examination`;
        out.push({ id: `${stem}_examination`, label, region: general ? "general" : regionOf(stem), findings });
    }
    return out.sort((a, b) => REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region));
}

// ── The upgrade ─────────────────────────────────────────────────────────────

/** True for a case the bedside can run: a monitor's worth of vitals and at least one test to order. */
export function canUpgrade(legacy: unknown): boolean {
    if (!isObj(legacy) || isSimulationCase(legacy)) return false;
    if (legacy.experience === "classic") return false;
    return readVitals(legacy.patient?.vitalSigns) !== null && Array.isArray(legacy.tests) && legacy.tests.some((t: unknown) => isObj(t) && !!str(t.id));
}

/** Authored additions that live outside the case JSON (the case itself is in the database). */
export interface UpgradeOverlay {
    appearance?: AppearanceSpec;
}

export function upgradeLegacyCase<T extends Json>(legacy: T, overlay: UpgradeOverlay = {}): T & Partial<SimulationCaseConfig> {
    if (!canUpgrade(legacy)) return legacy;

    const vitals = readVitals(legacy.patient.vitalSigns) as Vitals;
    const tests = (legacy.tests as unknown[]).filter((t): t is Json => isObj(t) && !!str(t.id));
    const age = num(legacy.patient.age);
    const limits = vitalLimitsForAge(age);

    // ── Monitor ─────────────────────────────────────────────────────────
    const unmeasured: NonNullable<SimulationCaseConfig["initial_state"]["unmeasured"]> = [];
    if (vitals.sys === undefined || vitals.dia === undefined) unmeasured.push("bp");
    if (vitals.spo2 === undefined) unmeasured.push("spo2");
    if (vitals.rr === undefined) unmeasured.push("rr");
    if (vitals.temp === undefined) unmeasured.push("temperature");

    const unstable =
        (vitals.sys !== undefined && vitals.sys < limits.sbpLow) ||
        (vitals.spo2 !== undefined && vitals.spo2 < 90) ||
        vitals.hr < limits.hrLow * 0.7 ||
        vitals.hr > limits.hrHigh * 1.4;

    const initial_state: SimulationCaseConfig["initial_state"] = {
        state: "presenting",
        rhythm: monitorRhythm(tests, vitals.hr, age),
        rate: vitals.hr,
        ...(vitals.sys !== undefined && vitals.dia !== undefined ? { systolic: vitals.sys, diastolic: vitals.dia } : {}),
        ...(vitals.spo2 !== undefined ? { spo2: vitals.spo2 } : {}),
        ...(vitals.rr !== undefined ? { rr: vitals.rr } : {}),
        ...(vitals.temp !== undefined ? { temperature: vitals.temp } : {}),
        consciousness: "alert",
        stability: unstable ? "unstable" : "stable",
        ...(unmeasured.length > 0 ? { unmeasured } : {}),
        flags: {},
    };

    // A bedside monitor's alarm limits are not a diagnosis: they sound for what is dangerous at this age.
    const state_thresholds: StateThreshold[] = [
        { parameter: "spo2", lt: 90, trigger: "critical_hypoxia" },
        { parameter: "hr", lt: Math.round(limits.hrLow * 0.7), trigger: "severe_bradycardia" },
        { parameter: "hr", gt: Math.round(limits.hrHigh * 1.4), trigger: "severe_tachycardia" },
        { parameter: "sbp", lt: limits.sbpLow, trigger: "hypotension" },
    ];

    // ── Investigations ──────────────────────────────────────────────────
    const custom_tests: CustomTestDef[] = [];
    const investigation_results: Record<string, CaseInvestigationResult> = {};
    const seen = new Set<string>();
    for (const t of tests) {
        const id = String(t.id);
        if (seen.has(id)) continue;
        seen.add(id);
        const kind = kindOf(t);
        custom_tests.push({
            id,
            name: str(t.name) ?? id,
            category: categoryOf(t, kind),
            kind,
            turnaround_minutes: TURNAROUND_MINUTES[kind],
        });
        investigation_results[id] = resultOf(t, kind);
    }

    const examination = examinationOf(legacy.patient_facts);

    // How the patient looks: the case's own `appearance` block, else an authored overlay, else whatever
    // the case's examination and structured facts record. Nothing where the case is silent.
    const appearance = isObj(legacy.appearance) ? (legacy.appearance as AppearanceSpec) : (overlay.appearance ?? deriveAppearance(legacy));

    return {
        ...legacy,
        experience: "bedside",
        setting: str(legacy.setting) ?? "Bedside assessment",
        clinical_constraints: { untimed: true, time_scale: 1 },
        // Hints need authored, case-specific wording; the assists that read the case's own results stay on.
        assist_config: {
            mode: "intermediate",
            allowed: ["highlight_abnormal", "explain_abnormal", "ecg_interpretation_hint", "radiology_impression"],
            disabled: ["socratic_hint", "diagnostic_hint", "reveal_diagnosis", "management_guidance"],
        },
        initial_state,
        state_thresholds,
        // The patient stays as presented, and there is no tray: nothing here says what a treatment would do.
        event_rules: [],
        action_consequences: [],
        available_interventions: [],
        ...(examination.length > 0 ? { examination } : {}),
        ...(appearance ? { appearance } : {}),
        custom_tests,
        // Order from the case's own tests or the full catalog — a real ward doesn't hand a student a
        // pre-picked menu. The case's own test still wins where an id collides (getTestDef checks
        // custom_tests first); anything else resolves to a catalog-normal result (case-resolvers.ts).
        order_menu: "catalog",
        investigation_results,
        scoring_mode: "classic",
    };
}
