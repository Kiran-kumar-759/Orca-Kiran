import React, { useMemo, useState } from "react";
import { Compass, ZoomIn, ZoomOut, RotateCcw, AlertCircle } from "lucide-react";
import { HazardTrackPoint } from "../types";

interface Props {
  stormName: string;
  stormId: string;
  basin: string | null;
  trackPoints: HazardTrackPoint[];
  isLoading: boolean;
  selectedPointIndex?: number | null;
  onSelectPoint?: (index: number) => void;
  className?: string;
  source?: string;
}

const formatCoord = (lat: number | null | undefined, lon: number | null | undefined): string => {
  if (lat === null || lat === undefined || lon === null || lon === undefined || isNaN(lat) || isNaN(lon)) {
    return "N/A";
  }
  const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
  const lonStr = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
  return `${latStr}, ${lonStr}`;
};

export const CycloneMap: React.FC<Props> = ({
  stormName,
  stormId,
  basin,
  trackPoints,
  isLoading,
  selectedPointIndex,
  onSelectPoint,
  className = "h-[440px]",
  source,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ point: HazardTrackPoint; index: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Filter valid points only (never plot null coordinates or 0,0)
  const validPoints = useMemo(() => {
    return trackPoints.filter(
      (p) =>
        p.latitude !== null &&
        p.longitude !== null &&
        typeof p.latitude === "number" &&
        typeof p.longitude === "number" &&
        !isNaN(p.latitude) &&
        !isNaN(p.longitude) &&
        p.latitude >= -90 &&
        p.latitude <= 90 &&
        !(p.latitude === 0 && p.longitude === 0)
    );
  }, [trackPoints]);

  const isSingleFix = validPoints.length === 1;

  // Compute bounding box
  const bounds = useMemo(() => {
    if (validPoints.length === 0) {
      // Default to North Indian Ocean (Arabian Sea + Bay of Bengal)
      return { minLat: 5.0, maxLat: 25.0, minLon: 60.0, maxLon: 95.0 };
    }
    const lats = validPoints.map((p) => p.latitude);
    const lons = validPoints.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    if (validPoints.length === 1) {
      // Single advisory fix (e.g. live GDACS alert)
      // Provide an oceanic sector bounding box around the centroid (±5° lat, ±7.5° lon)
      return {
        minLat: Math.max(-90, minLat - 5.0),
        maxLat: Math.min(90, maxLat + 5.0),
        minLon: minLon - 7.5,
        maxLon: maxLon + 7.5,
      };
    }

    const latPadding = Math.max((maxLat - minLat) * 0.15, 2.0);
    const lonPadding = Math.max((maxLon - minLon) * 0.15, 2.0);

    return {
      minLat: Math.max(-90, minLat - latPadding),
      maxLat: Math.min(90, maxLat + latPadding),
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding,
    };
  }, [validPoints]);

  // Project geographic coordinates to SVG coordinates [0..100]
  const project = (lat: number, lon: number) => {
    const lonSpan = bounds.maxLon - bounds.minLon || 1;
    const latSpan = bounds.maxLat - bounds.minLat || 1;
    const x = ((lon - bounds.minLon) / lonSpan) * 100;
    const y = ((bounds.maxLat - lat) / latSpan) * 100;
    return { x, y };
  };

  // Generate SVG path string for multi-point trajectories
  const pathD = useMemo(() => {
    if (validPoints.length < 2) return "";
    return validPoints
      .map((pt, idx) => {
        const { x, y } = project(pt.latitude, pt.longitude);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [validPoints, bounds]);

  // Cartographic Graticules (Latitude & Longitude grid lines with degree labels)
  const graticules = useMemo(() => {
    const latSpan = bounds.maxLat - bounds.minLat;
    const lonSpan = bounds.maxLon - bounds.minLon;
    const latStep = latSpan > 25 ? 5 : latSpan > 10 ? 3 : 2;
    const lonStep = lonSpan > 25 ? 5 : lonSpan > 10 ? 3 : 2;

    const latLines: number[] = [];
    const startLat = Math.ceil(bounds.minLat / latStep) * latStep;
    for (let lat = startLat; lat < bounds.maxLat; lat += latStep) {
      latLines.push(lat);
    }

    const lonLines: number[] = [];
    const startLon = Math.ceil(bounds.minLon / lonStep) * lonStep;
    for (let lon = startLon; lon < bounds.maxLon; lon += lonStep) {
      lonLines.push(lon);
    }

    return { latLines, lonLines };
  }, [bounds]);

  const getCategoryColor = (cat: string | null | undefined, wind: number | null | undefined) => {
    const c = (cat || "").toLowerCase();
    if (c.includes("red")) return "#ef4444"; // Red Alert
    if (c.includes("orange")) return "#f97316"; // Orange Alert
    if (c.includes("green")) return "#22c55e"; // Green Alert
    if (c.includes("5")) return "#d946ef"; // Category 5 - Fuchsia
    if (c.includes("4")) return "#ef4444"; // Category 4 - Red
    if (c.includes("3")) return "#f97316"; // Category 3 - Orange
    if (c.includes("2")) return "#eab308"; // Category 2 - Yellow
    if (c.includes("1")) return "#22c55e"; // Category 1 - Green
    if (c.includes("storm") || (wind && wind >= 34)) return "#06b6d4"; // Tropical Storm - Cyan
    if (c.includes("depression") || (wind && wind >= 20)) return "#3b82f6"; // Depression - Blue
    return "#94a3b8"; // Default slate
  };

  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;

  const isGdacs = source === "GDACS" || stormId.startsWith("hz-gdacs-");

  return (
    <div className={`relative rounded-xl overflow-hidden border border-orca-border bg-[#071321] flex flex-col ${className}`}>
      {/* Top Map Header */}
      <div className="bg-orca-dark/90 backdrop-blur-md px-4 py-2.5 border-b border-orca-border flex items-center justify-between text-xs z-10">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
          <span className="font-semibold text-slate-100">
            {stormName
              ? `${stormName} (${stormId}) ${isSingleFix ? "Active Centroid Advisory" : "Track Progression"}`
              : "Cartographic Maritime Chart"}
          </span>
          {basin && (
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
              {basin.replace("_", " ")}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          <span className="hidden sm:inline font-mono text-[11px]">
            Center: {formatCoord(centerLat, centerLon)}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 font-mono text-[10px]">
            {isGdacs ? "WGS84 • GDACS Live Feed" : "WGS84 • NOAA IBTrACS Archive"}
          </span>
        </div>
      </div>

      {/* Main Cartographic View */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center">
        {/* Gridded Nautical Bathymetry Pattern */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #38bdf8 1px, transparent 1px), linear-gradient(to right, #192d4a 1px, transparent 1px), linear-gradient(to bottom, #192d4a 1px, transparent 1px)`,
            backgroundSize: "32px 32px, 64px 64px, 64px 64px",
          }}
        />

        {/* Ocean Depth Rings */}
        <div className="absolute w-[600px] h-[600px] rounded-full border border-cyan-500/10 pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-cyan-500/15 pointer-events-none" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-orca-dark/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="mt-3 text-xs text-slate-300 font-mono">Loading track points from PostgreSQL...</span>
          </div>
        )}

        {/* No Track Points Notice */}
        {!isLoading && validPoints.length === 0 && (
          <div className="z-20 text-center p-6 max-w-sm">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-200">No Valid Coordinates</h4>
            <p className="text-xs text-slate-400 mt-1">
              This storm record does not contain valid geographic coordinate fixes.
            </p>
          </div>
        )}

        {/* SVG Track Renderer */}
        {validPoints.length > 0 && (
          <svg
            className="w-full h-full p-8"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center", transition: "transform 0.2s ease" }}
          >
            <defs>
              <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.9" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Cartographic Coordinate Graticule Lines (Lat/Lon grid) */}
            {graticules.latLines.map((lat) => {
              const { y } = project(lat, bounds.minLon);
              if (y < 2 || y > 98) return null;
              const label = `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}`;
              return (
                <g key={`lat-${lat}`} className="pointer-events-none opacity-40">
                  <line
                    x1="0"
                    y1={y}
                    x2="100"
                    y2={y}
                    stroke="#1e3a5f"
                    strokeWidth="0.35"
                    strokeDasharray="1.5,1.5"
                  />
                  <text
                    x="1.5"
                    y={Math.max(3, y - 0.8)}
                    fill="#64748b"
                    fontSize="1.8"
                    fontFamily="monospace"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            {graticules.lonLines.map((lon) => {
              const { x } = project(bounds.minLat, lon);
              if (x < 2 || x > 98) return null;
              const label = `${Math.abs(lon)}°${lon >= 0 ? "E" : "W"}`;
              return (
                <g key={`lon-${lon}`} className="pointer-events-none opacity-40">
                  <line
                    x1={x}
                    y1="0"
                    x2={x}
                    y2="100"
                    stroke="#1e3a5f"
                    strokeWidth="0.35"
                    strokeDasharray="1.5,1.5"
                  />
                  <text
                    x={Math.min(94, x + 0.8)}
                    y="98.5"
                    fill="#64748b"
                    fontSize="1.8"
                    fontFamily="monospace"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Trajectory glow path */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeOpacity="0.3"
                filter="url(#glow)"
              />
            )}

            {/* Connecting Track Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="url(#trackGradient)"
                strokeWidth="1.2"
                strokeDasharray="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Track Point Markers */}
            {validPoints.map((pt, idx) => {
              const { x, y } = project(pt.latitude, pt.longitude);
              const color = getCategoryColor(pt.category, pt.wind_speed_knots);
              const isSelected = selectedPointIndex === idx;
              const isStart = idx === 0;
              const isEnd = idx === validPoints.length - 1;
              const radius = isSingleFix ? 2.8 : isSelected ? 3.0 : isStart || isEnd ? 2.2 : 1.4;

              return (
                <g key={idx} className="cursor-pointer group">
                  {/* Single advisory beacon concentric rings */}
                  {isSingleFix && (
                    <>
                      <circle
                        cx={x}
                        cy={y}
                        r="6.5"
                        fill="none"
                        stroke={color}
                        strokeWidth="0.5"
                        className="animate-ping opacity-60"
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r="11.0"
                        fill="none"
                        stroke={color}
                        strokeWidth="0.35"
                        strokeDasharray="1.5,1.5"
                        className="opacity-50"
                      />
                    </>
                  )}

                  {/* Multi-point Selection pulse ring */}
                  {!isSingleFix && isSelected && (
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="0.8"
                      className="animate-ping"
                    />
                  )}

                  {/* Marker Node */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={isSelected || isSingleFix ? "0.8" : "0.4"}
                    className="transition-transform duration-150 hover:scale-150"
                    onMouseEnter={() => setHoveredPoint({ point: pt, index: idx })}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => onSelectPoint && onSelectPoint(idx)}
                  />

                  {/* Start / End / Live Centroid Labels */}
                  {validPoints.length > 1 && isStart && (
                    <text
                      x={x}
                      y={y - 3}
                      textAnchor="middle"
                      fill="#22c55e"
                      fontSize="2.5"
                      fontWeight="bold"
                    >
                      START
                    </text>
                  )}
                  {validPoints.length > 1 && isEnd && (
                    <text
                      x={x}
                      y={y - 3}
                      textAnchor="middle"
                      fill="#ef4444"
                      fontSize="2.5"
                      fontWeight="bold"
                    >
                      END
                    </text>
                  )}
                  {validPoints.length === 1 && (
                    <g>
                      <rect
                        x={x - 17}
                        y={y - 8.5}
                        width="34"
                        height="4.5"
                        rx="1"
                        fill="#071321"
                        stroke={color}
                        strokeWidth="0.3"
                        opacity="0.9"
                      />
                      <text
                        x={x}
                        y={y - 5.5}
                        textAnchor="middle"
                        fill={color}
                        fontSize="2.2"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        ACTIVE CENTROID FIX
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Informative Single Advisory Banner Overlay */}
        {isSingleFix && (
          <div className="absolute top-3 left-3 right-3 sm:right-auto z-10 bg-orca-navy/90 border border-cyan-800/60 rounded-lg px-3 py-1.5 text-[11px] text-cyan-200 backdrop-blur-md shadow-md flex items-center space-x-2 max-w-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span className="leading-snug">
              <strong>Active Bulletin Centroid Fix:</strong> Real-time GDACS feed publishes the current monitored eye position. Switch to the <strong>Historical</strong> tab to view multi-day polyline tracks.
            </span>
          </div>
        )}

        {/* Floating Tooltip for Hovered/Selected Point */}
        {hoveredPoint && (
          <div className="absolute top-12 left-4 z-20 bg-orca-dark/95 border border-cyan-500/40 rounded-lg p-3 text-xs shadow-xl backdrop-blur-md pointer-events-none max-w-xs">
            <div className="font-semibold text-cyan-300">
              {isSingleFix ? "Active Advisory Centroid Fix" : `Fix #${hoveredPoint.index + 1} of ${validPoints.length}`}
            </div>
            <div className="text-slate-300 font-mono mt-1 text-[11px]">
              UTC: {new Date(hoveredPoint.point.time).toUTCString()}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px]">
              <div>
                <span className="text-slate-400">Coords:</span>{" "}
                <span className="text-slate-200">
                  {formatCoord(hoveredPoint.point.latitude, hoveredPoint.point.longitude)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Wind:</span>{" "}
                <span className="text-slate-200">
                  {hoveredPoint.point.wind_speed_knots !== null
                    ? `${hoveredPoint.point.wind_speed_knots} kts`
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Pressure:</span>{" "}
                <span className="text-slate-200">
                  {hoveredPoint.point.pressure_hpa !== null
                    ? `${hoveredPoint.point.pressure_hpa} hPa`
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Category:</span>{" "}
                <span className="text-slate-200 font-medium">
                  {hoveredPoint.point.category || "Unclassified"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Map Viewport Controls */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-1.5 bg-orca-dark/90 p-1 rounded-lg border border-orca-border text-slate-300">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
            className="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
            className="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={() => setZoomLevel(1)}
            className="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Legend */}
        <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center space-x-3 bg-orca-dark/90 px-3 py-1.5 rounded-lg border border-orca-border text-[11px] text-slate-300">
          <span className="text-slate-400 font-medium">Scale:</span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>Depression</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            <span>Tropical Storm</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
            <span>Cat 1-2</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span>Cat 3+</span>
          </span>
        </div>
      </div>
    </div>
  );
};
