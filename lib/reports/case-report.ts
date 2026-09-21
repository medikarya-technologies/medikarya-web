// =========================
// lib/reports/case-report.ts
// =========================
// "Report a problem with this case": what a report is, how it is checked before it is stored, and the email a
// student can send instead when it cannot be stored. Students are the fastest way to find a wrong value in a
// case, so the form asks for one kind of problem and a sentence about it, and quietly adds where in the case
// they were (the clock, the tab), which is what makes a report something a clinician can act on.
//
// Pure: no React and no I/O; the server action and the dialog both use it, so they agree on the rules.

export const REPORT_CATEGORIES = [
    { id: "clinical", label: "A clinical fact looks wrong", hint: "A value, a finding, a drug or a dose that is not right." },
    { id: "result", label: "A result does not fit", hint: "A lab, ECG or image that contradicts the patient." },
    { id: "patient", label: "The patient's reply is off", hint: "An answer that does not match the case, or makes no sense." },
    { id: "scoring", label: "My score seems unfair", hint: "Feedback that says something you did was wrong when it was right, or the reverse." },
    { id: "unclear", label: "Something is confusing", hint: "A step, a word or a screen you could not follow." },
    { id: "bug", label: "Something is broken", hint: "It froze, showed an error, or did not do what it said." },
    { id: "other", label: "Something else", hint: "Anything the others do not cover." },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["id"];
export type ReportPlace = "encounter" | "debrief";

export const MIN_MESSAGE = 8;
export const MAX_MESSAGE = 2000;
/** How many reports one person can send in an hour: a bound on a stuck button or a script, far above real use. */
export const REPORTS_PER_HOUR = 10;

const TABS = ["history", "exam", "tests", "diagnose"] as const;
const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

export interface ReportInput {
    caseId: string;
    category: string;
    message?: string;
    place?: string;
    /** Encounter clock, in seconds, when the report was opened. */
    clockSeconds?: number;
    tab?: string;
    guestId?: string;
}

export interface CleanReport {
    caseId: string;
    category: ReportCategory;
    message: string;
    place: ReportPlace;
    context: { clockSeconds?: number; tab?: string };
}

export type Checked = { ok: true; report: CleanReport } | { ok: false; message: string };

export const isReportCategory = (value: unknown): value is ReportCategory => REPORT_CATEGORIES.some((c) => c.id === value);

/** Checks and tidies what arrived (from the browser: never trusted) into what is stored. */
export function normaliseReport(input: ReportInput): Checked {
    if (typeof input?.caseId !== "string" || !CASE_ID.test(input.caseId)) return { ok: false, message: "We could not tell which case this is about." };
    if (!isReportCategory(input.category)) return { ok: false, message: "Choose what kind of problem it is." };

    const message = (typeof input.message === "string" ? input.message : "").replace(/\r\n/g, "\n").trim();
    if (message.length < MIN_MESSAGE) return { ok: false, message: "Tell us a little more, in a sentence or two, so we can find it." };
    if (message.length > MAX_MESSAGE) return { ok: false, message: `That is too long: please keep it under ${MAX_MESSAGE} characters.` };

    const context: CleanReport["context"] = {};
    if (typeof input.clockSeconds === "number" && Number.isFinite(input.clockSeconds) && input.clockSeconds >= 0 && input.clockSeconds <= 86_400) {
        context.clockSeconds = Math.round(input.clockSeconds);
    }
    if (typeof input.tab === "string" && (TABS as readonly string[]).includes(input.tab)) context.tab = input.tab;

    return { ok: true, report: { caseId: input.caseId, category: input.category, message, place: input.place === "debrief" ? "debrief" : "encounter", context } };
}

export const categoryLabel = (id: ReportCategory): string => REPORT_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/**
 * The email a student can send when the report could not be stored: everything the report would have carried,
 * as plain text. Kept short (a long address breaks some mail apps), so a very long message is cut.
 */
export function reportMailto(report: CleanReport, to = "support@medikarya.in"): string {
    const where = [report.place === "debrief" ? "after the case (the feedback)" : "during the case", report.context.tab ? `on the ${report.context.tab} tab` : "", report.context.clockSeconds !== undefined ? `at ${Math.floor(report.context.clockSeconds / 60)}m ${report.context.clockSeconds % 60}s` : ""].filter(Boolean).join(", ");
    const body = [`Case: ${report.caseId}`, `Problem: ${categoryLabel(report.category)}`, `Where: ${where}`, "", report.message.slice(0, 1200)].join("\n");
    return `mailto:${to}?subject=${encodeURIComponent(`Problem with a case: ${report.caseId}`)}&body=${encodeURIComponent(body)}`;
}
