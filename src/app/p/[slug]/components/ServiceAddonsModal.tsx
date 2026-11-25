"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Clock, Plus, Sparkles, X } from "lucide-react";
import { getBestTextColor } from "@/lib/themeUtils";

interface AddonOption {
  id: string;
  nome: string;
  descricaoCurta?: string;
  duracaoEstimada: string;
  preco?: number | null;
  exibirPreco?: boolean;
}

interface ServiceAddonsModalProps {
  mainName: string;
  addons: AddonOption[];
  initialChosen: string[];
  primaryColor: string;
  cardRadius: number;
  onConfirm: (chosenIds: string[]) => void;
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// Janela que aparece quando a cliente escolhe um serviço principal com adicionais.
// Fechar (X, fundo ou Esc) mantém o serviço principal e a escolha que estava antes.
export default function ServiceAddonsModal({
  mainName, addons, initialChosen, primaryColor, cardRadius, onConfirm,
}: ServiceAddonsModalProps) {
  const [chosen, setChosen] = useState<string[]>(initialChosen);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { confirmRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onConfirm(initialChosen); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [initialChosen, onConfirm]);

  const toggle = (id: string) => setChosen((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const extra = addons.filter((a) => chosen.includes(a.id)).reduce((sum, a) => sum + (a.preco ?? 0), 0);
  const showExtra = addons.some((a) => chosen.includes(a.id) && a.preco != null && (a.exibirPreco ?? true));
  const radius = Math.min(cardRadius, 28);
  const onPrimary = getBestTextColor(primaryColor);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="addons-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onConfirm(initialChosen); }}
    >
      <div className="absolute inset-0 bg-black/55 pointer-events-none" />
      <div
        className="relative w-full sm:max-w-md max-h-[88vh] flex flex-col bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-2xl rt-rise"
        style={{ borderTopLeftRadius: radius, borderTopRightRadius: radius, borderBottomLeftRadius: radius, borderBottomRightRadius: radius }}
      >
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className="p-2 rounded-full shrink-0" style={{ backgroundColor: `${primaryColor}1A`, color: primaryColor }}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="addons-title" className="text-base font-bold leading-snug" style={{ fontFamily: "var(--theme-heading-font)" }}>
              Quer incluir algum adicional?
            </h2>
            <p className="text-xs text-[var(--theme-muted-text)] mt-0.5">Para: <span className="font-semibold">{mainName}</span></p>
          </div>
          <button type="button" onClick={() => onConfirm(initialChosen)} aria-label="Fechar"
            className="p-1.5 rounded-lg text-[var(--theme-muted-text)] hover:opacity-70 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-2 overflow-y-auto space-y-2">
          {addons.map((a) => {
            const on = chosen.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(a.id)}
                className="w-full flex items-center gap-3 p-3 text-left border transition-all active:scale-[0.99]"
                style={{
                  borderRadius: Math.min(radius, 18),
                  borderColor: on ? primaryColor : "rgba(128,128,128,0.25)",
                  backgroundColor: on ? `${primaryColor}12` : "transparent",
                }}
              >
                <span className="h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors"
                  style={{ borderColor: on ? primaryColor : "rgba(128,128,128,0.45)", backgroundColor: on ? primaryColor : "transparent", color: onPrimary }}>
                  {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 text-[var(--theme-muted-text)]" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">{a.nome}</span>
                  {a.descricaoCurta && <span className="block text-xs text-[var(--theme-muted-text)] line-clamp-2">{a.descricaoCurta}</span>}
                  <span className="flex items-center gap-1 text-[11px] text-[var(--theme-muted-text)] mt-0.5">
                    <Clock className="h-3 w-3" />+{a.duracaoEstimada}
                  </span>
                </span>
                {a.preco != null && (a.exibirPreco ?? true) && (
                  <span className="text-sm font-bold shrink-0" style={{ color: primaryColor }}>+ {brl(a.preco)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-5 pt-3 pb-5 flex flex-col gap-2 border-t border-[rgba(128,128,128,0.15)] mt-2">
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onConfirm(chosen)}
            className="w-full py-3.5 px-4 font-semibold text-sm shadow-lg hover:brightness-110 active:scale-[0.98] transition-all"
            style={{ backgroundColor: primaryColor, color: onPrimary, borderRadius: 999, fontFamily: "var(--theme-body-font)" }}
          >
            {chosen.length === 0
              ? "Continuar sem adicionais"
              : `Incluir ${chosen.length} adicional${chosen.length > 1 ? "is" : ""}${showExtra ? ` (+ ${brl(extra)})` : ""}`}
          </button>
          {chosen.length > 0 && (
            <button type="button" onClick={() => onConfirm([])}
              className="w-full py-2 text-xs font-semibold text-[var(--theme-muted-text)] hover:opacity-70">
              Não quero adicionais
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
