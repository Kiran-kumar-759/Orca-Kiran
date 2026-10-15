import React from "react";
import { NavLink } from "react-router-dom";
import { Anchor, LineChart, Shield, Landmark, AlertTriangle } from "lucide-react";

export const workspaces = [
  {
    id: "fisherman",
    name: "Fisherman",
    path: "/fisherman",
    icon: Anchor,
    tagline: "Marine conditions, wave forecasts & hazard warnings",
  },
  {
    id: "marine-monitoring",
    name: "Marine Monitoring",
    path: "/marine-monitoring",
    icon: LineChart,
    tagline: "SST time-series, seasonal trends & anomaly detection",
  },
  {
    id: "protected-areas",
    name: "Protected Areas",
    path: "/protected-areas",
    icon: Shield,
    tagline: "Marine reserve boundaries & ecological monitoring",
  },
  {
    id: "coastal-authority",
    name: "Coastal Authority",
    path: "/coastal-authority",
    icon: Landmark,
    tagline: "Settlement exposure, ports & infrastructure impact",
  },
  {
    id: "disaster-management",
    name: "Disaster Management",
    path: "/disaster-management",
    icon: AlertTriangle,
    tagline: "Cyclone track playback & multi-hazard risk assessment",
  },
];

export const WorkspaceNav: React.FC = () => {
  return (
    <nav className="border-b border-orca-border bg-orca-navy/40 px-6 py-2 flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar">
      {workspaces.map((ws) => {
        const Icon = ws.icon;
        return (
          <NavLink
            key={ws.id}
            to={ws.path}
            className={({ isActive }) =>
              `flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-orca-card/50 border border-transparent"
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{ws.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
