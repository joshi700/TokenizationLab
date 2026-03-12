import { NextRequest, NextResponse } from "next/server";
import { createNetworkTokenFromSession } from "@/lib/gateway";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required field: sessionId" },
        { status: 400 }
      );
    }

    const result = await createNetworkTokenFromSession(sessionId);

    return NextResponse.json({
      success: result.success,
      networkToken: result.success ? result.data : null,
      apiLogs: [result.apiLog],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
