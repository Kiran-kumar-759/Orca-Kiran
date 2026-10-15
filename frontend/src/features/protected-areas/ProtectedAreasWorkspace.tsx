import React, { useState } from "react";
import { Shield } from "lucide-react";
import { InvestigationInput } from "../investigations/InvestigationInput";
import { FindingsList } from "../investigations/FindingsList";
import { InvestigationEventsTimeline } from "../investigations/InvestigationEventsTimeline";
import { OceanMap } from "../../components/maps/OceanMap";
import { MarineChart } from "../../components/charts/MarineChart";
import { VerificationBadge } from "../../components/evidence/VerificationBadge";
import { EvidenceDrawer } from "../../components/evidence/EvidenceDrawer";
import { apiClient } from "../../lib/api-client";
import { InvestigationResponse, ExecutionEvent, EvidenceRecord, InvestigationCreate } from "../../types";

export const ProtectedAreasWorkspace: React.FC = () => {
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const chlorophyllData = [
    { time: "Q1", value: 0.32 },
    { time: "Q2", value: 0.45 },
    { time: "Q3", value: 1.15 },
    { time: "Q4", value: 0.58 },
  ];

  const handleStartInvestigation = async (payload: InvestigationCreate) => {
    setIsLoading(true);
    try {
      const res = await apiClient.createInvestigation({
        ...payload,
        preferred_agents: ["ocean_research", "coastal_risk"],
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
      <div className="p-5 rounded-2xl border border-orca-border bg-gradient-to-r from-orca-navy to-emerald-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            <span>Workspace 3 — Marine Protected Areas & Conservation</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Reserve Boundaries & Ecological Health Monitoring</h2>
          <p className="text-xs text-orca-muted mt-1 max-w-2xl">
            Audit environmental indicators (chlorophyll-a, SST) inside and outside protected marine zones, and evaluate external hazard exposure.
          </p>
        </div>

        {investigation?.verification_summary && (
          <div className="flex items-center space-x-2 bg-orca-dark/80 px-4 py-2.5 rounded-xl border border-orca-border">
            <span className="text-xs text-orca-muted">Audit:</span>
            <VerificationBadge state={investigation.verification_summary.overall_state} />
          </div>
        )}
      </div>

      <InvestigationInput
        workspace="protected-areas"
        defaultQuery="Compare available temperature and chlorophyll observations inside and outside the Netrani Island biodiversity zone."
        defaultLocation={{ latitude: 14.0175, longitude: 74.3278, name: "Netrani Island MPA" }}
        onStartInvestigation={handleStartInvestigation}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OceanMap
          latitude={14.0175}
          longitude={74.3278}
          title="Netrani Island Marine Sanctuary & Surrounds"
          markers={[
            { lat: 14.0175, lon: 74.3278, label: "Netrani Protected Core", type: "protected" },
            { lat: 14.15, lon: 74.4, label: "Coastal Buffer Boundary", type: "station" },
          ]}
        />
        <MarineChart
          title="Seasonal Chlorophyll-a Phytoplankton Proxy"
          data={chlorophyllData}
          unit="mg/m³"
          primaryName="Chlorophyll-a"
        />
      </div>

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
