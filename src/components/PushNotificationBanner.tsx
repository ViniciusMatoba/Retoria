"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellOff, X, Loader2 } from "lucide-react";
import { usePushNotification } from "@/hooks/usePushNotification";

interface Props {
  userId: string | undefined;
}

const DISMISSED_KEY = "retoria_push_banner_dismissed";

export default function PushNotificationBanner({ userId }: Props) {
  const { permission, isRegistered, isLoading, enable } = usePushNotification(userId);
  const [dismissed, setDismissed] = useState(true); // começa oculto até verificar

  useEffect(() => {
    // Mostra o banner se o usuário nunca foi solicitado (permission === "default")
    // e não tiver dismissado manualmente antes
    const wasDismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    if (!wasDismissed && permission === "default") {
      setDismissed(false);
    }
  }, [permission]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleEnable = async () => {
    await enable();
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  // Não mostra se: já concedido, negado, sem suporte, ou dismissado
  if (dismissed || permission === "granted" || permission === "denied" || permission === "unsupported") {
    return null;
  }

  return (
    <div className="mx-4 mt-3 mb-0 md:mx-0 md:mt-0">
      <div className="flex items-start gap-3 px-4 py-3 bg-indigo-600/15 border border-indigo-500/30 rounded-2xl">
        <div className="shrink-0 mt-0.5 p-1.5 bg-indigo-500/20 rounded-lg">
          <Bell className="h-4 w-4 text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-200">
            Receba alertas de novos agendamentos
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
            Ative as notificações para saber na hora quando um cliente agendar, mesmo com o dashboard fechado.
          </p>

          <div className="flex gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleEnable}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-[11px] font-bold rounded-lg transition-all"
            >
              {isLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Bell className="h-3 w-3" />}
              Ativar notificações
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-[11px] font-semibold rounded-lg transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
