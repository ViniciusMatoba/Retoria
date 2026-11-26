"use client";

import React, { useState } from "react";
import { Phone, MessageCircle, MapPin, ChevronDown, Map as MapIcon, Navigation } from "lucide-react";
import { hexToRgba } from "@/lib/slotDayStripes";
import {
  PublicAddress,
  ServiceLocationType,
  SERVICE_LOCATION_LABELS,
  buildTelUrl,
  buildWhatsAppUrl,
  formatPublicAddress,
  getWelcomeMessage,
  hasMinimalAddress,
  isValidPhone,
} from "@/lib/contactUtils";
import { ThemeConfig, getBestTextColor } from "@/lib/themeUtils";
import DirectionsModal from "./DirectionsModal";

const Instagram = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

export interface PublicProfileInfo {
  // Core (always present)
  nomeNegocio: string;
  nome: string;
  fotoLogoUrl?: string;

  // Welcome message — reuses descricaoCurta
  descricaoCurta?: string;

  // Contact
  telefoneWhatsapp?: string; // booking WhatsApp — reused for public display
  publicPhone?: string;      // optional separate voice phone
  instagram?: string;        // optional instagram handle

  // Address
  serviceLocationType?: ServiceLocationType;
  publicAddress?: PublicAddress | null;

  // Visibility flags — all default false except nome/message
  showResponsibleName?: boolean;
  showWelcomeMessage?: boolean;
  showPublicPhone?: boolean;
  showPublicWhatsApp?: boolean;
  showPublicAddress?: boolean;
  showMiniMap?: boolean;
  showPublicInstagram?: boolean;
}

interface PublicProfessionalHeaderProps {
  profile: PublicProfileInfo;
  theme: ThemeConfig;
  isPreview?: boolean;
  /** Foto de trabalho na capa (visual "app", ligado por conta). Sem foto: capa em degradê. */
  coverImageUrl?: string | null;
}

