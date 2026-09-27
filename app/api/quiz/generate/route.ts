import { NextRequest, NextResponse } from "next/server";
import { QuizGenerator } from "@/engine/evaluation/QuizGenerator";
import { authorizeAiCase } from "@/lib/plans/access";

// The follow-up quiz after a case. The case is loaded on the server by id and only for a case this student has
// started (lib/plans/access.ts); the student's feedback comes from the request, so its size is capped.
const MAX_FEEDBACK_BYTES = 100_000;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { feedback, orderedTestNames } = body;

        if (!feedback) {
            return NextResponse.json({ error: "Missing feedback" }, { status: 400 });
        }
        if (JSON.stringify(feedback).length > MAX_FEEDBACK_BYTES) {
            return NextResponse.json({ error: "Feedback too large" }, { status: 413 });
        }

        const access = await authorizeAiCase(request, body.caseId ?? body.caseData?.id, "quiz");
        if ("response" in access) return access.response;

        const testNames = Array.isArray(orderedTestNames)
            ? orderedTestNames.filter((t): t is string => typeof t === "string").slice(0, 200).map((t) => t.slice(0, 120))
            : [];

        console.log(`QuizGeneration API: Generating quiz for user=${access.userId}, case=${access.caseData.id}`);

        const result = await QuizGenerator.generate(feedback, access.caseData, testNames);

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error in quiz generation API:", error);
        return NextResponse.json(
            { error: "Failed to generate quiz" },
            { status: 500 }
        );
    }
}
