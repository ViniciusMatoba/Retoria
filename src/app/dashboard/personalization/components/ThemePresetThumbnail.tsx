import React from "react";
import { ThemePreset } from "@/lib/themePresetCatalog";
import { gradientPresets, bgPatterns } from "@/lib/themeUtils";

interface ThemePresetThumbnailProps {
  preset: ThemePreset;
  size?: "sm" | "md";
}

function resolveBackground(preset: ThemePreset): string {
  const t = preset.theme;
  if (t.backgroundType === "gradient" && t.backgroundGradient) {
    return gradientPresets[t.backgroundGradient] ?? t.backgroundColor;
  }
  if (t.backgroundType === "preset" && t.backgroundPreset) {
    const pattern = bgPatterns[t.backgroundPreset];
    if (pattern) {
      return `${pattern.css}, ${t.backgroundColor}`;
    }
  }
  return t.backgroundColor;
}

export default function ThemePresetThumbnail({ preset, size = "md" }: ThemePresetThumbnailProps) {
  const { theme: t } = preset;
  const bg = resolveBackground(preset);
  const isSmall = size === "sm";

  const w = isSmall ? 120 : 200;
  const h = isSmall ? 80 : 130;

  return (
    <div
      className="rounded-xl overflow-hidden shrink-0"
      style={{ width: w, height: h, background: bg, position: "relative" }}
      aria-hidden="true"
    >
      {/* Header bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: isSmall ? 18 : 28,
          background: t.surfaceColor,
          borderBottom: `2px solid ${t.primaryColor}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: isSmall ? 6 : 10,
          gap: isSmall ? 3 : 5,
        }}
      >
        <div
          style={{
            width: isSmall ? 18 : 28,
            height: isSmall ? 5 : 8,
            borderRadius: 999,
            background: t.primaryColor,
            opacity: 0.9,
          }}
        />
        <div
          style={{
            width: isSmall ? 10 : 16,
            height: isSmall ? 5 : 8,
            borderRadius: 999,
            background: t.mutedTextColor,
            opacity: 0.35,
          }}
        />
      </div>

      {/* Content area */}
      <div
        style={{
          position: "absolute",
          top: isSmall ? 22 : 34,
          left: isSmall ? 6 : 10,
          right: isSmall ? 6 : 10,
          bottom: isSmall ? 6 : 10,
          display: "flex",
          flexDirection: "column",
          gap: isSmall ? 4 : 6,
        }}
      >
        {/* Card mock */}
        <div
          style={{
            background: t.surfaceColor,
            borderRadius: t.cardRadius / (isSmall ? 2 : 1.5),
            padding: isSmall ? "3px 5px" : "5px 8px",
            border: t.cardStyle === "bordered" ? `1px solid ${t.mutedTextColor}30` : "none",
            boxShadow: t.cardStyle === "elevated" ? "0 2px 6px rgba(0,0,0,0.12)" : "none",
            display: "flex",
            alignItems: "center",
            gap: isSmall ? 3 : 5,
          }}
        >
          <div
            style={{
              width: isSmall ? 16 : 24,
              height: isSmall ? 16 : 24,
              borderRadius: t.cardRadius / (isSmall ? 3 : 2),
              background: `${t.primaryColor}25`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                width: "60%",
                height: isSmall ? 3 : 5,
                borderRadius: 2,
                background: t.textColor,
                opacity: 0.8,
              }}
            />
            <div
              style={{
                width: "40%",
                height: isSmall ? 2 : 4,
                borderRadius: 2,
                background: t.mutedTextColor,
                opacity: 0.5,
              }}
            />
          </div>
        </div>

        {/* Button mock */}
        <div
          style={{
            background: t.primaryColor,
            borderRadius:
              t.buttonStyle === "pill"
                ? 999
                : t.buttonStyle === "rounded"
                ? isSmall ? 8 : 12
                : t.buttonStyle === "soft"
                ? isSmall ? 4 : 6
                : 0,
            height: isSmall ? 10 : 16,
            width: "55%",
            alignSelf: "flex-start",
          }}
        />
      </div>
    </div>
  );
}
