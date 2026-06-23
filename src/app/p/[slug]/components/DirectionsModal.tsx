"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Navigation, Map, Copy, Check } from "lucide-react";
import {
  PublicAddress,
  formatPublicAddress,
  buildGoogleMapsDirectionsUrl,
  buildWazeDirectionsUrl,
  hasMinimalAddress,
} from "@/lib/contactUtils";

interface DirectionsModalProps {
  address: PublicAddress;
  isPreview?: boolean;
  onClose: () => void;
}

export default function DirectionsModal({ address, isPreview = false, onClose }: DirectionsModalProps) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  const handleClose = () => {
    onClose();
    setTimeout(() => triggerRef.current?.focus(), 50);
  };

  const handleCopyAddress = async () => {
    const text = formatPublicAddress(address);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // silent fail — clipboard not available
    }
  };

  const googleUrl = buildGoogleMapsDirectionsUrl(address);
  const wazeUrl = buildWazeDirectionsUrl(address);
  const formattedAddress = formatPublicAddress(address);

  const handleExternalLink = (url: string) => {
    if (isPreview) return; // block navigation in preview mode
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Como chegar"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet / Modal */}
      <div className="relative w-full sm:max-w-sm bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Como chegar</h2>
            {isPreview && (
              <p className="text-[10px] text-amber-400 font-semibold mt-0.5">Modo prévia — navegação bloqueada</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Address display */}
        <div className="px-5 py-4 text-xs text-slate-400 leading-relaxed border-b border-slate-800">
          <p className="font-semibold text-slate-300 mb-1">Endereço</p>
          <p>{formattedAddress}</p>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          {googleUrl && (
            <button
              type="button"
              onClick={() => handleExternalLink(googleUrl)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-all ${
                isPreview
                  ? "border-slate-800 text-slate-500 cursor-not-allowed"
                  : "border-slate-800 hover:border-blue-500/40 hover:bg-blue-500/5 text-slate-200"
              }`}
            >
              <Map className="h-5 w-5 text-blue-400 shrink-0" />
              <span>Abrir no Google Maps</span>
            </button>
          )}

          {wazeUrl && (
            <button
              type="button"
              onClick={() => handleExternalLink(wazeUrl)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-all ${
                isPreview
                  ? "border-slate-800 text-slate-500 cursor-not-allowed"
                  : "border-slate-800 hover:border-sky-500/40 hover:bg-sky-500/5 text-slate-200"
              }`}
            >
              <Navigation className="h-5 w-5 text-sky-400 shrink-0" />
              <span>Abrir no Waze</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyAddress}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-semibold transition-all"
          >
            {copied ? (
              <Check className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="h-5 w-5 text-slate-400 shrink-0" />
            )}
            <span>{copied ? "Endereço copiado!" : "Copiar endereço"}</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="w-full px-4 py-3 rounded-2xl text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
