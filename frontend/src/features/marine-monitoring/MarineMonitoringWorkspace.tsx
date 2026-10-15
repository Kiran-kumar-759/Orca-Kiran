import React, { useState } from "react";
import { LineChart } from "lucide-react";
import { InvestigationInput } from "../investigations/InvestigationInput";
import { FindingsList } from "../investigations/FindingsList";
import { InvestigationEventsTimeline } from "../investigations/InvestigationEventsTimeline";
import { OceanMap } from "../../components/maps/OceanMap";
import { MarineChart } from "../../components/charts/MarineChart";
import { VerificationBadge } from "../../components/evidence/VerificationBadge";
import { EvidenceDrawer } from "../../components/evidence/EvidenceDrawer";
import { apiClient } from "../../lib/api-client";
import { InvestigationResponse, ExecutionEvent, EvidenceRecord, InvestigationCreate } from "../../types";

export const MarineMonitoringWorkspace: React.FC = () => {
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sstData = [
    { time: "Jan", value: 27.2 },
    { time: "Mar", value: 28.5 },
    { time: "May", value: 30.1 },
    { time: "Jul", value: 28.0 },
    { time: "Sep", value: 28.4 },
    { time: "Nov", value: 28.8 },
  ];

  const handleStartInvestigation = async (payload: InvestigationCreate) => {
    setIsLoading(true);
    try {
      const res = await apiClient.createInvestigation({
        ...payload,
        preferred_agents: ["ocean_research"],
      });
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

  return (
    <div className="space-y-6">
      {/* Workspace Banner */}
      <div className="p-5 rounded-2xl border border-orca-border bg-gradient-to-r from-orca-navy to-teal-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <LineChart className="w-4 h-4" />
            <span>Workspace 2 — Scientific Marine Monitoring</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Oceanographic Indicators & Time-Series Research</h2>
          <p className="text-xs text-orca-muted mt-1 max-w-2xl">
            Analyze available Sea Surface Temperature (SST) records, ocean-colour chlorophyll trends, and seasonal anomaly patterns.
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
        workspace="marine-monitoring"
        defaultQuery="Compare available sea-surface temperature observations off Karnataka across the past years and evaluate seasonal patterns."
        defaultLocation={{ latitude: 13.5, longitude: 74.2, name: "Karnataka Coastal Waters" }}
        onStartInvestigation={handleStartInvestigation}
        isLoading={isLoading}
      />

      {/* Map & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OceanMap
          latitude={13.5}
          longitude={74.2}
          title="Arabian Sea Oceanographic Transect"
          markers={[
            { lat: 13.5, lon: 74.2, label: "INCOIS Buoy Station", type: "station" },
            { lat: 14.1, lon: 74.0, label: "Outer Shelf Monitoring Point", type: "station" },
          ]}
        />
        <MarineChart
          title="Seasonal Sea Surface Temperature (SST) Climatology"
          data={sstData}
          unit="°C"
          primaryName="SST"
        />
      </div>

      {/* Findings & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <FindingsList
            findings={investigation?.findings || []}
            onSelectEvidence={(eid) => {
              const match = evidenceList.find((e) => e.id === eid);
              if (match) setSelectedEvidence(match);
            }}
          />
        </div>
        <div>
          <InvestigationEventsTimeline events={events} />
        </div>
      </div>

      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  );
};
