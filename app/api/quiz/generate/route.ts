import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { QuizGenerator } from "@/engine/evaluation/QuizGenerator";

export async function POST(request: NextRequest) {
    try {
        // Auth check — works for both authenticated and guest users
        let currentUserId = "guest";
        try {
            const { userId } = await auth();
            if (userId) currentUserId = userId;
        } catch {
            // Guest access — auth() may throw when no session exists
        }

        const body = await request.json();
        const { feedback, caseData, orderedTestNames } = body;

        if (!feedback || !caseData) {
            return NextResponse.json(
                { error: "Missing feedback or caseData" },
                { status: 400 }
            );
        }

        console.log(`QuizGeneration API: Generating quiz for user=${currentUserId}, case=${caseData.id || 'unknown'}`);

        const result = await QuizGenerator.generate(
            feedback,
            caseData,
            orderedTestNames || []
        );

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error in quiz generation API:", error);
        return NextResponse.json(
            { error: "Failed to generate quiz" },
            { status: 500 }
        );
    }
}
