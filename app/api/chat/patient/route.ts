import { NextRequest, NextResponse } from "next/server";
import { ChatEngine } from "../../../../engine/chatEngine";
import { authorizeAiCase } from "@/lib/plans/access";
import { MAX_MESSAGE_LENGTH, cleanCondition } from "./condition";
import { cleanChatHistory } from "../../../../engine/chatHistory";

// The patient's reply. The case is loaded on the server by id (never taken from the request), and only for a case
// this student has started (lib/plans/access.ts), so this cannot be used as an open AI endpoint. The conversation so
// far comes with each question (`history`, cleaned and capped in engine/chatHistory.ts): the server keeps none.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;
    const caseId = body.caseId ?? body.caseData?.id;

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "That question is too long." }, { status: 400 });
    }

    const access = await authorizeAiCase(request, caseId, "chat");
    if ("response" in access) return access.response;

    const result = await ChatEngine.processRequest(message, access.caseData, cleanChatHistory(body.history), cleanCondition(body.currentCondition));

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error in patient chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
