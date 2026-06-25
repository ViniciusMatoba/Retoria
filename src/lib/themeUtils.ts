export interface FontItem {
  id: string;
  family: string;
  category: "modern" | "humanized" | "elegant" | "strong";
  weights: number[];
  fallback: "sans-serif" | "serif";
  label: string;
}

export const fontCatalog: FontItem[] = [
  // Modernas
  { id: "inter", family: "Inter", category: "modern", weights: [400, 500, 700, 800], fallback: "sans-serif", label: "Inter" },
  { id: "manrope", family: "Manrope", category: "modern", weights: [400, 500, 700], fallback: "sans-serif", label: "Manrope" },
  { id: "montserrat", family: "Montserrat", category: "modern", weights: [400, 500, 700, 800], fallback: "sans-serif", label: "Montserrat" },
  { id: "poppins", family: "Poppins", category: "modern", weights: [400, 500, 700], fallback: "sans-serif", label: "Poppins" },
  { id: "dm-sans", family: "DM Sans", category: "modern", weights: [400, 500, 700], fallback: "sans-serif", label: "DM Sans" },
  { id: "archivo", family: "Archivo", category: "modern", weights: [400, 500, 700], fallback: "sans-serif", label: "Archivo" },
  // Humanizadas
  { id: "nunito", family: "Nunito", category: "humanized", weights: [400, 600, 700], fallback: "sans-serif", label: "Nunito" },
  { id: "quicksand", family: "Quicksand", category: "humanized", weights: [400, 500, 700], fallback: "sans-serif", label: "Quicksand" },
  { id: "lato", family: "Lato", category: "humanized", weights: [400, 700], fallback: "sans-serif", label: "Lato" },
  // Elegantes
  { id: "playfair", family: "Playfair Display", category: "elegant", weights: [400, 700], fallback: "serif", label: "Playfair Display" },
  { id: "lora", family: "Lora", category: "elegant", weights: [400, 500, 700], fallback: "serif", label: "Lora" },
  { id: "cormorant", family: "Cormorant Garamond", category: "elegant", weights: [400, 500, 700], fallback: "serif", label: "Cormorant Garamond" },
  { id: "merriweather", family: "Merriweather", category: "elegant", weights: [400, 700], fallback: "serif", label: "Merriweather" },
  // Fortes
  { id: "oswald", family: "Oswald", category: "strong", weights: [400, 500, 700], fallback: "sans-serif", label: "Oswald" },
  { id: "bebas", family: "Bebas Neue", category: "strong", weights: [400], fallback: "sans-serif", label: "Bebas Neue" },
  { id: "roboto-condensed", family: "Roboto Condensed", category: "strong", weights: [400, 700], fallback: "sans-serif", label: "Roboto Condensed" }
];

export interface ThemeConfig {
  preset: string;
  sourcePresetId?: string; // preservado quando preset vira "custom" após edição manual
  mode: "light" | "dark" | "custom";

  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;

  headingFont: string;
  bodyFont: string;

  buttonStyle: "square" | "soft" | "rounded" | "pill";
  cardStyle: "flat" | "bordered" | "elevated" | "glass";
  cardRadius: number; // 0, 8, 12, 16, 24, 32

  backgroundType: "solid" | "gradient" | "preset" | "image";
  backgroundPreset: string | null; // waves, diffuse, shapes, texturized, geometric, organic, dark-elegance
  backgroundGradient: string | null; // aurora, sunset, ocean, forest, neutral
  backgroundImageUrl: string | null;
  backgroundStoragePath: string | null;
  backgroundUpdatedAt: number | null;

  backgroundOverlay: number; // 0 to 80
  backgroundOverlayColor: "dark" | "light";

  backgroundPosition: "center" | "top" | "bottom" | "left" | "right";
  backgroundSize: "cover" | "contain";
  backgroundAttachment: "scroll" | "fixed";

  showProfileImage: boolean;
  profileImageSize: "sm" | "md" | "lg" | "xl";
  showServiceImages: boolean;

  updatedAt?: any;
}

export const gradientPresets: Record<string, string> = {
  aurora: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
  sunset: "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)",
  ocean: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)",
  forest: "linear-gradient(135deg, #10b981 0%, #059669 50%, #064e3b 100%)",
  neutral: "linear-gradient(135deg, #64748b 0%, #334155 50%, #1e293b 100%)",
  "energy-dark": "linear-gradient(135deg, #0f172a 0%, #1c0a00 50%, #431407 100%)",
  "pop-expression": "linear-gradient(135deg, #fdf4ff 0%, #fce7f3 50%, #ede9fe 100%)"
};

