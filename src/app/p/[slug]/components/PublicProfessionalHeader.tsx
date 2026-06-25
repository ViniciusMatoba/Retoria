"use client";

import React, { useState } from "react";
import { Phone, MessageCircle, MapPin, ChevronRight } from "lucide-react";
import {
  PublicAddress,
  ServiceLocationType,
  SERVICE_LOCATION_LABELS,
  formatPhoneFriendly,
  buildTelUrl,
  buildWhatsAppUrl,
  formatPublicAddress,
  getWelcomeMessage,
  hasMinimalAddress,
  isValidPhone,
} from "@/lib/contactUtils";
import { ThemeConfig, getBestTextColor } from "@/lib/themeUtils";
import DirectionsModal from "./DirectionsModal";

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
}

interface PublicProfessionalHeaderProps {
  profile: PublicProfileInfo;
  theme: ThemeConfig;
  isPreview?: boolean;
}

export default function PublicProfessionalHeader({
  profile,
  theme,
  isPreview = false,
}: PublicProfessionalHeaderProps) {
  const [showDirections, setShowDirections] = useState(false);

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

  let btnRadiusClass = "";
  if (theme.buttonStyle === "square")   btnRadiusClass = "rounded-none";
  else if (theme.buttonStyle === "soft") btnRadiusClass = "rounded-lg";
  else if (theme.buttonStyle === "rounded") btnRadiusClass = "rounded-2xl";
  else if (theme.buttonStyle === "pill") btnRadiusClass = "rounded-full";

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

  return (
    <>
      <div
        style={cardRadiusStyle}
        className={`p-6 text-center flex flex-col items-center shadow-lg relative overflow-hidden backdrop-blur-sm ${cardClass}`}
      >
        {/* Top brand accent line */}
        <div className="absolute top-0 inset-x-0 h-1.5" style={{ backgroundColor: corBrand }} />

        {/* Logo / Avatar */}
        {theme.showProfileImage && (
          <div className="h-20 w-20 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-slate-950/60 flex items-center justify-center overflow-hidden mb-4 shadow-md">
            {profile.fotoLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.fotoLogoUrl} alt={`Logo de ${profile.nomeNegocio}`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-black" style={{ color: corBrand }}>{initials}</span>
            )}
          </div>
        )}

        {/* Business name */}
        <h1
          className="text-2xl font-extrabold text-[var(--theme-text)]"
          style={{ fontFamily: "var(--theme-heading-font)" }}
        >
          {profile.nomeNegocio}
        </h1>

        {/* Responsible name */}
        {showResponsible && (
          <p className="text-xs text-[var(--theme-muted-text)] font-semibold mt-0.5">
            Responsável: {profile.nome}
          </p>
        )}

        {/* Location type badge */}
        {showLocationBadge && locationLabel && (
          <span
            className="mt-2 px-3 py-0.5 rounded-full text-[11px] font-bold border"
            style={{
              borderColor: `${corBrand}40`,
              color: corBrand,
              backgroundColor: `${corBrand}12`,
            }}
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

        {/* Contact row */}
        {(showPhone || showWhatsApp) && (
          <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)] w-full flex flex-wrap items-center justify-center gap-2">
            {showPhone && profile.publicPhone && (
              <a
                href={isPreview ? undefined : buildTelUrl(profile.publicPhone)}
                onClick={isPreview ? (e) => e.preventDefault() : undefined}
                aria-label={`Ligar para ${profile.nomeNegocio}`}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] transition-opacity hover:opacity-80 ${btnRadiusClass} border border-[rgba(255,255,255,0.1)] bg-[var(--theme-surface)]`}
                style={{ color: "var(--theme-text)" }}
              >
                <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: corBrand }} aria-hidden="true" />
                <span>{formatPhoneFriendly(profile.publicPhone)}</span>
              </a>
            )}

            {showWhatsApp && profile.telefoneWhatsapp && (
              <a
                href={isPreview ? undefined : buildWhatsAppUrl(profile.telefoneWhatsapp)}
                target={isPreview ? undefined : "_blank"}
                rel="noopener noreferrer"
                onClick={isPreview ? (e) => e.preventDefault() : undefined}
                aria-label={`WhatsApp de ${profile.nomeNegocio}`}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] transition-opacity active:scale-[0.97] ${btnRadiusClass}`}
                style={{
                  backgroundColor: corBrand,
                  color: getBestTextColor(corBrand),
                }}
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        )}

        {/* Address */}
        {showAddress && profile.publicAddress && profile.serviceLocationType !== "online" && (
          <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)] w-full">
            {profile.serviceLocationType === "mobile" ? (
              <p className="text-xs text-[var(--theme-muted-text)] text-center">
                Atendimento em domicílio — consulte a área de atendimento.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="flex items-start gap-1.5 text-xs text-[var(--theme-muted-text)] max-w-xs text-center leading-relaxed">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: corBrand }} aria-hidden="true" />
                  <span>{addressText}</span>
                </div>

                {/* Mini mapa incorporado */}
                {mapsEmbedUrl && showMap && !isPreview && (
                  <div className="w-full max-w-xs rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)] shadow-md mt-1" style={{ height: 140 }}>
                    <iframe
                      title="Localização"
                      src={mapsEmbedUrl}
                      width="100%"
                      height="140"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}

                {canShowDirections && (
                  <button
                    type="button"
                    onClick={handleDirectionsClick}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] transition-opacity hover:opacity-80 active:scale-[0.97] border ${btnRadiusClass}`}
                    style={{
                      borderColor: `${corBrand}40`,
                      color: corBrand,
                      backgroundColor: `${corBrand}10`,
                    }}
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Como chegar</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
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
