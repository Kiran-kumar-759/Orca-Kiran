import React, { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, History } from "lucide-react";
import { InvestigationInput } from "../investigations/InvestigationInput";
import { FindingsList } from "../investigations/FindingsList";
import { InvestigationEventsTimeline } from "../investigations/InvestigationEventsTimeline";
import { OceanMap } from "../../components/maps/OceanMap";
import { MarineChart } from "../../components/charts/MarineChart";
import { VerificationBadge } from "../../components/evidence/VerificationBadge";
import { EvidenceDrawer } from "../../components/evidence/EvidenceDrawer";
import { apiClient } from "../../lib/api-client";
import {
  InvestigationResponse,
  ExecutionEvent,
  EvidenceRecord,
  InvestigationCreate,
  Hazard,
} from "../../types";
import { formatDateTime } from "../../lib/utils";

export const DisasterManagementWorkspace: React.FC = () => {
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);

  // Real backend hazard state
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [isLoadingHazards, setIsLoadingHazards] = useState(true);

  // Load real backend hazard data on mount
  useEffect(() => {
    setIsLoadingHazards(true);
    apiClient
      .getHazards({ basin: "arabian_sea", limit: 10 })
      .then((res) => {
        setHazards(res.items);
        if (res.items.length > 0) {
          setSelectedHazard(res.items[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to load hazards from backend:", err);
      })
      .finally(() => {
        setIsLoadingHazards(false);
      });
  }, []);

  const handleStartInvestigation = async (payload: InvestigationCreate) => {
    setIsLoading(true);
    setReportMarkdown(null);
    try {
      const res = await apiClient.createInvestigation({
        ...payload,
        preferred_agents: ["marine_hazard", "coastal_risk"],
      });
      setInvestigation(res);

      const [evts, evs, report] = await Promise.all([
        apiClient.getInvestigationEvents(res.investigation_id),
        apiClient.getInvestigationEvidence(res.investigation_id),
        apiClient.getInvestigationReport(res.investigation_id),
      ]);
      setEvents(evts);
      setEvidenceList(evs);
      setReportMarkdown(report.markdown_content);
    } catch (err: any) {
      alert(`Investigation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert real track points to chart time-series
  const chartData = selectedHazard?.track_points
    ?.filter((pt) => pt.wind_speed_knots !== null && pt.wind_speed_knots !== undefined)
    ?.map((pt) => ({
      time: new Date(pt.time).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
      value: pt.wind_speed_knots || 0,
      secondary: pt.pressure_hpa || 0,
    })) || [];

  // Downsample track points to 6-10 significant markers for the map
  const mapMarkers = (selectedHazard?.track_points || [])
    .filter((_, idx, arr) => idx === 0 || idx === arr.length - 1 || idx % Math.max(1, Math.floor(arr.length / 6)) === 0)
    .map((pt) => ({
      lat: pt.latitude,
      lon: pt.longitude,
      label: `${selectedHazard?.name?.replace("Cyclone ", "") || "Storm"} (${pt.wind_speed_knots || 0} kts)`,
      type: "cyclone" as const,
    }));

  const mapCenterLat = mapMarkers.length > 0 ? mapMarkers[Math.floor(mapMarkers.length / 2)].lat : 14.5;
  const mapCenterLon = mapMarkers.length > 0 ? mapMarkers[Math.floor(mapMarkers.length / 2)].lon : 72.5;

  return (
    <div className="space-y-6">
      {/* Workspace Banner */}
      <div className="p-5 rounded-2xl border border-orca-border bg-gradient-to-r from-orca-navy to-rose-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Workspace 5 — Emergency Planning & Disaster Management</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Cyclone Tracking, Track Playback & Coastal Risk</h2>
          <p className="text-xs text-orca-muted mt-1 max-w-2xl">
            Audit tropical cyclone information, replay historical storm trajectories (NOAA IBTrACS), and evaluate coastal population exposure.
          </p>
        </div>

        {investigation?.verification_summary && (
          <div className="flex items-center space-x-2 bg-orca-dark/80 px-4 py-2.5 rounded-xl border border-orca-border">
            <span className="text-xs text-orca-muted">Audit:</span>
            <VerificationBadge state={investigation.verification_summary.overall_state} />
          </div>
        )}
      </div>

      {/* Query Bar */}
      <InvestigationInput
        workspace="disaster-management"
        defaultQuery="Investigate cyclone tracks relevant to the Arabian Sea and evaluate proximity to Karnataka coastal ports."
        defaultLocation={{ latitude: 13.0, longitude: 74.0, name: "Arabian Sea Coastal Corridor" }}
        onStartInvestigation={handleStartInvestigation}
        isLoading={isLoading}
      />

      {/* Real Storm Selector & Provenance Header */}
      <div className="p-4 rounded-xl border border-orca-border bg-orca-navy/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">Loaded Cyclone Trajectory:</span>
          {isLoadingHazards ? (
            <span className="text-orca-muted animate-pulse">Loading verified tracks from backend...</span>
          ) : hazards.length > 0 ? (
            <select
              value={selectedHazard?.hazard_id}
              onChange={(e) => {
                const h = hazards.find((item) => item.hazard_id === e.target.value);
                if (h) setSelectedHazard(h);
              }}
              className="bg-orca-dark border border-orca-border px-3 py-1.5 rounded-lg text-cyan-300 font-medium focus:outline-none focus:border-cyan-400"
            >
              {hazards.map((h) => (
                <option key={h.hazard_id} value={h.hazard_id}>
                  {h.name} ({h.track_points.length} points)
                </option>
              ))}
            </select>
          ) : (
            <span className="text-amber-400">No hazard records currently in database.</span>
          )}
        </div>

        {selectedHazard && (
          <div className="flex items-center space-x-4 text-orca-muted">
            <span>
              Period: {formatDateTime(selectedHazard.first_observed)} → {formatDateTime(selectedHazard.last_observed)}
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
              Source: {selectedHazard.source}
            </span>
          </div>
        )}
      </div>

      {/* Map & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OceanMap
          latitude={mapCenterLat}
          longitude={mapCenterLon}
          title={`Chronological Track: ${selectedHazard?.name || "Arabian Sea Cyclone"}`}
          markers={mapMarkers}
        />
        <MarineChart
          title={`NOAA IBTrACS Sustained Wind Speed (knots) — ${selectedHazard?.name || "Storm Progression"}`}
          data={chartData}
          unit="knots"
          primaryName="Sustained Wind"
        />
      </div>

      {/* Findings, Report & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <FindingsList
            findings={investigation?.findings || []}
            onSelectEvidence={(eid) => {
              const match = evidenceList.find((e) => e.id === eid);
              if (match) setSelectedEvidence(match);
            }}
          />

          {reportMarkdown && (
            <div className="p-4 rounded-xl border border-orca-border bg-orca-navy/90 space-y-3">
              <div className="flex items-center justify-between border-b border-orca-border pb-2">
                <span className="text-xs font-semibold text-slate-200">Generated Scientific Report</span>
                <span className="text-[11px] text-cyan-400">Traceable & Verified</span>
              </div>
              <pre className="text-xs font-mono bg-orca-dark p-3 rounded-lg overflow-x-auto text-slate-300 whitespace-pre-wrap">
                {reportMarkdown}
              </pre>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <InvestigationEventsTimeline events={events} />

          {investigation?.limitations && investigation.limitations.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/20 text-xs text-amber-200 space-y-1.5">
              <div className="flex items-center space-x-1 font-semibold text-amber-300">
                <ShieldAlert className="w-4 h-4" />
                <span>Disclosures & Known Limitations</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-300/90">
                {investigation.limitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Evidence Drawer */}
      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  );
};
