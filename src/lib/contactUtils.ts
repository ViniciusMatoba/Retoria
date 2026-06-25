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

// ─── Instagram utils ──────────────────────────────────────────────────────────

export function cleanInstagramUsername(input: string | null | undefined): string {
  if (!input) return "";
  let clean = input.trim();
  if (!clean) return "";

  // Remove leading @ if present
  if (clean.startsWith("@")) {
    clean = clean.substring(1);
  }

  // Handle full URL extraction
  try {
    if (clean.includes("/")) {
      let urlString = clean;
      if (!/^https?:\/\//i.test(clean)) {
        urlString = "https://" + clean;
      }
      const url = new URL(urlString);
      if (url.hostname.includes("instagram.com")) {
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments.length > 0) {
          clean = segments[0];
        }
      }
    }
  } catch (e) {
    // Ignore URL parse error and fall back
  }

  // Remove query params or trailing slash
  clean = clean.split(/[?#]/)[0];
  clean = clean.replace(/\/$/, "");

  // Instagram username rules: letters, numbers, periods, underscores
  clean = clean.replace(/[^a-zA-Z0-9._]/g, "");

  return clean;
}

export function buildInstagramUrl(username: string | null | undefined): string {
  const clean = cleanInstagramUsername(username);
  if (!clean) return "";
  return `https://instagram.com/${clean}`;
}

