"use client";

import { useState } from "react";

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
    title: "Create Gateway Token",
    method: "POST",
    path: "/api/rest/version/{version}/merchant/{merchantId}/token",
    description:
      "Creates a gateway token from card details. The token maps to the card in a secure vault and can be used for future payments.",
    requestBody: {
      sourceOfFunds: {
        provided: {
          card: {
            number: "5123450000000008",
            expiry: { month: "05", year: "25" },
          },
        },
      },
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
      {
        field: "sourceOfFunds.provided.card.number",
        description: "Full PAN (card number)",
      },
      {
        field: "sourceOfFunds.provided.card.expiry",
        description: "Card expiry month and year",
      },
      { field: "token", description: "Gateway token ID returned" },
      { field: "status", description: "Token validity status" },
    ],
  },
  {
    title: "CIT Payment (Card)",
    method: "PUT",
    path: "/api/rest/version/{version}/merchant/{merchantId}/order/{orderId}/transaction/{txnId}",
    description:
      "Customer-initiated transaction (CIT) using card details. Establishes a recurring agreement for future MIT payments.",
    requestBody: {
      apiOperation: "PAY",
      order: { amount: "10.00", currency: "USD", reference: "ORD-xxx" },
      sourceOfFunds: {
        type: "CARD",
        provided: {
          card: {
            number: "5123450000000008",
            expiry: { month: "05", year: "25" },
            securityCode: "100",
          },
        },
      },
      transaction: { source: "INTERNET", reference: "TXN-xxx" },
      agreement: { type: "RECURRING", id: "AGR-xxx" },
    },
    responseExample: {
      result: "SUCCESS",
      order: {
        amount: 10.0,
        currency: "USD",
        id: "ORD-xxx",
        status: "CAPTURED",
        totalAuthorizedAmount: 10.0,
        totalCapturedAmount: 10.0,
      },
      response: { acquirerCode: "00", gatewayCode: "APPROVED" },
      transaction: { type: "PAYMENT", receipt: "123456789" },
    },
    fields: [
      {
        field: "apiOperation",
        description: "PAY - authorize and capture in one step",
      },
      {
        field: "sourceOfFunds.type",
        description: "CARD - paying with card details",
      },
      {
        field: "transaction.source",
        description: "INTERNET - customer initiated online",
      },
      {
        field: "agreement.type",
        description:
          "RECURRING - establishes recurring agreement for future MIT",
      },
      {
        field: "agreement.id",
        description: "Unique agreement ID for linking future MIT transactions",
      },
    ],
  },
  {
    title: "MIT Payment (Token)",
    method: "PUT",
    path: "/api/rest/version/{version}/merchant/{merchantId}/order/{orderId}/transaction/{txnId}",
    description:
      "Merchant-initiated transaction (MIT) using a stored gateway token. No card details or CVV required.",
    requestBody: {
      apiOperation: "PAY",
      order: { amount: "5.00", currency: "USD", reference: "ORD-xxx" },
      sourceOfFunds: { type: "CARD", token: "9876543210987654" },
      transaction: { source: "MERCHANT", reference: "TXN-xxx" },
      agreement: { type: "RECURRING", id: "AGR-xxx" },
    },
    responseExample: {
      result: "SUCCESS",
      order: {
        amount: 5.0,
        currency: "USD",
        status: "CAPTURED",
      },
      response: { acquirerCode: "00", gatewayCode: "APPROVED" },
      sourceOfFunds: { token: "9876543210987654", type: "CARD" },
    },
    fields: [
      {
        field: "sourceOfFunds.token",
        description: "Gateway token ID - replaces card number",
      },
      {
        field: "transaction.source",
        description: "MERCHANT - merchant initiated (no cardholder present)",
      },
      {
        field: "agreement.id",
        description:
          "Must match the agreement ID from the original CIT transaction",
      },
    ],
  },
  {
    title: "Provision Network Token",
    method: "POST",
    path: "/api/rest/version/{version}/merchant/{merchantId}/token",
    description:
      "Requests a network token (DPAN) from the card network's Token Service Provider. The DPAN auto-updates when the underlying card is replaced or expires.",
    requestBody: {
      sourceOfFunds: {
        provided: {
          card: {
            number: "5123450000000008",
            expiry: { month: "05", year: "25" },
          },
        },
      },
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
      {
        field: "networkTokenization.enabled",
        description: "Requests a network-level token instead of gateway token",
      },
      {
        field: "token",
        description: "The DPAN (Device PAN) - network token",
      },
      {
        field: "type",
        description: "SCHEME_TOKEN indicates a network token",
      },
    ],
  },
  {
    title: "Pay with Network Token",
    method: "PUT",
    path: "/api/rest/version/{version}/merchant/{merchantId}/order/{orderId}/transaction/{txnId}",
    description:
      "Payment using a network token (DPAN). The sourceOfFunds type is SCHEME_TOKEN instead of CARD.",
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
      {
        field: "sourceOfFunds.type",
        description: "SCHEME_TOKEN - paying with network token (DPAN)",
      },
      {
        field: "sourceOfFunds.token",
        description: "The DPAN from network token provisioning",
      },
    ],
  },
];

