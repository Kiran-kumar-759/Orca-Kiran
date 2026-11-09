import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Navigation,
  RefreshCw,
  Wind,
} from "lucide-react";
import { hazardApi } from "../api";
import {
  CycloneForecastPositionItem,
  CycloneForecastRunItem,
  CycloneForecastSyncResponse,
  CycloneProviderStatusResponse,
} from "../types";
import { PipelineStatusPill } from "./PipelineStatusPill";

function formatUtc(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toISOString().replace(".000Z", "Z").replace("T", " ");
  } catch {
    return isoString;
  }
}

function getWindCategory(knots: number | null): { label: string; color: string; badge: string } {
  if (knots === null) return { label: "Unknown", color: "text-slate-400", badge: "bg-slate-800" };
  if (knots < 34) return { label: "Tropical Depression", color: "text-teal-300", badge: "bg-teal-950 border-teal-800" };
  if (knots < 64) return { label: "Tropical Storm", color: "text-cyan-300", badge: "bg-cyan-950 border-cyan-800" };
  if (knots < 83) return { label: "Cat 1 Hurricane", color: "text-amber-300", badge: "bg-amber-950 border-amber-800" };
  if (knots < 96) return { label: "Cat 2 Hurricane", color: "text-orange-300", badge: "bg-orange-950 border-orange-800" };
  if (knots < 113) return { label: "Cat 3 Major Hurricane", color: "text-rose-400", badge: "bg-rose-950 border-rose-800" };
  if (knots < 137) return { label: "Cat 4 Major Hurricane", color: "text-rose-500", badge: "bg-rose-950 border-rose-700" };
  return { label: "Cat 5 Major Hurricane", color: "text-purple-400", badge: "bg-purple-950 border-purple-800" };
}

