import React, { useState } from "react";
import { Database, Globe, Radio } from "lucide-react";

export interface PipelineStatusProps {
  provider: string;
  isHealthy: boolean;
  freshness: "fresh" | "stale" | "unavailable" | "unknown";
  lastSyncUtc: string | null;
  lastAttemptUtc?: string | null;
  lastAttemptStatus?: string | null;
  isFallback?: boolean;
  message?: string | null;
  geographicCoverage?: string | null;
  isSyncing?: boolean;
}

export function formatTimeDisplays(isoUtc: string | null): { local: string; utc: string } {
  if (!isoUtc) return { local: "Never", utc: "Never" };
  try {
    const d = new Date(isoUtc);
    if (isNaN(d.getTime())) return { local: isoUtc, utc: isoUtc };
    const utcStr = d.toISOString().replace(".000Z", "Z").replace("T", " ");
    const localStr = d.toLocaleString();
    return { local: localStr, utc: utcStr };
  } catch {
    return { local: isoUtc, utc: isoUtc };
  }
}

export const PipelineStatusPill: React.FC<PipelineStatusProps> = ({
  provider,
  isHealthy,
  freshness,
  lastSyncUtc,
  lastAttemptUtc,
  lastAttemptStatus,
  isFallback = false,
  message,
  geographicCoverage,
  isSyncing = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const syncTimes = formatTimeDisplays(lastSyncUtc);
  const attemptTimes = formatTimeDisplays(lastAttemptUtc || null);

  const getFreshnessBadge = () => {
    if (isSyncing) {
      return {
        label: "SYNCING",
        bg: "bg-cyan-500/20",
        border: "border-cyan-500/40",
        text: "text-cyan-300",
        dot: "bg-cyan-400 animate-pulse",
      };
    }
    switch (freshness) {
      case "fresh":
        return {
          label: "FRESH",
          bg: "bg-emerald-500/15",
          border: "border-emerald-500/40",
          text: "text-emerald-300",
          dot: "bg-emerald-400",
        };
      case "stale":
        return {
          label: "STALE",
          bg: "bg-amber-500/15",
          border: "border-amber-500/40",
          text: "text-amber-300",
          dot: "bg-amber-400",
        };
      case "unavailable":
        return {
          label: "UNAVAILABLE",
          bg: "bg-rose-500/15",
          border: "border-rose-500/40",
          text: "text-rose-300",
          dot: "bg-rose-400",
        };
      case "unknown":
      default:
        return {
          label: "UNKNOWN",
          bg: "bg-slate-500/15",
          border: "border-slate-500/40",
          text: "text-slate-300",
          dot: "bg-slate-400",
        };
    }
  };

  const badge = getFreshnessBadge();

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-orca-dark/90 border border-orca-border hover:border-slate-600 transition shadow-sm cursor-pointer text-left"
        title="Click to view provider freshness, timestamps, and pipeline audit details"
      >
        <Radio
          className={`w-3.5 h-3.5 ${
            isSyncing
              ? "text-cyan-400 animate-spin"
              : isHealthy
              ? "text-emerald-400 animate-pulse"
              : "text-rose-400"
          }`}
        />
        <div className="flex flex-col text-[10px]">
          <div className="flex items-center space-x-1.5 font-semibold leading-tight">
            <span className="text-slate-200">{provider}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full font-mono text-[9px] uppercase tracking-wider font-bold border ${badge.bg} ${badge.border} ${badge.text} flex items-center space-x-1`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              <span>{badge.label}</span>
            </span>
            {isFallback && (
              <span className="px-1.5 py-0.2 rounded-full font-mono text-[9px] uppercase font-bold border bg-amber-950/80 border-amber-600/60 text-amber-300 flex items-center space-x-1">
                <Database className="w-2.5 h-2.5 text-amber-400" />
                <span>FALLBACK</span>
              </span>
            )}
          </div>
          <span className="text-slate-400 font-mono text-[9px]">
            {lastSyncUtc ? `Synced: ${syncTimes.local}` : "No synced data"}
          </span>
        </div>
      </button>

      {/* Popover Details Modal/Drawer */}
      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50 p-4 rounded-xl bg-orca-card border border-slate-700 shadow-2xl backdrop-blur-xl text-xs text-slate-200 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-sm text-slate-100">{provider} Pipeline</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="space-y-2.5 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Freshness Evaluation:</span>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${badge.bg} ${badge.border} ${badge.text}`}>
                  {badge.label}
                </span>
                <span className="text-slate-300">
                  {freshness === "fresh" && "Persisted records satisfy configured threshold window."}
                  {freshness === "stale" && "Stored records exceed freshness threshold. Provider refresh needed."}
                  {freshness === "unavailable" && "Zero verified records currently persisted in PostgreSQL."}
                  {freshness === "unknown" && "Timestamp metadata insufficient for reliable freshness evaluation."}
                </span>
              </div>
            </div>

            {isFallback && (
              <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-700/60 text-amber-200 text-[10px] flex items-start space-x-2">
                <Database className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Persisted Fallback Active:</strong> Latest live refresh failed. Displayed records are verified historical/prior forecasts from PostgreSQL.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px] block">Last Sync (Local):</span>
                <span className="font-mono text-slate-200 text-[10px]">{syncTimes.local}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Last Sync (UTC):</span>
                <span className="font-mono text-slate-300 text-[10px]">{syncTimes.utc}</span>
              </div>
            </div>

            {lastAttemptUtc && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                <div>
                  <span className="text-slate-400 text-[10px] block">Last Attempt (UTC):</span>
                  <span className="font-mono text-slate-300 text-[10px]">{attemptTimes.utc}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Attempt Status:</span>
                  <span className={`font-mono text-[10px] font-bold uppercase ${lastAttemptStatus === "success" ? "text-emerald-400" : "text-amber-400"}`}>
                    {lastAttemptStatus || "Unknown"}
                  </span>
                </div>
              </div>
            )}

            {geographicCoverage && (
              <div className="pt-1 border-t border-slate-800">
                <span className="text-slate-400 text-[10px] block flex items-center space-x-1">
                  <Globe className="w-3 h-3 text-cyan-400 inline" />
                  <span>Geographic Coverage Limitation:</span>
                </span>
                <span className="text-slate-300 text-[10px] font-sans mt-0.5 block italic bg-slate-900/60 p-1.5 rounded border border-slate-800">
                  {geographicCoverage}
                </span>
              </div>
            )}

            {message && (
              <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 italic">
                &ldquo;{message}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
