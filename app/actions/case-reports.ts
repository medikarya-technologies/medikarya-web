"use server";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";
import { normaliseReport, REPORTS_PER_HOUR, type ReportInput } from "@/lib/reports/case-report";

export type ReportResult = { ok: true } | { ok: false; reason: "invalid" | "no-identity" | "too-many" | "unavailable"; message: string };

/**
 * Stores a "report a problem with this case". Only a signed-in student or a guest trying a case can send one, and
 * only a handful an hour, so a stuck button or a script cannot fill the table. Every failure comes back as a
 * plain message the dialog can show; the dialog then offers the same report as an email.
 */
export async function reportCaseProblem(input: ReportInput): Promise<ReportResult> {
    const checked = normaliseReport(input);
    if (!checked.ok) return { ok: false, reason: "invalid", message: checked.message };

    try {
        const { userId } = await auth();
        const guestId = typeof input.guestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(input.guestId) ? input.guestId : undefined;
        if (!userId && !guestId) return { ok: false, reason: "no-identity", message: "Sign in to send a report from here." };

        const since = new Date(Date.now() - 3_600_000).toISOString();
        const recent = await supabaseServer
            .from("case_reports")
            .select("id", { count: "exact", head: true })
            .eq(userId ? "user_id" : "guest_id", (userId ?? guestId) as string)
            .gte("created_at", since);
        if (recent.error) throw recent.error;
        if ((recent.count ?? 0) >= REPORTS_PER_HOUR) return { ok: false, reason: "too-many", message: "That is a lot of reports in an hour. Please try again a little later." };

        const { report } = checked;
        const { error } = await supabaseServer.from("case_reports").insert({
            case_id: report.caseId,
            category: report.category,
            message: report.message,
            place: report.place,
            context: report.context,
            user_id: userId ?? null,
            guest_id: userId ? null : (guestId ?? null),
        });
        if (error) throw error;
        return { ok: true };
    } catch (error) {
        // Most likely the table has not been created yet (scripts/add_case_reports.sql), or the database is down.
        console.error("Could not store a case report:", error);
        return { ok: false, reason: "unavailable", message: "We could not send that just now." };
    }
}
