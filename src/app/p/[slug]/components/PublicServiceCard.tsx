import React, { useState } from "react";
import Image from "next/image";
import { Clock, Check, Sparkles, Star } from "lucide-react";
import { buildVersionedImageUrl, getBestTextColor, isAllowedPublicImageUrl } from "../../../../lib/themeUtils";
import { hexToRgba } from "@/lib/slotDayStripes";

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
  popular?: boolean; // selo "Mais pedido"
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function PublicServiceCard({
  service,
  isSelected,
  onSelect,
  showServiceImages,
  cardStyle,
  cardRadius,
  primaryColor,
  popular = false,
}: PublicServiceCardProps) {
  const [imageError, setImageError] = useState(false);
  const rawUrl = service.imagemUrl ? buildVersionedImageUrl(service.imagemUrl, service.imagemUpdatedAt) : null;
  // Only pass URLs that next/image is configured to serve (local paths or Firebase Storage)
  const imageUrl = rawUrl && isAllowedPublicImageUrl(rawUrl) ? rawUrl : null;
  const hasPhoto = showServiceImages && !!imageUrl && !imageError;
  const soft = (a: number) => hexToRgba(primaryColor, a) ?? `rgba(128,128,128,${a})`;
  const showPrice = service.preco != null && (service.exibirPreco ?? true);
  const onPrimary = getBestTextColor(primaryColor);

  // Resolve card style classes
  let cardClass = "";
  const styleObj: React.CSSProperties = { borderRadius: `${cardRadius}px` };

  switch (cardStyle) {
    case "flat":
      cardClass = "bg-[var(--theme-surface)] border border-transparent";
      break;
    case "bordered":
      cardClass = "bg-[var(--theme-surface)] border border-[rgba(128,128,128,0.18)]";
      break;
    case "elevated":
      cardClass = "bg-[var(--theme-surface)] border border-transparent shadow-lg shadow-black/5";
      break;
    case "glass":
      cardClass = "bg-[rgba(15,23,42,0.4)] backdrop-blur-md border border-[rgba(255,255,255,0.08)]";
      break;
    default:
      cardClass = "bg-[var(--theme-surface)] border border-[rgba(128,128,128,0.18)]";
  }

  if (isSelected) {
    styleObj.borderColor = primaryColor;
    styleObj.boxShadow = `0 0 0 1.5px ${primaryColor}, 0 10px 24px -14px ${soft(0.6)}`;
  }

  const badge = popular && (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm"
      style={{ backgroundColor: primaryColor, color: onPrimary }}
    >
      <Star className="h-3 w-3 fill-current" aria-hidden="true" /> Mais pedido
    </span>
  );

  return (
    <button
      onClick={onSelect}
      style={styleObj}
      className={`
        w-full text-left flex flex-col sm:flex-row items-stretch gap-4 p-4 transition-all duration-250 cursor-pointer overflow-hidden active:scale-[0.99]
        ${cardClass}
        ${isSelected ? "rt-pop" : "hover:border-[rgba(128,128,128,0.35)]"}
      `}
    >
      {/* Foto do serviço (mantida). Sem foto, um ícone delicado na cor da página. */}
      {showServiceImages && (
        hasPhoto ? (
          <div
            style={{ borderRadius: `${Math.max(0, cardRadius - 4)}px` }}
            className="relative aspect-[16/9] sm:aspect-square w-full sm:w-28 shrink-0 overflow-hidden"
          >
            <Image
              src={imageUrl!}
              alt={service.imagemAlt || service.nome}
              fill
              sizes="(max-width: 640px) 100vw, 112px"
              loading="lazy"
              className="object-cover object-center transition-transform duration-300 hover:scale-105"
              onError={() => setImageError(true)}
            />
            {popular && <span className="absolute left-2 top-2">{badge}</span>}
          </div>
        ) : (
          <div
            aria-hidden="true"
            style={{ borderRadius: `${Math.max(8, cardRadius - 6)}px`, backgroundColor: soft(0.1), color: primaryColor }}
            className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center self-center"
          >
            <Sparkles className="h-6 w-6" />
          </div>
        )
      )}

      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          {popular && !hasPhoto && <div className="mb-1.5">{badge}</div>}
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-bold text-[var(--theme-text)] text-[15px] sm:text-base leading-snug">{service.nome}</h4>
            {showPrice && (
              <span className="shrink-0 text-base font-extrabold" style={{ color: primaryColor }}>
                {brlFmt.format(service.preco!)}
              </span>
            )}
          </div>
          {service.descricaoCurta && (
            <p className="text-xs text-[var(--theme-muted-text)] mt-1 line-clamp-2 leading-relaxed">
              {service.descricaoCurta}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-3">
          {/* Duração bem visível */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--theme-text)]"
            style={{ backgroundColor: soft(0.08), border: `1px solid ${soft(0.16)}` }}
          >
            <Clock className="h-3.5 w-3.5" style={{ color: primaryColor }} aria-hidden="true" />
            {service.duracaoEstimada}
          </span>

          <span
            style={isSelected
              ? { backgroundColor: primaryColor, borderColor: primaryColor, color: onPrimary }
              : { borderColor: soft(0.35), color: primaryColor }}
            className="px-3 py-1 rounded-full border text-[10px] uppercase font-black tracking-wider flex items-center gap-1 transition-all"
          >
            {isSelected && <Check className="rt-check-in h-3 w-3" />}
            <span>{isSelected ? "Selecionado" : "Selecionar"}</span>
          </span>
        </div>
      </div>
    </button>
  );
}
