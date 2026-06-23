import React from "react";
import { ThemeConfig, validateHexColor, getContrastRatio, getBestTextColor } from "../../../../lib/themeUtils";
import { AlertTriangle, CheckCircle, Palette } from "lucide-react";

interface ThemeColorEditorProps {
  currentConfig: ThemeConfig;
  onChangeColor: (key: keyof ThemeConfig, val: string) => void;
}

export default function ThemeColorEditor({
  currentConfig,
  onChangeColor
}: ThemeColorEditorProps) {
  
  const colorItems = [
    { key: "primaryColor" as keyof ThemeConfig, label: "Cor Principal", desc: "Usada para botões, bordas ativas e realces principais." },
    { key: "secondaryColor" as keyof ThemeConfig, label: "Cor Secundária", desc: "Tons secundários de apoio em listas e pequenos ícones." },
    { key: "accentColor" as keyof ThemeConfig, label: "Cor de Destaque", desc: "Usada para chamar a atenção para estados especiais." },
    { key: "backgroundColor" as keyof ThemeConfig, label: "Cor de Fundo", desc: "Fundo geral da página (quando não houver imagem/gradiente)." },
    { key: "surfaceColor" as keyof ThemeConfig, label: "Superfície dos Cards", desc: "Fundo dos blocos de serviços, datas e formulários." },
    { key: "textColor" as keyof ThemeConfig, label: "Texto Principal", desc: "Cor dos títulos e dos textos informativos gerais." },
    { key: "mutedTextColor" as keyof ThemeConfig, label: "Texto Secundário / Muted", desc: "Cor de legendas, durações e descrições secundárias." }
  ];

  // Calculate contrast ratios
  const contrastBg = getContrastRatio(currentConfig.backgroundColor, currentConfig.textColor);
  const contrastCard = getContrastRatio(currentConfig.surfaceColor, currentConfig.textColor);
  
  // Best text color for button
  const bestButtonTextColor = getBestTextColor(currentConfig.primaryColor);
  const contrastButton = getContrastRatio(currentConfig.primaryColor, bestButtonTextColor);
  
  const contrastButtonBg = getContrastRatio(currentConfig.backgroundColor, currentConfig.primaryColor);

  const getContrastBadge = (ratio: number) => {
    const passed = ratio >= 4.5;
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${passed ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/10" : "bg-amber-500/10 text-amber-400 border border-amber-500/10"}`}>
        {passed ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        <span>Contraste: {ratio.toFixed(2)}:1 ({passed ? "Passou AA" : "Baixo Contraste"})</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-200">Personalize as Cores</h3>
        <p className="text-xs text-slate-500">Ajuste os tons hexadecimais. O sistema validará automaticamente as relações de acessibilidade.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Colors Inputs */}
        <div className="space-y-4">
          {colorItems.map((item) => {
            const val = currentConfig[item.key] as string;
            return (
              <div key={item.key} className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-350 uppercase tracking-wider">{item.label}</label>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">{val}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal mb-2.5">{item.desc}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={val}
                    onChange={(e) => onChangeColor(item.key, e.target.value)}
                    className="h-9 w-9 rounded-lg border border-slate-800 bg-slate-900 p-1 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={val}
                    maxLength={7}
                    onChange={(e) => {
                      const hex = e.target.value;
                      onChangeColor(item.key, hex);
                    }}
                    placeholder="#ffffff"
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Contrast Checker Dashboard */}
        <div className="bg-slate-950/20 border border-slate-850 rounded-3xl p-5 md:p-6 space-y-5 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <Palette className="h-4.5 w-4.5 text-indigo-400" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Validador de Contraste WCAG AA</h4>
          </div>

          <div className="space-y-4">
            {/* 1. Texto sobre Fundo */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-400">Texto principal sobre Fundo</span>
                {getContrastBadge(contrastBg)}
              </div>
              <div className="p-3 rounded-2xl text-xs font-medium border border-slate-850" style={{ backgroundColor: currentConfig.backgroundColor, color: currentConfig.textColor }}>
                Exemplo de texto principal sobre o fundo selecionado.
              </div>
            </div>

            {/* 2. Texto sobre Card */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-400">Texto principal sobre Cards</span>
                {getContrastBadge(contrastCard)}
              </div>
              <div className="p-3 rounded-2xl text-xs font-medium border border-slate-850" style={{ backgroundColor: currentConfig.surfaceColor, color: currentConfig.textColor }}>
                Exemplo de texto sobre a superfície dos cards.
              </div>
            </div>

            {/* 3. Texto sobre Botão */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-400">Texto do CTA sobre Botão Principal</span>
                {getContrastBadge(contrastButton)}
              </div>
              <div className="p-3 rounded-2xl text-xs font-bold text-center border border-slate-850 uppercase tracking-wider" style={{ backgroundColor: currentConfig.primaryColor, color: bestButtonTextColor }}>
                CONFIRMAR AGENDAMENTO
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                💡 O sistema selecionará automaticamente o texto <strong>{bestButtonTextColor === "#ffffff" ? "Branco" : "Escuro"}</strong> para este botão para maximizar o contraste.
              </p>
            </div>

            {/* 4. Botão sobre Fundo */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-400">Botão Principal sobre Fundo</span>
                {getContrastBadge(contrastButtonBg)}
              </div>
              {contrastButtonBg < 4.5 && (
                <p className="text-[10px] text-amber-400/90 font-medium">
                  ⚠️ O botão principal pode ter visibilidade comprometida em relação ao fundo da página.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
