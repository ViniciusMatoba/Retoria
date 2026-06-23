"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Monitor, Tablet, Smartphone, Check, ArrowLeft } from "lucide-react";
import { ThemePreset } from "@/lib/themePresetCatalog";
import { ThemeConfig } from "@/lib/themeUtils";
import PublicBookingExperience, {
  Professional,
  Service,
  AvailableSlot,
} from "@/app/p/[slug]/components/PublicBookingExperience";

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  desktop: 1024,
  tablet: 768,
  mobile: 390,
};

interface ThemePresetPreviewModalProps {
  preset: ThemePreset;
  professional: Professional;
  services: Service[];
  slots: AvailableSlot[];
  onClose: () => void;
  onApply: (theme: ThemeConfig, presetId: string) => void;
}

export default function ThemePresetPreviewModal({
  preset,
  professional,
  services,
  slots,
  onClose,
  onApply,
}: ThemePresetPreviewModalProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Store the element that opened the modal so we can restore focus on close
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  const handleClose = () => {
    onClose();
    setTimeout(() => triggerRef.current?.focus(), 50);
  };

  const handleApply = () => {
    onApply(preset.theme, preset.id);
    handleClose();
  };

  const contentWidth = VIEWPORT_WIDTHS[viewport];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Prévia do tema: ${preset.name}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md"
    >
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
          aria-label="Voltar aos temas"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Voltar</span>
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 font-semibold truncate">Prévia —</p>
          <p className="text-sm text-slate-200 font-bold truncate">{preset.name}</p>
        </div>

        {/* Viewport switcher */}
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
          {(["desktop", "tablet", "mobile"] as Viewport[]).map((vp) => {
            const Icon = vp === "desktop" ? Monitor : vp === "tablet" ? Tablet : Smartphone;
            const label = vp === "desktop" ? "Desktop" : vp === "tablet" ? "Tablet" : "Mobile";
            return (
              <button
                key={vp}
                type="button"
                onClick={() => setViewport(vp)}
                title={label}
                aria-pressed={viewport === vp}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewport === vp
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleApply}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors shadow"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Usar este tema</span>
        </button>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar prévia"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-slate-950 flex items-start justify-center p-4 md:p-8">
        <div
          className="origin-top transition-all duration-300 bg-slate-950 overflow-hidden shadow-2xl rounded-2xl border border-slate-800"
          style={{
            width: contentWidth,
            minWidth: Math.min(contentWidth, 320),
            maxWidth: "100%",
          }}
        >
          <PublicBookingExperience
            professional={professional}
            services={services}
            slots={slots}
            themeConfig={preset.theme}
            previewMode={true}
          />
        </div>
      </div>
    </div>
  );
}
