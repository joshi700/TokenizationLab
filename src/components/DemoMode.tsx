"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import PayloadViewer from "./PayloadViewer";

// ── Global type for Mastercard PaymentSession ──────────────────────────

declare global {
  interface Window {
    PaymentSession?: {
      configure: (config: Record<string, unknown>) => void;
      updateSessionFromForm: (type: string) => void;
    };
  }
}

// ── Types ──────────────────────────────────────────────────────────────

interface ApiLog {
  step: string;
  request: { method: string; url: string; body: Record<string, unknown> };
  response: { status: number; body: Record<string, unknown> };
}

interface GatewayConfig {
  merchantId: string;
  gatewayUrl: string;
  apiVersion: string;
}

interface DemoState {
  activeFlow: "gateway" | "network";
  gwStep: number;
  gwToken: string | null;
  gwAgreementId: string | null;
  gwCITResult: Record<string, unknown> | null;
  gwMITResult: Record<string, unknown> | null;
  gwApiLogs: ApiLog[];
  ntStep: number;
  ntToken: string | null;
  ntTokenData: Record<string, unknown> | null;
  ntPayResult: Record<string, unknown> | null;
  ntApiLogs: ApiLog[];
  loading: boolean;
  error: string | null;
}

const initialState: DemoState = {
  activeFlow: "gateway",
  gwStep: 0,
  gwToken: null,
  gwAgreementId: null,
  gwCITResult: null,
  gwMITResult: null,
  gwApiLogs: [],
  ntStep: 0,
  ntToken: null,
  ntTokenData: null,
  ntPayResult: null,
  ntApiLogs: [],
  loading: false,
  error: null,
};

