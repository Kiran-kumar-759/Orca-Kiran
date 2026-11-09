import React from "react";
import { Wind, Gauge, Calendar, MapPin, Database, Activity, ShieldCheck } from "lucide-react";
import { HazardEvent, HazardStatsResponse } from "../types";

interface Props {
  selectedEvent: HazardEvent | null;
  stats: HazardStatsResponse | null;
  isLoadingStats: boolean;
}

export const CycloneDetailPanel: React.FC<Props> = ({
  selectedEvent,
  stats,
  isLoadingStats,
}) => {
  if (!selectedEvent) {
    return (
      <div className="rounded-xl border border-orca-border bg-orca-navy/60 p-6 text-center text-slate-400">
        <Activity className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <h4 className="text-sm font-medium text-slate-300">No Cyclone Selected</h4>
        <p className="text-xs mt-1 text-slate-400">
          Select a cyclone from the list to inspect its verified historical observations.
        </p>
      </div>
    );
  }

  const formatUtcDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "N/A" : d.toUTCString();
  };

  return (
    <div className="rounded-xl border border-orca-border bg-orca-navy/80 p-5 space-y-4 shadow-lg backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-orca-border/80 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold text-slate-100">{selectedEvent.name}</h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
              {selectedEvent.hazard_id}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
            <span className="flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span className="capitalize">{selectedEvent.basin?.replace("_", " ") || "North Indian Ocean"}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>{selectedEvent.source}</span>
            </span>
          </div>
        </div>
        {selectedEvent.status === "active" ? (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 ${
              (selectedEvent.metadata_json?.alert_level || "").toLowerCase() === "red"
                ? "bg-rose-950/80 text-rose-300 border border-rose-800/60 shadow-[0_0_10px_rgba(244,63,94,0.25)]"
                : (selectedEvent.metadata_json?.alert_level || "").toLowerCase() === "orange"
                ? "bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>
              {selectedEvent.metadata_json?.alert_level
                ? `${selectedEvent.metadata_json.alert_level} Alert`
                : "Active Alert"}
            </span>
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Historical Verified</span>
          </span>
        )}
      </div>

      {/* Derived Aggregate Statistics */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Observed Intensity (Derived from Track Records)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Max Wind */}
          <div className="rounded-lg bg-orca-card/60 border border-orca-border p-2.5">
            <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <span>Peak Wind</span>
            </div>
            <div className="text-base font-bold text-slate-100 mt-1">
              {isLoadingStats ? (
                <span className="animate-pulse text-xs text-slate-500">Computing...</span>
              ) : stats?.max_wind_knots !== null && stats?.max_wind_knots !== undefined ? (
                <span>
                  {stats.max_wind_knots} <span className="text-xs font-normal text-slate-400">kts</span>
                </span>
              ) : (
                <span className="text-slate-400 text-xs">N/A</span>
              )}
            </div>
          </div>

          {/* Min Pressure */}
          <div className="rounded-lg bg-orca-card/60 border border-orca-border p-2.5">
            <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
              <Gauge className="w-3.5 h-3.5 text-teal-400" />
              <span>Min Pressure</span>
            </div>
            <div className="text-base font-bold text-slate-100 mt-1">
              {isLoadingStats ? (
                <span className="animate-pulse text-xs text-slate-500">Computing...</span>
              ) : stats?.min_pressure_hpa !== null && stats?.min_pressure_hpa !== undefined ? (
                <span>
                  {stats.min_pressure_hpa} <span className="text-xs font-normal text-slate-400">hPa</span>
                </span>
              ) : (
                <span className="text-slate-400 text-xs">N/A</span>
              )}
            </div>
          </div>

          {/* Track Points Count */}
          <div className="rounded-lg bg-orca-card/60 border border-orca-border p-2.5">
            <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>{selectedEvent.status === "active" ? "Advisory Fixes" : "Track Fixes"}</span>
            </div>
            <div className="text-base font-bold text-slate-100 mt-1">
              {stats?.track_points_count ?? selectedEvent.track_points.length}{" "}
              <span className="text-xs font-normal text-slate-400">
                {selectedEvent.status === "active" ? "active fix" : "fixes"}
              </span>
            </div>
          </div>

          {/* Observed Categories */}
          <div className="rounded-lg bg-orca-card/60 border border-orca-border p-2.5">
            <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Max Category</span>
            </div>
            <div className="text-xs font-semibold text-purple-300 mt-1 truncate">
              {stats?.categories_observed?.length
                ? stats.categories_observed[stats.categories_observed.length - 1]
                : "Standard"}
            </div>
          </div>
        </div>
      </div>

      {/* Temporal Observation Window */}
      <div className="rounded-lg bg-orca-dark/70 border border-orca-border/60 p-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center space-x-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>First Observed:</span>
          </span>
          <span className="font-mono text-[11px] text-slate-200">
            {formatUtcDate(selectedEvent.first_observed)}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center space-x-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-teal-400" />
            <span>Last Observed:</span>
          </span>
          <span className="font-mono text-[11px] text-slate-200">
            {formatUtcDate(selectedEvent.last_observed)}
          </span>
        </div>
      </div>

      {/* Provenance Footer */}
      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-orca-border/50">
        {selectedEvent.source === "GDACS" ? (
          <>
            <span className="text-cyan-300 font-mono">
              Source: Global Disaster Alert & Coordination System (GDACS UN/EU)
            </span>
            {selectedEvent.metadata_json?.report_url && (
              <a
                href={selectedEvent.metadata_json.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline font-medium"
              >
                View Official GDACS Report ↗
              </a>
            )}
          </>
        ) : (
          <>
            <span>Dataset: NOAA NCEI IBTrACS NI Archive (v04r01)</span>
            <span className="text-slate-400 italic">No forecast extrapolation</span>
          </>
        )}
      </div>
    </div>
  );
};
