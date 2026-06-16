import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json(
                { success: false, reason: "unauthenticated" },
                { status: 200 }
            );
        }

        const { caseId, quizResults } = await request.json();

        if (!caseId || !quizResults) {
            return NextResponse.json(
                { success: false, reason: "missing_data" },
                { status: 400 }
            );
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
            console.error("Quiz save: Could not find latest attempt:", fetchError);
            return NextResponse.json(
                { success: false, reason: "no_attempt_found" },
                { status: 200 }
            );
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
            console.error("Quiz save: Failed to update attempt:", updateError);
            return NextResponse.json(
                { success: false, reason: "update_failed" },
                { status: 500 }
            );
        }

        console.log(`Quiz save: Saved results (${quizResults.score}/${quizResults.total}) for attempt ${latestAttempt.id}`);
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Quiz save: Unexpected error:", error);
        return NextResponse.json(
            { success: false, reason: "unexpected_error" },
            { status: 500 }
        );
    }
}
