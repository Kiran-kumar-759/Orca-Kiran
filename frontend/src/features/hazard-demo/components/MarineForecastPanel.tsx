import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Clock,
  Compass,
  Database,
  MapPin,
  RefreshCw,
  Waves,
  Wind,
} from "lucide-react";
import { hazardApi } from "../api";
import {
  MarineForecastItem,
  MarineForecastResponse,
  MarineForecastSyncResponse,
  MarineProviderStatusResponse,
} from "../types";
import { PipelineStatusPill } from "./PipelineStatusPill";

interface LocationPreset {
  name: string;
  latitude: number;
  longitude: number;
  region: string;
}

const LOCATION_PRESETS: LocationPreset[] = [
  { name: "Mangaluru Coast", latitude: 12.91, longitude: 74.85, region: "Karnataka / Arabian Sea" },
  { name: "Mumbai Harbour", latitude: 18.92, longitude: 72.83, region: "Maharashtra / Arabian Sea" },
  { name: "Chennai Port", latitude: 13.08, longitude: 80.27, region: "Tamil Nadu / Bay of Bengal" },
  { name: "Visakhapatnam", latitude: 17.68, longitude: 83.21, region: "Andhra Pradesh / Bay of Bengal" },
  { name: "Kochi Port", latitude: 9.93, longitude: 76.26, region: "Kerala / Arabian Sea" },
];

function getSeaState(waveHeight: number | null): { label: string; color: string; bg: string } {
  if (waveHeight === null) return { label: "Unknown", color: "text-slate-400", bg: "bg-slate-800/40" };
  if (waveHeight < 0.5) return { label: "Calm (Rippled)", color: "text-cyan-300", bg: "bg-cyan-950/60" };
  if (waveHeight < 1.25) return { label: "Smooth / Slight", color: "text-emerald-300", bg: "bg-emerald-950/60" };
  if (waveHeight < 2.5) return { label: "Moderate", color: "text-amber-300", bg: "bg-amber-950/60" };
  if (waveHeight < 4.0) return { label: "Rough", color: "text-orange-300", bg: "bg-orange-950/60" };
  return { label: "Very High / Hazardous", color: "text-rose-400", bg: "bg-rose-950/60" };
}

function formatUtc(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toISOString().replace(".000Z", "Z").replace("T", " ");
  } catch {
    return isoString;
  }
}

