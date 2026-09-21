"use server";

import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCases } from "@/data/cases";
import { buildDashboardStats, NO_STATS, summariseAttempts, type CaseProgress, type DashboardStats } from "@/lib/library/case-library";
import { computeMilestones, type Milestone } from "@/lib/library/milestones";

/**
 * Everything the dashboard home and the profile page need about the signed-in student, in one go: the
 * numbers, and what they have done on each case. Two small queries (attempts, streak) run alongside the
 * case list, which is kept for a minute. Names come from that list rather than a third query, and the
 * per-case progress is read from the same attempts, not a second query for them.
 */
export async function getDashboardData(): Promise<{ stats: DashboardStats; progress: Record<string, CaseProgress>; milestones: Milestone[] }> {
    const empty = { stats: NO_STATS, progress: {}, milestones: [] as Milestone[] };
    try {
        // Always derive userId from the server-side session — never from client input
        const { userId } = await auth();
        if (!userId) return empty;

        const [attemptsResult, profileResult, cases] = await Promise.all([
            supabaseServer
                .from("case_attempts")
                .select("id, case_id, score, xp_earned, time_taken, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false }),
            supabaseServer.from("user_profiles").select("current_streak").eq("clerk_user_id", userId).maybeSingle(),
            getCases(),
        ]);

        if (attemptsResult.error) {
            console.error("Error fetching dashboard stats:", attemptsResult.error);
            throw new Error("Failed to fetch dashboard stats");
        }
        if (profileResult.error) {
            console.error("Error fetching user profile for streak:", profileResult.error);
        }

        const rows = attemptsResult.data ?? [];
        const titles = new Map(cases.map((c) => [c.id, c.title]));
        return {
            stats: buildDashboardStats(rows, (id) => titles.get(id), profileResult.data?.current_streak || 0),
            progress: summariseAttempts(rows),
            milestones: computeMilestones({ attempts: rows, cases: cases.map((c) => ({ id: c.id, category: c.category })) }),
        };
    } catch (err) {
        console.error("Dashboard stats action failed:", err);
        return empty;
    }
}

/** Kept for callers that only want the numbers. */
export async function getDashboardStats(): Promise<DashboardStats> {
    return (await getDashboardData()).stats;
}
