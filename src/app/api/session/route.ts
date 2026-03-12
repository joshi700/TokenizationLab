import { NextResponse } from "next/server";
import { createSession } from "@/lib/gateway";

export async function POST() {
  try {
    const result = await createSession();

    const sessionId =
      result.data?.session && typeof result.data.session === "object"
        ? (result.data.session as Record<string, unknown>).id
        : null;

    return NextResponse.json({
      success: result.success,
      sessionId,
      apiLogs: [result.apiLog],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
