import React from "react";
import { themePresets, ThemeConfig } from "../../../../lib/themeUtils";

interface ThemePresetSelectorProps {
  currentConfig: ThemeConfig;
  onSelectPreset: (presetName: string) => void;
}

export default function ThemePresetSelector({
  currentConfig,
  onSelectPreset
}: ThemePresetSelectorProps) {
  const presetsList = [
    { name: "minimalist", label: "Minimalista", desc: "Design limpo, focado em clareza com tons de cinza e azul." },
    { name: "elegant", label: "Elegante", desc: "Sofisticado, usa fontes serifadas e tons terrosos quentes." },
    { name: "natural", label: "Natural", desc: "Paleta verde ecológica e formas arredondadas amigáveis." },
    { name: "night", label: "Noturno", desc: "Visual escuro futurista com tons de azul profundo e indigo." },
    { name: "corporate", label: "Corporativo", desc: "Design formal focado em confiança, usando tons de azul-marinho." },
    { name: "vibrant", label: "Vibrante", desc: "Design alegre e enérgico com tons quentes e contrastes fortes." },
    { name: "delicate", label: "Delicado", desc: "Estética suave com tons pastel de rosa e linhas harmônicas." }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-200">Escolha um Tema Pronto</h3>
        <p className="text-xs text-slate-500">Selecione uma base inicial. Suas modificações serão aplicadas sobre o tema.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {presetsList.map((preset) => {
          const isSelected = currentConfig.preset === preset.name;
          const presetData = themePresets[preset.name];

          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => onSelectPreset(preset.name)}
              className={`
                p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all duration-200 cursor-pointer
                ${isSelected 
                  ? "bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/5" 
                  : "bg-slate-950/40 border-slate-800 hover:border-slate-750"
                }
              `}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-200">{preset.label}</span>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded text-[9px] bg-indigo-600/20 text-indigo-400 font-extrabold uppercase tracking-wider border border-indigo-500/20">
                      Ativo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{preset.desc}</p>
              </div>

              {/* Color dots preview */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-850 w-full">
                <span className="text-[10px] text-slate-550 font-bold mr-1">Paleta:</span>
                <span className="h-4 w-4 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: presetData.primaryColor }} title="Primária" />
                <span className="h-4 w-4 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: presetData.backgroundColor }} title="Fundo" />
                <span className="h-4 w-4 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: presetData.surfaceColor }} title="Superfície" />
                <span className="h-4 w-4 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: presetData.textColor }} title="Texto" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
