import React from "react";
import { ThemeConfig } from "../../../../lib/themeUtils";
import { ToggleLeft, ToggleRight, Layout, Sliders } from "lucide-react";

interface ComponentStyleEditorProps {
  currentConfig: ThemeConfig;
  onChangeField: (key: keyof ThemeConfig, val: any) => void;
}

export default function ComponentStyleEditor({
  currentConfig,
  onChangeField
}: ComponentStyleEditorProps) {
  
  const buttonStyles = [
    { value: "square", label: "Quadrado", radius: "0px" },
    { value: "soft", label: "Suave", radius: "8px" },
    { value: "rounded", label: "Arredondado", radius: "16px" },
    { value: "pill", label: "Pílula", radius: "9999px" }
  ];

  const cardStyles = [
    { value: "flat", label: "Plano (Flat)", desc: "Sem borda ou sombras, apenas fundo sólido." },
    { value: "bordered", label: "Bordas (Bordered)", desc: "Bordas sutis ao redor do card." },
    { value: "elevated", label: "Elevado (Elevated)", desc: "Sombra projetada para efeito 3D." },
    { value: "glass", label: "Efeito Vidro (Glass)", desc: "Semi-transparência com desfoque de fundo." }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-200">Estilos de Componentes</h3>
        <p className="text-xs text-slate-500">Personalize o formato dos botões de ação e dos cartões de serviços na sua página.</p>
      </div>

      {/* 1. Buttons */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Formato dos Botões</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {buttonStyles.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => onChangeField("buttonStyle", style.value)}
              className={`
                p-3 rounded-2xl border text-center flex flex-col items-center justify-between gap-3 transition-all cursor-pointer
                ${currentConfig.buttonStyle === style.value 
                  ? "bg-slate-900 border-indigo-500 shadow-md" 
                  : "bg-slate-950/40 border-slate-800 hover:border-slate-750"
                }
              `}
            >
              <span className="font-bold text-xs text-slate-200">{style.label}</span>
              <div 
                className="h-8 w-16 bg-indigo-600 flex items-center justify-center text-[10px] text-white font-extrabold shadow-sm border border-black/10 shrink-0" 
                style={{ borderRadius: style.radius }}
              >
                CTA
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Cards */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Estilo dos Cartões (Cards)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cardStyles.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => onChangeField("cardStyle", style.value)}
              className={`
                p-4 rounded-2xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer
                ${currentConfig.cardStyle === style.value 
                  ? "bg-slate-900 border-indigo-500 shadow-md" 
                  : "bg-slate-950/40 border-slate-800 hover:border-slate-750"
                }
              `}
            >
              <span className="font-bold text-xs text-slate-200">{style.label}</span>
              <span className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{style.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Card Radius */}
      <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3">
        <div className="flex justify-between items-center text-xs">
          <label className="font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
            <Layout className="h-4 w-4 text-indigo-400" />
            <span>Arredondamento dos Cards</span>
          </label>
          <span className="font-mono font-bold text-slate-300">{currentConfig.cardRadius}px</span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {[0, 8, 12, 16, 24, 32].map((radius) => (
            <button
              key={radius}
              type="button"
              onClick={() => onChangeField("cardRadius", radius)}
              className={`
                py-1.5 px-1 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer
                ${currentConfig.cardRadius === radius 
                  ? "bg-indigo-650 border-indigo-500 text-white" 
                  : "bg-slate-950 border-slate-800 text-slate-400"
                }
              `}
            >
              {radius}px
            </button>
          ))}
        </div>
      </div>

      {/* 4. Visibilidade de Imagens */}
      <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-850 pb-2 text-slate-350">
          <Sliders className="h-4.5 w-4.5 text-indigo-450" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Imagens e Elementos Visuais</span>
        </div>

        <div className="space-y-4">
          {/* showProfileImage */}
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-bold text-slate-200">Exibir Imagem de Logo no Perfil</span>
              <span className="text-[10px] text-slate-500 mt-0.5 block leading-normal">
                Mostra ou oculta a sua foto circular no topo da página de agendamento.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onChangeField("showProfileImage", !currentConfig.showProfileImage)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {currentConfig.showProfileImage ? (
                <ToggleRight className="h-7 w-7 text-emerald-500" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-slate-655" />
              )}
            </button>
          </div>

          {/* profileImageSize */}
          {currentConfig.showProfileImage && (
            <div>
              <span className="block text-xs font-bold text-slate-200 mb-2">Tamanho da Foto / Logo</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(["sm", "md", "lg", "xl"] as const).map((size) => {
                  const labels: Record<string, string> = { sm: "Pequeno", md: "Médio", lg: "Grande", xl: "Extra" };
                  const active = (currentConfig.profileImageSize ?? "md") === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onChangeField("profileImageSize", size)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-all border ${active ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}
                    >
                      {labels[size]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* showServiceImages */}
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-bold text-slate-200">Exibir Imagens dos Serviços</span>
              <span className="text-[10px] text-slate-500 mt-0.5 block leading-normal">
                Mostra a foto de capa do procedimento nos cards de agendamento público.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onChangeField("showServiceImages", !currentConfig.showServiceImages)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {currentConfig.showServiceImages ? (
                <ToggleRight className="h-7 w-7 text-emerald-500" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-slate-655" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
