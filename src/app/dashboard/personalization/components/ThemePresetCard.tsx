import React from "react";
import { Eye, Check, Sun, Moon } from "lucide-react";
import { ThemePreset, SEGMENT_LABELS } from "@/lib/themePresetCatalog";
import { ThemeConfig } from "@/lib/themeUtils";
import ThemePresetThumbnail from "./ThemePresetThumbnail";

interface ThemePresetCardProps {
  preset: ThemePreset;
  isActive: boolean;
  onPreview: (preset: ThemePreset) => void;
  onApply: (theme: ThemeConfig, presetId: string) => void;
}

const BADGE_STYLES: Record<string, string> = {
  recommended: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  new: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
};

const BADGE_LABELS: Record<string, string> = {
  recommended: "Recomendado",
  new: "Novo",
};

export default function ThemePresetCard({ preset, isActive, onPreview, onApply }: ThemePresetCardProps) {
  const { theme: t } = preset;

  return (
    <div
      className={`rounded-2xl border flex flex-col gap-0 overflow-hidden transition-all duration-200 ${
        isActive
          ? "border-indigo-500 shadow-lg shadow-indigo-500/10 bg-slate-900"
          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative w-full h-[110px] overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <ThemePresetThumbnail preset={preset} size="md" />
        </div>
        {/* Active badge */}
        {isActive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600/90 text-white text-[10px] font-extrabold shadow">
            <Check className="h-2.5 w-2.5" />
            Ativo
          </div>
        )}
        {/* Mode indicator */}
        <div className="absolute top-2 left-2">
          {preset.mode === "dark" ? (
            <Moon className="h-3.5 w-3.5 text-slate-300 drop-shadow" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-amber-400 drop-shadow" />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold text-sm text-slate-100 leading-tight">{preset.name}</span>
          {preset.badge && (
            <span className={`shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${BADGE_STYLES[preset.badge]}`}>
              {BADGE_LABELS[preset.badge]}
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{preset.shortDescription}</p>

        {/* Fonts */}
        <p className="text-[10px] text-slate-500">
          <span className="font-bold text-slate-400">Fontes:</span>{" "}
          {t.headingFont === t.bodyFont ? t.headingFont : `${t.headingFont} + ${t.bodyFont}`}
        </p>

        {/* Color dots */}
        <div className="flex items-center gap-1.5">
          {[t.primaryColor, t.backgroundColor, t.surfaceColor, t.accentColor].map((color, i) => (
            <span
              key={i}
              className="h-4 w-4 rounded-full border border-black/20 shrink-0"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Segments */}
        <div className="flex flex-wrap gap-1">
          {preset.recommendedSegments.slice(0, 3).map((seg) => (
            <span
              key={seg}
              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-750"
            >
              {SEGMENT_LABELS[seg]}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-slate-800/60 mt-auto">
        <button
          type="button"
          onClick={() => onPreview(preset)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Ver prévia
        </button>
        <button
          type="button"
          onClick={() => onApply(preset.theme, preset.id)}
          disabled={isActive}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-default text-white text-[11px] font-bold transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          {isActive ? "Aplicado" : "Usar este tema"}
        </button>
      </div>
    </div>
  );
}
