import {
  ThemeConfig,
  getDefaultThemeConfig,
  validateThemeConfig,
  fontCatalog,
  gradientPresets,
  bgPatterns,
} from "./themeUtils";

export type PresetBadge = "recommended" | "new" | null;

export type SegmentFilter =
  | "beleza"
  | "saúde"
  | "bem-estar"
  | "esporte"
  | "criativo"
  | "corporativo"
  | "alimentação"
  | "pet"
  | "jovem";

export const SEGMENT_LABELS: Record<SegmentFilter, string> = {
  "beleza": "Beleza",
  "saúde": "Saúde",
  "bem-estar": "Bem-estar",
  "esporte": "Esporte",
  "criativo": "Criativo",
  "corporativo": "Corporativo",
  "alimentação": "Alimentação",
  "pet": "Pet",
  "jovem": "Jovem e Entretenimento",
};

export interface ThemePreset {
  id: string;
  name: string;
  shortDescription: string;
  fullDescription?: string;
  recommendedSegments: SegmentFilter[];
  tags: string[];
  mode: "light" | "dark";
  featured?: boolean;
  badge: PresetBadge;
  order: number;
  preview: {
    backgroundStyle: string;
    primaryColor: string;
    surfaceColor: string;
    textColor: string;
    headingFont: string;
    bodyFont: string;
  };
  theme: ThemeConfig;
}

const base = getDefaultThemeConfig();

