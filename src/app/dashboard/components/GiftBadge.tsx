"use client";

import React, { useState } from "react";
import { Check, Gift, Loader2 } from "lucide-react";
import { useAuth } from "@/app/providers";
import { getSaoPauloToday } from "@/lib/timezone";
import { useGiftBadges, type BadgeLead } from "@/hooks/useGiftBadges";

const deliveredOn = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

// Selo do brinde num agendamento: "Entregar brinde" (no dia ou depois), "Tem brinde" (ainda vai vir)
// ou "Brinde entregue em dd/mm" — que aparece em todos os agendamentos da mesma cliente no período.
// Não mostra nada se o agendamento não participa de nenhum brinde.
export default function GiftBadge({ lead, className = "" }: { lead: BadgeLead; className?: string }) {
  const { user } = useAuth();
  const { statusOf, deliver } = useGiftBadges(user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const status = statusOf(lead);
  if (!status) return null;

  if (status.delivered) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ${className}`} title={status.campaign.nome}>
        <Check className="h-3 w-3" /> Brinde entregue em {deliveredOn(status.delivered.entregueEm)}
      </span>
    );
  }

  if ((lead.dataEscolhida ?? "") > getSaoPauloToday()) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-indigo-500/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 ${className}`} title={status.campaign.nome}>
        <Gift className="h-3 w-3" /> Tem brinde
      </span>
    );
  }

  const onClick = async () => {
    setBusy(true);
    setError("");
    const err = await deliver(lead);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title={status.campaign.nome}
        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
        Entregar brinde
      </button>
      {error && <span className="text-[11px] font-semibold text-amber-400">{error}</span>}
    </span>
  );
}