export default function PublicProfessionalHeader({
  profile,
  theme,
  isPreview = false,
  coverImageUrl = null,
}: PublicProfessionalHeaderProps) {
  const [showDirections, setShowDirections] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const corBrand = theme.primaryColor;
  const initials = profile.nomeNegocio
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Resolve visibility with safe defaults for old profiles
  const showResponsible = profile.showResponsibleName ?? true;
  const showMessage = profile.showWelcomeMessage ?? true;
  const showPhone = !!(profile.showPublicPhone && profile.publicPhone && isValidPhone(profile.publicPhone));
  const showWhatsApp = !!(profile.showPublicWhatsApp && profile.telefoneWhatsapp && isValidPhone(profile.telefoneWhatsapp));
  const showAddress = !!(profile.showPublicAddress && hasMinimalAddress(profile.publicAddress));
  const showMap = !!(profile.showMiniMap && showAddress);
  const showInstagram = !!(profile.showPublicInstagram && profile.instagram);

  const welcomeMessage = getWelcomeMessage(profile.descricaoCurta);

  // Resolve card style
  let cardClass = "";
  switch (theme.cardStyle) {
    case "flat":     cardClass = "bg-[var(--theme-surface)] border-transparent"; break;
    case "bordered": cardClass = "bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)]"; break;
    case "elevated": cardClass = "bg-[var(--theme-surface)] border-transparent shadow-2xl shadow-black/20"; break;
    case "glass":    cardClass = "bg-[rgba(15,23,42,0.4)] backdrop-blur-md border border-[rgba(255,255,255,0.08)]"; break;
    default:         cardClass = "bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)]";
  }

  const cardRadiusStyle = { borderRadius: `${theme.cardRadius}px` };

  const locationLabel = profile.serviceLocationType
    ? SERVICE_LOCATION_LABELS[profile.serviceLocationType]
    : null;

  const showLocationBadge =
    profile.serviceLocationType && profile.serviceLocationType !== "physical";

  // Address section logic
  const addressText = formatPublicAddress(profile.publicAddress);

  // Build Google Maps embed URL — uses coordinates when available, falls back to address string
  const mapsEmbedUrl = (() => {
    const addr = profile.publicAddress;
    if (!addr) return null;
    if (addr.latitude != null && addr.longitude != null) {
      return `https://maps.google.com/maps?q=${addr.latitude},${addr.longitude}&z=16&output=embed`;
    }
    const query = encodeURIComponent(addressText ?? "");
    if (!query) return null;
    return `https://maps.google.com/maps?q=${query}&output=embed`;
  })();

  const canShowDirections =
    hasMinimalAddress(profile.publicAddress) &&
    profile.serviceLocationType !== "online";

  const handleDirectionsClick = () => {
    if (isPreview) {
      setShowDirections(true); // show the modal in preview but it blocks navigation
      return;
    }
    setShowDirections(true);
  };

  // Tamanho do logo redondo (px) e quanto ele "sobe" sobre a capa
  const logoPx = { sm: 64, md: 88, lg: 112, xl: 132 }[theme.profileImageSize ?? "md"] ?? 88;
  const brandSoft = (a: number) => hexToRgba(corBrand, a) ?? `rgba(128,128,128,${a})`;

  // Ações rápidas em botões redondos lado a lado
  type QuickAction = { key: string; label: string; icon: React.ReactNode; href?: string; external?: boolean; onClick?: () => void; filled?: boolean; ariaLabel: string };
  const actions: QuickAction[] = [];
  if (showWhatsApp && profile.telefoneWhatsapp) {
    actions.push({ key: "wa", label: "WhatsApp", icon: <MessageCircle className="h-5 w-5" aria-hidden="true" />, href: buildWhatsAppUrl(profile.telefoneWhatsapp), external: true, filled: true, ariaLabel: `WhatsApp de ${profile.nomeNegocio}` });
  }
  if (showInstagram && profile.instagram) {
    actions.push({ key: "ig", label: "Instagram", icon: <Instagram className="h-5 w-5" aria-hidden="true" />, href: `https://instagram.com/${profile.instagram}`, external: true, ariaLabel: `Instagram de ${profile.nomeNegocio}` });
  }
  if (showPhone && profile.publicPhone) {
    actions.push({ key: "tel", label: "Ligar", icon: <Phone className="h-5 w-5" aria-hidden="true" />, href: buildTelUrl(profile.publicPhone), ariaLabel: `Ligar para ${profile.nomeNegocio}` });
  }
  if (showAddress && canShowDirections && profile.serviceLocationType !== "mobile") {
    actions.push({ key: "dir", label: "Como chegar", icon: <Navigation className="h-5 w-5" aria-hidden="true" />, onClick: handleDirectionsClick, ariaLabel: "Como chegar" });
  }

  return (
    <>
      <div
        style={cardRadiusStyle}
        className={`text-center flex flex-col items-center shadow-lg relative overflow-hidden ${cardClass}`}
      >
        {/* Capa: degradê na cor da página com brilhos suaves (só CSS) */}
        <div
          aria-hidden="true"
          className={`relative w-full overflow-hidden ${coverImageUrl ? "h-40 sm:h-44" : "h-28 sm:h-32"}`}
          style={{ background: `linear-gradient(135deg, ${corBrand} 0%, ${brandSoft(0.82)} 45%, ${brandSoft(0.55)} 100%)` }}
        >
          {coverImageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImageUrl} alt="" loading="eager" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center" />
              <span className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${brandSoft(0.05)} 0%, ${brandSoft(0.35)} 55%, ${brandSoft(0.85)} 100%)` }} />
            </>
          )}
          <span className="absolute -top-10 -left-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
          <span className="absolute -bottom-12 right-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <span className="absolute top-4 right-1/4 h-2 w-2 rounded-full bg-white/40" />
          <span className="absolute top-10 right-[18%] h-1 w-1 rounded-full bg-white/50" />
          <span className="absolute bottom-6 left-[22%] h-1.5 w-1.5 rounded-full bg-white/30" />
        </div>

        <div className="w-full px-6 pb-6 flex flex-col items-center">
          {/* Logo redondo sobreposto à capa */}
          {theme.showProfileImage ? (
            <div
              style={{
                width: logoPx,
                height: logoPx,
                marginTop: -logoPx / 2,
                boxShadow: `0 12px 30px -12px ${brandSoft(0.55)}`,
                outline: "4px solid var(--theme-surface)",
              }}
              className={`relative mx-auto rounded-full flex items-center justify-center overflow-hidden mb-3 ${profile.fotoLogoUrl ? "bg-white" : ""}`}
            >
              {profile.fotoLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.fotoLogoUrl} alt={`Logo de ${profile.nomeNegocio}`} className="h-full w-full object-contain object-center p-[7%]" />
              ) : (
                <span
                  className={`h-full w-full flex items-center justify-center font-black ${{ sm: "text-xl", md: "text-2xl", lg: "text-3xl", xl: "text-4xl" }[theme.profileImageSize ?? "md"]}`}
                  style={{ color: getBestTextColor(corBrand), backgroundColor: corBrand }}
                >
                  {initials}
                </span>
              )}
            </div>
          ) : (
            <div className="h-5" />
          )}

          {/* Business name */}
          <h1
            className="text-2xl font-extrabold text-[var(--theme-text)] leading-tight"
            style={{ fontFamily: "var(--theme-heading-font)" }}
          >
            {profile.nomeNegocio}
          </h1>

          {/* Responsible name */}
          {showResponsible && (
            <p className="text-xs text-[var(--theme-muted-text)] font-semibold mt-1">
              Responsável: {profile.nome}
            </p>
          )}

          {/* Location type badge */}
          {showLocationBadge && locationLabel && (
            <span
              className="mt-2 px-3 py-0.5 rounded-full text-[11px] font-bold border"
              style={{ borderColor: brandSoft(0.25), color: corBrand, backgroundColor: brandSoft(0.07) }}
            >
              {locationLabel}
            </span>
          )}

          {/* Welcome message */}
          {showMessage && (
            <p className="text-sm text-[var(--theme-muted-text)] mt-3 max-w-sm leading-relaxed">
              {welcomeMessage}
            </p>
          )}

          {/* Ações rápidas: botões redondos lado a lado */}
          {actions.length > 0 && (
            <div className="mt-5 flex w-full items-start justify-center gap-5 sm:gap-7">
              {actions.map((a) => {
                const circle = (
                  <span
                    className="h-12 w-12 rounded-full flex items-center justify-center shadow-sm transition-transform group-active:scale-90"
                    style={a.filled
                      ? { backgroundColor: corBrand, color: getBestTextColor(corBrand), boxShadow: `0 8px 18px -8px ${brandSoft(0.7)}` }
                      : { backgroundColor: brandSoft(0.1), color: corBrand, border: `1px solid ${brandSoft(0.22)}` }}
                  >
                    {a.icon}
                  </span>
                );
                const label = <span className="text-[11px] font-semibold text-[var(--theme-text)]">{a.label}</span>;
                const cls = "group flex w-16 flex-col items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] rounded-xl";
                return a.href ? (
                  <a
                    key={a.key}
                    href={isPreview ? undefined : a.href}
                    target={a.external && !isPreview ? "_blank" : undefined}
                    rel={a.external ? "noopener noreferrer" : undefined}
                    onClick={isPreview ? (e) => e.preventDefault() : undefined}
                    aria-label={a.ariaLabel}
                    className={cls}
                  >
                    {circle}{label}
                  </a>
                ) : (
                  <button key={a.key} type="button" onClick={a.onClick} aria-label={a.ariaLabel} className={cls}>
                    {circle}{label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Endereço com mapa recolhido (o mapa só carrega ao tocar) */}
          {showAddress && profile.publicAddress && profile.serviceLocationType !== "online" && (
            <div className="mt-5 w-full rounded-2xl px-4 py-3" style={{ backgroundColor: brandSoft(0.05), border: `1px solid ${brandSoft(0.12)}` }}>
              {profile.serviceLocationType === "mobile" ? (
                <p className="text-xs text-[var(--theme-muted-text)] text-center">
                  Atendimento em domicílio — consulte a área de atendimento.
                </p>
              ) : (
                <>
                  <div className="flex items-start justify-center gap-1.5 text-xs text-[var(--theme-muted-text)] text-center leading-relaxed">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: corBrand }} aria-hidden="true" />
                    <span>{addressText}</span>
                  </div>
                  {mapsEmbedUrl && showMap && !isPreview && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMapOpen((o) => !o)}
                        aria-expanded={mapOpen}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: corBrand }}
                      >
                        <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {mapOpen ? "Esconder mapa" : "Ver no mapa"}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mapOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                      </button>
                      {mapOpen && (
                        <div className="rt-rise mt-2 w-full rounded-xl overflow-hidden border border-[rgba(128,128,128,0.2)]" style={{ height: 170 }}>
                          <iframe
                            title="Localização"
                            src={mapsEmbedUrl}
                            width="100%"
                            height="170"
                            style={{ border: 0 }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Directions modal */}
      {showDirections && profile.publicAddress && (
        <DirectionsModal
          address={profile.publicAddress}
          isPreview={isPreview}
          onClose={() => setShowDirections(false)}
        />
      )}
    </>
  );
}
