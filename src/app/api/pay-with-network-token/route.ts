import { NextRequest, NextResponse } from "next/server";
import { payWithNetworkToken, generateOrderId, generateTxnId } from "@/lib/gateway";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, amount, currency = "USD" } = body;

    if (!token || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: token, amount" },
        { status: 400 }
      );
    }

    const orderId = generateOrderId();
    const txnId = generateTxnId();

    const result = await payWithNetworkToken(orderId, txnId, token, amount, currency);

    return NextResponse.json({
      success: result.success,
      orderId,
      txnId,
      paymentResult: result.data,
      apiLogs: [result.apiLog],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
