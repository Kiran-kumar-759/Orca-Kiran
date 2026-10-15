import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  time: string;
  value: number;
  secondary?: number;
}

interface Props {
  title: string;
  data: DataPoint[];
  unit: string;
  primaryKey?: string;
  primaryName?: string;
  className?: string;
}

export const MarineChart: React.FC<Props> = ({
  title,
  data,
  unit,
  primaryKey = "value",
  primaryName = "Observed / Forecast",
  className = "h-64",
}) => {
  return (
    <div className={`p-4 rounded-xl border border-orca-border bg-orca-navy/70 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">{title}</h4>
        <span className="text-xs text-orca-muted">Unit: {unit}</span>
      </div>

      <div className="flex-1 w-full min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="marineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e2e8f0",
              }}
              formatter={(val: any) => [`${val} ${unit}`, primaryName]}
            />
            <Area
              type="monotone"
              dataKey={primaryKey}
              stroke="#06b6d4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#marineGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
