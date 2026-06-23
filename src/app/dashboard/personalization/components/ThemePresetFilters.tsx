"use client";

import React from "react";
import { Search } from "lucide-react";
import { SegmentFilter, SEGMENT_LABELS } from "@/lib/themePresetCatalog";

const ALL_SEGMENTS: SegmentFilter[] = [
  "beleza", "saúde", "bem-estar", "esporte", "criativo", "corporativo", "alimentação", "pet", "jovem",
];

interface ThemePresetFiltersProps {
  activeSegment: SegmentFilter | null;
  searchQuery: string;
  onSegmentChange: (segment: SegmentFilter | null) => void;
  onSearchChange: (query: string) => void;
}

export default function ThemePresetFilters({
  activeSegment,
  searchQuery,
  onSegmentChange,
  onSearchChange,
}: ThemePresetFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por nome, segmento ou palavra-chave..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Segment pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onSegmentChange(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
            activeSegment === null
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
          }`}
        >
          Todos
        </button>
        {ALL_SEGMENTS.map((seg) => (
          <button
            key={seg}
            type="button"
            onClick={() => onSegmentChange(activeSegment === seg ? null : seg)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
              activeSegment === seg
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
            }`}
          >
            {SEGMENT_LABELS[seg]}
          </button>
        ))}
      </div>
    </div>
  );
}
