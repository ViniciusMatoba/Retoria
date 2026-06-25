import React, { useState } from "react";
import { ThemeConfig, gradientPresets, bgPatterns, getBestTextColor } from "../../../../lib/themeUtils";
import PublicThemeProvider from "../../../p/[slug]/components/PublicThemeProvider";
import PublicServiceCard from "../../../p/[slug]/components/PublicServiceCard";
import { formatPhoneFriendly } from "../../../../lib/contactUtils";
import { Smartphone, Phone, MessageCircle, MapPin, ChevronRight } from "lucide-react";

interface ThemePreviewProps {
  themeConfig: ThemeConfig;
  businessName: string;
  professionalName: string;
  fotoLogoUrl: string;
  descricaoCurta: string;
  showResponsibleName?: boolean;
  showWelcomeMessage?: boolean;
  showPublicPhone?: boolean;
  showPublicWhatsApp?: boolean;
  showPublicAddress?: boolean;
  publicPhone?: string;
  telefoneWhatsapp?: string;
  addressText?: string;
}

export default function ThemePreview({
  themeConfig,
  businessName,
  professionalName,
  fotoLogoUrl,
  descricaoCurta,
  showResponsibleName = true,
  showWelcomeMessage = true,
  showPublicPhone = false,
  showPublicWhatsApp = false,
  showPublicAddress = false,
  publicPhone = "",
  telefoneWhatsapp = "",
  addressText = "",
}: ThemePreviewProps) {
  const [selectedServiceId, setSelectedServiceId] = useState("srv-1");
  const initials = businessName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  // Mock services for preview
  const mockServices = [
    {
      id: "srv-1",
      nome: "Limpeza de pele profunda",
      descricaoCurta: "Higienização facial com remoção de cravos e máscara hidratante especial.",
      duracaoEstimada: "60 min",
      imagemUrl: "/demo/service-preview.svg",
      imagemAlt: "Imagem demonstrativa do serviço",
      imagemUpdatedAt: null
    },
    {
      id: "srv-2",
      nome: "Design de Sobrancelhas",
      descricaoCurta: "Modelagem harmônica com pinça e aplicação opcional de henna.",
      duracaoEstimada: "30 min",
      imagemUrl: null,
      imagemAlt: null,
      imagemUpdatedAt: null
    }
  ];

  // Resolve background style inline
  let bgStyle: React.CSSProperties = {};
  if (themeConfig.backgroundType === "solid") {
    bgStyle.backgroundColor = themeConfig.backgroundColor;
  } else if (themeConfig.backgroundType === "gradient" && themeConfig.backgroundGradient) {
    bgStyle.background = gradientPresets[themeConfig.backgroundGradient] || themeConfig.backgroundColor;
  } else if (themeConfig.backgroundType === "preset" && themeConfig.backgroundPreset) {
    bgStyle.background = bgPatterns[themeConfig.backgroundPreset]?.css || themeConfig.backgroundColor;
    if (themeConfig.backgroundPreset === "texturized") {
      // Texture is dot grid
      bgStyle.backgroundSize = "20px 20px";
    }
  } else if (themeConfig.backgroundType === "image" && themeConfig.backgroundImageUrl) {
    bgStyle.backgroundImage = `url(${themeConfig.backgroundImageUrl}?v=${themeConfig.backgroundUpdatedAt})`;
    bgStyle.backgroundPosition = themeConfig.backgroundPosition;
    bgStyle.backgroundSize = themeConfig.backgroundSize;
    // Don't apply fixed inside preview frame scroll
    bgStyle.backgroundAttachment = "scroll";
  }

  // Resolve button style classes
  let btnRadiusClass = "";
  if (themeConfig.buttonStyle === "square") btnRadiusClass = "rounded-none";
  else if (themeConfig.buttonStyle === "soft") btnRadiusClass = "rounded-lg";
  else if (themeConfig.buttonStyle === "rounded") btnRadiusClass = "rounded-2xl";
  else if (themeConfig.buttonStyle === "pill") btnRadiusClass = "rounded-full";

  // Resolve card style classes
  let cardClass = "";
  const cardRadiusStyle = { borderRadius: `${themeConfig.cardRadius}px` };
  switch (themeConfig.cardStyle) {
    case "flat":
      cardClass = "bg-[var(--theme-surface)] border-transparent";
      break;
    case "bordered":
      cardClass = "bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)]";
      break;
    case "elevated":
      cardClass = "bg-[var(--theme-surface)] border-transparent shadow-lg shadow-black/10";
      break;
    case "glass":
      cardClass = "bg-[rgba(15,23,42,0.4)] backdrop-blur-md border border-[rgba(255,255,255,0.08)]";
      break;
    default:
      cardClass = "bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)]";
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-3 shrink-0 lg:sticky lg:top-8">
      <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-wider">
        <Smartphone className="h-4 w-4 text-indigo-400" />
        <span>Pré-visualização em Tempo Real (Mobile)</span>
      </div>

      {/* iPhone Frame Simulator Container */}
      <div className="relative w-[340px] h-[650px] border-[10px] border-slate-800 rounded-[48px] bg-slate-950 overflow-hidden shadow-2xl relative flex flex-col justify-start select-none ring-1 ring-slate-800">
        
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-5 bg-slate-800 rounded-b-2xl z-30 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mr-2" />
          <span className="w-10 h-1 bg-slate-900 rounded-full" />
        </div>

        {/* Public Page Simulation Content */}
        <PublicThemeProvider themeConfig={themeConfig}>
          <div 
            style={bgStyle} 
            className="w-full h-full overflow-y-auto px-4 py-8 relative flex flex-col justify-start gap-4 scrollbar-none"
          >
            {/* Background Overlay */}
            {themeConfig.backgroundType === "image" && themeConfig.backgroundOverlay > 0 && (
              <div 
                className={`absolute inset-0 pointer-events-none z-0 ${themeConfig.backgroundOverlayColor === "dark" ? "bg-black" : "bg-white"}`}
                style={{ opacity: themeConfig.backgroundOverlay / 100 }}
              />
            )}

            <div className="z-10 space-y-4 pt-4">
              
              {/* Brand Header */}
              <div 
                style={cardRadiusStyle}
                className={`p-4 text-center flex flex-col items-center relative overflow-hidden ${cardClass}`}
              >
                {/* Topbrand Color Accent Stripe */}
                <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: themeConfig.primaryColor }} />

                {themeConfig.showProfileImage && (
                  <div className="h-12 w-12 rounded-xl border border-[rgba(255,255,255,0.08)] bg-slate-950/60 flex items-center justify-center overflow-hidden mb-2.5 shadow-md">
                    {fotoLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fotoLogoUrl} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-black" style={{ color: themeConfig.primaryColor }}>{initials}</span>
                    )}
                  </div>
                )}
                <h1 className="text-sm font-extrabold text-[var(--theme-text)] truncate max-w-[200px]" style={{ fontFamily: `'${themeConfig.headingFont}', sans-serif` }}>
                  {businessName || "Nome do Negócio"}
                </h1>
                {showResponsibleName && (
                  <p className="text-[10px] text-[var(--theme-muted-text)] font-semibold mt-0.5">Responsável: {professionalName || "Profissional"}</p>
                )}
                {showWelcomeMessage && descricaoCurta && (
                  <p className="text-[10px] text-[var(--theme-muted-text)] mt-2 leading-relaxed max-w-[220px] line-clamp-2">
                    {descricaoCurta}
                  </p>
                )}

                {/* Contact row */}
                {(showPublicPhone || showPublicWhatsApp) && (
                  <div className="mt-3 pt-2.5 border-t border-[rgba(255,255,255,0.07)] w-full flex flex-wrap items-center justify-center gap-1.5">
                    {showPublicPhone && publicPhone && (
                      <span
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-semibold border border-[rgba(255,255,255,0.1)] bg-[var(--theme-surface)] text-[var(--theme-text)] ${btnRadiusClass}`}
                      >
                        <Phone className="h-2.5 w-2.5 shrink-0" style={{ color: themeConfig.primaryColor }} />
                        <span>{formatPhoneFriendly(publicPhone)}</span>
                      </span>
                    )}
                    {showPublicWhatsApp && telefoneWhatsapp && (
                      <span
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-semibold ${btnRadiusClass}`}
                        style={{ backgroundColor: themeConfig.primaryColor, color: getBestTextColor(themeConfig.primaryColor) }}
                      >
                        <MessageCircle className="h-2.5 w-2.5 shrink-0" />
                        <span>WhatsApp</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Address */}
                {showPublicAddress && addressText && (
                  <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.07)] w-full flex items-center justify-center gap-1 text-[9px] text-[var(--theme-muted-text)]">
                    <MapPin className="h-2.5 w-2.5 shrink-0" style={{ color: themeConfig.primaryColor }} />
                    <span className="truncate max-w-[200px]">{addressText}</span>
                  </div>
                )}
              </div>

              {/* Progress Steps Header */}
              <div className="bg-[rgba(15,23,42,0.4)] backdrop-blur-sm border border-[rgba(255,255,255,0.05)] rounded-2xl px-3 py-2 flex justify-between items-center text-[10px] font-bold text-[var(--theme-muted-text)]">
                <span className="text-[var(--theme-primary)] font-black">1. Serviço</span>
                <ChevronRight className="h-2.5 w-2.5 text-slate-700" />
                <span className="opacity-50">2. Horário</span>
                <ChevronRight className="h-2.5 w-2.5 text-slate-700" />
                <span className="opacity-50">3. Dados</span>
              </div>

              {/* Services List Panel */}
              <div 
                style={cardRadiusStyle}
                className={`p-4 space-y-3 ${cardClass}`}
              >
                <div>
                  <h2 className="text-xs font-black text-[var(--theme-text)]" style={{ fontFamily: `'${themeConfig.headingFont}', sans-serif` }}>Escolha o serviço</h2>
                  <p className="text-[9px] text-[var(--theme-muted-text)] mt-0.5">Selecione uma opção para continuar.</p>
                </div>

                <div className="space-y-2">
                  {mockServices.map((srv) => (
                    <PublicServiceCard
                      key={srv.id}
                      service={srv}
                      isSelected={selectedServiceId === srv.id}
                      onSelect={() => setSelectedServiceId(srv.id)}
                      showServiceImages={themeConfig.showServiceImages}
                      cardStyle={themeConfig.cardStyle}
                      cardRadius={themeConfig.cardRadius}
                      primaryColor={themeConfig.primaryColor}
                    />
                  ))}
                </div>

                {/* Primary Button */}
                <button
                  type="button"
                  style={{ 
                    backgroundColor: themeConfig.primaryColor,
                    color: getBestTextColor(themeConfig.primaryColor),
                    fontFamily: `'${themeConfig.bodyFont}', sans-serif`
                  }}
                  className={`w-full py-2.5 px-4 font-extrabold text-[10px] uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1.5 shadow-md ${btnRadiusClass}`}
                >
                  <span>Próximo Passo</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>
          </div>
        </PublicThemeProvider>
      </div>
    </div>
  );
}
