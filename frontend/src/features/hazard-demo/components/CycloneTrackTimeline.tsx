import React from "react";
import { Clock, Navigation, Wind, Gauge, Layers } from "lucide-react";
import { HazardTrackPoint } from "../types";

interface Props {
  trackPoints: HazardTrackPoint[];
  isLoading: boolean;
  selectedPointIndex?: number | null;
  onSelectPoint?: (index: number) => void;
}

const formatCoordinates = (lat: number | null | undefined, lon: number | null | undefined): string => {
  if (lat === null || lat === undefined || lon === null || lon === undefined || isNaN(lat) || isNaN(lon)) {
    return "N/A";
  }
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
  return `${latStr}, ${lonStr}`;
};

export const CycloneTrackTimeline: React.FC<Props> = ({
  trackPoints,
  isLoading,
  selectedPointIndex,
  onSelectPoint,
}) => {
  const isSingleFix = trackPoints.length === 1;

  return (
    <div className="rounded-xl border border-orca-border bg-orca-navy/80 flex flex-col h-[320px] shadow-lg backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-orca-border/80 flex items-center justify-between text-xs bg-orca-dark/60">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-100">
            {isSingleFix ? "Active Advisory Bulletin Fix" : "Chronological Track Progression"}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          {isSingleFix ? "1 active advisory fix" : `${trackPoints.length} total fixes`}
        </span>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-2" />
            <span>Loading chronological track fixes...</span>
          </div>
        ) : trackPoints.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-500">
            No track points recorded for this event.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-orca-dark/80 text-slate-400 text-[10px] uppercase font-semibold sticky top-0 border-b border-orca-border/60">
              <tr>
                <th className="py-2 px-3">Fix #</th>
                <th className="py-2 px-3">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>UTC Timestamp</span>
                  </span>
                </th>
                <th className="py-2 px-3">
                  <span className="flex items-center space-x-1">
                    <Navigation className="w-3 h-3" />
                    <span>Lat / Lon</span>
                  </span>
                </th>
                <th className="py-2 px-3">
                  <span className="flex items-center space-x-1">
                    <Wind className="w-3 h-3" />
                    <span>Wind (kts)</span>
                  </span>
                </th>
                <th className="py-2 px-3">
                  <span className="flex items-center space-x-1">
                    <Gauge className="w-3 h-3" />
                    <span>Pressure</span>
                  </span>
                </th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orca-border/40 text-[11px] font-mono">
              {trackPoints.map((pt, idx) => {
                const isSelected = selectedPointIndex === idx;
                const dateObj = new Date(pt.time);
                const timeStr = isNaN(dateObj.getTime())
                  ? pt.time
                  : dateObj.toISOString().replace("T", " ").replace(":00.000Z", " UTC");

                return (
                  <tr
                    key={idx}
                    onClick={() => onSelectPoint && onSelectPoint(idx)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "hover:bg-orca-card/50 text-slate-300"
                    }`}
                  >
                    <td className="py-1.5 px-3 font-semibold text-slate-400">
                      #{idx + 1}
                    </td>
                    <td className="py-1.5 px-3 text-slate-200 whitespace-nowrap">
                      {timeStr}
                    </td>
                    <td className="py-1.5 px-3 text-slate-300 whitespace-nowrap">
                      {formatCoordinates(pt.latitude, pt.longitude)}
                    </td>
                    <td className="py-1.5 px-3">
                      {pt.wind_speed_knots !== null && pt.wind_speed_knots !== undefined ? (
                        <span className="font-semibold text-cyan-300">
                          {pt.wind_speed_knots}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-normal">N/A</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3">
                      {pt.pressure_hpa !== null && pt.pressure_hpa !== undefined ? (
                        <span className="text-teal-300">{pt.pressure_hpa} hPa</span>
                      ) : (
                        <span className="text-slate-500 font-normal">N/A</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-300">
                        {pt.category || "Unclassified"}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 font-sans text-[10px] text-emerald-400">
                      Observed
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
