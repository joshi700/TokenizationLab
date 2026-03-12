import { NextRequest, NextResponse } from "next/server";
import { payWithToken, generateOrderId, generateTxnId } from "@/lib/gateway";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, amount, currency = "USD", agreementId } = body;

    if (!token || !amount || !agreementId) {
      return NextResponse.json(
        { error: "Missing required fields: token, amount, agreementId" },
        { status: 400 }
      );
    }

    const orderId = generateOrderId();
    const txnId = generateTxnId();

    const result = await payWithToken(orderId, txnId, token, amount, currency, agreementId);

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
