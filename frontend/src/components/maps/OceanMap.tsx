import React, { useRef } from "react";
import { MapPin, Layers, Compass } from "lucide-react";

interface Props {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  title?: string;
  markers?: Array<{
    lat: number;
    lon: number;
    label: string;
    type?: "station" | "cyclone" | "port" | "protected";
  }>;
  className?: string;
}

export const OceanMap: React.FC<Props> = ({
  latitude = 13.0,
  longitude = 74.0,
  zoom = 6,
  title = "Geospatial Marine Intelligence Map",
  markers = [],
  className = "h-80",
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-orca-border bg-orca-navy/80 flex flex-col ${className}`}>
      {/* Top Map Bar */}
      <div className="absolute top-0 inset-x-0 z-10 bg-orca-dark/80 backdrop-blur-md px-4 py-2 border-b border-orca-border flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
          <span className="font-semibold text-slate-200">{title}</span>
        </div>
        <div className="flex items-center space-x-3 text-orca-muted">
          <span>Center: {latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E (Zoom {zoom})</span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
            WGS84
          </span>
        </div>
      </div>

      {/* Visual Marine Cartographic Canvas */}
      <div ref={mapContainer} className="flex-1 w-full relative flex items-center justify-center bg-[#071321] overflow-hidden pt-8">
        {/* Gridded Nautical Bathymetry Pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, #38bdf8 1px, transparent 1px), linear-gradient(to right, #192d4a 1px, transparent 1px), linear-gradient(to bottom, #192d4a 1px, transparent 1px)`,
            backgroundSize: "24px 24px, 48px 48px, 48px 48px",
          }}
        />

        {/* Coastal / Bathymetry Aesthetic Depth Contours */}
        <div className="absolute w-[600px] h-[600px] rounded-full border border-cyan-500/10 pointer-events-none" />
        <div className="absolute w-[450px] h-[450px] rounded-full border border-cyan-500/15 pointer-events-none" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-teal-500/20 pointer-events-none" />

        {/* Center Target Indicator */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 animate-ping absolute inset-0" />
            <div className="w-8 h-8 rounded-full bg-cyan-500/30 border border-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.6)]">
              <MapPin className="w-4 h-4 text-cyan-300" />
            </div>
          </div>
          <span className="mt-2 px-2.5 py-1 rounded bg-orca-dark/90 border border-cyan-500/40 text-[11px] font-mono text-cyan-300 shadow-md">
            {latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E
          </span>
        </div>

        {/* Additional Feature Markers */}
        {markers.map((m, idx) => (
          <div
            key={idx}
            className="absolute z-10 flex items-center space-x-1.5 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              top: `${50 + (latitude - m.lat) * 20}%`,
              left: `${50 + (m.lon - longitude) * 20}%`,
            }}
          >
            <div className="w-3 h-3 rounded-full bg-teal-400 border border-white shadow-sm" />
            <span className="text-[10px] bg-orca-navy/90 px-1.5 py-0.5 rounded border border-orca-border text-slate-200 whitespace-nowrap">
              {m.label}
            </span>
          </div>
        ))}

        {/* Bottom map overlay controls */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-2 bg-orca-dark/90 px-3 py-1.5 rounded-lg border border-orca-border text-xs text-orca-muted">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Layer: Open-Meteo & IBTrACS Overlay</span>
        </div>
      </div>
    </div>
  );
};
