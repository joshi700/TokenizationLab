"use client";

import { useState, useCallback } from "react";
import PayloadViewer from "./PayloadViewer";

interface ApiLog {
  step: string;
  request: { method: string; url: string; body: Record<string, unknown> };
  response: { status: number; body: Record<string, unknown> };
}

interface DemoState {
  activeFlow: "gateway" | "network";
  // Gateway flow
  gwStep: number;
  gwToken: string | null;
  gwAgreementId: string | null;
  gwCITResult: Record<string, unknown> | null;
  gwMITResult: Record<string, unknown> | null;
  gwApiLogs: ApiLog[];
  // Network flow
  ntStep: number;
  ntToken: string | null;
  ntTokenData: Record<string, unknown> | null;
  ntPayResult: Record<string, unknown> | null;
  ntApiLogs: ApiLog[];
  // Common
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

const TEST_CARDS = {
  mastercard: { number: "5123450000000008", expiryMonth: "05", expiryYear: "25", cvv: "100" },
  visa: { number: "4508750015741019", expiryMonth: "05", expiryYear: "25", cvv: "100" },
};

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

function CardForm({
  onSubmit,
  loading,
  buttonLabel,
  showCvv = true,
  showAmount = true,
}: {
  onSubmit: (data: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    amount: string;
  }) => void;
  loading: boolean;
  buttonLabel: string;
  showCvv?: boolean;
  showAmount?: boolean;
}) {
  const [card, setCard] = useState(TEST_CARDS.mastercard);
  const [amount, setAmount] = useState("10.00");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Card Number</label>
        <input
          type="text"
          value={card.number}
          onChange={(e) => setCard({ ...card, number: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          placeholder="5123 4500 0000 0008"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Month</label>
          <input
            type="text"
            value={card.expiryMonth}
            onChange={(e) => setCard({ ...card, expiryMonth: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
            placeholder="MM"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Year</label>
          <input
            type="text"
            value={card.expiryYear}
            onChange={(e) => setCard({ ...card, expiryYear: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
            placeholder="YY"
          />
        </div>
        {showCvv && (
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">CVV</label>
            <input
              type="text"
              value={card.cvv}
              onChange={(e) => setCard({ ...card, cvv: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
              placeholder="100"
            />
          </div>
        )}
      </div>
      {showAmount && (
        <div>
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
      <button
        onClick={() => onSubmit({ cardNumber: card.number, expiryMonth: card.expiryMonth, expiryYear: card.expiryYear, cvv: card.cvv, amount })}
        disabled={loading}
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
      <p className="text-[10px] text-slate-600 text-center">
        MTF test environment - no real charges
      </p>
    </div>
  );
}

function TokenCard({
  token,
  label,
  masked,
}: {
  token: string;
  label: string;
  masked?: boolean;
}) {
  const [revealed, setRevealed] = useState(!masked);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-xl p-5 animate-token-reveal">
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

export default function TryMode() {
  const [state, setState] = useState<DemoState>(initialState);

  const updateState = useCallback((updates: Partial<DemoState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Gateway Token Flow: Step 1 - CIT Payment + Create Token
  async function handleGatewayPay(data: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    amount: string;
  }) {
    updateState({ loading: true, error: null });
    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
  async function handleProvisionNetworkToken(data: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
  }) {
    updateState({ loading: true, error: null });
    try {
      const res = await fetch("/api/create-network-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      const tokenId =
        result.networkToken?.token ||
        result.networkToken?.deviceSpecificNumber ||
        null;
      updateState({
        ntStep: 1,
        ntToken: tokenId,
        ntTokenData: result.networkToken,
        ntApiLogs: result.apiLogs || [],
        loading: false,
        error: result.success ? null : "Network token provisioning response received - check API details",
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
        body: JSON.stringify({
          token: state.ntToken,
          amount,
        }),
      });
      const result = await res.json();
      updateState({
        ntStep: 2,
        ntPayResult: result,
        ntApiLogs: [...state.ntApiLogs, ...(result.apiLogs || [])],
        loading: false,
        error: result.success ? null : "Network token payment response received - check API details",
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
    <div className="animate-fade-in">
      {/* Flow Selector */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Error Display */}
      {state.error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-red-400">{state.error}</span>
          <button
            onClick={() => updateState({ error: null })}
            className="text-red-400/60 hover:text-red-400"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column: Interactive Demo */}
        <div className="space-y-6">
          {state.activeFlow === "gateway" ? (
            <GatewayFlow
              state={state}
              onPay={handleGatewayPay}
              onMITPay={handleMITPay}
            />
          ) : (
            <NetworkFlow
              state={state}
              onProvision={handleProvisionNetworkToken}
              onPay={handleNetworkTokenPay}
            />
          )}
        </div>

        {/* Right Column: API Payloads */}
        <div className="space-y-4">
          {activeApiLogs.length > 0 ? (
            <PayloadViewer logs={activeApiLogs} title="API Payloads" />
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-500">
                API request and response payloads will appear here
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Run a transaction to see the data
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Gateway Token Sub-Flow ─────────────────────────────────────────────

function GatewayFlow({
  state,
  onPay,
  onMITPay,
}: {
  state: DemoState;
  onPay: (data: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    amount: string;
  }) => void;
  onMITPay: (amount: string) => void;
}) {
  const [mitAmount, setMitAmount] = useState("5.00");

  return (
    <>
      <StepIndicator
        steps={["Pay & Tokenize", "Token Created", "MIT Payment"]}
        current={state.gwStep}
      />

      {/* Step 0: Card Input */}
      {state.gwStep === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">
            Step 1: Initial Card Payment (CIT)
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            Enter card details to make a payment and create a gateway token
          </p>
          <CardForm
            onSubmit={onPay}
            loading={state.loading}
            buttonLabel="Pay & Create Token"
          />
        </div>
      )}

      {/* Step 1: Token Created */}
      {state.gwStep >= 1 && (
        <div className="space-y-4 animate-slide-up">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">CIT Payment Result</h3>
              <ResultBadge success={state.gwCITResult?.success as boolean} />
            </div>
            {state.gwToken && (
              <TokenCard token={state.gwToken} label="Gateway Token" masked />
            )}
            {state.gwAgreementId && (
              <div className="mt-3 bg-slate-800/50 rounded-lg px-4 py-2.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Agreement ID
                </span>
                <p className="font-mono text-sm text-slate-300">
                  {state.gwAgreementId}
                </p>
              </div>
            )}
          </div>

          {/* Step 2: MIT Payment */}
          {state.gwStep === 1 && state.gwToken && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 animate-slide-up">
              <h3 className="text-white font-semibold mb-1">
                Step 2: Merchant Initiated Payment (MIT)
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                Charge the stored token without card details
              </p>
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
                  <label className="block text-xs text-slate-400 mb-1.5">
                    Amount (USD)
                  </label>
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

          {/* MIT Result */}
          {state.gwStep === 2 && state.gwMITResult && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">MIT Payment Result</h3>
                <ResultBadge
                  success={state.gwMITResult.success as boolean}
                />
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
  onProvision,
  onPay,
}: {
  state: DemoState;
  onProvision: (data: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
  }) => void;
  onPay: (amount: string) => void;
}) {
  const [payAmount, setPayAmount] = useState("15.00");

  return (
    <>
      <StepIndicator
        steps={["Provision Token", "Token Created", "Pay with DPAN"]}
        current={state.ntStep}
      />

      {/* Step 0: Card Input for Network Token */}
      {state.ntStep === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">
            Step 1: Provision Network Token
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            Enter card details to request a network token (DPAN) from the Token Service Provider
          </p>
          <CardForm
            onSubmit={(data) =>
              onProvision({
                cardNumber: data.cardNumber,
                expiryMonth: data.expiryMonth,
                expiryYear: data.expiryYear,
              })
            }
            loading={state.loading}
            buttonLabel="Provision Network Token"
            showCvv={false}
            showAmount={false}
          />
        </div>
      )}

      {/* Step 1: Network Token Provisioned */}
      {state.ntStep >= 1 && (
        <div className="space-y-4 animate-slide-up">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">
                Network Token Result
              </h3>
              <ResultBadge success={!!state.ntToken} />
            </div>
            {state.ntToken ? (
              <TokenCard
                token={state.ntToken}
                label="Network Token (DPAN)"
                masked
              />
            ) : (
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-yellow-400">
                  Network token provisioning returned a response. Check the API
                  payload for details. Note: MTF may have limited network token
                  support.
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Pay with Network Token */}
          {state.ntStep === 1 && state.ntToken && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 animate-slide-up">
              <h3 className="text-white font-semibold mb-1">
                Step 2: Pay with Network Token
              </h3>
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
                  <label className="block text-xs text-slate-400 mb-1.5">
                    Amount (USD)
                  </label>
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

          {/* Network Token Payment Result */}
          {state.ntStep === 2 && state.ntPayResult && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">
                  Network Token Payment Result
                </h3>
                <ResultBadge
                  success={state.ntPayResult.success as boolean}
                />
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
