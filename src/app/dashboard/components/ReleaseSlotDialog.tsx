"use client";

import React, { useSyncExternalStore } from "react";
import { CalendarCheck2, CalendarX2, X } from "lucide-react";

// Pergunta, ao cancelar / marcar perdido / não compareceu ANTES do horário, se o horário fica livre.
// Uso: const escolha = await askReleaseSlot({ nome, status }); null = desistiu, true = liberar, false = manter.
// O <ReleaseSlotDialogHost /> fica montado uma vez no painel (DashboardShell).

type Pending = { nome: string; status: string; quando: string; resolve: (v: boolean | null) => void } | null;
let pending: Pending = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => pending;

export function askReleaseSlot(opts: { nome: string; status: string; quando: string }): Promise<boolean | null> {
  pending?.resolve(null);
  return new Promise((resolve) => {
    pending = { ...opts, resolve };
    emit();
  });
}

const answer = (v: boolean | null) => {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(v);
};

export default function ReleaseSlotDialogHost() {
  const p = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (!p) return null;
  const acao = p.status === "Cancelado" ? "cancelado" : p.status === "Perdido" ? "marcado como perdido" : "marcado como não compareceu";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="release-title">
      <button type="button" aria-label="Voltar sem alterar" onClick={() => answer(null)} className="absolute inset-0 bg-black/60" />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
        <button type="button" aria-label="Voltar sem alterar" onClick={() => answer(null)} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800">
          <X className="h-4 w-4" />
        </button>
        <div className="pr-8">
          <h2 id="release-title" className="text-base font-bold text-slate-100">Liberar o horário?</h2>
          <p className="mt-1 text-sm text-slate-400">
            O agendamento de <strong className="text-slate-200">{p.nome || "cliente"}</strong> ({p.quando}) será {acao}. O horário ainda não chegou.
          </p>
        </div>
        <div className="space-y-2">
          <button type="button" onClick={() => answer(true)} className="w-full flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-left hover:bg-emerald-500/15">
            <CalendarCheck2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
            <span>
              <span className="block text-sm font-bold text-emerald-300">Liberar horário</span>
              <span className="block text-xs text-slate-400">Some da agenda e o horário volta a ficar livre para outra cliente.</span>
            </span>
          </button>
          <button type="button" onClick={() => answer(false)} className="w-full flex items-start gap-3 rounded-xl border border-slate-700 p-3 text-left hover:bg-slate-800">
            <CalendarX2 className="h-5 w-5 shrink-0 text-slate-300 mt-0.5" />
            <span>
              <span className="block text-sm font-bold text-slate-200">Manter na agenda</span>
              <span className="block text-xs text-slate-400">Continua aparecendo na agenda, apagado, e o horário fica ocupado.</span>
            </span>
          </button>
          <button type="button" onClick={() => answer(null)} className="w-full py-2 text-sm font-semibold text-slate-400 hover:text-slate-200">
            Voltar sem alterar
          </button>
        </div>
      </div>
    </div>
  );
}
