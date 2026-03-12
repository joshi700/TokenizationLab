const GATEWAY_URL = process.env.GATEWAY_URL || "https://na.gateway.mastercard.com";
const API_VERSION = process.env.API_VERSION || "81";
const MERCHANT_ID = process.env.MERCHANT_ID || "TESTMIDtesting00";
const API_USERNAME = process.env.API_USERNAME || "merchant.TESTMIDtesting00";
const API_PASSWORD = process.env.API_PASSWORD || "";

const BASE_URL = `${GATEWAY_URL}/api/rest/version/${API_VERSION}/merchant/${MERCHANT_ID}`;

function getAuthHeader(): string {
  return "Basic " + Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString("base64");
}

export function getGatewayConfig() {
  return {
    merchantId: MERCHANT_ID,
    gatewayUrl: GATEWAY_URL,
    apiVersion: API_VERSION,
  };
}

export interface ApiLog {
  step: string;
  request: {
    method: string;
    url: string;
    body: Record<string, unknown>;
  };
  response: {
    status: number;
    body: Record<string, unknown>;
  };
}

async function gatewayRequest(
  method: string,
  path: string,
  body: Record<string, unknown>,
  step: string
): Promise<{ success: boolean; data: Record<string, unknown>; apiLog: ApiLog }> {
  const url = `${BASE_URL}${path}`;
  const apiLog: ApiLog = {
    step,
    request: { method, url, body },
    response: { status: 0, body: {} },
  };

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    apiLog.response = { status: response.status, body: data };

    return {
      success: response.ok,
      data,
      apiLog,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    apiLog.response = { status: 500, body: { error: message } };
    return {
      success: false,
      data: { error: message },
      apiLog,
    };
  }
}

export function generateOrderId(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function generateTxnId(): string {
  return `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function generateAgreementId(): string {
  return `AGR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// ── Hosted Session ─────────────────────────────────────────────────────

// Create a new gateway session (returns session.id for Hosted Session JS)
export async function createSession() {
  return gatewayRequest("POST", "/session", {}, "Create Session");
}

// ── Gateway Tokenization (via Hosted Session) ──────────────────────────

// Create a gateway token from a Hosted Session (card data stored in session)
export async function createTokenFromSession(sessionId: string) {
  return gatewayRequest(
    "POST",
    "/token",
    {
      session: { id: sessionId },
      sourceOfFunds: { type: "CARD" },
    },
    "Create Gateway Token"
  );
}

// CIT Payment using Hosted Session (card data stored in session)
export async function payWithSession(
  orderId: string,
  txnId: string,
  sessionId: string,
  amount: string,
  currency: string,
  agreementId: string
) {
  return gatewayRequest(
    "PUT",
    `/order/${orderId}/transaction/${txnId}`,
    {
      apiOperation: "PAY",
      order: {
        amount,
        currency,
        reference: orderId,
      },
      session: { id: sessionId },
      sourceOfFunds: { type: "CARD" },
      transaction: {
        source: "INTERNET",
        reference: txnId,
      },
      agreement: {
        type: "RECURRING",
        id: agreementId,
      },
    },
    "CIT Payment (Hosted Session)"
  );
}

// ── MIT Payment (uses stored token, no session needed) ─────────────────

export async function payWithToken(
  orderId: string,
  txnId: string,
  token: string,
  amount: string,
  currency: string,
  agreementId: string
) {
  return gatewayRequest(
    "PUT",
    `/order/${orderId}/transaction/${txnId}`,
    {
      apiOperation: "PAY",
      order: {
        amount,
        currency,
        reference: orderId,
      },
      sourceOfFunds: {
        type: "CARD",
        token,
      },
      transaction: {
        source: "MERCHANT",
        reference: txnId,
      },
      agreement: {
        type: "RECURRING",
        id: agreementId,
      },
    },
    "MIT Payment (Token)"
  );
}

// ── Network Tokenization (via Hosted Session) ──────────────────────────

// Provision a network token (DPAN) from a Hosted Session
export async function createNetworkTokenFromSession(sessionId: string) {
  return gatewayRequest(
    "POST",
    "/token",
    {
      session: { id: sessionId },
      sourceOfFunds: { type: "CARD" },
      networkTokenization: {
        enabled: true,
      },
    },
    "Provision Network Token"
  );
}

// Pay with network token (DPAN)
export async function payWithNetworkToken(
  orderId: string,
  txnId: string,
  token: string,
  amount: string,
  currency: string
) {
  return gatewayRequest(
    "PUT",
    `/order/${orderId}/transaction/${txnId}`,
    {
      apiOperation: "PAY",
      order: {
        amount,
        currency,
        reference: orderId,
      },
      sourceOfFunds: {
        type: "SCHEME_TOKEN",
        token,
      },
      transaction: {
        source: "INTERNET",
        reference: txnId,
      },
    },
    "Payment with Network Token"
  );
}
