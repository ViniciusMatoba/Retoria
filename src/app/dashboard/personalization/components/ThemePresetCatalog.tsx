"use client";

import React, { useMemo, useState } from "react";
import {
  themePresetCatalog,
  searchThemePresets,
  getThemePresetsBySegment,
  ThemePreset,
  SegmentFilter,
} from "@/lib/themePresetCatalog";
import { ThemeConfig } from "@/lib/themeUtils";
import { Professional, Service, AvailableSlot } from "@/app/p/[slug]/components/PublicBookingExperience";
import ThemePresetFilters from "./ThemePresetFilters";
import ThemePresetCard from "./ThemePresetCard";
import ThemePresetPreviewModal from "./ThemePresetPreviewModal";

interface ThemePresetCatalogProps {
  currentPresetId: string;
  professional: Professional;
  services: Service[];
  slots: AvailableSlot[];
  onApply: (theme: ThemeConfig, presetId: string) => void;
}

export default function ThemePresetCatalog({
  currentPresetId,
  professional,
  services,
  slots,
  onApply,
}: ThemePresetCatalogProps) {
  const [activeSegment, setActiveSegment] = useState<SegmentFilter | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPreset, setPreviewPreset] = useState<ThemePreset | null>(null);

  const filteredPresets = useMemo(() => {
    let list = searchQuery
      ? searchThemePresets(searchQuery)
      : activeSegment
      ? getThemePresetsBySegment(activeSegment)
      : themePresetCatalog;

    return [...list].sort((a, b) => a.order - b.order);
  }, [activeSegment, searchQuery]);

  const handleApplyFromModal = (theme: ThemeConfig, presetId: string) => {
    onApply(theme, presetId);
    setPreviewPreset(null);
  };

  return (
    <>
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Temas Profissionais</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Escolha um tema pronto como base. Você pode personalizar qualquer detalhe depois.
          </p>
        </div>

        <ThemePresetFilters
          activeSegment={activeSegment}
          searchQuery={searchQuery}
          onSegmentChange={setActiveSegment}
          onSearchChange={setSearchQuery}
        />

        {filteredPresets.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhum tema encontrado para <span className="font-bold text-slate-400">&ldquo;{searchQuery}&rdquo;</span>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredPresets.map((preset) => (
              <ThemePresetCard
                key={preset.id}
                preset={preset}
                isActive={currentPresetId === preset.id}
                onPreview={setPreviewPreset}
                onApply={onApply}
              />
            ))}
          </div>
        )}
      </div>

      {previewPreset && (
        <ThemePresetPreviewModal
          preset={previewPreset}
          professional={professional}
          services={services}
          slots={slots}
          onClose={() => setPreviewPreset(null)}
          onApply={handleApplyFromModal}
        />
      )}
    </>
  );
}
