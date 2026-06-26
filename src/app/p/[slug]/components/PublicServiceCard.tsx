import React, { useState } from "react";
import Image from "next/image";
import { Clock, Briefcase, Check } from "lucide-react";
import { buildVersionedImageUrl, isAllowedPublicImageUrl } from "../../../../lib/themeUtils";

interface Service {
  id: string;
  nome: string;
  descricaoCurta: string;
  duracaoEstimada: string;
  preco?: number | null;
  exibirPreco?: boolean;
  imagemUrl?: string | null;
  imagemStoragePath?: string | null;
  imagemAlt?: string | null;
  imagemUpdatedAt?: number | null;
}

interface PublicServiceCardProps {
  service: Service;
  isSelected: boolean;
  onSelect: () => void;
  showServiceImages: boolean;
  cardStyle: "flat" | "bordered" | "elevated" | "glass";
  cardRadius: number;
  primaryColor: string;
}

export default function PublicServiceCard({
  service,
  isSelected,
  onSelect,
  showServiceImages,
  cardStyle,
  cardRadius,
  primaryColor
}: PublicServiceCardProps) {
  const [imageError, setImageError] = useState(false);
  const rawUrl = service.imagemUrl ? buildVersionedImageUrl(service.imagemUrl, service.imagemUpdatedAt) : null;
  // Only pass URLs that next/image is configured to serve (local paths or Firebase Storage)
  const imageUrl = rawUrl && isAllowedPublicImageUrl(rawUrl) ? rawUrl : null;

  // Resolve card style classes
  let cardClass = "";
  const styleObj: React.CSSProperties = {
    borderRadius: `${cardRadius}px`
  };

  switch (cardStyle) {
    case "flat":
      cardClass = "bg-[var(--theme-surface)] border-transparent";
      break;
    case "bordered":
      cardClass = "bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)]";
      break;
    case "elevated":
      cardClass = "bg-[var(--theme-surface)] border-transparent shadow-xl shadow-black/10";
      break;
    case "glass":
      cardClass = "bg-[rgba(15,23,42,0.4)] backdrop-blur-md border border-[rgba(255,255,255,0.08)]";
      break;
    default:
      cardClass = "bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)]";
  }

  // Active border check
  if (isSelected) {
    styleObj.borderColor = primaryColor;
    styleObj.boxShadow = `0 0 0 1px ${primaryColor}`;
  }

  return (
    <button
      onClick={onSelect}
      style={styleObj}
      className={`
        w-full text-left flex flex-col sm:flex-row items-stretch gap-4 p-4 transition-all duration-250 cursor-pointer overflow-hidden
        ${cardClass}
        ${isSelected ? "" : "hover:border-[rgba(255,255,255,0.2)]"}
      `}
    >
      {/* Cover Image Container */}
      {showServiceImages && (
        <div 
          style={{ borderRadius: `${Math.max(0, cardRadius - 4)}px` }}
          className="relative aspect-[16/9] sm:aspect-square w-full sm:w-28 shrink-0 overflow-hidden bg-slate-950/60 border border-[rgba(255,255,255,0.05)]"
        >
          {imageUrl && !imageError ? (
            <Image
              src={imageUrl}
              alt={service.imagemAlt || service.nome}
              fill
              sizes="(max-width: 640px) 100vw, 112px"
              loading="lazy"
              className="object-cover object-center transition-transform duration-300 hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/40">
              <Briefcase className="h-6 w-6 opacity-30 mb-0.5" />
              <span className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Procedimento</span>
            </div>
          )}
        </div>
      )}

      {/* Details Area */}
      <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-bold text-[var(--theme-text)] truncate text-sm sm:text-base">{service.nome}</h4>
          </div>
          {service.descricaoCurta && (
            <p className="text-xs text-[var(--theme-muted-text)] mt-1.5 line-clamp-2 leading-relaxed">
              {service.descricaoCurta}
            </p>
          )}
        </div>

        {/* Selection Indicator */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[rgba(255,255,255,0.05)] text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[var(--theme-muted-text)]">
              <Clock className="h-3.5 w-3.5 opacity-60" />
              <span>
                Duração:{" "}
                <strong className="text-[var(--theme-text)] font-semibold">{service.duracaoEstimada}</strong>
              </span>
            </div>
            {service.preco != null && (service.exibirPreco ?? true) && (
              <span className="font-bold text-sm" style={{ color: primaryColor }}>
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.preco)}
              </span>
            )}
          </div>
          
          <div 
            style={{ 
              backgroundColor: isSelected ? `${primaryColor}15` : "transparent",
              borderColor: isSelected ? primaryColor : "rgba(255,255,255,0.08)",
              color: isSelected ? primaryColor : "var(--theme-muted-text)"
            }}
            className="px-3 py-1 rounded-lg border text-[10px] uppercase font-black tracking-wider flex items-center gap-1 transition-all"
          >
            {isSelected && <Check className="h-3 w-3" />}
            <span>{isSelected ? "Selecionado" : "Selecionar"}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
