"use client";

import React, { useState } from "react";
import type { User } from "firebase/auth";
import { Bell, BellOff, BellRing, ChevronDown, Loader2, Send } from "lucide-react";
import { usePushNotification } from "@/hooks/usePushNotification";

// Cartão da tela de Leads: avisos de agendamento neste aparelho (ligar, testar, desligar).
// A confirmação continua manual: o agendamento entra como Novo e o profissional marca como Agendado.
export default function BookingAlertsCard({ user }: { user: User }) {
  const { permission, isRegistered, isLoading, enable, disable } = usePushNotification(user.uid);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"" | "test">("");
  const [msg, setMsg] = useState<{ tone: "ok" | "erro"; text: string } | null>(null);

  const sendTest = async () => {
    setBusy("test");
    setMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/professionals/${user.uid}/push-test`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar o teste.");
      setMsg(
        data.sent > 0
          ? { tone: "ok", text: `Teste enviado para ${data.sent} aparelho(s). O aviso deve aparecer em alguns segundos.` }
          : { tone: "erro", text: "Nenhum aparelho recebeu o teste. Desative e ative os avisos de novo neste aparelho." }
      );
    } catch (e) {
      setMsg({ tone: "erro", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const turnOn = async () => {
    setMsg(null);
    const ok = await enable();
    if (ok) setMsg({ tone: "ok", text: "Avisos ligados neste aparelho. Toque em \"Enviar aviso de teste\" para conferir." });
    else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setMsg({ tone: "erro", text: "A permissão foi dada, mas o aparelho não pôde ser registrado. Confira a internet e tente de novo." });
    }
  };

  const alertsOn = permission === "granted" && isRegistered;
  const summary = alertsOn ? "Ligados neste aparelho" : "Desligados neste aparelho";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="flex min-w-0 items-center gap-3">
          {alertsOn ? <BellRing className="h-5 w-5 shrink-0 text-emerald-400" /> : <BellOff className="h-5 w-5 shrink-0 text-slate-500" />}
          <div className="min-w-0">
            <div className="font-semibold text-slate-200">Avisos de agendamento</div>
            <div className={`truncate text-xs ${alertsOn ? "text-emerald-400" : "text-slate-500"}`}>{summary}</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-800 p-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avisos neste aparelho</div>
            <p className="text-xs text-slate-400">
              Você recebe um aviso quando uma cliente agenda, cancela ou remarca pela página pública, mesmo com o app fechado. Ative em cada aparelho que usar. O agendamento continua entrando como Novo, para você conferir e marcar como Agendado.
            </p>
            {permission === "unsupported" ? (
              <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">
                Este navegador não mostra avisos. No iPhone, instale o app na tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá; é preciso iOS 16.4 ou mais novo.
              </p>
            ) : permission === "denied" ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Os avisos estão bloqueados neste aparelho. Libere as notificações do Retoria nas configurações do navegador ou do celular e volte aqui.
              </p>
            ) : alertsOn ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={sendTest} disabled={busy !== "" || isLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                  {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar aviso de teste
                </button>
                <button type="button" onClick={() => { setMsg(null); disable(); }} disabled={busy !== "" || isLoading} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">
                  <BellOff className="h-4 w-4" />
                  Desativar neste aparelho
                </button>
              </div>
            ) : (
              <button type="button" onClick={turnOn} disabled={isLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Ativar avisos neste aparelho
              </button>
            )}
          </div>

          {msg && (
            <div className={`rounded-xl border p-3 text-sm ${msg.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{msg.text}</div>
          )}
        </div>
      )}
    </section>
  );
}
