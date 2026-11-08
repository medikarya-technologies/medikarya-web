"use server";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";

export interface CaseAttempt {
    id: string;
    case_id: string;
    score: number | null;
    xp_earned: number;
    time_taken: number;
    created_at: string;
    completed_at?: string;
    feedback_json: any;
}

/**
 * Fetches all past attempts for a specific case for the current authenticated user.
 * Ordered by recency (newest first).
 */
export async function getCaseAttemptHistory(caseId: string): Promise<CaseAttempt[]> {
    try {
        const { userId } = await auth();
        if (!userId) {
            return [];
        }

        const { data, error } = await supabaseServer
            .from("case_attempts")
            .select("*")
            .eq("user_id", userId)
            .eq("case_id", caseId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(`Error fetching attempt history for case ${caseId}:`, error);
            return [];
        }

        // The saved grading audit is for admin review and re-scoring. The student-facing debrief
        // already has its own case data, so do not send the hidden rubric snapshot to the browser.
        return (data as CaseAttempt[]).map((attempt) => {
            if (!attempt.feedback_json || typeof attempt.feedback_json !== "object") return attempt;
            const { gradingAudit: _gradingAudit, ...feedback } = attempt.feedback_json;
            return { ...attempt, feedback_json: feedback };
        });
    } catch (error) {
        console.error("Failed to fetch case attempt history:", error);
        return [];
    }
}