// ── Shared Sub-Components ──────────────────────────────────────────────

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              i < current
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : i === current
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-slate-800/50 text-slate-500 border border-slate-700/50"
            }`}
          >
            {i < current ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span>{i + 1}</span>
            )}
            {step}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < current ? "bg-emerald-500/40" : "bg-slate-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Hosted Card Form ───────────────────────────────────────────────────
// Uses Mastercard Gateway Hosted Session to securely collect card data.
// Card details are entered in Mastercard-hosted iframes; raw PAN never
// touches our JavaScript or server. After updateSessionFromForm() the
// gateway session holds the encrypted card, and we pass only the session
// ID to our backend.

function HostedCardForm({
  onSessionReady,
  loading,
  buttonLabel,
  showAmount = true,
  idPrefix,
  gatewayConfig,
}: {
  onSessionReady: (sessionId: string, amount: string) => void;
  loading: boolean;
  buttonLabel: string;
  showAmount?: boolean;
  idPrefix: string;
  gatewayConfig: GatewayConfig | null;
}) {
  const [amount, setAmount] = useState("10.00");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Refs to keep latest values available inside callbacks
  const amountRef = useRef(amount);
  const onSessionReadyRef = useRef(onSessionReady);
  amountRef.current = amount;
  onSessionReadyRef.current = onSessionReady;
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gatewayConfig) return;
    const cfg = gatewayConfig; // capture for closure
    let cancelled = false;

    async function init() {
      try {
        // 1. Load session.js from gateway if not already loaded
        if (!window.PaymentSession) {
          await new Promise<void>((resolve, reject) => {
            const src = `${cfg.gatewayUrl}/form/version/${cfg.apiVersion}/merchant/${cfg.merchantId}/session.js`;
            // Avoid duplicate scripts
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
              // Already loading / loaded
              if (window.PaymentSession) {
                resolve();
              } else {
                existing.addEventListener("load", () => resolve());
                existing.addEventListener("error", () => reject(new Error("session.js failed")));
              }
              return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Mastercard session.js"));
            document.head.appendChild(script);
          });
        }

        if (cancelled) return;

        // 2. Create a gateway session
        const res = await fetch("/api/session", { method: "POST" });
        const data = await res.json();
        if (!data.sessionId) {
          setFormError("Could not create gateway session");
          setInitializing(false);
          return;
        }

        if (cancelled) return;

        const sid = data.sessionId as string;
        setSessionId(sid);
        sessionIdRef.current = sid;

        // 3. Configure hosted fields
        window.PaymentSession!.configure({
          session: sid,
          fields: {
            card: {
              number: `#${idPrefix}-card-number`,
              securityCode: `#${idPrefix}-card-cvv`,
              expiryMonth: `#${idPrefix}-card-expiry-month`,
              expiryYear: `#${idPrefix}-card-expiry-year`,
            },
          },
          frameEmbeddingMitigation: ["javascript"],
          interaction: {
            displayControl: {
              formatCard: "EMBOSSED",
              invalidFieldCharacters: "REJECT",
            },
          },
          callbacks: {
            initialized: () => {
              if (!cancelled) {
                setConfigured(true);
                setInitializing(false);
              }
            },
            formSessionUpdate: (response: Record<string, unknown>) => {
              if (cancelled) return;
              if (response.status === "ok") {
                onSessionReadyRef.current(sessionIdRef.current!, amountRef.current);
              } else {
                const errors = response.errors as Record<string, unknown> | undefined;
                setFormError(
                  "Card validation failed" +
                    (errors ? ": " + JSON.stringify(errors) : "")
                );
              }
            },
          },
        });
      } catch (err) {
        if (!cancelled) {
          setFormError(err instanceof Error ? err.message : "Initialization failed");
          setInitializing(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [gatewayConfig, idPrefix]);

  function handleSubmit() {
    setFormError(null);
    if (window.PaymentSession) {
      window.PaymentSession.updateSessionFromForm("card");
    }
  }

  return (
    <div className="space-y-4">
      {initializing && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading secure payment form...
        </div>
      )}

      <div className={initializing ? "opacity-30 pointer-events-none" : ""}>
        {/* Card Number */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1.5">Card Number</label>
          <div
            id={`${idPrefix}-card-number`}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg h-[44px] px-1 focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-colors"
          />
        </div>

        {/* Expiry + CVV */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Month</label>
            <div
              id={`${idPrefix}-card-expiry-month`}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg h-[44px] px-1 focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Year</label>
            <div
              id={`${idPrefix}-card-expiry-year`}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg h-[44px] px-1 focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">CVV</label>
            <div
              id={`${idPrefix}-card-cvv`}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg h-[44px] px-1 focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-colors"
            />
          </div>
        </div>

        {/* Amount */}
        {showAmount && (
          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-1.5">Amount (USD)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
              placeholder="10.00"
            />
          </div>
        )}

        {formError && (
          <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {formError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!configured || loading}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            buttonLabel
          )}
        </button>
        <div className="flex items-center justify-center gap-2 mt-2">
          <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-[10px] text-slate-500">
            Card data secured by Mastercard Gateway Hosted Session (PCI SAQ-A)
          </p>
        </div>
      </div>
    </div>
  );
}

function TokenCard({ token, label, masked }: { token: string; label: string; masked?: boolean }) {
  const [revealed, setRevealed] = useState(!masked);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {masked && (
            <button
              onClick={() => setRevealed(!revealed)}
              className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors"
            >
              {revealed ? "Mask" : "Reveal"}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <p className="font-mono text-lg text-orange-400 tracking-wider">
        {revealed ? token : token.slice(0, 6) + "******" + token.slice(-4)}
      </p>
    </div>
  );
}

function ResultBadge({ success }: { success: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        success
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-red-500/20 text-red-400 border border-red-500/30"
      }`}
    >
      {success ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {success ? "Success" : "Failed"}
    </span>
  );
}

// ── API Reference Data ─────────────────────────────────────────────────

interface EndpointDoc {
  title: string;
  method: string;
  path: string;
  description: string;
  requestBody: Record<string, unknown>;
  responseExample: Record<string, unknown>;
  fields: { field: string; description: string }[];
}

const endpoints: EndpointDoc[] = [
  {
    title: "Create Session",
    method: "POST",
    path: "/api/rest/version/{version}/merchant/{merchantId}/session",
    description:
      "Creates a new gateway session. The returned session.id is used to configure Hosted Session JS on the frontend and to reference card data in subsequent API calls.",
    requestBody: {},
    responseExample: {
      merchant: "TESTMIDtesting00",
      result: "SUCCESS",
      session: { id: "SESSION0002abcdef1234567890", version: "1a2b3c4d" },
    },
    fields: [
      { field: "session.id", description: "Session identifier passed to PaymentSession.configure() and to subsequent API calls" },
    ],
  },
  {
    title: "Create Gateway Token",
    method: "POST",
    path: "/api/rest/version/{version}/merchant/{merchantId}/token",
    description:
      "Creates a gateway token from card data held in the Hosted Session. No raw card details are sent by the merchant server.",
    requestBody: {
      session: { id: "SESSION0002abcdef1234567890" },
      sourceOfFunds: { type: "CARD" },
    },
    responseExample: {
      result: "SUCCESS",
      token: "9876543210987654",
      repositoryId: "...",
      status: "VALID",
      sourceOfFunds: {
        type: "CARD",
        provided: {
          card: {
            number: "512345xxxxxx0008",
            scheme: "MASTERCARD",
            expiry: { month: "05", year: "25" },
          },
        },
      },
    },
    fields: [
      { field: "session.id", description: "Hosted Session containing encrypted card data" },
      { field: "sourceOfFunds.type", description: "CARD - tokenize the card in the session" },
      { field: "token", description: "Gateway token ID returned for future use" },
    ],
  },
  {
    title: "CIT Payment (Hosted Session)",
    method: "PUT",
    path: "/api/rest/version/{version}/merchant/{merchantId}/order/{orderId}/transaction/{txnId}",
    description:
      "Customer-initiated payment using card data in the Hosted Session. Establishes a recurring agreement for future MIT payments.",
    requestBody: {
      apiOperation: "PAY",
      session: { id: "SESSION0002abcdef1234567890" },
      order: { amount: "10.00", currency: "USD", reference: "ORD-xxx" },
      sourceOfFunds: { type: "CARD" },
      transaction: { source: "INTERNET", reference: "TXN-xxx" },
      agreement: { type: "RECURRING", id: "AGR-xxx" },
    },
    responseExample: {
      result: "SUCCESS",
      order: { amount: 10.0, currency: "USD", id: "ORD-xxx", status: "CAPTURED" },
      response: { acquirerCode: "00", gatewayCode: "APPROVED" },
      transaction: { type: "PAYMENT", receipt: "123456789" },
    },
    fields: [
      { field: "session.id", description: "Hosted Session with card data - replaces sourceOfFunds.provided.card" },
      { field: "sourceOfFunds.type", description: "CARD - use card from session" },
      { field: "transaction.source", description: "INTERNET - customer initiated online" },
      { field: "agreement.type", description: "RECURRING - establishes agreement for future MIT" },
    ],
  },
  {
    title: "MIT Payment (Token)",
    method: "PUT",
    path: "/api/rest/version/{version}/merchant/{merchantId}/order/{orderId}/transaction/{txnId}",
    description:
      "Merchant-initiated payment using a stored gateway token. No session or card details required.",
    requestBody: {
      apiOperation: "PAY",
      order: { amount: "5.00", currency: "USD", reference: "ORD-xxx" },
      sourceOfFunds: { type: "CARD", token: "9876543210987654" },
      transaction: { source: "MERCHANT", reference: "TXN-xxx" },
      agreement: { type: "RECURRING", id: "AGR-xxx" },
    },
    responseExample: {
      result: "SUCCESS",
      order: { amount: 5.0, currency: "USD", status: "CAPTURED" },
      response: { acquirerCode: "00", gatewayCode: "APPROVED" },
      sourceOfFunds: { token: "9876543210987654", type: "CARD" },
    },
    fields: [
      { field: "sourceOfFunds.token", description: "Gateway token - replaces card number" },
      { field: "transaction.source", description: "MERCHANT - no cardholder present" },
      { field: "agreement.id", description: "Must match agreement from original CIT" },
    ],
  },
  {
    title: "Provision Network Token",
    method: "POST",
    path: "/api/rest/version/{version}/merchant/{merchantId}/token",
    description:
      "Requests a network token (DPAN) via the card network's Token Service Provider. Uses card from Hosted Session.",
    requestBody: {
      session: { id: "SESSION0002abcdef1234567890" },
      sourceOfFunds: { type: "CARD" },
      networkTokenization: { enabled: true },
    },
    responseExample: {
      result: "SUCCESS",
      token: "5246890000123456",
      type: "SCHEME_TOKEN",
      status: "ACTIVE",
      scheme: "MASTERCARD",
    },
    fields: [
      { field: "session.id", description: "Hosted Session containing card data" },
      { field: "networkTokenization.enabled", description: "Request network-level (scheme) token" },
      { field: "type", description: "SCHEME_TOKEN indicates a network token" },
    ],
  },
  {
    title: "Pay with Network Token",
    method: "PUT",
    path: "/api/rest/version/{version}/merchant/{merchantId}/order/{orderId}/transaction/{txnId}",
    description:
      "Payment using a provisioned network token (DPAN). sourceOfFunds type is SCHEME_TOKEN.",
    requestBody: {
      apiOperation: "PAY",
      order: { amount: "15.00", currency: "USD", reference: "ORD-xxx" },
      sourceOfFunds: { type: "SCHEME_TOKEN", token: "5246890000123456" },
      transaction: { source: "INTERNET", reference: "TXN-xxx" },
    },
    responseExample: {
      result: "SUCCESS",
      order: { amount: 15.0, currency: "USD", status: "CAPTURED" },
      response: { acquirerCode: "00", gatewayCode: "APPROVED" },
      sourceOfFunds: { type: "SCHEME_TOKEN" },
    },
    fields: [
      { field: "sourceOfFunds.type", description: "SCHEME_TOKEN - pay with DPAN" },
      { field: "sourceOfFunds.token", description: "The DPAN from provisioning" },
    ],
  },
];

// ── Collapsible Endpoint Card ──────────────────────────────────────────

function EndpointCard({ endpoint }: { endpoint: EndpointDoc }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"request" | "response" | "fields">("request");
  const [copied, setCopied] = useState(false);

  const methodColor =
    endpoint.method === "POST"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : "bg-blue-500/20 text-blue-400 border-blue-500/30";

  const content =
    activeTab === "request"
      ? JSON.stringify(endpoint.requestBody, null, 2)
      : activeTab === "response"
      ? JSON.stringify(endpoint.responseExample, null, 2)
      : "";

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${methodColor} uppercase tracking-wider`}>
            {endpoint.method}
          </span>
          <span className="text-sm text-white font-medium">{endpoint.title}</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-800">
          <div className="px-4 py-2">
            <p className="font-mono text-[11px] text-slate-500 break-all">{endpoint.path}</p>
            <p className="text-xs text-slate-400 mt-1">{endpoint.description}</p>
          </div>
          <div className="border-t border-slate-800 px-4 py-2 flex items-center gap-1">
            {(["request", "response", "fields"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${
                  activeTab === tab
                    ? tab === "request" ? "bg-blue-500/20 text-blue-400"
                    : tab === "response" ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-purple-500/20 text-purple-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {activeTab === "fields" ? (
            <div className="px-4 py-3 space-y-2">
              {endpoint.fields.map((f) => (
                <div key={f.field} className="flex gap-3">
                  <code className="text-[11px] font-mono text-orange-400 shrink-0 bg-slate-800/50 px-2 py-0.5 rounded">
                    {f.field}
                  </code>
                  <span className="text-[11px] text-slate-400">{f.description}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <pre className="px-4 py-3 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[280px] overflow-y-auto leading-relaxed">
                {content}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Demo Component ────────────────────────────────────────────────

export default function DemoMode() {
  const [state, setState] = useState<DemoState>(initialState);
  const [refOpen, setRefOpen] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null);

  // Load gateway config on mount
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setGatewayConfig)
      .catch(() => {});
  }, []);

  const updateState = useCallback((updates: Partial<DemoState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Gateway Token Flow: Step 1 - CIT Payment + Create Token
  async function handleGatewayPay(sessionId: string, amount: string) {
    updateState({ loading: true, error: null });
    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, amount }),
      });
      const result = await res.json();
      if (result.error && !result.apiLogs) {
        updateState({ error: result.error, loading: false });
        return;
      }
      updateState({
        gwStep: 1,
        gwToken: result.gatewayToken,
        gwAgreementId: result.agreementId,
        gwCITResult: result,
        gwApiLogs: result.apiLogs || [],
        loading: false,
        error: result.success ? null : "Payment failed - check API response for details",
      });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : "Request failed",
        loading: false,
      });
    }
  }

  // Gateway Token Flow: Step 2 - MIT Payment with Token
  async function handleMITPay(amount: string) {
    if (!state.gwToken || !state.gwAgreementId) return;
    updateState({ loading: true, error: null });
    try {
      const res = await fetch("/api/pay-with-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.gwToken,
          amount,
          agreementId: state.gwAgreementId,
        }),
      });
      const result = await res.json();
      updateState({
        gwStep: 2,
        gwMITResult: result,
        gwApiLogs: [...state.gwApiLogs, ...(result.apiLogs || [])],
        loading: false,
        error: result.success ? null : "MIT Payment failed - check API response",
      });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : "Request failed",
        loading: false,
      });
    }
  }

  // Network Token Flow: Step 1 - Provision
  async function handleProvisionNetworkToken(sessionId: string) {
    updateState({ loading: true, error: null });
    try {
      const res = await fetch("/api/create-network-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const result = await res.json();
      const tokenId =
        result.networkToken?.token || result.networkToken?.deviceSpecificNumber || null;
      updateState({
        ntStep: 1,
        ntToken: tokenId,
        ntTokenData: result.networkToken,
        ntApiLogs: result.apiLogs || [],
        loading: false,
        error: result.success
          ? null
          : "Network token provisioning response received - check API details",
      });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : "Request failed",
        loading: false,
      });
    }
  }

  // Network Token Flow: Step 2 - Pay with Network Token
  async function handleNetworkTokenPay(amount: string) {
    if (!state.ntToken) return;
    updateState({ loading: true, error: null });
    try {
      const res = await fetch("/api/pay-with-network-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: state.ntToken, amount }),
      });
      const result = await res.json();
      updateState({
        ntStep: 2,
        ntPayResult: result,
        ntApiLogs: [...state.ntApiLogs, ...(result.apiLogs || [])],
        loading: false,
        error: result.success
          ? null
          : "Network token payment response received - check API details",
      });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : "Request failed",
        loading: false,
      });
    }
  }

  function resetDemo() {
    setState(initialState);
  }

  const activeApiLogs =
    state.activeFlow === "gateway" ? state.gwApiLogs : state.ntApiLogs;

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
          <button
            onClick={() => updateState({ activeFlow: "gateway" })}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              state.activeFlow === "gateway"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Gateway Token
          </button>
          <button
            onClick={() => updateState({ activeFlow: "network" })}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              state.activeFlow === "network"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Network Token
          </button>
        </div>
        <button
          onClick={resetDemo}
          className="px-4 py-2 text-xs text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
        >
          Reset Demo
        </button>
      </div>

      {/* ── Error ── */}
      {state.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-red-400">{state.error}</span>
          <button onClick={() => updateState({ error: null })} className="text-red-400/60 hover:text-red-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Side-by-Side ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Interactive Demo */}
        <div className="space-y-6">
          {state.activeFlow === "gateway" ? (
            <GatewayFlow
              key="gw"
              state={state}
              gatewayConfig={gatewayConfig}
              onPay={handleGatewayPay}
              onMITPay={handleMITPay}
            />
          ) : (
            <NetworkFlow
              key="nt"
              state={state}
              gatewayConfig={gatewayConfig}
              onProvision={handleProvisionNetworkToken}
              onPay={handleNetworkTokenPay}
            />
          )}
        </div>

        {/* Right: Live API Payloads */}
        <div className="space-y-4">
          {activeApiLogs.length > 0 ? (
            <PayloadViewer logs={activeApiLogs} title="Live API Payloads" />
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">API request and response payloads will appear here</p>
              <p className="text-xs text-slate-600 mt-1">Run a transaction to see live data</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Collapsible API Reference ── */}
      <div className="border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setRefOpen(!refOpen)}
          className="w-full px-6 py-4 flex items-center justify-between bg-slate-900/50 hover:bg-slate-900/80 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-sm font-semibold text-white">API Reference</span>
            <span className="text-xs text-slate-500">Endpoint docs, field explanations & test cards</span>
          </div>
          <svg
            className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${refOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {refOpen && (
          <div className="border-t border-slate-800 p-6 space-y-6 bg-slate-950/50">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span>
                Base URL:{" "}
                <code className="text-slate-400">
                  {"https://na.gateway.mastercard.com/api/rest/version/81/merchant/<merchantId>"}
                </code>
              </span>
              <span>Auth: Basic HTTP</span>
              <span>
                Session JS:{" "}
                <code className="text-slate-400">
                  {"https://<gateway>/form/version/<ver>/merchant/<mid>/session.js"}
                </code>
              </span>
            </div>

            <div className="space-y-3">
              {endpoints.map((ep) => (
                <EndpointCard key={ep.title} endpoint={ep} />
              ))}
            </div>

            {/* Quick Reference */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <h4 className="text-sm text-white font-semibold mb-4">Quick Reference</h4>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <h5 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                    Transaction Source Types
                  </h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <code className="text-orange-400">INTERNET</code>
                      <span className="text-slate-400">Customer initiated (CIT)</span>
                    </div>
                    <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <code className="text-emerald-400">MERCHANT</code>
                      <span className="text-slate-400">Merchant initiated (MIT)</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                    Source of Funds Types
                  </h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <code className="text-orange-400">CARD</code>
                      <span className="text-slate-400">Card or gateway token</span>
                    </div>
                    <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <code className="text-blue-400">SCHEME_TOKEN</code>
                      <span className="text-slate-400">Network token (DPAN)</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                    Agreement Types
                  </h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <code className="text-orange-400">RECURRING</code>
                      <span className="text-slate-400">Scheduled recurring payments</span>
                    </div>
                    <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <code className="text-yellow-400">UNSCHEDULED</code>
                      <span className="text-slate-400">Unscheduled charges</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                    Test Cards (MTF)
                  </h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <code className="text-orange-400">5123450000000008</code>
                      <span className="text-slate-400">Mastercard</span>
                    </div>
                    <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <code className="text-blue-400">4508750015741019</code>
                      <span className="text-slate-400">Visa</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gateway Token Sub-Flow ─────────────────────────────────────────────

function GatewayFlow({
  state,
  gatewayConfig,
  onPay,
  onMITPay,
}: {
  state: DemoState;
  gatewayConfig: GatewayConfig | null;
  onPay: (sessionId: string, amount: string) => void;
  onMITPay: (amount: string) => void;
}) {
  const [mitAmount, setMitAmount] = useState("5.00");

  return (
    <>
      <StepIndicator
        steps={["Pay & Tokenize", "Token Created", "MIT Payment"]}
        current={state.gwStep}
      />

      {state.gwStep === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Step 1: Initial Card Payment (CIT)</h3>
          <p className="text-xs text-slate-400 mb-5">
            Enter card details in the secure hosted fields to make a payment and create a gateway token
          </p>
          <HostedCardForm
            onSessionReady={onPay}
            loading={state.loading}
            buttonLabel="Pay & Create Token"
            idPrefix="gw"
            gatewayConfig={gatewayConfig}
          />
        </div>
      )}

      {state.gwStep >= 1 && (
        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">CIT Payment Result</h3>
              <ResultBadge success={state.gwCITResult?.success as boolean} />
            </div>
            {state.gwToken && <TokenCard token={state.gwToken} label="Gateway Token" masked />}
            {state.gwAgreementId && (
              <div className="mt-3 bg-slate-800/50 rounded-lg px-4 py-2.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Agreement ID</span>
                <p className="font-mono text-sm text-slate-300">{state.gwAgreementId}</p>
              </div>
            )}
          </div>

          {state.gwStep === 1 && state.gwToken && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Step 2: Merchant Initiated Payment (MIT)</h3>
              <p className="text-xs text-slate-400 mb-5">Charge the stored token without card details</p>
              <div className="space-y-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Using Token</span>
                    <span className="font-mono text-xs text-orange-400">
                      {state.gwToken.slice(0, 6)}...{state.gwToken.slice(-4)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Amount (USD)</label>
                  <input
                    type="text"
                    value={mitAmount}
                    onChange={(e) => setMitAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
                  />
                </div>
                <button
                  onClick={() => onMITPay(mitAmount)}
                  disabled={state.loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 text-sm"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Charge Token"
                  )}
                </button>
              </div>
            </div>
          )}

          {state.gwStep === 2 && state.gwMITResult && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">MIT Payment Result</h3>
                <ResultBadge success={state.gwMITResult.success as boolean} />
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Order ID</span>
                  <span className="text-slate-300 font-mono">
                    {(state.gwMITResult as Record<string, unknown>).orderId as string}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Transaction</span>
                  <span className="text-slate-300 font-mono">
                    {(state.gwMITResult as Record<string, unknown>).txnId as string}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Source</span>
                  <span className="text-emerald-400 font-mono">MERCHANT</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500 text-center">
                Payment processed using stored token - no card data required
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Network Token Sub-Flow ─────────────────────────────────────────────

function NetworkFlow({
  state,
  gatewayConfig,
  onProvision,
  onPay,
}: {
  state: DemoState;
  gatewayConfig: GatewayConfig | null;
  onProvision: (sessionId: string) => void;
  onPay: (amount: string) => void;
}) {
  const [payAmount, setPayAmount] = useState("15.00");

  return (
    <>
      <StepIndicator
        steps={["Provision Token", "Token Created", "Pay with DPAN"]}
        current={state.ntStep}
      />

      {state.ntStep === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Step 1: Provision Network Token</h3>
          <p className="text-xs text-slate-400 mb-5">
            Enter card details in the secure hosted fields to request a network token (DPAN)
          </p>
          <HostedCardForm
            onSessionReady={(sessionId) => onProvision(sessionId)}
            loading={state.loading}
            buttonLabel="Provision Network Token"
            showAmount={false}
            idPrefix="nt"
            gatewayConfig={gatewayConfig}
          />
        </div>
      )}

      {state.ntStep >= 1 && (
        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Network Token Result</h3>
              <ResultBadge success={!!state.ntToken} />
            </div>
            {state.ntToken ? (
              <TokenCard token={state.ntToken} label="Network Token (DPAN)" masked />
            ) : (
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-yellow-400">
                  Network token provisioning returned a response. Check the API payload for details.
                  Note: MTF may have limited network token support.
                </p>
              </div>
            )}
          </div>

          {state.ntStep === 1 && state.ntToken && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Step 2: Pay with Network Token</h3>
              <p className="text-xs text-slate-400 mb-5">
                Use the DPAN for payment - sourceOfFunds.type = SCHEME_TOKEN
              </p>
              <div className="space-y-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Using DPAN</span>
                    <span className="font-mono text-xs text-blue-400">
                      {state.ntToken.slice(0, 6)}...{state.ntToken.slice(-4)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Amount (USD)</label>
                  <input
                    type="text"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                  />
                </div>
                <button
                  onClick={() => onPay(payAmount)}
                  disabled={state.loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 text-sm"
                >
                  {state.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Pay with Network Token"
                  )}
                </button>
              </div>
            </div>
          )}

          {state.ntStep === 2 && state.ntPayResult && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Network Token Payment Result</h3>
                <ResultBadge success={state.ntPayResult.success as boolean} />
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Order ID</span>
                  <span className="text-slate-300 font-mono">
                    {(state.ntPayResult as Record<string, unknown>).orderId as string}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Source Type</span>
                  <span className="text-blue-400 font-mono">SCHEME_TOKEN</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
