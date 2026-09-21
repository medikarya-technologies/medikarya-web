import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_MESSAGE, MIN_MESSAGE, REPORT_CATEGORIES, categoryLabel, isReportCategory, normaliseReport, reportMailto, type ReportInput } from "../case-report";

const good: ReportInput = { caseId: "viral-gastroenteritis", category: "clinical", message: "The potassium is 6.9 but the patient is drinking normally." };

function accepted(input: ReportInput) {
    const checked = normaliseReport(input);
    assert.equal(checked.ok, true, JSON.stringify(checked));
    if (!checked.ok) throw new Error("unreachable");
    return checked.report;
}

describe("case report: what is accepted", () => {
    it("accepts a report with a case, a kind of problem and a sentence, and says where it was", () => {
        const r = accepted({ ...good, place: "debrief", clockSeconds: 312.6, tab: "tests" });
        assert.deepEqual(r, { caseId: "viral-gastroenteritis", category: "clinical", message: good.message, place: "debrief", context: { clockSeconds: 313, tab: "tests" } });
    });

    it("defaults to the encounter, and leaves out a clock or a tab it does not understand", () => {
        const r = accepted({ ...good, place: "somewhere", clockSeconds: -5, tab: "settings" });
        assert.equal(r.place, "encounter");
        assert.deepEqual(r.context, {});
        assert.deepEqual(accepted({ ...good, clockSeconds: Number.NaN }).context, {});
        assert.deepEqual(accepted({ ...good, clockSeconds: 999_999 }).context, {});
    });

    it("trims the message and normalises line breaks", () => {
        assert.equal(accepted({ ...good, message: "  first line\r\nsecond line  " }).message, "first line\nsecond line");
    });

    it("knows every kind of problem it offers", () => {
        for (const c of REPORT_CATEGORIES) {
            assert.equal(isReportCategory(c.id), true);
            assert.equal(accepted({ ...good, category: c.id }).category, c.id);
            assert.ok(categoryLabel(c.id).length > 3);
        }
    });
});

describe("case report: what is refused", () => {
    const refused = (input: ReportInput) => {
        const checked = normaliseReport(input);
        assert.equal(checked.ok, false);
        return checked.ok ? "" : checked.message;
    };

    it("refuses a missing or odd case id", () => {
        for (const caseId of ["", " ", "a b", "../etc", "x".repeat(121), "-start", "<script>"]) refused({ ...good, caseId });
        refused({ ...good, caseId: undefined as unknown as string });
    });

    it("refuses a kind of problem that is not on the list", () => {
        for (const category of ["", "spam", "CLINICAL", undefined as unknown as string]) refused({ ...good, category });
    });

    it("wants a sentence, and not a novel", () => {
        assert.match(refused({ ...good, message: "" }), /more/i);
        assert.match(refused({ ...good, message: "x".repeat(MIN_MESSAGE - 1) }), /more/i);
        assert.match(refused({ ...good, message: "x".repeat(MAX_MESSAGE + 1) }), /long/i);
        assert.match(refused({ ...good, message: `${" ".repeat(20)}short` }), /more/i);
        accepted({ ...good, message: "x".repeat(MIN_MESSAGE) });
        accepted({ ...good, message: "x".repeat(MAX_MESSAGE) });
    });

    it("never throws on what a browser might send", () => {
        for (const junk of [null, undefined, 42, "text", [], {}]) assert.doesNotThrow(() => normaliseReport(junk as unknown as ReportInput));
    });
});

describe("case report: the email to send instead", () => {
    const report = accepted({ ...good, place: "debrief", clockSeconds: 125, tab: "diagnose" });

    it("carries the case, the kind of problem, where, and the message", () => {
        const mail = reportMailto(report);
        assert.ok(mail.startsWith("mailto:support@medikarya.in?subject="));
        const body = decodeURIComponent(mail.split("&body=")[1]);
        assert.match(body, /Case: viral-gastroenteritis/);
        assert.match(body, /Problem: A clinical fact looks wrong/);
        assert.match(body, /after the case \(the feedback\), on the diagnose tab, at 2m 5s/);
        assert.match(body, /potassium is 6\.9/);
    });

    it("is cut to a length a mail app can open", () => {
        const long = accepted({ ...good, message: "y".repeat(MAX_MESSAGE) });
        assert.ok(reportMailto(long).length < 4000);
    });
});