export const CycloneForecastPanel: React.FC = () => {
  const [runs, setRuns] = useState<CycloneForecastRunItem[]>([]);
  const [providerStatus, setProviderStatus] = useState<CycloneProviderStatusResponse | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<CycloneForecastSyncResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [selectedPositionIndex, setSelectedPositionIndex] = useState<number>(0);

  // Load runs and provider status from backend
  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resp, status] = await Promise.all([
        hazardApi.fetchCycloneForecastRuns(),
        hazardApi.fetchCycloneProviderStatus().catch(() => null),
      ]);
      setRuns(resp.items);
      if (status) setProviderStatus(status);
      if (resp.items.length > 0) {
        setSelectedRunId((prev) => {
          const exists = resp.items.some((r) => r.id === prev);
          return exists ? prev : resp.items[0].id;
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load cyclone forecast runs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await hazardApi.syncCycloneForecasts();
      setSyncResult(res);
      await loadRuns();
    } catch (err: any) {
      setSyncError(err.message || "NOAA NHC cyclone forecast sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId) || runs[0];
  const positions = selectedRun?.positions || [];
  const selectedPos: CycloneForecastPositionItem | undefined =
    positions[selectedPositionIndex] || positions[0];

  // SVG coordinate projection calculation for trajectory
  const mapProjection = useMemo(() => {
    if (positions.length === 0) return null;
    const lats = positions.map((p) => p.latitude);
    const lons = positions.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const padLat = Math.max(1.5, (maxLat - minLat) * 0.25);
    const padLon = Math.max(2.0, (maxLon - minLon) * 0.25);

    const latDomain = [minLat - padLat, maxLat + padLat];
    const lonDomain = [minLon - padLon, maxLon + padLon];

    const width = 640;
    const height = 360;

    const project = (lat: number, lon: number) => {
      const x = ((lon - lonDomain[0]) / (lonDomain[1] - lonDomain[0])) * width;
      // Invert Y for cartesian lat to SVG
      const y = height - ((lat - latDomain[0]) / (latDomain[1] - latDomain[0])) * height;
      return { x, y };
    };

    return { width, height, project, minLat, maxLat, minLon, maxLon };
  }, [positions]);

  return (
    <div className="flex flex-col space-y-6 w-full animate-fadeIn">
      {/* 1. Header Bar with NOAA Provider Info & Sync Action */}
      <div className="bg-orca-card/80 border border-orca-border rounded-xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-sm">
              <Navigation className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Official 5-Day Tropical Cyclone Trajectory Forecasts</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-mono">
                NOAA NHC (Verified)
              </span>
            </div>
            <p className="text-xs text-orca-muted mt-1">
              Genuine future predicted positions (TAU 0h to 120h), valid times, wind speeds, and classifications stored in PostgreSQL <code className="text-emerald-400 font-mono">orca_db</code>.
            </p>
          </div>

          {/* Sync Button & Status Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <PipelineStatusPill
              provider="NOAA NHC"
              isHealthy={providerStatus?.is_healthy ?? true}
              freshness={providerStatus?.freshness || "unknown"}
              lastSyncUtc={providerStatus?.last_sync_utc || (selectedRun ? selectedRun.retrieval_time : null)}
              lastAttemptUtc={providerStatus?.last_attempt_utc ?? null}
              lastAttemptStatus={providerStatus?.last_attempt_status ?? null}
              isFallback={providerStatus?.is_fallback || false}
              message={providerStatus?.message}
              geographicCoverage="Eastern Pacific, North Atlantic, Central Pacific (Note: Does not cover Indian Ocean)"
              isSyncing={isSyncing}
            />

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSync}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl border text-xs font-medium transition shadow-sm ${
                isSyncing
                  ? "bg-cyan-950/60 border-cyan-700/50 text-cyan-400 cursor-not-allowed opacity-75"
                  : "bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/50 text-cyan-200 active:scale-98 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Ingesting NOAA NHC..." : "Sync Cyclone Forecasts"}</span>
            </button>
          </div>
        </div>

        {/* Run Selector Pills */}
        {runs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-orca-border/70 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400 mr-1">Active Forecast Runs:</span>
            {runs.map((r) => {
              const isSelected = r.id === selectedRunId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRunId(r.id);
                    setSelectedPositionIndex(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center space-x-2 ${
                    isSelected
                      ? "bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm"
                      : "bg-orca-dark/70 border-orca-border text-slate-300 hover:text-slate-100 hover:border-slate-500"
                  }`}
                >
                  <span className="font-semibold">{r.storm_name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Adv #{r.advisory_number} ({r.basin})
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-mono">
                    {r.positions_count} pts
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Explicit Geographic Coverage Disclaimer */}
        <div className="mt-3 pt-3 border-t border-orca-border/50 text-[11px] text-slate-400 flex items-center space-x-2">
          <span className="font-semibold text-slate-300">Geographic Coverage Notice:</span>
          <span>NOAA NHC operational advisories cover the Eastern Pacific, North Atlantic, and Central Pacific. Indian Ocean cyclogenesis (IMD / RSMC New Delhi) is outside NHC forecast jurisdiction.</span>
        </div>
      </div>

      {/* Sync Feedback Banners */}
      {syncResult && (
        <div className="bg-emerald-950/80 border border-emerald-800/60 rounded-xl px-5 py-3 text-xs text-emerald-200 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>NOAA NHC Sync Succeeded:</strong> Ingested {syncResult.retrieved_runs_count} forecast advisory runs and {syncResult.inserted_positions_count} future forecast positions. Persisted in PostgreSQL.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300">
            Status: {syncResult.status}
          </span>
        </div>
      )}

      {/* Persisted Fallback Banner if upstream failed */}
      {(syncError || providerStatus?.is_fallback) && runs.length > 0 && (
        <div className="bg-amber-950/70 border border-amber-600/60 rounded-xl px-5 py-3 text-xs text-amber-200 flex items-start space-x-3 shadow-md animate-fadeIn">
          <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300">
              {syncError ? "Upstream Refresh Failed — Persisted Fallback Active" : "Persisted Fallback Mode Active"}
            </p>
            <p className="text-[11px] text-amber-200/90 mt-0.5">
              {syncError ? `${syncError}. ` : ""}
              Displaying {runs.length} previously persisted official cyclone advisory runs from PostgreSQL <code className="text-emerald-400 font-mono">orca_db</code>.
              {" "}Freshness: <span className="uppercase font-mono font-bold text-amber-300">{providerStatus?.freshness || "stale"}</span>
              {selectedRun && ` (Last Issue: ${formatUtc(selectedRun.issue_time)})`}.
            </p>
          </div>
        </div>
      )}

      {syncError && runs.length === 0 && (
        <div className="bg-rose-950/80 border border-rose-800/60 rounded-xl px-5 py-3 text-xs text-rose-200 flex items-center space-x-2 shadow-md">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span><strong>Sync Error:</strong> {syncError}. Zero active forecast runs currently in local database.</span>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-orca-navy/80 border border-orca-border rounded-xl p-12 text-center text-xs text-slate-400 shadow-lg">
          <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Querying persisted cyclone forecast runs from PostgreSQL...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-950/50 border border-rose-800/40 rounded-xl p-8 text-center text-xs text-rose-300">
          <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="bg-orca-navy/80 border border-orca-border rounded-xl p-12 text-center text-xs text-slate-400">
          <Navigation className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="font-semibold text-slate-300">No Cyclone Forecast Runs Currently Stored in PostgreSQL</p>
          <p className="text-orca-muted mt-1 max-w-md mx-auto">
            Click below to fetch active tropical cyclone advisories and future 5-day predicted waypoints directly from NOAA NHC.
          </p>
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSync}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition"
          >
            {isSyncing ? "Syncing..." : "Sync Active NOAA NHC Cyclone Forecasts"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* Left Column: Selected Run Details & Selected Waypoint Metrics (4 cols) */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            {/* Advisory Run Metadata Card */}
            <div className="bg-orca-navy/90 border border-orca-border rounded-xl p-5 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-orca-border/80">
                <div className="flex items-center space-x-2">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">Advisory Metadata</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  orca_db Persisted
                </span>
              </div>

              {selectedRun && (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-orca-border/50">
                    <span className="text-slate-400">Storm / Event:</span>
                    <span className="font-bold text-slate-100">{selectedRun.storm_name} ({selectedRun.storm_id})</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-orca-border/50">
                    <span className="text-slate-400">Advisory Number:</span>
                    <span className="font-mono text-cyan-300 font-semibold">#{selectedRun.advisory_number}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-orca-border/50">
                    <span className="text-slate-400">Oceanic Basin:</span>
                    <span className="capitalize text-slate-200">{selectedRun.basin.replace("_", " ")}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-orca-border/50">
                    <span className="text-slate-400">Official Issue Time:</span>
                    <span className="font-mono text-slate-200">{formatUtc(selectedRun.issue_time)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-orca-border/50">
                    <span className="text-slate-400">Forecast Horizon:</span>
                    <span className="font-mono text-emerald-300 font-semibold">5 Days (120 Hours)</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">Provider Source:</span>
                    <a
                      href={selectedRun.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center space-x-1"
                    >
                      <span>NOAA NHC Feed</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Waypoint Metric Card */}
            {selectedPos && (
              <div className="bg-orca-navy/90 border border-orca-border rounded-xl p-5 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 border-b border-orca-border/80">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Forecast Waypoint: TAU +{selectedPos.lead_time_hours}h
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Valid: {formatUtc(selectedPos.valid_time)}
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  {/* Category Banner */}
                  {(() => {
                    const cat = getWindCategory(selectedPos.max_wind_knots);
                    return (
                      <div className={`p-3 rounded-xl border ${cat.badge} flex items-center justify-between`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">Classification</span>
                          <span className={`text-sm font-bold ${cat.color}`}>{cat.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{selectedPos.stage_description || "Forecast Waypoint"}</span>
                        </div>
                        <Wind className={`w-6 h-6 ${cat.color} opacity-80`} />
                      </div>
                    );
                  })()}

                  {/* Wind & Pressure Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-orca-dark/70 border border-orca-border">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">Max Wind Speed</span>
                      <div className="flex items-baseline space-x-1 mt-1">
                        <span className="text-2xl font-bold font-mono text-cyan-300">
                          {selectedPos.max_wind_knots !== null ? selectedPos.max_wind_knots : "N/A"}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">knots</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-orca-dark/70 border border-orca-border">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">Peak Gusts</span>
                      <div className="flex items-baseline space-x-1 mt-1">
                        <span className="text-2xl font-bold font-mono text-amber-300">
                          {selectedPos.wind_gusts_knots !== null ? selectedPos.wind_gusts_knots : "N/A"}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">knots</span>
                      </div>
                    </div>
                  </div>

                  {/* Coordinates & Pressure */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-orca-card/50 border border-orca-border/60">
                      <span className="text-slate-400">Predicted Coordinates:</span>
                      <span className="font-mono text-slate-100 font-semibold">
                        {Math.abs(selectedPos.latitude).toFixed(2)}°{selectedPos.latitude >= 0 ? "N" : "S"},{" "}
                        {Math.abs(selectedPos.longitude).toFixed(2)}°{selectedPos.longitude >= 0 ? "E" : "W"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-orca-card/50 border border-orca-border/60">
                      <span className="text-slate-400">Central Pressure:</span>
                      <span className="font-mono text-slate-100">
                        {selectedPos.min_pressure_hpa !== null ? `${selectedPos.min_pressure_hpa} hPa` : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: 5-Day Trajectory Map & Chronological Positions Table (8 cols) */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            {/* SVG Cartographic Trajectory Map */}
            <div className="bg-orca-navy/90 border border-orca-border rounded-xl p-5 shadow-lg backdrop-blur-md flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-orca-border/80 text-xs">
                <div className="flex items-center space-x-2">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-semibold text-slate-100">
                    Predicted 5-Day Trajectory Track ({positions.length} Forecast Positions)
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] font-mono text-orca-muted">
                  <span className="w-2.5 h-0.5 border-t-2 border-dashed border-cyan-400 inline-block" />
                  <span>Dashed = Future Prediction</span>
                </div>
              </div>

              {/* Map Canvas */}
              <div className="mt-4 relative bg-orca-dark/90 rounded-xl border border-orca-border/80 overflow-hidden flex items-center justify-center p-3">
                {mapProjection && (
                  <svg
                    viewBox={`0 0 ${mapProjection.width} ${mapProjection.height}`}
                    className="w-full h-[320px] select-none"
                  >
                    {/* Background Grid Lines */}
                    {[0.25, 0.5, 0.75].map((ratio) => (
                      <g key={ratio} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3">
                        <line
                          x1={0}
                          y1={mapProjection.height * ratio}
                          x2={mapProjection.width}
                          y2={mapProjection.height * ratio}
                        />
                        <line
                          x1={mapProjection.width * ratio}
                          y1={0}
                          x2={mapProjection.width * ratio}
                          y2={mapProjection.height}
                        />
                      </g>
                    ))}

                    {/* Future Prediction Connecting Line (Dashed) */}
                    {positions.length > 1 && (
                      <path
                        d={positions
                          .map((p, idx) => {
                            const { x, y } = mapProjection.project(p.latitude, p.longitude);
                            return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Waypoint Markers */}
                    {positions.map((p, idx) => {
                      const { x, y } = mapProjection.project(p.latitude, p.longitude);
                      const isSelected = idx === selectedPositionIndex;
                      const markerColor =
                        (p.max_wind_knots || 0) >= 64 ? "#f43f5e" : (p.max_wind_knots || 0) >= 34 ? "#fbbf24" : "#2dd4bf";

                      return (
                        <g
                          key={p.id}
                          className="cursor-pointer group"
                          onClick={() => setSelectedPositionIndex(idx)}
                        >
                          {/* Pulsing ring if selected */}
                          {isSelected && (
                            <circle
                              cx={x}
                              y={y}
                              r="14"
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              strokeDasharray="3 3"
                              className="animate-spin"
                            />
                          )}

                          {/* Waypoint circle */}
                          <circle
                            cx={x}
                            y={y}
                            r={isSelected ? "7" : "5"}
                            fill={markerColor}
                            stroke="#0b1329"
                            strokeWidth="2"
                            className="transition-all hover:r-7"
                          />

                          {/* Label showing TAU lead time */}
                          <text
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                            fill="#cbd5e1"
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            +{p.lead_time_hours}h
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 text-[11px] text-slate-400">
                <span>Click any forecast waypoint to inspect predicted wind speed and time</span>
                <span className="font-mono text-emerald-400">Verified NOAA NHC Advisory Track</span>
              </div>
            </div>

            {/* Chronological Forecast Waypoints Table */}
            <div className="bg-orca-navy/90 border border-orca-border rounded-xl p-4 shadow-lg backdrop-blur-md flex flex-col max-h-[280px]">
              <div className="flex items-center justify-between pb-2 border-b border-orca-border/80 text-xs">
                <span className="font-semibold text-slate-200">Chronological Forecast Waypoints (TAU 0h - 120h)</span>
                <span className="text-[10px] text-orca-muted font-mono">Sorted by Lead Time</span>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar mt-2">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-orca-dark text-slate-400 font-semibold border-b border-orca-border">
                    <tr>
                      <th className="py-1.5 px-2">Lead Time</th>
                      <th className="py-1.5 px-2">Valid Time (UTC)</th>
                      <th className="py-1.5 px-2">Position</th>
                      <th className="py-1.5 px-2">Max Wind</th>
                      <th className="py-1.5 px-2">Gusts</th>
                      <th className="py-1.5 px-2">Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orca-border/40 font-mono text-slate-300">
                    {positions.map((p, i) => (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPositionIndex(i)}
                        className={`cursor-pointer hover:bg-cyan-950/30 transition ${
                          i === selectedPositionIndex ? "bg-cyan-950/60 text-cyan-200 font-semibold" : ""
                        }`}
                      >
                        <td className="py-1.5 px-2 text-cyan-300">+{p.lead_time_hours}h</td>
                        <td className="py-1.5 px-2">{formatUtc(p.valid_time)}</td>
                        <td className="py-1.5 px-2">
                          {p.latitude.toFixed(1)}°N, {Math.abs(p.longitude).toFixed(1)}°W
                        </td>
                        <td className="py-1.5 px-2 text-amber-300">
                          {p.max_wind_knots !== null ? `${p.max_wind_knots} kts` : "-"}
                        </td>
                        <td className="py-1.5 px-2">
                          {p.wind_gusts_knots !== null ? `${p.wind_gusts_knots} kts` : "-"}
                        </td>
                        <td className="py-1.5 px-2 text-slate-300">{p.stage_description || p.classification || "Forecast"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