export const MarineForecastPanel: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<string>("Mangaluru Coast");
  const [latitude, setLatitude] = useState<number>(12.91);
  const [longitude, setLongitude] = useState<number>(74.85);
  const [forecastDays, setForecastDays] = useState<number>(3);

  const [forecastData, setForecastData] = useState<MarineForecastResponse | null>(null);
  const [providerStatus, setProviderStatus] = useState<MarineProviderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [queryError, setQueryError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<MarineForecastSyncResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);

  // Fetch persisted forecast records and provider health from backend database
  const loadForecasts = useCallback(async (lat: number, lon: number, days: number) => {
    setIsLoading(true);
    setQueryError(null);
    try {
      const limit = days * 24;
      const [resp, status] = await Promise.all([
        hazardApi.fetchMarineForecasts(lat, lon, 0.5, limit),
        hazardApi.fetchMarineProviderStatus(lat, lon).catch(() => null),
      ]);
      setForecastData(resp);
      if (status) setProviderStatus(status);
      setSelectedPointIndex(0);
    } catch (err: any) {
      setQueryError(err.message || "Failed to query marine forecasts from database");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForecasts(latitude, longitude, forecastDays);
  }, [latitude, longitude, forecastDays, loadForecasts]);

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = LOCATION_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setLatitude(preset.latitude);
      setLongitude(preset.longitude);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await hazardApi.syncMarineForecasts({
        latitude,
        longitude,
        forecast_days: forecastDays,
      });
      setSyncResult(res);
      // Refresh DB data
      await loadForecasts(latitude, longitude, forecastDays);
    } catch (err: any) {
      setSyncError(err.message || "Open-Meteo Marine ingestion failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const items = forecastData?.items || [];
  const currentPoint: MarineForecastItem | undefined = items[selectedPointIndex] || items[0];
  const maxWaveHeight = Math.max(...items.map((i) => i.wave_height_m || 0), 1.0);

  return (
    <div className="flex flex-col space-y-6 w-full animate-fadeIn">
      {/* 1. Header & Location Controls Bar */}
      <div className="bg-orca-card/80 border border-orca-border rounded-xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-sm">
              <Waves className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Marine Wave & Sea-State Forecasts</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-mono">
                Open-Meteo Marine
              </span>
            </div>
            <p className="text-xs text-orca-muted mt-1">
              Hourly significant wave height, direction, swell, and wind-wave forecasts persisted in PostgreSQL <code className="text-emerald-400 font-mono">orca_db</code>.
            </p>
          </div>

          {/* Sync Ingestion Button & Status Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <PipelineStatusPill
              provider="Open-Meteo"
              isHealthy={providerStatus?.is_healthy ?? true}
              freshness={forecastData?.freshness || providerStatus?.freshness || "unknown"}
              lastSyncUtc={forecastData?.last_retrieved_utc || providerStatus?.last_sync_utc || null}
              lastAttemptUtc={providerStatus?.last_attempt_utc ?? null}
              lastAttemptStatus={providerStatus?.last_attempt_status ?? null}
              isFallback={forecastData?.is_fallback || providerStatus?.is_fallback || false}
              message={providerStatus?.message}
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
              <span>{isSyncing ? "Ingesting Open-Meteo..." : "Sync Marine Forecast"}</span>
            </button>
          </div>
        </div>

        {/* Location & Horizon Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4 pt-4 border-t border-orca-border/70 text-xs">
          {/* Preset Selector */}
          <div className="md:col-span-4 flex flex-col space-y-1">
            <label className="text-[11px] font-medium text-slate-300 flex items-center space-x-1">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>Location Preset</span>
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="bg-orca-dark border border-orca-border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
            >
              {LOCATION_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.region})
                </option>
              ))}
              <option value="custom">Custom Coordinates</option>
            </select>
          </div>

          {/* Latitude */}
          <div className="md:col-span-3 flex flex-col space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Latitude (°N/S)</label>
            <input
              type="number"
              step="0.01"
              min="-90"
              max="90"
              value={latitude}
              onChange={(e) => {
                setSelectedPreset("custom");
                setLatitude(parseFloat(e.target.value) || 0);
              }}
              className="bg-orca-dark border border-orca-border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs font-mono"
            />
          </div>

          {/* Longitude */}
          <div className="md:col-span-3 flex flex-col space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Longitude (°E/W)</label>
            <input
              type="number"
              step="0.01"
              min="-180"
              max="180"
              value={longitude}
              onChange={(e) => {
                setSelectedPreset("custom");
                setLongitude(parseFloat(e.target.value) || 0);
              }}
              className="bg-orca-dark border border-orca-border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs font-mono"
            />
          </div>

          {/* Horizon Selector */}
          <div className="md:col-span-2 flex flex-col space-y-1">
            <label className="text-[11px] font-medium text-slate-300 flex items-center space-x-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Horizon</span>
            </label>
            <select
              value={forecastDays}
              onChange={(e) => setForecastDays(parseInt(e.target.value, 10))}
              className="bg-orca-dark border border-orca-border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
            >
              <option value="1">1 Day (24h)</option>
              <option value="3">3 Days (72h)</option>
              <option value="5">5 Days (120h)</option>
              <option value="7">7 Days (168h)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Feedback Banners */}
      {syncResult && (
        <div className="bg-emerald-950/80 border border-emerald-800/60 rounded-xl px-5 py-3 text-xs text-emerald-200 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Open-Meteo Sync Succeeded:</strong> Ingested {syncResult.retrieved_count} hourly forecast points ({syncResult.inserted_count} new, {syncResult.updated_count} updated, {syncResult.unchanged_count} unchanged). Persisted in PostgreSQL.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300">
            Status: {syncResult.status}
          </span>
        </div>
      )}

      {/* Persisted Fallback Banner if upstream failed */}
      {(syncError || forecastData?.is_fallback) && items.length > 0 && (
        <div className="bg-amber-950/70 border border-amber-600/60 rounded-xl px-5 py-3 text-xs text-amber-200 flex items-start space-x-3 shadow-md animate-fadeIn">
          <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300">
              {syncError ? "Upstream Refresh Failed — Persisted Fallback Active" : "Persisted Fallback Mode"}
            </p>
            <p className="text-[11px] text-amber-200/90 mt-0.5">
              {syncError ? `${syncError}. ` : ""}
              Displaying {items.length} previously persisted forecast records from PostgreSQL <code className="text-emerald-400 font-mono">orca_db</code>.
              {" "}Freshness: <span className="uppercase font-mono font-bold text-amber-300">{forecastData?.freshness || "stale"}</span>
              {forecastData?.last_retrieved_utc && ` (Retrieved: ${formatUtc(forecastData.last_retrieved_utc)})`}.
            </p>
          </div>
        </div>
      )}

      {syncError && items.length === 0 && (
        <div className="bg-rose-950/80 border border-rose-800/60 rounded-xl px-5 py-3 text-xs text-rose-200 flex items-center space-x-2 shadow-md">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span><strong>Sync Error:</strong> {syncError}. No persisted fallback data exists for these coordinates.</span>
        </div>
      )}

      {/* 2. Main Content Grid */}
      {isLoading ? (
        <div className="bg-orca-navy/80 border border-orca-border rounded-xl p-12 text-center text-xs text-slate-400 shadow-lg">
          <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Querying persisted marine forecasts from PostgreSQL...</p>
        </div>
      ) : queryError ? (
        <div className="bg-rose-950/50 border border-rose-800/40 rounded-xl p-8 text-center text-xs text-rose-300">
          <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
          <p className="font-semibold">{queryError}</p>
          <button
            type="button"
            onClick={handleSync}
            className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs hover:bg-cyan-500/30 transition"
          >
            Trigger Initial Sync for this Location
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-orca-navy/80 border border-orca-border rounded-xl p-12 text-center text-xs text-slate-400">
          <Waves className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="font-semibold text-slate-300">No Persisted Forecasts Near ({latitude.toFixed(2)}, {longitude.toFixed(2)})</p>
          <p className="text-orca-muted mt-1 max-w-md mx-auto">
            No forecast points currently exist in PostgreSQL <code className="text-emerald-400">orca_db</code> within 0.5° radius. Click below to fetch real data from Open-Meteo Marine.
          </p>
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSync}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition"
          >
            {isSyncing ? "Syncing..." : "Sync Real Open-Meteo Marine Forecast"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* Left Column: Current Point Wave Summary Card (4 cols) */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            <div className="bg-orca-navy/90 border border-orca-border rounded-xl p-5 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-orca-border/80">
                <div className="flex items-center space-x-2">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">Point Sea-State</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  PostgreSQL Verified
                </span>
              </div>

              {currentPoint && (
                <div className="mt-4 space-y-4">
                  {/* Sea State Status Banner */}
                  {(() => {
                    const st = getSeaState(currentPoint.wave_height_m);
                    return (
                      <div className={`p-3 rounded-xl border border-orca-border ${st.bg} flex items-center justify-between`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">Sea State</span>
                          <span className={`text-sm font-bold ${st.color}`}>{st.label}</span>
                        </div>
                        <Waves className={`w-6 h-6 ${st.color} opacity-80`} />
                      </div>
                    );
                  })()}

                  {/* Primary Wave Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-orca-dark/70 border border-orca-border">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">Significant Wave Ht</span>
                      <div className="flex items-baseline space-x-1 mt-1">
                        <span className="text-2xl font-bold font-mono text-cyan-300">
                          {currentPoint.wave_height_m !== null ? currentPoint.wave_height_m.toFixed(2) : "N/A"}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">meters</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-orca-dark/70 border border-orca-border">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">Wave Period</span>
                      <div className="flex items-baseline space-x-1 mt-1">
                        <span className="text-2xl font-bold font-mono text-slate-100">
                          {currentPoint.wave_period_s !== null ? currentPoint.wave_period_s.toFixed(1) : "N/A"}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">sec</span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Metrics: Direction, Wind Wave, Swell Wave */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-orca-card/50 border border-orca-border/60">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Wave Direction</span>
                      </div>
                      <div className="flex items-center space-x-1 font-mono text-slate-200">
                        <span>{currentPoint.wave_direction_deg !== null ? `${Math.round(currentPoint.wave_direction_deg)}°` : "N/A"}</span>
                        {currentPoint.wave_direction_deg !== null && (
                          <ArrowUp
                            className="w-3.5 h-3.5 text-cyan-400 inline"
                            style={{ transform: `rotate(${currentPoint.wave_direction_deg}deg)` }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-orca-card/50 border border-orca-border/60">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <Wind className="w-3.5 h-3.5 text-amber-400" />
                        <span>Wind Wave Height</span>
                      </div>
                      <span className="font-mono text-slate-200">
                        {currentPoint.wind_wave_height_m !== null ? `${currentPoint.wind_wave_height_m.toFixed(2)} m` : "N/A"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-orca-card/50 border border-orca-border/60">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <Waves className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Swell Wave Height</span>
                      </div>
                      <span className="font-mono text-slate-200">
                        {currentPoint.swell_wave_height_m !== null ? `${currentPoint.swell_wave_height_m.toFixed(2)} m` : "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Timestamps & Provenance */}
                  <div className="pt-3 border-t border-orca-border/70 text-[11px] text-orca-muted space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Valid Time (UTC):</span>
                      <span className="text-cyan-300 font-semibold">{formatUtc(currentPoint.valid_time)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Persisted ID:</span>
                      <span className="text-slate-300 truncate max-w-[170px]" title={currentPoint.id}>
                        {currentPoint.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Grid Cell:</span>
                      <span className="text-slate-300">
                        {currentPoint.latitude.toFixed(3)}°N, {currentPoint.longitude.toFixed(3)}°E
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Retrieved (UTC):</span>
                      <span className="text-slate-400">{formatUtc(currentPoint.retrieval_time)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Hourly Wave Chart & Forecast Horizon Timeline (8 cols) */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            {/* Visual Wave Height Chart */}
            <div className="bg-orca-navy/90 border border-orca-border rounded-xl p-5 shadow-lg backdrop-blur-md flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-orca-border/80 text-xs">
                <div className="flex items-center space-x-2">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-semibold text-slate-100">
                    Hourly Significant Wave Height Trend ({items.length} Persisted Points)
                  </span>
                </div>
                <span className="text-[11px] text-orca-muted font-mono">
                  Scale: 0 - {maxWaveHeight.toFixed(1)}m
                </span>
              </div>

              {/* Chart Bars */}
              <div className="mt-4 pt-2 pb-4 overflow-x-auto no-scrollbar">
                <div className="flex items-end space-x-1.5 min-w-[600px] h-48 px-2">
                  {items.map((pt, idx) => {
                    const h = pt.wave_height_m || 0;
                    const pct = Math.min(100, Math.max(8, (h / maxWaveHeight) * 100));
                    const isSelected = idx === selectedPointIndex;
                    const barColor =
                      h > 3.0
                        ? "bg-rose-500"
                        : h > 2.0
                        ? "bg-amber-400"
                        : h > 1.0
                        ? "bg-cyan-400"
                        : "bg-teal-400";

                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setSelectedPointIndex(idx)}
                        className={`group relative flex-1 flex flex-col items-center justify-end h-full transition rounded-t focus:outline-none ${
                          isSelected ? "opacity-100" : "opacity-75 hover:opacity-100"
                        }`}
                        title={`${formatUtc(pt.valid_time)}: ${h.toFixed(2)}m (Period: ${pt.wave_period_s}s)`}
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute -top-10 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <span className="px-2 py-0.5 rounded bg-orca-dark border border-cyan-500 text-[10px] font-mono text-cyan-200 whitespace-nowrap shadow-lg">
                            {h.toFixed(2)}m | {pt.wave_period_s}s
                          </span>
                        </div>

                        {/* Bar */}
                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full rounded-t transition-all ${barColor} ${
                            isSelected ? "ring-2 ring-white shadow-[0_0_10px_rgba(255,255,255,0.4)]" : ""
                          }`}
                        />

                        {/* Valid Time Tick (every 6 hours) */}
                        {idx % 6 === 0 && (
                          <span className="text-[9px] font-mono text-slate-400 mt-1 absolute -bottom-5">
                            {new Date(pt.valid_time).getUTCHours()}h
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-orca-border/70 text-[11px] text-slate-400">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-teal-400 inline-block" />
                    <span>&lt;1.0m (Calm)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-400 inline-block" />
                    <span>1.0-2.0m (Smooth)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
                    <span>2.0-3.0m (Moderate)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
                    <span>&gt;3.0m (Rough)</span>
                  </div>
                </div>
                <span className="text-slate-500 text-[10px]">Click any bar to inspect point details</span>
              </div>
            </div>

            {/* Hourly Persisted Points Table */}
            <div className="bg-orca-navy/90 border border-orca-border rounded-xl p-4 shadow-lg backdrop-blur-md flex flex-col max-h-[300px]">
              <div className="flex items-center justify-between pb-2 border-b border-orca-border/80 text-xs">
                <span className="font-semibold text-slate-200">Chronological Hourly Persisted Records</span>
                <span className="text-[10px] text-orca-muted font-mono">Sorted by Valid Time (ASC)</span>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar mt-2">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-orca-dark text-slate-400 font-semibold border-b border-orca-border">
                    <tr>
                      <th className="py-1.5 px-2">Valid Time (UTC)</th>
                      <th className="py-1.5 px-2">Wave Ht (m)</th>
                      <th className="py-1.5 px-2">Period (s)</th>
                      <th className="py-1.5 px-2">Direction</th>
                      <th className="py-1.5 px-2">Wind Wave</th>
                      <th className="py-1.5 px-2">Swell</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orca-border/40 font-mono text-slate-300">
                    {items.map((pt, i) => (
                      <tr
                        key={pt.id}
                        onClick={() => setSelectedPointIndex(i)}
                        className={`cursor-pointer hover:bg-cyan-950/30 transition ${
                          i === selectedPointIndex ? "bg-cyan-950/60 text-cyan-200 font-semibold" : ""
                        }`}
                      >
                        <td className="py-1.5 px-2">{formatUtc(pt.valid_time)}</td>
                        <td className="py-1.5 px-2 text-cyan-300">
                          {pt.wave_height_m !== null ? pt.wave_height_m.toFixed(2) : "-"}
                        </td>
                        <td className="py-1.5 px-2">
                          {pt.wave_period_s !== null ? pt.wave_period_s.toFixed(1) : "-"}
                        </td>
                        <td className="py-1.5 px-2">
                          {pt.wave_direction_deg !== null ? `${Math.round(pt.wave_direction_deg)}°` : "-"}
                        </td>
                        <td className="py-1.5 px-2">
                          {pt.wind_wave_height_m !== null ? `${pt.wind_wave_height_m.toFixed(2)}m` : "-"}
                        </td>
                        <td className="py-1.5 px-2">
                          {pt.swell_wave_height_m !== null ? `${pt.swell_wave_height_m.toFixed(2)}m` : "-"}
                        </td>
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
