import { formatPhoneForWhatsApp, formatPhoneFriendly } from "./whatsapp";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  formattedAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export type ServiceLocationType = "physical" | "online" | "both" | "mobile";

export const SERVICE_LOCATION_LABELS: Record<ServiceLocationType, string> = {
  physical: "Atendimento presencial",
  online: "Atendimento on-line",
  both: "Presencial e on-line",
  mobile: "Atendimento em domicílio",
};

// ─── Phone utils ──────────────────────────────────────────────────────────────

export { formatPhoneForWhatsApp, formatPhoneFriendly };

export function normalizePhoneNumber(phone: string): string {
  return formatPhoneForWhatsApp(phone);
}

export function buildTelUrl(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return "";
  return `tel:+${normalized}`;
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return "";
  const base = `https://wa.me/${normalized}`;
  if (message) return `${base}?text=${encodeURIComponent(message)}`;
  return base;
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return normalized.length >= 10 && normalized.length <= 15;
}

// ─── Address utils ────────────────────────────────────────────────────────────

export function formatPublicAddress(addr: PublicAddress | null | undefined): string {
  if (!addr) return "";

  const parts: string[] = [];

  if (addr.formattedAddress) return addr.formattedAddress;

  if (addr.street) {
    parts.push(addr.number ? `${addr.street}, ${addr.number}` : addr.street);
  }
  if (addr.complement) parts.push(addr.complement);
  if (addr.neighborhood) parts.push(addr.neighborhood);

  const cityState = [addr.city, addr.state].filter(Boolean).join(" - ");
  if (cityState) parts.push(cityState);

  if (addr.postalCode) parts.push(`CEP ${addr.postalCode}`);

  return parts.join(", ");
}

export function hasMinimalAddress(addr: PublicAddress | null | undefined): boolean {
  if (!addr) return false;
  return !!(addr.city && addr.state);
}

export function validateCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ─── Maps URL builders ────────────────────────────────────────────────────────

export function buildGoogleMapsDirectionsUrl(addr: PublicAddress | null | undefined): string {
  if (!addr || !hasMinimalAddress(addr)) return "";

  const base = "https://www.google.com/maps/dir/";
  const params = new URLSearchParams();
  params.set("api", "1");

  if (validateCoordinates(addr.latitude, addr.longitude)) {
    params.set("destination", `${addr.latitude},${addr.longitude}`);
  } else {
    const destination = formatPublicAddress(addr);
    if (!destination) return "";
    params.set("destination", destination);
  }

  return `${base}?${params.toString()}`;
}

export function buildWazeDirectionsUrl(addr: PublicAddress | null | undefined): string {
  if (!addr || !hasMinimalAddress(addr)) return "";

  const base = "https://waze.com/ul";
  const params = new URLSearchParams();

  if (validateCoordinates(addr.latitude, addr.longitude)) {
    params.set("ll", `${addr.latitude},${addr.longitude}`);
    params.set("navigate", "yes");
  } else {
    const address = formatPublicAddress(addr);
    if (!address) return "";
    params.set("q", address);
    params.set("navigate", "yes");
  }

  params.set("utm_source", "retoria");

  return `${base}?${params.toString()}`;
}

// ─── Welcome message ──────────────────────────────────────────────────────────

export const DEFAULT_WELCOME_MESSAGE =
  "Seja bem-vindo! Escolha um serviço e encontre o melhor horário para você.";

export function sanitizeWelcomeMessage(msg: string): string {
  // Strip any HTML tags and collapse whitespace
  return msg.replace(/<[^>]*>/g, "").replace(/\s{2,}/g, " ").trim();
}

export function getWelcomeMessage(descricaoCurta?: string | null): string {
  if (!descricaoCurta) return DEFAULT_WELCOME_MESSAGE;
  const clean = sanitizeWelcomeMessage(descricaoCurta);
  return clean || DEFAULT_WELCOME_MESSAGE;
}
