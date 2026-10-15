import React, { useState } from "react";
import { Send, MapPin, Sparkles, Loader2 } from "lucide-react";
import { InvestigationCreate, LocationContext } from "../../types";

interface Props {
  workspace: string;
  defaultQuery: string;
  defaultLocation?: LocationContext;
  onStartInvestigation: (payload: InvestigationCreate) => void;
  isLoading: boolean;
}

export const InvestigationInput: React.FC<Props> = ({
  workspace,
  defaultQuery,
  defaultLocation = { latitude: 12.91, longitude: 74.85, name: "Offshore Mangaluru" },
  onStartInvestigation,
  isLoading,
}) => {
  const [query, setQuery] = useState(defaultQuery);
  const [lat, setLat] = useState(defaultLocation.latitude);
  const [lon, setLon] = useState(defaultLocation.longitude);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    onStartInvestigation({
      workspace,
      query: query.trim(),
      location: {
        latitude: lat,
        longitude: lon,
        name: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-orca-border bg-orca-navy/80 shadow-xl space-y-3">
      <div className="flex items-center justify-between text-xs text-orca-muted">
        <div className="flex items-center space-x-1.5">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="font-medium text-slate-200">ORCA Multi-Agent Scientific Investigation</span>
        </div>
        <button
          type="button"
          onClick={() => setShowLocationPicker(!showLocationPicker)}
          className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-medium"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Location: {lat.toFixed(2)}°N, {lon.toFixed(2)}°E</span>
        </button>
      </div>

      {showLocationPicker && (
        <div className="p-3 rounded-lg bg-orca-dark/80 border border-orca-border grid grid-cols-2 gap-3 text-xs animate-in fade-in duration-150">
          <div>
            <label className="block text-orca-muted mb-1">Target Latitude (WGS84)</label>
            <input
              type="number"
              step="0.01"
              value={lat}
              onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded bg-orca-navy border border-orca-border text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-orca-muted mb-1">Target Longitude (WGS84)</label>
            <input
              type="number"
              step="0.01"
              value={lon}
              onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded bg-orca-navy border border-orca-border text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask an oceanographic question or coastal hazard query..."
          className="flex-1 px-4 py-2.5 rounded-lg bg-orca-dark border border-orca-border text-slate-100 text-sm focus:outline-none focus:border-cyan-400 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-medium text-sm flex items-center space-x-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Executing Agents...</span>
            </>
          ) : (
            <>
              <span>Investigate</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
