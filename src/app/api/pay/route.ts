import { NextRequest, NextResponse } from "next/server";
import {
  payWithSession,
  createTokenFromSession,
  generateOrderId,
  generateTxnId,
  generateAgreementId,
} from "@/lib/gateway";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, amount, currency = "USD" } = body;

    if (!sessionId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, amount" },
        { status: 400 }
      );
    }

    const orderId = generateOrderId();
    const txnId = generateTxnId();
    const agreementId = generateAgreementId();

    // Step 1: Create gateway token from hosted session
    const tokenResult = await createTokenFromSession(sessionId);

    // Step 2: CIT Payment using hosted session
    const payResult = await payWithSession(
      orderId,
      txnId,
      sessionId,
      amount,
      currency,
      agreementId
    );

    const gatewayToken = tokenResult.success
      ? (tokenResult.data.token as string)
      : null;

    return NextResponse.json({
      success: payResult.success,
      orderId,
      txnId,
      agreementId,
      gatewayToken,
      paymentResult: payResult.data,
      tokenResult: tokenResult.data,
      apiLogs: [tokenResult.apiLog, payResult.apiLog],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
