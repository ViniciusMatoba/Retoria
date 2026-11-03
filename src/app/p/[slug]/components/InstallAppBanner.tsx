"use client";

import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Convite discreto para instalar o app (do profissional na página pública, ou o painel do administrador).
// Android: botão que abre o instalador do Chrome. iPhone: instrução (o Safari não tem botão de instalar).
export default function InstallAppBanner({
  appName,
  description = "Agende mais rápido, direto da tela inicial.",
  dismissKey = "retoria-install-dismissed",
}: {
  appName: string;
  description?: string;
  dismissKey?: string;
}) {
  const DISMISS_KEY = dismissKey;
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    let wasDismissed = false;
    try { wasDismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch {}
    setDismissed(standalone || wasDismissed);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent));

    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [DISMISS_KEY]);

  if (dismissed || (!installEvent && !isIos)) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    dismiss();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur flex items-center gap-3 text-slate-100">
      <Download className="h-5 w-5 shrink-0 text-indigo-400" />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-bold truncate">Instale o app {appName}</p>
        {installEvent ? (
          <p className="text-slate-400">{description}</p>
        ) : (
          <p className="text-slate-400">Toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.</p>
        )}
      </div>
      {installEvent && (
        <button type="button" onClick={install} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">
          Instalar
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label="Fechar" className="p-1 text-slate-400 hover:text-slate-200">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
