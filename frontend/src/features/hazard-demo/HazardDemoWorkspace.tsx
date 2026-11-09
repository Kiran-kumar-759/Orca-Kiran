import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  Info,
  Navigation,
  Radio,
  RefreshCw,
  ShieldAlert,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { hazardApi } from "./api";
import { CycloneDetailPanel } from "./components/CycloneDetailPanel";
import { CycloneFilters } from "./components/CycloneFilters";
import { CycloneMap } from "./components/CycloneMap";
import { CycloneTrackTimeline } from "./components/CycloneTrackTimeline";
import { CycloneForecastPanel } from "./components/CycloneForecastPanel";
import { MarineForecastPanel } from "./components/MarineForecastPanel";
import { MarineHazardAgentPanel } from "./components/MarineHazardAgentPanel";
import { PipelineStatusPill } from "./components/PipelineStatusPill";
import {
  GDACSStatusResponse,
  GDACSSyncResponse,
  HazardEvent,
  HazardFilterState,
  HazardStatsResponse,
  HazardTrackPoint,
} from "./types";

const INITIAL_FILTERS: HazardFilterState = {
  search: "",
  basin: "all",
  category: "all",
  sortBy: "last_observed",
  sortOrder: "desc",
  page: 1,
  limit: 15,
};

export const HazardDemoWorkspace: React.FC = () => {
  // Navigation View Mode: "live" | "forecasts" | "historical" | "agent"
  const [activeTab, setActiveTab] = useState<"live" | "forecasts" | "historical" | "agent">("agent");
  const [forecastSubTab, setForecastSubTab] = useState<"marine" | "cyclone">("marine");

  // Live GDACS Alerts State
  const [liveAlerts, setLiveAlerts] = useState<HazardEvent[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [gdacsStatus, setGdacsStatus] = useState<GDACSStatusResponse | null>(null);

  // Syncing State & Audit Report
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncAuditResult, setSyncAuditResult] = useState<GDACSSyncResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Historical Cyclones State
  const [filters, setFilters] = useState<HazardFilterState>(INITIAL_FILTERS);
  const [historicalEvents, setHistoricalEvents] = useState<HazardEvent[]>([]);
  const [totalHistoricalCount, setTotalHistoricalCount] = useState<number>(0);
  const [totalHistoricalPages, setTotalHistoricalPages] = useState<number>(1);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(true);
  const [historicalApiError, setHistoricalApiError] = useState<string | null>(null);

  // Shared Selection State (Works for both Live Alerts and Historical Storms)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HazardEvent | null>(null);
  const [trackPoints, setTrackPoints] = useState<HazardTrackPoint[]>([]);
  const [stats, setStats] = useState<HazardStatsResponse | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isLoadingTrack, setIsLoadingTrack] = useState<boolean>(false);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);

  // Debounced search input handler for historical list
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(handler);
  }, [filters.search]);

  // 1. Load Live Alerts and Provider Status
  const loadLiveAlerts = useCallback(async () => {
    setIsLoadingLive(true);
    setLiveError(null);
    try {
      const [alerts, status] = await Promise.all([
        hazardApi.fetchActiveLiveAlerts(),
        hazardApi.fetchGdacsStatus().catch(() => null),
      ]);
      setLiveAlerts(alerts);
      if (status) setGdacsStatus(status);

      // Auto-select first active alert if on live tab
      if (activeTab === "live" && alerts.length > 0) {
        setSelectedEventId((prev) => {
          const stillExists = alerts.some((a) => a.hazard_id === prev);
          return stillExists ? prev : alerts[0].hazard_id;
        });
      }
    } catch (err: any) {
      setLiveError(err.message || "Failed to load live GDACS alerts.");
    } finally {
      setIsLoadingLive(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadLiveAlerts();
  }, [loadLiveAlerts]);

  // 2. Load Historical Cyclones List
  const loadHistoricalEvents = useCallback(async () => {
    setIsLoadingHistorical(true);
    setHistoricalApiError(null);
    try {
      const activeFilters = {
        ...filters,
        search: debouncedSearch,
      };
      const response = await hazardApi.fetchHazardList(activeFilters);
      setHistoricalEvents(response.items);
      setTotalHistoricalCount(response.total ?? response.count);
      setTotalHistoricalPages(response.pages || 1);

      // Auto-select first storm if on historical tab and no selection
      if (activeTab === "historical" && response.items.length > 0) {
        setSelectedEventId((prev) => {
          const stillExists = response.items.some((h) => h.hazard_id === prev);
          return stillExists ? prev : response.items[0].hazard_id;
        });
      }
    } catch (err: any) {
      setHistoricalApiError(err.message || "Failed to query historical cyclone database.");
    } finally {
      setIsLoadingHistorical(false);
    }
  }, [filters, debouncedSearch, activeTab]);

  useEffect(() => {
    loadHistoricalEvents();
  }, [loadHistoricalEvents]);

  // 3. Trigger Live Ingestion Sync with GDACS
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncAuditResult(null);

    try {
      const result = await hazardApi.syncGdacsLiveAlerts();
      setSyncAuditResult(result);
      await loadLiveAlerts();
      setActiveTab("live");
    } catch (err: any) {
      setSyncError(err.message || "Failed to synchronize with GDACS live feed.");
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Load Detailed Track & Stats when selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) return;

    let isMounted = true;
    setIsLoadingTrack(true);
    setIsLoadingStats(true);
    setSelectedPointIndex(null);

    // 1. Fetch Event Detail
    hazardApi
      .fetchHazardDetail(selectedEventId)
      .then((evt) => {
        if (isMounted) setSelectedEvent(evt);
      })
      .catch((err) => console.error("Failed to load event detail:", err));

    // 2. Fetch Ordered Track Points
    hazardApi
      .fetchHazardTrack(selectedEventId)
      .then((trackRes) => {
        if (isMounted) setTrackPoints(trackRes.track_points);
      })
      .catch((err) => console.error("Failed to load track points:", err))
      .finally(() => {
        if (isMounted) setIsLoadingTrack(false);
      });

    // 3. Fetch Derived Statistics
    hazardApi
      .fetchHazardStats(selectedEventId)
      .then((statsRes) => {
        if (isMounted) setStats(statsRes);
      })
      .catch((err) => console.error("Failed to load hazard stats:", err))
      .finally(() => {
        if (isMounted) setIsLoadingStats(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedEventId]);

  const handleFilterChange = (updates: Partial<HazardFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const formatCoordinates = (lat: number | null | undefined, lon: number | null | undefined): string => {
    if (lat === null || lat === undefined || lon === null || lon === undefined || isNaN(lat) || isNaN(lon)) {
      return "No fix";
    }
    const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
    const lonStr = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
    return `${latStr}, ${lonStr}`;
  };

  return (
    <div className="space-y-6">
      {/* Workspace Banner & Ingestion Control Card */}
      <div className="p-5 rounded-2xl border border-orca-border bg-gradient-to-r from-orca-navy via-orca-card/70 to-cyan-950/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg backdrop-blur-md">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Person 2 — Marine Hazard & Forecast Agent (P2-03 Live Demo)</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            Real-Time GDACS Tropical Cyclone Ingestion & NOAA IBTrACS Archive
          </h2>
          <p className="text-xs text-orca-muted mt-1 max-w-2xl">
            Live automated disaster bulletins from UN/EU GDACS persisted idempotently to PostgreSQL, unified with 1,859 historical North Indian Ocean cyclone tracks.
          </p>
        </div>

        {/* Right Header Controls: Sync Action + Status Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Controlled GDACS Sync Button */}
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleTriggerSync}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl border font-medium text-xs transition shadow-sm ${
              isSyncing
                ? "bg-cyan-950/60 border-cyan-700/50 text-cyan-400 cursor-not-allowed opacity-75"
                : "bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/40 text-cyan-300 active:scale-98 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
            }`}
            title="Idempotently ingest active cyclone alerts from GDACS"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Ingesting GDACS..." : "Sync Live GDACS"}</span>
          </button>

          {/* GDACS Provider Status Pill */}
          <PipelineStatusPill
            provider="GDACS"
            isHealthy={gdacsStatus?.is_healthy ?? true}
            freshness={gdacsStatus?.freshness ?? "unknown"}
            lastSyncUtc={gdacsStatus?.last_sync_utc ?? null}
            lastAttemptUtc={gdacsStatus?.last_attempt_utc ?? null}
            lastAttemptStatus={gdacsStatus?.last_attempt_status ?? null}
            isFallback={gdacsStatus?.is_fallback ?? false}
            message={gdacsStatus?.message}
            isSyncing={isSyncing}
          />

          {/* PostgreSQL DB Pill */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-orca-dark/80 border border-orca-border">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300 font-mono text-[11px]">
              orca_db (<strong className="text-emerald-300">{liveAlerts.length} live</strong> /{" "}
              {totalHistoricalCount.toLocaleString()} hist)
            </span>
          </div>
        </div>
      </div>

      {/* Audit Report Banner (Displays result of last live ingestion sync) */}
      {syncAuditResult && (
        <div className="bg-emerald-950/80 border border-emerald-800/60 rounded-xl px-5 py-2.5 text-xs text-emerald-200 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>GDACS Ingestion Audit:</strong> {syncAuditResult.message} (Status:{" "}
              <span className="uppercase font-mono font-bold text-emerald-300">
                {syncAuditResult.status}
              </span>
              )
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSyncAuditResult(null)}
            className="text-emerald-400 hover:text-emerald-200 p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sync Error Banner with Retry Option */}
      {syncError && (
        <div className="bg-rose-950/80 border border-rose-800/60 rounded-xl px-5 py-2.5 text-xs text-rose-200 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Live Ingestion Error:</strong> {syncError}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleTriggerSync}
              className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition text-[11px] font-medium"
            >
              Retry Sync
            </button>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="text-rose-400 hover:text-rose-200 p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Navigation Mode Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-1.5 rounded-xl bg-orca-card/75 border border-orca-border text-xs font-semibold backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {/* 1. Live Alerts Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("live");
              if (liveAlerts.length > 0) setSelectedEventId(liveAlerts[0].hazard_id);
            }}
            className={`flex items-center space-x-2 py-2 px-4 rounded-lg transition ${
              activeTab === "live"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-orca-dark/50"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Live Alerts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
              {liveAlerts.length}
            </span>
          </button>

          {/* 2. Forecasts Tab (P2-04) */}
          <button
            type="button"
            onClick={() => setActiveTab("forecasts")}
            className={`flex items-center space-x-2 py-2 px-4 rounded-lg transition ${
              activeTab === "forecasts"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-orca-dark/50"
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span>Marine & Cyclone Forecasts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
              P2-04
            </span>
          </button>

          {/* 3. Historical Cyclones Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("historical");
              if (historicalEvents.length > 0)
                setSelectedEventId(historicalEvents[0].hazard_id);
            }}
            className={`flex items-center space-x-2 py-2 px-4 rounded-lg transition ${
              activeTab === "historical"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-orca-dark/50"
            }`}
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Historical Tracks</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-orca-dark border border-orca-border text-slate-300 font-mono">
              {totalHistoricalCount.toLocaleString()}
            </span>
          </button>

          {/* 4. Marine Hazard Agent Tab (P2-06) */}
          <button
            type="button"
            onClick={() => setActiveTab("agent")}
            className={`flex items-center space-x-2 py-2 px-4 rounded-lg transition ${
              activeTab === "agent"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-orca-dark/50"
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Marine Hazard Agent</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
              P2-06
            </span>
          </button>
        </div>

        {/* Forecast Sub-Tab Pills (when on forecasts tab) */}
        {activeTab === "forecasts" && (
          <div className="flex items-center space-x-1.5 p-1 rounded-lg bg-orca-dark/80 border border-orca-border/80">
            <button
              type="button"
              onClick={() => setForecastSubTab("marine")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                forecastSubTab === "marine"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Waves className="w-3 h-3 text-cyan-400" />
              <span>Marine Waves (Open-Meteo)</span>
            </button>
            <button
              type="button"
              onClick={() => setForecastSubTab("cyclone")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                forecastSubTab === "cyclone"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Navigation className="w-3 h-3 text-cyan-400" />
              <span>Cyclone 5-Day Tracks (NOAA NHC)</span>
            </button>
          </div>
        )}
      </div>

      {/* Marine Hazard Agent Panel View (P2-06 Full Width) */}
      {activeTab === "agent" && (
        <div className="w-full">
          <MarineHazardAgentPanel />
        </div>
      )}

      {/* Forecast Panel View (Full Width) */}
      {activeTab === "forecasts" && (
        <div className="w-full">
          {forecastSubTab === "marine" ? (
            <MarineForecastPanel />
          ) : (
            <CycloneForecastPanel />
          )}
        </div>
      )}

      {/* Main Hazard Explorer Grid (Live & Historical) */}
      {(activeTab === "live" || activeTab === "historical") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* Left Column: Mode Tabs & Hazard Listings (4 cols) */}
          <section className="lg:col-span-4 flex flex-col space-y-4">
            {/* TAB 1: LIVE GDACS ALERTS */}
            {activeTab === "live" && (
            <div className="rounded-xl border border-orca-border bg-orca-navy/80 flex flex-col flex-1 shadow-lg backdrop-blur-md overflow-hidden min-h-[500px]">
              {/* Live Alerts Header */}
              <div className="px-4 py-3 border-b border-orca-border/80 flex items-center justify-between text-xs bg-orca-dark/70">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-slate-100">
                    Active Tropical Cyclones ({liveAlerts.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Source: GDACS</span>
              </div>

              {/* Live Alerts Body */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2.5">
                {isLoadingLive ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading active alerts from PostgreSQL...</span>
                  </div>
                ) : liveError ? (
                  <div className="p-6 text-center text-xs space-y-2">
                    <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
                    <p className="text-rose-300 font-medium">{liveError}</p>
                    <button
                      type="button"
                      onClick={loadLiveAlerts}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : liveAlerts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-3">
                    <Info className="w-7 h-7 text-cyan-400 mx-auto" />
                    <p className="text-slate-200 font-medium text-sm">
                      No Active Cyclones Currently Persisted
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Click the "Sync Live GDACS" button above to query the live disaster alert feed and persist active alerts.
                    </p>
                    <button
                      type="button"
                      onClick={handleTriggerSync}
                      disabled={isSyncing}
                      className="mt-2 inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition text-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      <span>Check Feed Now</span>
                    </button>
                  </div>
                ) : (
                  liveAlerts.map((alert) => {
                    const isSelected = alert.hazard_id === selectedEventId;
                    const meta = alert.metadata_json || {};
                    const alertLevel = (meta.alert_level || "Green").toLowerCase();
                    const pt = alert.track_points[0];

                    const levelBadgeColor =
                      alertLevel === "red"
                        ? "bg-rose-950/80 text-rose-300 border-rose-800/80 shadow-[0_0_10px_rgba(244,63,94,0.25)]"
                        : alertLevel === "orange"
                        ? "bg-amber-950/80 text-amber-300 border-amber-800/80 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                        : "bg-emerald-950/80 text-emerald-300 border-emerald-800/80 shadow-[0_0_10px_rgba(16,185,129,0.2)]";

                    return (
                      <div
                        key={alert.hazard_id}
                        onClick={() => setSelectedEventId(alert.hazard_id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? "bg-cyan-500/15 border-cyan-500/60 shadow-[0_0_16px_rgba(6,182,212,0.2)] text-slate-100"
                            : "bg-orca-card/40 border-orca-border/70 hover:bg-orca-card/80 hover:border-orca-border text-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-xs text-slate-100">{alert.name}</div>
                            <div className="text-[11px] text-slate-400 capitalize mt-0.5">
                              {alert.basin?.replace("_", " ") || "Global Cyclone"}
                              {meta.country ? ` • ${meta.country}` : ""}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${levelBadgeColor}`}
                          >
                            {meta.alert_level || "Green"} Alert
                          </span>
                        </div>

                        {/* Intensity & Position Highlights */}
                        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] bg-orca-dark/60 p-2 rounded-lg border border-orca-border/50">
                          <div className="flex items-center space-x-1.5 text-slate-300">
                            <Wind className="w-3.5 h-3.5 text-cyan-400" />
                            <span>
                              {pt?.wind_speed_knots !== null && pt?.wind_speed_knots !== undefined
                                ? `${pt.wind_speed_knots} kts`
                                : meta.severity_kmh
                                ? `${Math.round(meta.severity_kmh * 0.54)} kts`
                                : "N/A"}
                            </span>
                          </div>
                          <div className="text-right text-slate-400 font-mono text-[10px]">
                            {formatCoordinates(pt?.latitude, pt?.longitude)}
                          </div>
                        </div>

                        {/* Provenance note */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                          <span>GDACS ID: {meta.gdacs_event_id || alert.hazard_id}</span>
                          <span className="text-cyan-400/80 flex items-center space-x-1">
                            <span>Status: ACTIVE</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HISTORICAL CYCLONES EXPLORER */}
          {activeTab === "historical" && (
            <>
              <CycloneFilters
                filters={filters}
                onChange={handleFilterChange}
                onReset={handleResetFilters}
              />

              {/* Historical Storms List */}
              <div className="rounded-xl border border-orca-border bg-orca-navy/80 flex flex-col flex-1 shadow-lg backdrop-blur-md overflow-hidden min-h-[440px]">
                {/* List Header */}
                <div className="px-4 py-3 border-b border-orca-border/80 flex items-center justify-between text-xs bg-orca-dark/60">
                  <span className="font-semibold text-slate-200">
                    Historical Storms ({totalHistoricalCount.toLocaleString()})
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Page {filters.page} of {totalHistoricalPages}
                  </span>
                </div>

                {/* List Body */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
                  {isLoadingHistorical ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span>Querying PostgreSQL database...</span>
                    </div>
                  ) : historicalApiError ? (
                    <div className="p-6 text-center text-xs space-y-2">
                      <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
                      <p className="text-rose-300 font-medium">{historicalApiError}</p>
                      <button
                        type="button"
                        onClick={loadHistoricalEvents}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Query</span>
                      </button>
                    </div>
                  ) : historicalEvents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                      <Info className="w-6 h-6 text-cyan-400 mx-auto" />
                      <p className="text-slate-300 font-medium">
                        No matching historical cyclones found.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Try clearing or widening your search or basin filter.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition text-xs"
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    historicalEvents.map((evt) => {
                      const isSelected = evt.hazard_id === selectedEventId;
                      const year = evt.first_observed
                        ? new Date(evt.first_observed).getFullYear()
                        : "Hist";
                      return (
                        <div
                          key={evt.hazard_id}
                          onClick={() => setSelectedEventId(evt.hazard_id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                            isSelected
                              ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)] text-slate-100"
                              : "bg-orca-card/30 border-orca-border/60 hover:bg-orca-card/70 hover:border-orca-border text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-100 truncate max-w-[180px]">
                              {evt.name}
                            </span>
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-orca-dark border border-orca-border text-cyan-300">
                              {year}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                            <span className="capitalize">
                              {evt.basin?.replace("_", " ") || "North Indian"}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {evt.hazard_id}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Pagination Controls */}
                {totalHistoricalPages > 1 && (
                  <div className="px-3 py-2.5 border-t border-orca-border/80 flex items-center justify-between text-xs bg-orca-dark/70">
                    <button
                      type="button"
                      disabled={filters.page <= 1}
                      onClick={() => handleFilterChange({ page: filters.page - 1 })}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-orca-card border border-orca-border text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {filters.page} / {totalHistoricalPages}
                    </span>
                    <button
                      type="button"
                      disabled={filters.page >= totalHistoricalPages}
                      onClick={() => handleFilterChange({ page: filters.page + 1 })}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-orca-card border border-orca-border text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Right Column: Interactive Map, Detail Panel, and Track Progression (8 cols) */}
        <section className="lg:col-span-8 flex flex-col space-y-5">
          {/* Main Interactive Map */}
          <CycloneMap
            stormName={selectedEvent?.name || ""}
            stormId={selectedEvent?.hazard_id || ""}
            basin={selectedEvent?.basin || null}
            trackPoints={trackPoints}
            isLoading={isLoadingTrack}
            selectedPointIndex={selectedPointIndex}
            onSelectPoint={(idx) => setSelectedPointIndex(idx)}
            className="h-[380px] sm:h-[440px]"
            source={selectedEvent?.source}
          />

          {/* Detail Panel */}
          <CycloneDetailPanel
            selectedEvent={selectedEvent}
            stats={stats}
            isLoadingStats={isLoadingStats}
          />

          {/* Chronological Track Table */}
          <CycloneTrackTimeline
            trackPoints={trackPoints}
            isLoading={isLoadingTrack}
            selectedPointIndex={selectedPointIndex}
            onSelectPoint={(idx) => setSelectedPointIndex(idx)}
          />
        </section>
      </div>
      )}
    </div>
  );
};
