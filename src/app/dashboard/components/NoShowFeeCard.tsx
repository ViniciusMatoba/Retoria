"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ChevronDown, Loader2, Receipt } from "lucide-react";
import { db } from "@/lib/firebase";
import { brl, readNoShowFeeSettings } from "@/lib/leadStatus";

// Cartão da tela de Leads: taxa cobrada de quem é marcado como Perdido ou Não compareceu.
// Enquanto a taxa estiver pendente, a cliente vê um aviso na página pública e não consegue agendar.
export default function NoShowFeeCard({ uid, initial, pendingCount }: { uid: string; initial: unknown; pendingCount: number }) {
  const start = readNoShowFeeSettings(initial);
  const [open, setOpen] = useState(false);
  const [ativo, setAtivo] = useState(start.ativo);
  const [valor, setValor] = useState(String(start.valor).replace(".", ","));
  const [saved, setSaved] = useState(start);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "erro"; text: string } | null>(null);

  const save = async () => {
    const v = Number(valor.replace(",", "."));
    if (ativo && (!Number.isFinite(v) || v <= 0 || v > 10_000)) { setMsg({ tone: "erro", text: "Informe um valor válido." }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const next = { ativo, valor: Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : saved.valor };
      await updateDoc(doc(db, "professionals", uid), { taxaNaoComparecimento: next });
      setSaved(next);
      setMsg({ tone: "ok", text: next.ativo ? `Taxa de ${brl(next.valor)} ligada para novos não comparecimentos.` : "Taxa desligada. Novas faltas não geram cobrança." });
    } catch {
      setMsg({ tone: "erro", text: "Não foi possível salvar. Tente novamente." });
    } finally {
      setBusy(false);
    }
  };

  const dirty = ativo !== saved.ativo || Number(valor.replace(",", ".")) !== saved.valor;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="flex min-w-0 items-center gap-3">
          <Receipt className={`h-5 w-5 shrink-0 ${saved.ativo ? "text-orange-400" : "text-slate-500"}`} />
          <div className="min-w-0">
            <div className="font-semibold text-slate-200">Taxa de não comparecimento</div>
            <div className="truncate text-xs text-slate-500">
              {saved.ativo ? `${brl(saved.valor)} · ` : "Desligada · "}
              {pendingCount > 0 ? <span className="font-semibold text-orange-400">{pendingCount} pendente(s)</span> : "nenhuma pendente"}
            </div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-800 p-4">
          <p className="text-xs text-slate-400">
            Ao marcar um agendamento como <strong>Perdido</strong> ou <strong>Não compareceu</strong>, a cliente fica com a taxa pendente.
            Quando ela tentar agendar de novo pela página, vê um aviso para pagar e enviar o comprovante, e só consegue agendar depois que você der baixa (botão no agendamento, aqui em Leads).
          </p>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-200">Cobrar taxa</span>
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => { setAtivo(e.target.checked); setMsg(null); }}
              className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-700 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:bg-orange-500 checked:before:translate-x-4"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-200">Valor (R$)</span>
            <input
              inputMode="decimal"
              value={valor}
              disabled={!ativo}
              onChange={(e) => { setValor(e.target.value.replace(/[^\d,.]/g, "")); setMsg(null); }}
              className="h-10 w-28 rounded-xl border border-slate-700 bg-slate-950 px-3 text-right text-base text-slate-100 disabled:opacity-50 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          {msg && (
            <div className={`rounded-xl border p-3 text-sm ${msg.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{msg.text}</div>
          )}
          <button type="button" onClick={save} disabled={!dirty || busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      )}
    </section>
  );
}
