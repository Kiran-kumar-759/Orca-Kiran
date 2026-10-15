import React from "react";
import { CheckCircle2, Play, Activity, Database, AlertCircle, ShieldCheck } from "lucide-react";
import { ExecutionEvent } from "../../types";
import { formatDateTime } from "../../lib/utils";

interface Props {
  events: ExecutionEvent[];
}

export const InvestigationEventsTimeline: React.FC<Props> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-orca-border bg-orca-navy/40 text-center text-xs text-orca-muted">
        No execution trace recorded yet. Start an investigation to observe real-time agent coordination.
      </div>
    );
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "investigation_started":
        return <Play className="w-3.5 h-3.5 text-cyan-400" />;
      case "agent_started":
        return <Activity className="w-3.5 h-3.5 text-blue-400" />;
      case "evidence_added":
        return <Database className="w-3.5 h-3.5 text-teal-400" />;
      case "verification_passed":
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case "verification_failed":
        return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
      case "investigation_completed":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="p-4 rounded-xl border border-orca-border bg-orca-navy/60 space-y-3">
      <div className="flex items-center justify-between border-b border-orca-border/50 pb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Genuine Agent Execution Event Trace
        </h4>
        <span className="text-[11px] text-orca-muted">{events.length} lifecycle events</span>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="flex items-start space-x-2.5 text-xs p-2 rounded-lg bg-orca-dark/60 border border-orca-border/40"
          >
            <div className="mt-0.5 p-1 rounded bg-orca-navy border border-orca-border flex-shrink-0">
              {getEventIcon(evt.event_type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 capitalize">
                  {evt.event_type.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-orca-muted font-mono">{formatDateTime(evt.timestamp)}</span>
              </div>
              {evt.agent_id && (
                <div className="text-[11px] text-cyan-400 font-medium">Agent: {evt.agent_id}</div>
              )}
              {evt.payload && Object.keys(evt.payload).length > 0 && (
                <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                  {JSON.stringify(evt.payload)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
