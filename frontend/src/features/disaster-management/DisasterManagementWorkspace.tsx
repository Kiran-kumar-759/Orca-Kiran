import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { InvestigationInput } from "../investigations/InvestigationInput";
import { FindingsList } from "../investigations/FindingsList";
import { InvestigationEventsTimeline } from "../investigations/InvestigationEventsTimeline";
import { OceanMap } from "../../components/maps/OceanMap";
import { MarineChart } from "../../components/charts/MarineChart";
import { VerificationBadge } from "../../components/evidence/VerificationBadge";
import { EvidenceDrawer } from "../../components/evidence/EvidenceDrawer";
import { apiClient } from "../../lib/api-client";
import { InvestigationResponse, ExecutionEvent, EvidenceRecord, InvestigationCreate } from "../../types";

export const DisasterManagementWorkspace: React.FC = () => {
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);

  const cycloneWindData = [
    { time: "May 14 00:00", value: 45 },
    { time: "May 15 06:00", value: 70 },
    { time: "May 16 12:00", value: 105 },
    { time: "May 17 18:00", value: 115 },
    { time: "May 18 12:00", value: 85 },
  ];

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

  return (
    <div className="space-y-6">
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

      <InvestigationInput
        workspace="disaster-management"
        defaultQuery="Investigate the latest available cyclone information relevant to the Arabian Sea, identify exposed coastal areas, and explain what remains uncertain."
        defaultLocation={{ latitude: 14.5, longitude: 71.8, name: "Arabian Sea Cyclone Corridor" }}
        onStartInvestigation={handleStartInvestigation}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OceanMap
          latitude={14.5}
          longitude={71.8}
          title="Cyclone Track Trajectory & Coastline Intersection"
          markers={[
            { lat: 12.2, lon: 72.8, label: "Tauktae Pt 1 (70 kts)", type: "cyclone" },
            { lat: 14.5, lon: 71.8, label: "Tauktae Pt 2 (105 kts)", type: "cyclone" },
            { lat: 19.2, lon: 71.2, label: "Tauktae Pt 3 (115 kts)", type: "cyclone" },
          ]}
        />
        <MarineChart
          title="Historical Cyclone Peak Sustained Wind Speed (knots)"
          data={cycloneWindData}
          unit="knots"
          primaryName="Sustained Wind"
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