const rawThemePresetCatalog: ThemePreset[] = [
  {
    id: "beauty-elegant",
    name: "Essência Elegante",
    shortDescription: "Sofisticado e delicado para serviços de beleza, estética e atendimento premium.",
    recommendedSegments: ["beleza", "bem-estar"],
    tags: ["estética", "beleza", "maquiagem", "sobrancelhas", "cabeleireiro", "noivas", "consultoria de imagem", "fotografia feminina", "premium"],
    mode: "light",
    featured: true,
    badge: "recommended",
    order: 1,
    preview: {
      backgroundStyle: "#FDF7F4",
      primaryColor: "#8C4A67",
      surfaceColor: "#FFFFFF",
      textColor: "#3F2D33",
      headingFont: "Playfair Display",
      bodyFont: "Manrope",
    },
    theme: {
      ...base,
      preset: "beauty-elegant",
      mode: "light",
      primaryColor: "#8C4A67",
      secondaryColor: "#D7A9B8",
      accentColor: "#B7791F",
      backgroundColor: "#FDF7F4",
      surfaceColor: "#FFFFFF",
      textColor: "#3F2D33",
      mutedTextColor: "#725E65",
      headingFont: "Playfair Display",
      bodyFont: "Manrope",
      buttonStyle: "rounded",
      cardStyle: "elevated",
      cardRadius: 24,
      backgroundType: "image",
      backgroundPreset: null,
      backgroundGradient: null,
      backgroundImageUrl: "/themes/backgrounds/beauty-marble.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 8,
      backgroundOverlayColor: "light",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "wellness-natural",
    name: "Naturalmente",
    shortDescription: "Paleta orgânica e serena para terapeutas, psicólogos e profissionais de bem-estar.",
    recommendedSegments: ["bem-estar", "saúde"],
    tags: ["terapeutas", "psicólogos", "psicanalistas", "massoterapeutas", "yoga", "terapias integrativas", "nutricionistas", "bem-estar"],
    mode: "light",
    featured: true,
    badge: "recommended",
    order: 2,
    preview: {
      backgroundStyle: "#F4F7F1",
      primaryColor: "#356859",
      surfaceColor: "#FFFFFF",
      textColor: "#25352B",
      headingFont: "Lora",
      bodyFont: "Nunito",
    },
    theme: {
      ...base,
      preset: "wellness-natural",
      mode: "light",
      primaryColor: "#356859",
      secondaryColor: "#A8BFA3",
      accentColor: "#C9784A",
      backgroundColor: "#F4F7F1",
      surfaceColor: "#FFFFFF",
      textColor: "#25352B",
      mutedTextColor: "#607064",
      headingFont: "Lora",
      bodyFont: "Nunito",
      buttonStyle: "soft",
      cardStyle: "bordered",
      cardRadius: 16,
      backgroundType: "image",
      backgroundPreset: null,
      backgroundGradient: null,
      backgroundImageUrl: "/themes/backgrounds/wellness-leaves.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 20,
      backgroundOverlayColor: "light",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "fitness-movement",
    name: "Movimento",
    shortDescription: "Energia e intensidade para personal trainers, academias, pilates e esportes.",
    recommendedSegments: ["esporte"],
    tags: ["personal trainer", "fisioterapia esportiva", "academia", "pilates", "dança", "lutas", "treinadores"],
    mode: "dark",
    featured: false,
    badge: "new",
    order: 3,
    preview: {
      backgroundStyle: "#0F172A",
      primaryColor: "#EA580C",
      surfaceColor: "#1E293B",
      textColor: "#F8FAFC",
      headingFont: "Oswald",
      bodyFont: "Inter",
    },
    theme: {
      ...base,
      preset: "fitness-movement",
      mode: "dark",
      primaryColor: "#EA580C",
      secondaryColor: "#1E293B",
      accentColor: "#FACC15",
      backgroundColor: "#0F172A",
      surfaceColor: "#1E293B",
      textColor: "#F8FAFC",
      mutedTextColor: "#CBD5E1",
      headingFont: "Oswald",
      bodyFont: "Inter",
      buttonStyle: "soft",
      cardStyle: "elevated",
      cardRadius: 12,
      backgroundType: "image",
      backgroundGradient: null,
      backgroundPreset: null,
      backgroundImageUrl: "/themes/backgrounds/fitness-concrete.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 35,
      backgroundOverlayColor: "dark",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "tattoo-black-studio",
    name: "Black Studio",
    shortDescription: "Visual urbano e ousado para tatuadores, barbeiros, artistas e estúdios alternativos.",
    recommendedSegments: ["criativo", "beleza"],
    tags: ["tatuadores", "barbeiros", "body piercing", "artistas alternativos", "estúdios", "moda urbana"],
    mode: "dark",
    featured: false,
    badge: null,
    order: 4,
    preview: {
      backgroundStyle: "#0A0A0A",
      primaryColor: "#B91C1C",
      surfaceColor: "#171717",
      textColor: "#F5F5F5",
      headingFont: "Bebas Neue",
      bodyFont: "DM Sans",
    },
    theme: {
      ...base,
      preset: "tattoo-black-studio",
      mode: "dark",
      primaryColor: "#B91C1C",
      secondaryColor: "#262626",
      accentColor: "#D4AF37",
      backgroundColor: "#0A0A0A",
      surfaceColor: "#171717",
      textColor: "#F5F5F5",
      mutedTextColor: "#A3A3A3",
      headingFont: "Bebas Neue",
      bodyFont: "DM Sans",
      buttonStyle: "square",
      cardStyle: "bordered",
      cardRadius: 8,
      backgroundType: "image",
      backgroundPreset: null,
      backgroundGradient: null,
      backgroundImageUrl: "/themes/backgrounds/tattoo-grunge.png",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 40,
      backgroundOverlayColor: "dark",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "business-trust",
    name: "Confiança Profissional",
    shortDescription: "Design sóbrio e confiável para consultores, contadores, corretores e profissionais financeiros.",
    recommendedSegments: ["corporativo"],
    tags: ["consultores", "contadores", "corretores", "assessores", "advogados", "financeiro", "serviços empresariais"],
    mode: "light",
    featured: true,
    badge: "recommended",
    order: 5,
    preview: {
      backgroundStyle: "#F8FAFC",
      primaryColor: "#1D4ED8",
      surfaceColor: "#FFFFFF",
      textColor: "#172554",
      headingFont: "Montserrat",
      bodyFont: "Inter",
    },
    theme: {
      ...base,
      preset: "business-trust",
      mode: "light",
      primaryColor: "#1D4ED8",
      secondaryColor: "#172554",
      accentColor: "#0F766E",
      backgroundColor: "#F8FAFC",
      surfaceColor: "#FFFFFF",
      textColor: "#172554",
      mutedTextColor: "#64748B",
      headingFont: "Montserrat",
      bodyFont: "Inter",
      buttonStyle: "soft",
      cardStyle: "bordered",
      cardRadius: 12,
      backgroundType: "image",
      backgroundPreset: null,
      backgroundGradient: null,
      backgroundImageUrl: "/themes/backgrounds/business-blue.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 25,
      backgroundOverlayColor: "dark",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "creative-authorial",
    name: "Autoral",
    shortDescription: "Identidade expressiva e autoral para fotógrafos, designers, artistas e produtores criativos.",
    recommendedSegments: ["criativo"],
    tags: ["fotógrafos", "filmmakers", "designers", "artistas", "cerimonialistas", "produtores", "eventos"],
    mode: "light",
    featured: false,
    badge: "new",
    order: 6,
    preview: {
      backgroundStyle: "#FFF8F0",
      primaryColor: "#7C3AED",
      surfaceColor: "#FFFFFF",
      textColor: "#321E1E",
      headingFont: "Cormorant Garamond",
      bodyFont: "Poppins",
    },
    theme: {
      ...base,
      preset: "creative-authorial",
      mode: "light",
      primaryColor: "#7C3AED",
      secondaryColor: "#321E1E",
      accentColor: "#DB2777",
      backgroundColor: "#FFF8F0",
      surfaceColor: "#FFFFFF",
      textColor: "#321E1E",
      mutedTextColor: "#78625B",
      headingFont: "Cormorant Garamond",
      bodyFont: "Poppins",
      buttonStyle: "rounded",
      cardStyle: "elevated",
      cardRadius: 16,
      backgroundType: "image",
      backgroundPreset: null,
      backgroundGradient: null,
      backgroundImageUrl: "/themes/backgrounds/creative-paint.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 15,
      backgroundOverlayColor: "light",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "food-artisanal",
    name: "Sabor Artesanal",
    shortDescription: "Visual quente e apetitoso para confeiteiros, chefs, marmitas e produtores artesanais.",
    recommendedSegments: ["alimentação"],
    tags: ["confeiteiros", "cozinheiros", "marmitas", "chefs", "buffets", "cafeterias", "produtores artesanais"],
    mode: "light",
    featured: false,
    badge: null,
    order: 7,
    preview: {
      backgroundStyle: "#FFF8ED",
      primaryColor: "#9A3412",
      surfaceColor: "#FFFFFF",
      textColor: "#3B2416",
      headingFont: "Merriweather",
      bodyFont: "Lato",
    },
    theme: {
      ...base,
      preset: "food-artisanal",
      mode: "light",
      primaryColor: "#9A3412",
      secondaryColor: "#5B3825",
      accentColor: "#D97706",
      backgroundColor: "#FFF8ED",
      surfaceColor: "#FFFFFF",
      textColor: "#3B2416",
      mutedTextColor: "#7C6254",
      headingFont: "Merriweather",
      bodyFont: "Lato",
      buttonStyle: "rounded",
      cardStyle: "elevated",
      cardRadius: 16,
      backgroundType: "image",
      backgroundPreset: null,
      backgroundGradient: null,
      backgroundImageUrl: "/themes/backgrounds/food-wood.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 12,
      backgroundOverlayColor: "light",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "pet-friendly",
    name: "Amigo Pet",
    shortDescription: "Acolhedor e divertido para pet shops, veterinários, adestradores e cuidadores animais.",
    recommendedSegments: ["pet"],
    tags: ["pet shop", "banho e tosa", "veterinários", "adestradores", "cuidadores", "hospedagem animal"],
    mode: "light",
    featured: false,
    badge: null,
    order: 8,
    preview: {
      backgroundStyle: "#F4FBFA",
      primaryColor: "#0F766E",
      surfaceColor: "#FFFFFF",
      textColor: "#173B3F",
      headingFont: "Quicksand",
      bodyFont: "Nunito",
    },
    theme: {
      ...base,
      preset: "pet-friendly",
      mode: "light",
      primaryColor: "#0F766E",
      secondaryColor: "#5EEAD4",
      accentColor: "#F59E0B",
      backgroundColor: "#F4FBFA",
      surfaceColor: "#FFFFFF",
      textColor: "#173B3F",
      mutedTextColor: "#587477",
      headingFont: "Quicksand",
      bodyFont: "Nunito",
      buttonStyle: "pill",
      cardStyle: "elevated",
      cardRadius: 24,
      backgroundType: "image",
      backgroundPreset: null,
      backgroundGradient: null,
      backgroundImageUrl: "/themes/backgrounds/pet-grass.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 30,
      backgroundOverlayColor: "light",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "health-clear",
    name: "Saúde Clara",
    shortDescription: "Limpo, confiável e acessível para dentistas, clínicas e profissionais de saúde.",
    recommendedSegments: ["saúde"],
    tags: ["dentistas", "clínicas", "fonoaudiólogos", "fisioterapeutas", "nutricionistas", "podólogos", "saúde"],
    mode: "light",
    featured: false,
    badge: null,
    order: 9,
    preview: {
      backgroundStyle: "#F5FAFC",
      primaryColor: "#0369A1",
      surfaceColor: "#FFFFFF",
      textColor: "#183044",
      headingFont: "Manrope",
      bodyFont: "Inter",
    },
    theme: {
      ...base,
      preset: "health-clear",
      mode: "light",
      primaryColor: "#0369A1",
      secondaryColor: "#0F766E",
      accentColor: "#38BDF8",
      backgroundColor: "#F5FAFC",
      surfaceColor: "#FFFFFF",
      textColor: "#183044",
      mutedTextColor: "#607483",
      headingFont: "Manrope",
      bodyFont: "Inter",
      buttonStyle: "rounded",
      cardStyle: "bordered",
      cardRadius: 16,
      backgroundType: "image",
      backgroundPreset: null,
      backgroundGradient: null,
      backgroundImageUrl: "/themes/backgrounds/health-light.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 5,
      backgroundOverlayColor: "light",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
  {
    id: "youth-pop",
    name: "Energia Pop",
    shortDescription: "Vibrante e expressivo para criadores de conteúdo, festas, DJs e profissionais jovens.",
    recommendedSegments: ["jovem"],
    tags: ["criadores de conteúdo", "recreadores", "festas", "DJs", "dança", "influenciadores", "jovem"],
    mode: "light",
    featured: false,
    badge: "new",
    order: 10,
    preview: {
      backgroundStyle: "linear-gradient(135deg, #fdf4ff 0%, #fce7f3 50%, #ede9fe 100%)",
      primaryColor: "#DB2777",
      surfaceColor: "#FFFFFF",
      textColor: "#32134A",
      headingFont: "Archivo",
      bodyFont: "Poppins",
    },
    theme: {
      ...base,
      preset: "youth-pop",
      mode: "light",
      primaryColor: "#DB2777",
      secondaryColor: "#6D28D9",
      accentColor: "#FACC15",
      backgroundColor: "#FFF7FD",
      surfaceColor: "#FFFFFF",
      textColor: "#32134A",
      mutedTextColor: "#765B82",
      headingFont: "Archivo",
      bodyFont: "Poppins",
      buttonStyle: "pill",
      cardStyle: "elevated",
      cardRadius: 24,
      backgroundType: "image",
      backgroundGradient: null,
      backgroundPreset: null,
      backgroundImageUrl: "/themes/backgrounds/youth-bokeh.jpg",
      backgroundStoragePath: null,
      backgroundUpdatedAt: null,
      backgroundOverlay: 10,
      backgroundOverlayColor: "dark",
      backgroundPosition: "center",
      backgroundSize: "cover",
      backgroundAttachment: "scroll",
      showProfileImage: true,
      showServiceImages: true,
    },
  },
];

export const themePresetCatalog: ThemePreset[] = rawThemePresetCatalog.filter((preset) => {
  const result = validateThemePreset(preset);
  if (!result.valid) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`Preset inválido: ${preset.id}`, result.errors);
    }
    return false;
  }
  return true;
});

export function getThemePresetById(id: string): ThemePreset | null {
  return themePresetCatalog.find((p) => p.id === id) ?? null;
}

export function getThemePresetsBySegment(segment: SegmentFilter): ThemePreset[] {
  return themePresetCatalog.filter((p) => p.recommendedSegments.includes(segment));
}

export function searchThemePresets(query: string): ThemePreset[] {
  const q = query.toLowerCase().trim();
  if (!q) return themePresetCatalog;
  return themePresetCatalog.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.shortDescription.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.recommendedSegments.some((s) => s.toLowerCase().includes(q))
  );
}

export function validateThemePreset(preset: ThemePreset): {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
} {
  const errors: Array<{ field: string; message: string }> = [];

  if (!preset.id) {
    errors.push({ field: "id", message: "ID do preset está ausente." });
  }
  if (!preset.name) {
    errors.push({ field: "name", message: "Nome do preset está ausente." });
  }
  if (!preset.recommendedSegments || preset.recommendedSegments.length === 0) {
    errors.push({ field: "recommendedSegments", message: "O preset deve ter pelo menos um segmento recomendado." });
  } else {
    for (const seg of preset.recommendedSegments) {
      if (!SEGMENT_LABELS[seg]) {
        errors.push({ field: "recommendedSegments", message: `Segmento recomendado inválido: ${seg}` });
      }
    }
  }
  if (!preset.tags || preset.tags.length === 0) {
    errors.push({ field: "tags", message: "O preset deve ter pelo menos uma tag." });
  }
  if (preset.mode !== "light" && preset.mode !== "dark") {
    errors.push({ field: "mode", message: `Modo inválido: ${preset.mode}` });
  }

  // Preview validation
  if (!preset.preview) {
    errors.push({ field: "preview", message: "Configuração de preview está ausente." });
  } else {
    const previewFields = ["backgroundStyle", "primaryColor", "surfaceColor", "textColor", "headingFont", "bodyFont"];
    for (const f of previewFields) {
      if (!preset.preview[f as keyof typeof preset.preview]) {
        errors.push({ field: `preview.${f}`, message: `Campo de preview ausente: ${f}` });
      }
    }
  }

  // ThemeConfig validation
  if (!preset.theme) {
    errors.push({ field: "theme", message: "Configuração de tema (theme) está ausente." });
  } else {
    const result = validateThemeConfig(preset.theme);
    if (!result.valid) {
      errors.push({ field: "theme", message: result.error || "ThemeConfig inválido." });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateThemePresetCatalog(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const preset of themePresetCatalog) {
    if (!preset.id) {
      errors.push("Preset sem ID.");
      continue;
    }
    if (ids.has(preset.id)) {
      errors.push(`ID duplicado: ${preset.id}`);
    }
    ids.add(preset.id);

    const result = validateThemePreset(preset);
    if (!result.valid) {
      for (const err of result.errors) {
        errors.push(`[${preset.id}] Campo: ${err.field} - Motivo: ${err.message}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