export const bgPatterns: Record<string, { css: string; label: string }> = {
  "waves": {
    label: "Ondas Suaves",
    css: "radial-gradient(circle at 100% 150%, #3b82f6 24%, #6366f1 28%, #1e1b4b 45%)"
  },
  "diffuse": {
    label: "Luz Difusa",
    css: "radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0) 70%)"
  },
  "shapes": {
    label: "Formas Abstratas",
    css: "linear-gradient(217deg, rgba(236,72,153,.08), rgba(236,72,153,0) 70.71%), linear-gradient(127deg, rgba(99,102,241,.08), rgba(99,102,241,0) 70.71%), linear-gradient(336deg, rgba(16,185,129,.05), rgba(16,185,129,0) 70.71%)"
  },
  "texturized": {
    label: "Textura Discreta",
    css: "radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0), radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)" // offset dynamic custom style in CSS
  },
  "geometric": {
    label: "Padrão Geométrico",
    css: "linear-gradient(30deg, #1e293b 12%, transparent 12.5%, transparent 87%, #1e293b 87.5%, #1e293b), linear-gradient(150deg, #1e293b 12%, transparent 12.5%, transparent 87%, #1e293b 87.5%, #1e293b), linear-gradient(270deg, #1e293b 22%, transparent 22.5%, transparent 77%, #1e293b 77.5%, #1e293b)"
  },
  "organic": {
    label: "Fundo Orgânico",
    css: "radial-gradient(circle at 10% 20%, rgba(4, 120, 87, 0.1) 0%, rgba(15, 23, 42, 0) 60%), radial-gradient(circle at 90% 80%, rgba(20, 184, 166, 0.08) 0%, rgba(15, 23, 42, 0) 60%)"
  },
  "dark-elegance": {
    label: "Fundo Escuro Elegante",
    css: "linear-gradient(to right, #0f172a, #1e1b4b, #0f172a)"
  },
  "diffuse-light": {
    label: "Luz Difusa Clara",
    css: "radial-gradient(circle at 30% 20%, rgba(216,180,254,0.18) 0%, rgba(255,255,255,0) 60%), radial-gradient(circle at 80% 80%, rgba(196,181,253,0.12) 0%, rgba(255,255,255,0) 55%)"
  },
  "organic-soft": {
    label: "Orgânico Suave",
    css: "radial-gradient(circle at 15% 25%, rgba(134,239,172,0.15) 0%, rgba(255,255,255,0) 55%), radial-gradient(circle at 85% 75%, rgba(167,243,208,0.1) 0%, rgba(255,255,255,0) 55%)"
  },
  "dark-texture": {
    label: "Textura Escura",
    css: "radial-gradient(circle at 50% 0%, rgba(185,28,28,0.08) 0%, rgba(10,10,10,0) 60%), linear-gradient(180deg, #0a0a0a 0%, #111111 100%)"
  },
  "geometric-light": {
    label: "Geométrico Claro",
    css: "linear-gradient(135deg, rgba(29,78,216,0.04) 25%, transparent 25%), linear-gradient(225deg, rgba(29,78,216,0.04) 25%, transparent 25%), linear-gradient(45deg, rgba(29,78,216,0.04) 25%, transparent 25%), linear-gradient(315deg, rgba(29,78,216,0.04) 25%, #f8fafc 25%)"
  },
  "editorial-abstract": {
    label: "Abstrato Editorial",
    css: "radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(219,39,119,0.06) 0%, transparent 55%)"
  },
  "artisan-texture": {
    label: "Textura Artesanal",
    css: "radial-gradient(circle at 60% 30%, rgba(154,52,18,0.08) 0%, transparent 55%), radial-gradient(circle at 20% 80%, rgba(217,119,6,0.07) 0%, transparent 50%)"
  },
  "rounded-playful": {
    label: "Bolhas Arredondadas",
    css: "radial-gradient(circle at 10% 90%, rgba(15,118,110,0.12) 0%, transparent 40%), radial-gradient(circle at 90% 10%, rgba(245,158,11,0.1) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(94,234,212,0.06) 0%, transparent 60%)"
  },
  "soft-waves": {
    label: "Ondas Suaves",
    css: "radial-gradient(circle at 0% 50%, rgba(3,105,161,0.08) 0%, transparent 50%), radial-gradient(circle at 100% 50%, rgba(56,189,248,0.07) 0%, transparent 50%)"
  }
};