function EndpointCard({ endpoint }: { endpoint: EndpointDoc }) {
  const [activeTab, setActiveTab] = useState<"request" | "response" | "fields">(
    "request"
  );
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
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`px-2.5 py-0.5 text-[10px] font-bold rounded border ${methodColor} uppercase tracking-wider`}
          >
            {endpoint.method}
          </span>
          <h3 className="text-white font-semibold">{endpoint.title}</h3>
        </div>
        <p className="font-mono text-xs text-slate-500 mb-2 break-all">
          {endpoint.path}
        </p>
        <p className="text-xs text-slate-400">{endpoint.description}</p>
      </div>

      <div className="border-b border-slate-800 px-5 py-2 flex items-center gap-1">
        {(["request", "response", "fields"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs rounded-md capitalize transition-colors ${
              activeTab === tab
                ? tab === "request"
                  ? "bg-blue-500/20 text-blue-400"
                  : tab === "response"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-purple-500/20 text-purple-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "fields" ? (
        <div className="p-5 space-y-3">
          {endpoint.fields.map((f) => (
            <div key={f.field} className="flex gap-3">
              <code className="text-xs font-mono text-orange-400 shrink-0 bg-slate-800/50 px-2 py-0.5 rounded">
                {f.field}
              </code>
              <span className="text-xs text-slate-400">{f.description}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto max-h-[350px] overflow-y-auto leading-relaxed">
            {content}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md border border-slate-700 transition-colors"
          >
            {copied ? "Copied!" : "Copy JSON"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DeveloperMode() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">API Reference</h2>
        <p className="text-slate-400 mb-2">
          Mastercard Gateway REST API endpoints for tokenization
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            Base URL:{" "}
            <code className="text-slate-400">
              https://na.gateway.mastercard.com/api/rest/version/81/merchant/
              {"<merchantId>"}
            </code>
          </span>
          <span>Auth: Basic HTTP</span>
        </div>
      </div>

      <div className="space-y-6">
        {endpoints.map((ep) => (
          <EndpointCard key={ep.title} endpoint={ep} />
        ))}
      </div>

      {/* Quick Reference */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">Quick Reference</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">
              Transaction Source Types
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                <code className="text-orange-400">INTERNET</code>
                <span className="text-slate-400">Customer initiated (CIT)</span>
              </div>
              <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                <code className="text-emerald-400">MERCHANT</code>
                <span className="text-slate-400">
                  Merchant initiated (MIT)
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">
              Source of Funds Types
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                <code className="text-orange-400">CARD</code>
                <span className="text-slate-400">
                  Card or gateway token
                </span>
              </div>
              <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                <code className="text-blue-400">SCHEME_TOKEN</code>
                <span className="text-slate-400">
                  Network token (DPAN)
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">
              Agreement Types
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                <code className="text-orange-400">RECURRING</code>
                <span className="text-slate-400">
                  Scheduled recurring payments
                </span>
              </div>
              <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                <code className="text-yellow-400">UNSCHEDULED</code>
                <span className="text-slate-400">
                  Unscheduled charges
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">
              Test Cards (MTF)
            </h4>
            <div className="space-y-2 text-xs">
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
  );
}
