"use server";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";

export interface CaseAttempt {
    id: string;
    case_id: string;
    score: number;
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

        return data as CaseAttempt[];
    } catch (error) {
        console.error("Failed to fetch case attempt history:", error);
        return [];
    }
}