export const themePresets: Record<string, Partial<ThemeConfig>> = {
  minimalist: {
    preset: "minimalist",
    mode: "light",
    primaryColor: "#0f172a",
    secondaryColor: "#475569",
    accentColor: "#6366f1",
    backgroundColor: "#f8fafc",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
    mutedTextColor: "#64748b",
    headingFont: "Inter",
    bodyFont: "Inter",
    buttonStyle: "soft",
    cardStyle: "bordered",
    cardRadius: 12,
    backgroundType: "solid",
    backgroundPreset: null,
    backgroundGradient: null,
    backgroundOverlay: 0,
    backgroundOverlayColor: "dark"
  },
  elegant: {
    preset: "elegant",
    mode: "light",
    primaryColor: "#111827",
    secondaryColor: "#d97706",
    accentColor: "#b45309",
    backgroundColor: "#fafaf9",
    surfaceColor: "#ffffff",
    textColor: "#1c1917",
    mutedTextColor: "#78716c",
    headingFont: "Playfair Display",
    bodyFont: "Lora",
    buttonStyle: "square",
    cardStyle: "flat",
    cardRadius: 0,
    backgroundType: "solid",
    backgroundPreset: null,
    backgroundGradient: null,
    backgroundOverlay: 0,
    backgroundOverlayColor: "dark"
  },
  natural: {
    preset: "natural",
    mode: "light",
    primaryColor: "#14532d",
    secondaryColor: "#15803d",
    accentColor: "#854d0e",
    backgroundColor: "#f0fdf4",
    surfaceColor: "#ffffff",
    textColor: "#166534",
    mutedTextColor: "#3f6212",
    headingFont: "Quicksand",
    bodyFont: "Nunito",
    buttonStyle: "rounded",
    cardStyle: "bordered",
    cardRadius: 16,
    backgroundType: "solid",
    backgroundPreset: null,
    backgroundGradient: null,
    backgroundOverlay: 0,
    backgroundOverlayColor: "dark"
  },
  night: {
    preset: "night",
    mode: "dark",
    primaryColor: "#6366f1",
    secondaryColor: "#818cf8",
    accentColor: "#a5b4fc",
    backgroundColor: "#090d16",
    surfaceColor: "#111827",
    textColor: "#f3f4f6",
    mutedTextColor: "#9ca3af",
    headingFont: "Poppins",
    bodyFont: "Lato",
    buttonStyle: "pill",
    cardStyle: "elevated",
    cardRadius: 24,
    backgroundType: "solid",
    backgroundPreset: null,
    backgroundGradient: null,
    backgroundOverlay: 0,
    backgroundOverlayColor: "dark"
  },
  corporate: {
    preset: "corporate",
    mode: "light",
    primaryColor: "#1e3a8a",
    secondaryColor: "#2563eb",
    accentColor: "#3b82f6",
    backgroundColor: "#f1f5f9",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
    mutedTextColor: "#475569",
    headingFont: "Montserrat",
    bodyFont: "DM Sans",
    buttonStyle: "soft",
    cardStyle: "bordered",
    cardRadius: 8,
    backgroundType: "solid",
    backgroundPreset: null,
    backgroundGradient: null,
    backgroundOverlay: 0,
    backgroundOverlayColor: "dark"
  },
  vibrant: {
    preset: "vibrant",
    mode: "light",
    primaryColor: "#ec4899",
    secondaryColor: "#f43f5e",
    accentColor: "#eab308",
    backgroundColor: "#fdf2f8",
    surfaceColor: "#ffffff",
    textColor: "#9d174d",
    mutedTextColor: "#be185d",
    headingFont: "Montserrat",
    bodyFont: "Poppins",
    buttonStyle: "pill",
    cardStyle: "elevated",
    cardRadius: 24,
    backgroundType: "solid",
    backgroundPreset: null,
    backgroundGradient: null,
    backgroundOverlay: 0,
    backgroundOverlayColor: "dark"
  },
  delicate: {
    preset: "delicate",
    mode: "light",
    primaryColor: "#db2777",
    secondaryColor: "#fda4af",
    accentColor: "#f472b6",
    backgroundColor: "#fff1f2",
    surfaceColor: "#ffffff",
    textColor: "#4c0519",
    mutedTextColor: "#9f1239",
    headingFont: "Quicksand",
    bodyFont: "Quicksand",
    buttonStyle: "rounded",
    cardStyle: "bordered",
    cardRadius: 16,
    backgroundType: "solid",
    backgroundPreset: null,
    backgroundGradient: null,
    backgroundOverlay: 0,
    backgroundOverlayColor: "dark"
  }
};

