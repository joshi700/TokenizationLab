"use client";

import { useState } from "react";
import Header from "@/components/Header";
import LearnMode from "@/components/LearnMode";
import DemoMode from "@/components/DemoMode";

type Mode = "learn" | "demo";

export default function Home() {
  const [mode, setMode] = useState<Mode>("learn");

  return (
    <div className="min-h-screen bg-slate-950">
      <Header mode={mode} onModeChange={setMode} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {mode === "learn" && <LearnMode />}
        {mode === "demo" && <DemoMode />}
      </main>
      <footer className="border-t border-slate-900 py-6 text-center">
        <p className="text-xs text-slate-600">
          TokenizationLab v1.0 | Mastercard Gateway MTF Environment | For demo
          and training purposes only
        </p>
      </footer>
    </div>
  );
}
