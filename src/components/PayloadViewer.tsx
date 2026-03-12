"use client";

import { useState } from "react";

interface ApiLog {
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

interface PayloadViewerProps {
  logs: ApiLog[];
  title?: string;
}

export default function PayloadViewer({ logs, title }: PayloadViewerProps) {
  const [selectedLog, setSelectedLog] = useState(0);
  const [activeTab, setActiveTab] = useState<"request" | "response">("request");
  const [copied, setCopied] = useState(false);

  if (logs.length === 0) return null;

  const log = logs[selectedLog];
  const content =
    activeTab === "request"
      ? JSON.stringify(log.request.body, null, 2)
      : JSON.stringify(log.response.body, null, 2);

  const statusColor =
    log.response.status < 300
      ? "text-emerald-400"
      : log.response.status < 500
      ? "text-yellow-400"
      : "text-red-400";

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}

      {logs.length > 1 && (
        <div className="px-4 py-2 border-b border-slate-800 flex gap-2 overflow-x-auto">
          {logs.map((l, i) => (
            <button
              key={i}
              onClick={() => { setSelectedLog(i); setActiveTab("request"); }}
              className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                selectedLog === i
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {l.step}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">
            {log.request.method}
          </span>
          <span className="text-xs font-mono text-slate-400 truncate max-w-[300px]">
            {log.request.url.replace(/https:\/\/[^/]+/, "")}
          </span>
          <span className={`text-xs font-mono font-bold ${statusColor}`}>
            {log.response.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("request")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              activeTab === "request"
                ? "bg-blue-500/20 text-blue-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Request
          </button>
          <button
            onClick={() => setActiveTab("response")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              activeTab === "response"
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Response
          </button>
        </div>
      </div>

      <div className="relative">
        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">
          {content}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md border border-slate-700 transition-colors"
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>
    </div>
  );
}
