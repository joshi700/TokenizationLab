"use client";

interface HeaderProps {
  mode: "learn" | "demo";
  onModeChange: (mode: "learn" | "demo") => void;
}

const modes = [
  { id: "learn" as const, label: "Learn", desc: "Visual explanations" },
  { id: "demo" as const, label: "Demo", desc: "Interactive demo & API" },
];

export default function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                TokenizationLab
              </h1>
            </div>
            <span className="text-[10px] font-semibold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
              MTF
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Mastercard Gateway
          </div>
        </div>
        <nav className="flex gap-1 -mb-px">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 ${
                mode === m.id
                  ? "border-orange-500 text-white"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
              }`}
            >
              <span>{m.label}</span>
              <span
                className={`ml-1.5 text-xs ${
                  mode === m.id ? "text-orange-400" : "text-slate-600"
                }`}
              >
                {m.desc}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