export function getDefaultThemeConfig(): ThemeConfig {
  return {
    preset: "minimalist",
    mode: "light",
    primaryColor: "#6366f1",
    secondaryColor: "#4f46e5",
    accentColor: "#818cf8",
    backgroundColor: "#0f172a",
    surfaceColor: "#1e293b",
    textColor: "#f8fafc",
    mutedTextColor: "#94a3b8",
    headingFont: "Inter",
    bodyFont: "Inter",
    buttonStyle: "soft",
    cardStyle: "bordered",
    cardRadius: 12,
    backgroundType: "solid",
    backgroundPreset: null,
    backgroundGradient: null,
    backgroundImageUrl: null,
    backgroundStoragePath: null,
    backgroundUpdatedAt: null,
    backgroundOverlay: 0,
    backgroundOverlayColor: "dark",
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundAttachment: "scroll",
    showProfileImage: true,
    profileImageSize: "md",
    showServiceImages: true
  };
}

export function validateHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function getRelativeLuminance(colorHex: string): number {
  const rgb = hexToRgb(colorHex);
  if (!rgb) return 0;
  
  const a = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function getBestTextColor(bgColor: string): string {
  const darkContrast = getContrastRatio(bgColor, "#0f172a");
  const lightContrast = getContrastRatio(bgColor, "#ffffff");
  return darkContrast > lightContrast ? "#0f172a" : "#ffffff";
}

export function validateThemeConfig(config: ThemeConfig): { valid: boolean; error?: string } {
  if (!config) return { valid: false, error: "Configuração ausente." };
  
  // Validate Colors
  const colors = [
    config.primaryColor,
    config.secondaryColor,
    config.accentColor,
    config.backgroundColor,
    config.surfaceColor,
    config.textColor,
    config.mutedTextColor
  ];
  for (const col of colors) {
    if (!col || !validateHexColor(col)) {
      return { valid: false, error: `Cor hexadecimal inválida: ${col}` };
    }
  }

  // Validate Fonts
  const allowedFonts = fontCatalog.map(f => f.family);
  if (!allowedFonts.includes(config.headingFont)) {
    return { valid: false, error: `Fonte de título não permitida: ${config.headingFont}` };
  }
  if (!allowedFonts.includes(config.bodyFont)) {
    return { valid: false, error: `Fonte de texto não permitida: ${config.bodyFont}` };
  }

  // Validate presets and enums
  const allowedPresets = [
    "minimalist", "elegant", "natural", "night", "corporate", "vibrant", "delicate", "custom",
    "beauty-elegant", "wellness-natural", "fitness-movement", "tattoo-black-studio",
    "business-trust", "creative-authorial", "food-artisanal", "pet-friendly",
    "health-clear", "youth-pop"
  ];
  if (!allowedPresets.includes(config.preset)) {
    return { valid: false, error: `Preset inválido: ${config.preset}` };
  }

  if (!["light", "dark", "custom"].includes(config.mode)) {
    return { valid: false, error: `Modo inválido: ${config.mode}` };
  }

  if (!["square", "soft", "rounded", "pill"].includes(config.buttonStyle)) {
    return { valid: false, error: `Estilo de botão inválido: ${config.buttonStyle}` };
  }

  if (!["flat", "bordered", "elevated", "glass"].includes(config.cardStyle)) {
    return { valid: false, error: `Estilo de card inválido: ${config.cardStyle}` };
  }

  const allowedRadii = [0, 8, 12, 16, 24, 32];
  if (!allowedRadii.includes(config.cardRadius)) {
    return { valid: false, error: `Raio do card inválido: ${config.cardRadius}` };
  }

  if (!["solid", "gradient", "preset", "image"].includes(config.backgroundType)) {
    return { valid: false, error: `Tipo de fundo inválido: ${config.backgroundType}` };
  }

  if (config.backgroundGradient && !gradientPresets[config.backgroundGradient]) {
    return { valid: false, error: `Gradiente inválido: ${config.backgroundGradient}` };
  }

  if (config.backgroundPreset && !bgPatterns[config.backgroundPreset]) {
    return { valid: false, error: `Padrão de fundo inválido: ${config.backgroundPreset}` };
  }

  if (config.backgroundOverlay < 0 || config.backgroundOverlay > 80) {
    return { valid: false, error: `Opacidade do overlay deve estar entre 0 e 80.` };
  }

  if (!["dark", "light"].includes(config.backgroundOverlayColor)) {
    return { valid: false, error: `Cor do overlay inválida.` };
  }

  if (!["center", "top", "bottom", "left", "right"].includes(config.backgroundPosition)) {
    return { valid: false, error: `Posição do fundo inválida.` };
  }

  if (!["cover", "contain"].includes(config.backgroundSize)) {
    return { valid: false, error: `Tamanho do fundo inválido.` };
  }

  if (!["scroll", "fixed"].includes(config.backgroundAttachment)) {
    return { valid: false, error: `Anexação de fundo inválida.` };
  }

  // Safety block: prevent custom external urls manually injected
  const storageHost = "firebasestorage.googleapis.com";
  if (config.backgroundImageUrl && !config.backgroundImageUrl.startsWith("/") && !config.backgroundImageUrl.includes(storageHost)) {
    return { valid: false, error: "Apenas imagens hospedadas no Firebase Storage da Retoria são aceitas." };
  }

  return { valid: true };
}

export function applyThemePreset(presetName: string, current: ThemeConfig): ThemeConfig {
  const presetData = themePresets[presetName];
  if (!presetData) return current;
  return {
    ...current,
    ...presetData,
    preset: presetName
  };
}

export function validateImageFile(file: File, maxSizeMB: number): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: "Nenhum arquivo selecionado." };
  
  const allowedMime = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMime.includes(file.type)) {
    return { valid: false, error: "Formato de arquivo inválido. Apenas JPG, JPEG, PNG e WEBP são permitidos." };
  }
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `O arquivo excede o limite máximo de ${maxSizeMB} MB.` };
  }
  
  return { valid: true };
}

