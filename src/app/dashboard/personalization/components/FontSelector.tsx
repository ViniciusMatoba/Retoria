import React from "react";
import { fontCatalog, ThemeConfig } from "../../../../lib/themeUtils";
import { getGoogleFontsLink } from "../../../p/[slug]/components/PublicThemeProvider";
import { Type } from "lucide-react";

interface FontSelectorProps {
  currentConfig: ThemeConfig;
  onChangeFont: (key: "headingFont" | "bodyFont", val: string) => void;
}

export default function FontSelector({
  currentConfig,
  onChangeFont
}: FontSelectorProps) {
  
  const fontLink = getGoogleFontsLink(currentConfig.headingFont, currentConfig.bodyFont);

  // Group fonts by category
  const categories = {
    modern: { label: "Modernas (Sans-Serif)", fonts: fontCatalog.filter(f => f.category === "modern") },
    humanized: { label: "Humanizadas (Suaves)", fonts: fontCatalog.filter(f => f.category === "humanized") },
    elegant: { label: "Elegantes (Serif)", fonts: fontCatalog.filter(f => f.category === "elegant") },
    strong: { label: "Fortes / Condensadas", fonts: fontCatalog.filter(f => f.category === "strong") }
  };

  const renderSelect = (key: "headingFont" | "bodyFont", label: string) => {
    const val = currentConfig[key];
    return (
      <div className="space-y-1.5 flex-1">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</label>
        <select
          value={val}
          onChange={(e) => onChangeFont(key, e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-semibold"
        >
          {Object.entries(categories).map(([catKey, cat]) => (
            <optgroup key={catKey} label={cat.label} className="bg-slate-950 text-slate-400 font-bold">
              {cat.fonts.map(font => (
                <option key={font.id} value={font.family} className="bg-slate-950 text-slate-200 font-normal">
                  {font.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hoist Fonts for Previews */}
      {fontLink && <link rel="stylesheet" href={fontLink} />}

      <div>
        <h3 className="text-sm font-bold text-slate-200">Escolha as Fontes</h3>
        <p className="text-xs text-slate-500">Configure famílias tipográficas distintas para dar personalidade aos títulos e parágrafos.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {renderSelect("headingFont", "Fonte dos Títulos (Cabeçalhos)")}
        {renderSelect("bodyFont", "Fonte do Texto (Parágrafos/Listas)")}
      </div>

      {/* Font Live Preview Box */}
      <div className="bg-slate-950/20 border border-slate-850 rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-850 pb-2 text-slate-400">
          <Type className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Demonstração das Fontes Ativas</span>
        </div>

        <div className="space-y-3 p-4 bg-slate-950/40 rounded-2xl border border-slate-900">
          <h1 
            style={{ fontFamily: `'${currentConfig.headingFont}', sans-serif` }}
            className="text-2xl font-extrabold text-slate-100"
          >
            Este é o Título do seu Negócio
          </h1>
          <h2 
            style={{ fontFamily: `'${currentConfig.headingFont}', sans-serif` }}
            className="text-sm font-bold text-indigo-400 uppercase tracking-widest"
          >
            Subtítulo ou Procedimento
          </h2>
          <p 
            style={{ fontFamily: `'${currentConfig.bodyFont}', sans-serif` }}
            className="text-xs text-slate-400 leading-relaxed font-normal"
          >
            Este é um exemplo de parágrafo descritivo. Os clientes poderão ler as informações dos procedimentos e serviços de forma legível e otimizada com esta fonte.
          </p>
          <div className="pt-2">
            <button 
              type="button"
              style={{ fontFamily: `'${currentConfig.bodyFont}', sans-serif` }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider"
            >
              Exemplo de CTA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
