import React from "react";
import { Search, Filter, RotateCcw } from "lucide-react";
import { HazardFilterState } from "../types";

interface Props {
  filters: HazardFilterState;
  onChange: (newFilters: Partial<HazardFilterState>) => void;
  onReset: () => void;
}

export const CycloneFilters: React.FC<Props> = ({ filters, onChange, onReset }) => {
  return (
    <div className="rounded-xl border border-orca-border bg-orca-navy/80 p-3.5 space-y-3 shadow-md backdrop-blur-md">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value, page: 1 })}
          placeholder="Search cyclone name (e.g. Tauktae) or SID..."
          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-orca-dark/90 border border-orca-border focus:border-cyan-400 focus:outline-none text-xs text-slate-200 placeholder-slate-500 transition-colors"
        />
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Basin Select */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
            Basin / Region
          </label>
          <select
            value={filters.basin}
            onChange={(e) => onChange({ basin: e.target.value, page: 1 })}
            className="w-full px-2 py-1.5 rounded-lg bg-orca-dark/90 border border-orca-border text-slate-200 focus:border-cyan-400 focus:outline-none text-xs"
          >
            <option value="all">All North Indian</option>
            <option value="arabian_sea">Arabian Sea</option>
            <option value="bay_of_bengal">Bay of Bengal</option>
          </select>
        </div>

        {/* Category Select */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value, page: 1 })}
            className="w-full px-2 py-1.5 rounded-lg bg-orca-dark/90 border border-orca-border text-slate-200 focus:border-cyan-400 focus:outline-none text-xs"
          >
            <option value="all">All Intensities</option>
            <option value="Tropical Depression">Tropical Depression</option>
            <option value="Tropical Storm">Tropical Storm</option>
            <option value="Category 1">Category 1</option>
            <option value="Category 2">Category 2</option>
            <option value="Category 3">Category 3</option>
            <option value="Category 4">Category 4</option>
            <option value="Category 5">Category 5</option>
          </select>
        </div>
      </div>

      {/* Sort Row */}
      <div className="flex items-center justify-between pt-1 border-t border-orca-border/50 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ sortBy: e.target.value, page: 1 })}
            className="px-2 py-1 rounded bg-orca-dark/90 border border-orca-border text-slate-300 text-[11px] focus:outline-none"
          >
            <option value="last_observed">Sort: Recent Date</option>
            <option value="first_observed">Sort: Earliest Date</option>
            <option value="name">Sort: Storm Name</option>
            <option value="id">Sort: Storm SID</option>
          </select>
          <button
            type="button"
            onClick={() =>
              onChange({
                sortOrder: filters.sortOrder === "desc" ? "asc" : "desc",
                page: 1,
              })
            }
            className="px-2 py-1 rounded bg-orca-dark/90 border border-orca-border text-slate-300 text-[11px] hover:text-cyan-300 font-mono"
            title="Toggle sort direction"
          >
            {filters.sortOrder.toUpperCase()}
          </button>
        </div>

        {/* Reset Action */}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center space-x-1 text-slate-400 hover:text-cyan-400 transition text-[11px]"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
