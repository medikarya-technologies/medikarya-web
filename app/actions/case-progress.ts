"use server";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";
import { summariseAttempts, type CaseProgress } from "@/lib/library/case-library";

/**
 * What the signed-in student has done on each case: how many attempts, the best score and when they
 * last tried. Empty when signed out and on any error, so the library still opens (it just shows every
 * case as not started).
 */
export async function getCaseProgress(): Promise<Record<string, CaseProgress>> {
    try {
        const { userId } = await auth();
        if (!userId) return {};

        const { data, error } = await supabaseServer.from("case_attempts").select("case_id, score, created_at").eq("user_id", userId);
        if (error) {
            console.error("Error fetching case progress:", error);
            return {};
        }
        return summariseAttempts(data ?? []);
    } catch (error) {
        console.error("Failed to fetch case progress:", error);
        return {};
    }
}

/**
 * What the first-case tour needs to decide whether to start by itself: who is signed in, and whether they have
 * finished any case at all. Null when signed out or when it cannot be worked out, so a failure never starts a
 * tour for someone who has been here for months.
 */
export async function getTourContext(): Promise<{ userId: string; hasAttempts: boolean } | null> {
    try {
        const { userId } = await auth();
        if (!userId) return null;

        const { count, error } = await supabaseServer.from("case_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (error) {
            console.error("Error checking attempts for the tour:", error);
            return null;
        }
        return { userId, hasAttempts: (count ?? 0) > 0 };
    } catch (error) {
        console.error("Failed to work out the tour context:", error);
        return null;
    }
}
