import { themePresetCatalog, validateThemePreset, validateThemePresetCatalog } from "../src/lib/themePresetCatalog";
import { validateThemeConfig, getDefaultThemeConfig } from "../src/lib/themeUtils";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, message?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    if (message) console.error(`    Erro: ${message}`);
    failed++;
  }
}

async function main() {
  console.log("=== INICIANDO TESTES DO SISTEMA DE TEMAS ===");

  // 1. Validar todo o catálogo de presets
  const catalogResult = validateThemePresetCatalog();
  assert(
    "Todos os presets do catálogo devem ser válidos (validateThemePresetCatalog)",
    catalogResult.valid,
    catalogResult.errors.join(", ")
  );

  // 1.2. Validar cada preset individualmente no loop
  let catalogPresetsValid = true;
  for (const preset of themePresetCatalog) {
    const result = validateThemePreset(preset);
    if (!result.valid || result.errors.length > 0) {
      catalogPresetsValid = false;
      console.error(`  Preset [${preset.id}] falhou na validação. Erros:`, result.errors);
    }
  }
  assert("Cada preset do catálogo passa na validação individual com zero erros", catalogPresetsValid);

  // 2. Verificar que nenhum preset usa URLs externas proibidas
  let hasExternalUrl = false;
  for (const preset of themePresetCatalog) {
    const url = preset.theme.backgroundImageUrl;
    if (url && !url.startsWith("/") && !url.includes("firebasestorage.googleapis.com")) {
      hasExternalUrl = true;
      console.error(`Preset [${preset.id}] usa URL inválida: ${url}`);
    }
  }
  assert("Nenhum preset do catálogo deve conter URLs externas proibidas", !hasExternalUrl);

  // 3. Testar validação de imagem local (começando com '/')
  const baseConfig = getDefaultThemeConfig();
  const localImageConfig = {
    ...baseConfig,
    backgroundType: "image" as const,
    backgroundImageUrl: "/themes/backgrounds/beauty-marble.jpg"
  };
  const localResult = validateThemeConfig(localImageConfig);
  assert("Deve aceitar imagem local com caminho relativo (começando com '/')", localResult.valid, localResult.error);

  // 4. Testar validação de imagem oficial no Firebase Storage
  const storageImageConfig = {
    ...baseConfig,
    backgroundType: "image" as const,
    backgroundImageUrl: "https://firebasestorage.googleapis.com/v0/b/retoria-prod/o/logo.jpg?alt=media"
  };
  const storageResult = validateThemeConfig(storageImageConfig);
  assert("Deve aceitar imagem hospedada no Firebase Storage oficial", storageResult.valid, storageResult.error);

  // 5. Testar rejeição de imagens de hosts não autorizados
  const externalImageConfig = {
    ...baseConfig,
    backgroundType: "image" as const,
    backgroundImageUrl: "https://images.unsplash.com/photo-12345"
  };
  const externalResult = validateThemeConfig(externalImageConfig);
  assert("Deve REJEITAR imagem de host externo não autorizado (ex: Unsplash)", !externalResult.valid);

  // 6. Testar presets de gradiente
  const gradientConfig = {
    ...baseConfig,
    backgroundType: "gradient" as const,
    backgroundGradient: "aurora"
  };
  const gradientResult = validateThemeConfig(gradientConfig);
  assert("Deve aceitar gradiente válido ('aurora')", gradientResult.valid, gradientResult.error);

  const invalidGradientConfig = {
    ...baseConfig,
    backgroundType: "gradient" as const,
    backgroundGradient: "invalid-gradient-name"
  };
  const invalidGradientResult = validateThemeConfig(invalidGradientConfig);
  assert("Deve REJEITAR gradiente inválido", !invalidGradientResult.valid);

  // 7. Testar presets de padrão (bgPatterns)
  const patternConfig = {
    ...baseConfig,
    backgroundType: "preset" as const,
    backgroundPreset: "waves"
  };
  const patternResult = validateThemeConfig(patternConfig);
  assert("Deve aceitar padrão de fundo válido ('waves')", patternResult.valid, patternResult.error);

  const invalidPatternConfig = {
    ...baseConfig,
    backgroundType: "preset" as const,
    backgroundPreset: "invalid-pattern-name"
  };
  const invalidPatternResult = validateThemeConfig(invalidPatternConfig);
  assert("Deve REJEITAR padrão de fundo inválido", !invalidPatternResult.valid);

  // 8. Testar rejeição de cores inválidas (não hex)
  const invalidColorConfig = {
    ...baseConfig,
    primaryColor: "rgb(255, 0, 0)"
  };
  const invalidColorResult = validateThemeConfig(invalidColorConfig);
  assert("Deve REJEITAR cor que não está em formato hexadecimal válido", !invalidColorResult.valid);

  // 9. Testar rejeição de fontes fora do catálogo
  const invalidFontConfig = {
    ...baseConfig,
    headingFont: "Comic Sans MS"
  };
  const invalidFontResult = validateThemeConfig(invalidFontConfig);
  assert("Deve REJEITAR fonte fora do catálogo permitido", !invalidFontResult.valid);

  // 10. Testar que filtros funcionam e removem presets inválidos (caso existam)
  const invalidPreset = {
    id: "invalid-test-preset",
    name: "Preset Inválido",
    shortDescription: "Para teste",
    recommendedSegments: ["beleza" as const],
    tags: ["teste"],
    mode: "light" as const,
    badge: null as any,
    order: 0,
    preview: {
      backgroundStyle: "#FFF",
      primaryColor: "#000",
      surfaceColor: "#FFF",
      textColor: "#000",
      headingFont: "Inter",
      bodyFont: "Inter"
    },
    theme: {
      ...baseConfig,
      primaryColor: "invalid-color-hex"
    }
  };

  const validationOfInvalidPreset = validateThemePreset(invalidPreset);
  assert("Deve detectar preset inválido na validação de metadados", !validationOfInvalidPreset.valid);

  // Resultados
  console.log(`\n=============================================`);
  console.log(`Resultados dos testes: ${passed} passados, ${failed} falhos.`);
  console.log(`=============================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro nos testes:", err);
  process.exit(1);
});
