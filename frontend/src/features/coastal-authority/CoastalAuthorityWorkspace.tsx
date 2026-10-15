import React, { useState } from "react";
import { Landmark } from "lucide-react";
import { InvestigationInput } from "../investigations/InvestigationInput";
import { FindingsList } from "../investigations/FindingsList";
import { InvestigationEventsTimeline } from "../investigations/InvestigationEventsTimeline";
import { OceanMap } from "../../components/maps/OceanMap";
import { MarineChart } from "../../components/charts/MarineChart";
import { VerificationBadge } from "../../components/evidence/VerificationBadge";
import { EvidenceDrawer } from "../../components/evidence/EvidenceDrawer";
import { apiClient } from "../../lib/api-client";
import { InvestigationResponse, ExecutionEvent, EvidenceRecord, InvestigationCreate } from "../../types";

export const CoastalAuthorityWorkspace: React.FC = () => {
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const exposureData = [
    { time: "Buffer 5km", value: 45000 },
    { time: "Buffer 10km", value: 120000 },
    { time: "Buffer 20km", value: 290000 },
    { time: "Buffer 50km", value: 680000 },
  ];

  const handleStartInvestigation = async (payload: InvestigationCreate) => {
    setIsLoading(true);
    try {
      const res = await apiClient.createInvestigation({
        ...payload,
        preferred_agents: ["coastal_risk", "marine_hazard"],
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
      <div className="p-5 rounded-2xl border border-orca-border bg-gradient-to-r from-orca-navy to-indigo-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Landmark className="w-4 h-4" />
            <span>Workspace 4 — Coastal Planning & Authority</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Settlement Exposure & Critical Infrastructure</h2>
          <p className="text-xs text-orca-muted mt-1 max-w-2xl">
            Evaluate geographic intersections between coastal hazard footprints, critical port infrastructure, and gridded population exposures.
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
        workspace="coastal-authority"
        defaultQuery="Using the coastal hazard boundary and population datasets, identify intersecting settlements and estimate potential population exposure."
        defaultLocation={{ latitude: 12.9347, longitude: 74.8211, name: "New Mangalore Port Zone" }}
        onStartInvestigation={handleStartInvestigation}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OceanMap
          latitude={12.9347}
          longitude={74.8211}
          title="Coastal Infrastructure & Settlement Density"
          markers={[
            { lat: 12.9347, lon: 74.8211, label: "New Mangalore Port", type: "port" },
            { lat: 12.87, lon: 74.88, label: "Ullal Coastal Settlement", type: "station" },
          ]}
        />
        <MarineChart
          title="Estimated Population Exposure by Hazard Distance Buffer"
          data={exposureData}
          unit="residents"
          primaryName="Exposed Population"
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
