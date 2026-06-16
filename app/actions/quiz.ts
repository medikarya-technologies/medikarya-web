"use server";

import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";

interface QuizResultPayload {
    questions: any[];
    answers: {
        questionId: string;
        selectedIndex: number;
        correct: boolean;
        timeSpentMs: number;
    }[];
    knowledgeGaps: {
        concept: string;
        relatedWeaknesses: string[];
        priority: number;
        questionCount: number;
    }[];
    score: number;
    total: number;
    generatedAt: string;
}

/**
 * Saves quiz results by updating the most recent case_attempts row
 * for this user+case, appending quizResults to the existing feedback_json.
 * 
 * Schema designed for future spaced repetition — stores per-question
 * correctness, knowledge gap, and timing data.
 */
export async function saveQuizResults(
    caseId: string,
    quizResults: QuizResultPayload
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            console.log("saveQuizResults: No authenticated user, skipping save.");
            return { success: false, reason: "unauthenticated" };
        }

        // Find the most recent attempt for this user + case
        const { data: latestAttempt, error: fetchError } = await supabaseServer
            .from("case_attempts")
            .select("id, feedback_json")
            .eq("user_id", userId)
            .eq("case_id", caseId)
            .order("completed_at", { ascending: false })
            .limit(1)
            .single();

        if (fetchError || !latestAttempt) {
            console.error("saveQuizResults: Could not find latest attempt:", fetchError);
            return { success: false, reason: "no_attempt_found" };
        }

        // Merge quiz results into existing feedback_json
        const updatedFeedback = {
            ...latestAttempt.feedback_json,
            quizResults: {
                ...quizResults,
                completedAt: new Date().toISOString(),
            },
        };

        const { error: updateError } = await supabaseServer
            .from("case_attempts")
            .update({ feedback_json: updatedFeedback })
            .eq("id", latestAttempt.id);

        if (updateError) {
            console.error("saveQuizResults: Failed to update attempt:", updateError);
            return { success: false, reason: "update_failed" };
        }

        console.log(`saveQuizResults: Saved quiz results (${quizResults.score}/${quizResults.total}) for attempt ${latestAttempt.id}`);
        return { success: true };

    } catch (error) {
        console.error("saveQuizResults: Unexpected error:", error);
        return { success: false, reason: "unexpected_error" };
    }
}
