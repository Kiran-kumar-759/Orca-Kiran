import React from "react";
import { Link2, AlertTriangle } from "lucide-react";
import { Finding } from "../../types";

interface Props {
  findings: Finding[];
  onSelectEvidence: (evidenceId: string) => void;
}

export const FindingsList: React.FC<Props> = ({ findings, onSelectEvidence }) => {
  if (!findings || findings.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-orca-border bg-orca-navy/40 text-center text-xs text-orca-muted">
        No findings currently generated. Run an investigation to produce evidence-backed findings.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Evidence-Backed Scientific Findings ({findings.length})
        </h3>
      </div>

      <div className="space-y-3">
        {findings.map((f) => (
          <div
            key={f.id}
            className="p-4 rounded-xl border border-orca-border bg-orca-navy/80 space-y-2.5 transition-all hover:border-cyan-500/30"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-slate-100 leading-snug">{f.claim}</h4>
              {f.value !== undefined && (
                <div className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-800/50 text-cyan-300 font-mono text-xs font-semibold whitespace-nowrap">
                  {String(f.value)} {f.unit || ""}
                </div>
              )}
            </div>

            {/* Uncertainty and Forecast indicators */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {f.is_forecast && (
                <span className="px-2 py-0.5 rounded bg-blue-950/70 border border-blue-800/40 text-blue-300 text-[11px]">
                  Forecast Window
                </span>
              )}
              {f.uncertainty && (
                <span className="text-orca-muted flex items-center space-x-1 text-[11px]">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Uncertainty: {f.uncertainty}</span>
                </span>
              )}
            </div>

            {/* Supporting Evidence Clickable Badges */}
            <div className="pt-2 border-t border-orca-border/40 flex items-center justify-between">
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                <span className="text-[11px] text-orca-muted mr-1">Cited Evidence:</span>
                {f.evidence_ids.length > 0 ? (
                  f.evidence_ids.map((eid) => (
                    <button
                      key={eid}
                      onClick={() => onSelectEvidence(eid)}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-orca-card hover:bg-cyan-950/60 border border-orca-border hover:border-cyan-500/40 text-cyan-300 hover:text-cyan-200 font-mono text-[11px] transition-colors"
                      title="Inspect immutable evidence record"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>{eid}</span>
                    </button>
                  ))
                ) : (
                  <span className="text-[11px] text-amber-400 font-medium">No cited evidence (Flagged)</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
