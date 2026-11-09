import React, { useState } from "react";
import { Anchor, ShieldAlert } from "lucide-react";
import { InvestigationInput } from "../investigations/InvestigationInput";
import { FindingsList } from "../investigations/FindingsList";
import { InvestigationEventsTimeline } from "../investigations/InvestigationEventsTimeline";
import { OceanMap } from "../../components/maps/OceanMap";
import { MarineChart } from "../../components/charts/MarineChart";
import { VerificationBadge } from "../../components/evidence/VerificationBadge";
import { EvidenceDrawer } from "../../components/evidence/EvidenceDrawer";
import { apiClient } from "../../lib/api-client";
import { InvestigationResponse, ExecutionEvent, EvidenceRecord, InvestigationCreate } from "../../types";

export const FishermanWorkspace: React.FC = () => {
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sample marine forecast data for visual chart
  const waveData = [
    { time: "00:00", value: 1.4 },
    { time: "03:00", value: 1.6 },
    { time: "06:00", value: 1.9 },
    { time: "09:00", value: 1.8 },
    { time: "12:00", value: 1.5 },
    { time: "15:00", value: 1.4 },
    { time: "18:00", value: 1.3 },
  ];

  const handleStartInvestigation = async (payload: InvestigationCreate) => {
    setIsLoading(true);
    try {
      const res = await apiClient.createInvestigation(payload);
      setInvestigation(res);

      const [evts, evs] = await Promise.all([
        apiClient.getInvestigationEvents(res.investigation_id),
        apiClient.getInvestigationEvidence(res.investigation_id),
      ]);
      setEvents(evts);
      setEvidenceList(evs);
    } catch (err: any) {
      alert(`Investigation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEvidence = (evidenceId: string) => {
    const found = evidenceList.find((e) => e.id === evidenceId);
    if (found) {
      setSelectedEvidence(found);
    } else {
      apiClient.getInvestigationEvidence(investigation?.investigation_id || "").then((evs) => {
        setEvidenceList(evs);
        const match = evs.find((e) => e.id === evidenceId);
        if (match) setSelectedEvidence(match);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Banner */}
      <div className="p-5 rounded-2xl border border-orca-border bg-gradient-to-r from-orca-navy to-cyan-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Anchor className="w-4 h-4" />
            <span>Workspace 1 — Marine Operators & Fishermen</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Coastal Marine Conditions & Hazard Advisories</h2>
          <p className="text-xs text-orca-muted mt-1 max-w-2xl">
            Inspect verified wave heights, wind forecasts, sea-surface temperature, and official maritime warnings before setting sail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {investigation?.provider_used && (
            <div className="flex items-center space-x-1.5 bg-orca-dark/80 px-3 py-2 rounded-xl border border-orca-border text-xs">
              {investigation.is_fallback ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/80">
                  Deterministic Rule Engine (Fallback)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                  AI: {investigation.provider_used} ({investigation.model_used || "default"})
                </span>
              )}
            </div>
          )}

          {investigation?.verification_summary && (
            <div className="flex items-center space-x-2 bg-orca-dark/80 px-4 py-2.5 rounded-xl border border-orca-border">
              <span className="text-xs text-orca-muted">Audit:</span>
              <VerificationBadge state={investigation.verification_summary.overall_state} />
            </div>
          )}
        </div>
      </div>

      {/* Query Bar */}
      <InvestigationInput
        workspace="fisherman"
        defaultQuery="Planning to fish offshore near Mangaluru tomorrow morning. Investigate wave/wind forecasts and warnings."
        onStartInvestigation={handleStartInvestigation}
        isLoading={isLoading}
      />

      {/* Grid: Map & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OceanMap
          latitude={investigation?.location?.latitude || 12.91}
          longitude={investigation?.location?.longitude || 74.85}
          title="Offshore Mangaluru Fishing Sector"
          markers={[
            { lat: 12.91, lon: 74.85, label: "Mangaluru Port Zone", type: "port" },
            { lat: 13.05, lon: 74.72, label: "Outer Fishing Grounds", type: "station" },
          ]}
        />
        <MarineChart
          title="Open-Meteo Significant Wave Height Forecast (Next 24h)"
          data={waveData}
          unit="m"
          primaryName="Wave Height (m)"
        />
      </div>

      {/* Findings & Genuine Event Trace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {investigation?.summary && (
            <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 text-xs text-cyan-200 shadow-md">
              <span className="font-semibold block mb-1 text-cyan-300 uppercase tracking-wider text-[11px]">
                Investigation Intelligence Summary
              </span>
              <div className="whitespace-pre-wrap leading-relaxed mt-2 text-slate-100 font-sans text-xs">
                {investigation.summary}
              </div>
            </div>
          )}
          <FindingsList
            findings={investigation?.findings || []}
            onSelectEvidence={handleSelectEvidence}
          />
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
