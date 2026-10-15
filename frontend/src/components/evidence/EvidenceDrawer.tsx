import React from "react";
import { X, ExternalLink, Database, Clock, MapPin } from "lucide-react";
import { EvidenceRecord } from "../../types";
import { formatDateTime } from "../../lib/utils";

interface Props {
  evidence: EvidenceRecord | null;
  onClose: () => void;
}

export const EvidenceDrawer: React.FC<Props> = ({ evidence, onClose }) => {
  if (!evidence) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-orca-navy border-l border-orca-border shadow-2xl h-full flex flex-col p-6 overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-orca-border">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-slate-100">Evidence Record Provenance</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-orca-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Evidence Content */}
        <div className="mt-6 space-y-5 text-sm">
          {/* Evidence ID & Source */}
          <div className="p-3.5 rounded-lg bg-orca-dark/80 border border-orca-border">
            <span className="text-xs text-orca-muted block mb-1">Evidence ID</span>
            <code className="text-cyan-300 font-mono text-xs font-semibold">{evidence.id}</code>
            <div className="mt-2 text-xs">
              <span className="text-orca-muted">Source Provider: </span>
              <span className="text-slate-200 font-medium">{evidence.source_name}</span>
            </div>
            {evidence.source_url && (
              <a
                href={evidence.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 underline"
              >
                <span>Inspect Source Provider URL</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Measurements */}
          <div className="p-3.5 rounded-lg bg-orca-dark/80 border border-orca-border">
            <span className="text-xs text-orca-muted block mb-2">Recorded Measurement</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-orca-muted block">Variable:</span>
                <span className="font-semibold text-slate-200">{evidence.variable || "General indicator"}</span>
              </div>
              <div>
                <span className="text-orca-muted block">Value & Unit:</span>
                <span className="font-semibold text-cyan-300">
                  {evidence.value !== undefined ? String(evidence.value) : "Recorded"} {evidence.unit || ""}
                </span>
              </div>
            </div>
          </div>

          {/* Time & Spatio-temporal provenance */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-orca-muted uppercase tracking-wider">Provenance & Coverage</h4>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-center space-x-2 text-slate-300">
                <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Observed Time: {formatDateTime(evidence.observation_time)}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300">
                <Clock className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Retrieved Time (UTC): {formatDateTime(evidence.retrieval_time)}</span>
              </div>
              {(evidence.latitude !== undefined || evidence.longitude !== undefined) && (
                <div className="flex items-center space-x-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>
                    Coordinates: {evidence.latitude?.toFixed(4)}, {evidence.longitude?.toFixed(4)} (WGS84)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quality & Licensing */}
          <div className="p-3 rounded-lg bg-orca-card/50 border border-orca-border text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-orca-muted">Quality Flag:</span>
              <span className="text-emerald-300 font-medium capitalize">{evidence.quality_flag || "Unvalidated"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-orca-muted">License / Terms:</span>
              <span className="text-slate-300">{evidence.license || "Open Data Policy"}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-orca-border">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-lg bg-orca-card hover:bg-orca-border text-slate-200 text-xs font-medium transition-colors"
          >
            Close Provenance Panel
          </button>
        </div>
      </div>
    </div>
  );
};