export function buildVersionedImageUrl(url: string | null | undefined, updatedAt: number | null | undefined): string {
  if (!url) return "";
  if (!updatedAt) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("v", String(updatedAt));
    return u.toString();
  } catch {
    return url + (url.includes("?") ? "&" : "?") + "v=" + updatedAt;
  }
}

const ALLOWED_IMAGE_HOSTS = ["firebasestorage.googleapis.com"];

/**
 * Returns true only for image URLs that next/image is configured to serve:
 * - Local paths starting with "/"
 * - HTTPS URLs from Firebase Storage (the only allowed remote host)
 * Everything else (Unsplash, arbitrary https, http) returns false.
 */
export function isAllowedPublicImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("/")) return true; // local public asset
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_IMAGE_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function getButtonRadius(style: string): string {
  switch (style) {
    case "square": return "0px";
    case "soft": return "8px";
    case "rounded": return "16px";
    case "pill": return "9999px";
    default: return "8px";
  }
}

export function normalizeThemeConfig(config: any): ThemeConfig {
  const base = getDefaultThemeConfig();
  if (!config) return base;

  const normalized = { ...base, ...config };

  // 1. Sanitize Colors
  const colorFields: Array<keyof ThemeConfig> = [
    "primaryColor", "secondaryColor", "accentColor",
    "backgroundColor", "surfaceColor", "textColor", "mutedTextColor"
  ];
  for (const field of colorFields) {
    if (!normalized[field] || !validateHexColor(normalized[field])) {
      normalized[field] = base[field];
    }
  }

  // 2. Sanitize Fonts
  const allowedFonts = fontCatalog.map(f => f.family);
  if (!allowedFonts.includes(normalized.headingFont)) {
    normalized.headingFont = base.headingFont;
  }
  if (!allowedFonts.includes(normalized.bodyFont)) {
    normalized.bodyFont = base.bodyFont;
  }

  // 3. Sanitize background type and options
  if (!["solid", "gradient", "preset", "image"].includes(normalized.backgroundType)) {
    normalized.backgroundType = base.backgroundType;
  }

  if (normalized.backgroundGradient && !gradientPresets[normalized.backgroundGradient]) {
    normalized.backgroundGradient = null;
    if (normalized.backgroundType === "gradient") {
      normalized.backgroundType = "solid";
    }
  }

  if (normalized.backgroundPreset && !bgPatterns[normalized.backgroundPreset]) {
    normalized.backgroundPreset = null;
    if (normalized.backgroundType === "preset") {
      normalized.backgroundType = "solid";
    }
  }

  // 4. Sanitize background image (critical for compatibility with old saved external URLs)
  if (normalized.backgroundImageUrl) {
    if (!isAllowedPublicImageUrl(normalized.backgroundImageUrl)) {
      console.warn(`[ThemeConfig] URL de fundo inválida detectada e removida: ${normalized.backgroundImageUrl}`);
      normalized.backgroundImageUrl = null;
      normalized.backgroundStoragePath = null;
      if (normalized.backgroundType === "image") {
        normalized.backgroundType = "solid";
      }
    }
  }

  return normalized;
}
