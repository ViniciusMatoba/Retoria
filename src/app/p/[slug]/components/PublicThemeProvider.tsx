import React from "react";
import { 
  fontCatalog, 
  ThemeConfig, 
  getButtonRadius, 
  gradientPresets, 
  bgPatterns, 
  buildVersionedImageUrl 
} from "@/lib/themeUtils";

export function getGoogleFontsLink(headingFont: string, bodyFont: string): string {
  const headingItem = fontCatalog.find(f => f.family === headingFont);
  const bodyItem = fontCatalog.find(f => f.family === bodyFont);
  
  if (!headingItem || !bodyItem) return "";
  
  const headingFamilyParam = headingItem.family.replace(/ /g, "+");
  const bodyFamilyParam = bodyItem.family.replace(/ /g, "+");
  
  const headingWeights = headingItem.weights.join(";");
  const bodyWeights = bodyItem.weights.join(";");
  
  if (headingItem.family === bodyItem.family) {
    const combinedWeights = Array.from(new Set([...headingItem.weights, ...bodyItem.weights])).sort().join(";");
    return `https://fonts.googleapis.com/css2?family=${headingFamilyParam}:wght@${combinedWeights}&display=swap`;
  }
  
  return `https://fonts.googleapis.com/css2?family=${headingFamilyParam}:wght@${headingWeights}&family=${bodyFamilyParam}:wght@${bodyWeights}&display=swap`;
}

interface PublicThemeProviderProps {
  themeConfig: ThemeConfig;
  children: React.ReactNode;
}

export default function PublicThemeProvider({
  themeConfig,
  children
}: PublicThemeProviderProps) {
  const fontUrl = getGoogleFontsLink(themeConfig.headingFont, themeConfig.bodyFont);

  const styleVariables = {
    "--theme-primary": themeConfig.primaryColor,
    "--theme-secondary": themeConfig.secondaryColor,
    "--theme-accent": themeConfig.accentColor,
    "--theme-background": themeConfig.backgroundColor,
    "--theme-surface": themeConfig.surfaceColor,
    "--theme-text": themeConfig.textColor,
    "--theme-muted-text": themeConfig.mutedTextColor,
    "--theme-card-radius": `${themeConfig.cardRadius}px`,
    "--theme-button-radius": getButtonRadius(themeConfig.buttonStyle),
    "--theme-heading-font": `'${themeConfig.headingFont}', ${fontCatalog.find(f => f.family === themeConfig.headingFont)?.fallback || 'sans-serif'}`,
    "--theme-body-font": `'${themeConfig.bodyFont}', ${fontCatalog.find(f => f.family === themeConfig.bodyFont)?.fallback || 'sans-serif'}`,
  } as React.CSSProperties;

  // Resolve background style inline
  const bgStyle: React.CSSProperties = { ...styleVariables };
  if (themeConfig.backgroundType === "solid") {
    bgStyle.backgroundColor = themeConfig.backgroundColor;
  } else if (themeConfig.backgroundType === "gradient" && themeConfig.backgroundGradient) {
    bgStyle.background = gradientPresets[themeConfig.backgroundGradient] || themeConfig.backgroundColor;
  } else if (themeConfig.backgroundType === "preset" && themeConfig.backgroundPreset) {
    bgStyle.background = bgPatterns[themeConfig.backgroundPreset]?.css || themeConfig.backgroundColor;
    if (themeConfig.backgroundPreset === "texturized") {
      bgStyle.backgroundSize = "20px 20px";
    }
  } else if (themeConfig.backgroundType === "image" && themeConfig.backgroundImageUrl) {
    const versionedUrl = buildVersionedImageUrl(themeConfig.backgroundImageUrl, themeConfig.backgroundUpdatedAt);
    bgStyle.backgroundImage = `url(${versionedUrl})`;
    bgStyle.backgroundPosition = themeConfig.backgroundPosition;
    bgStyle.backgroundSize = themeConfig.backgroundSize;
    bgStyle.backgroundAttachment = themeConfig.backgroundAttachment;
  }

  return (
    <div style={bgStyle} className="min-h-screen text-[var(--theme-text)] relative selection:bg-[var(--theme-primary)] selection:text-white transition-colors duration-200">
      {fontUrl && <link rel="stylesheet" href={fontUrl} />}
      {themeConfig.backgroundType === "image" && themeConfig.backgroundOverlay > 0 && (
        <div 
          className={`absolute inset-0 pointer-events-none z-0 ${
            themeConfig.backgroundOverlayColor === "dark" ? "bg-black" : "bg-white"
          }`}
          style={{ opacity: themeConfig.backgroundOverlay / 100 }}
        />
      )}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
