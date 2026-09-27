import { NextRequest, NextResponse } from "next/server";
import { ChatEngine } from "../../../../../engine/chatEngine";
import { authorizeAiCase } from "@/lib/plans/access";
import { cleanCondition } from "../condition";

// The patient's first words. Same rules as the chat itself: the case by id, from the server, once it is started.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const access = await authorizeAiCase(request, body.caseId ?? body.caseData?.id, "opening");
    if ("response" in access) return access.response;

    const openingLine = await ChatEngine.generateOpening(access.caseData, cleanCondition(body.currentCondition));
    return NextResponse.json({ opening: openingLine });

  } catch (error) {
    console.error("Error generating opening:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
