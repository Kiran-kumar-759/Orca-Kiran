import React, { useEffect, useState } from "react";
import { Waves, Cpu } from "lucide-react";
import { apiClient } from "../../lib/api-client";

export const Header: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<string>("checking");
  const [activeProvider, setActiveProvider] = useState<string>("Groq");

  useEffect(() => {
    apiClient
      .healthCheck()
      .then((data) => {
        setHealthStatus(data.status || "healthy");
        if (data.providers?.groq === "configured") setActiveProvider("Groq Llama-3.3");
        else if (data.providers?.gemini === "configured") setActiveProvider("Gemini 1.5 Flash");
        else if (data.providers?.openrouter === "configured") setActiveProvider("OpenRouter");
        else setActiveProvider("Deterministic Core");
      })
      .catch(() => {
        setHealthStatus("offline");
      });
  }, []);

  return (
    <header className="border-b border-orca-border bg-orca-dark/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Waves className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
              ORCA
            </h1>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
              Platform v1.0
            </span>
          </div>
          <p className="text-xs text-orca-muted">Open-Source Marine & Coastal Intelligence</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Active Provider Indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-orca-navy/80 border border-orca-border text-xs text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-orca-muted">AI Provider:</span>
          <span className="font-medium text-cyan-300">{activeProvider}</span>
        </div>

        {/* System Health Indicator */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-orca-navy/80 border border-orca-border text-xs">
          <div
            className={`w-2 h-2 rounded-full ${
              healthStatus === "healthy"
                ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                : healthStatus === "offline"
                ? "bg-rose-500"
                : "bg-amber-400"
            }`}
          />
          <span className="capitalize text-slate-300">{healthStatus}</span>
        </div>
      </div>
    </header>
  );
};
