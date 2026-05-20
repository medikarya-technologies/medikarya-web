
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ChatEngine } from "../../../../engine/chatEngine";

export async function POST(request: NextRequest) {
  try {
    let currentUserId = "guest";
    try {
      const { userId } = await auth();
      if (userId) currentUserId = userId;
    } catch {
      // Guest access — auth() may throw when no session exists
    }

    const body = await request.json();
    const { message, caseData } = body;

    const result = await ChatEngine.processRequest(message, caseData, currentUserId);

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
