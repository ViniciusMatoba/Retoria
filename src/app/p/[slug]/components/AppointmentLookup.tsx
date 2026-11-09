"use client";

import React, { useState } from "react";
import { CalendarSearch, Clock, Loader2, X } from "lucide-react";
import { maskPhone } from "@/lib/whatsapp";
import type { PublicAppointment } from "@/lib/customerAppointments";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const formatDay = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
  return `${weekday}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};

interface Props {
  slug: string;
  primaryColor: string;
  primaryTextColor: string;
  btnRadiusClass: string;
  cardRadius: number;
}

// Botão "Consultar meus agendamentos" da página pública: busca pelo WhatsApp e mostra os próximos e os anteriores.
export default function AppointmentLookup({ slug, primaryColor, primaryTextColor, btnRadiusClass, cardRadius }: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ upcoming: PublicAppointment[]; past: PublicAppointment[] } | null>(null);

  const close = () => {
    setOpen(false);
    setPhone("");
    setResult(null);
    setError("");
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/p/${encodeURIComponent(slug)}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: phone }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível consultar agora.");
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const section = (title: string, items: PublicAppointment[], empty: string) => (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-muted-text)] mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--theme-muted-text)]">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a, i) => (
            <li key={`${a.data}-${a.horario}-${i}`} className="rounded-xl border border-[rgba(128,128,128,0.25)] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[var(--theme-text)]">{formatDay(a.data)}</span>
                <span className="shrink-0 text-[11px] font-semibold text-[var(--theme-muted-text)]">{a.situacao}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--theme-text)]">
                {a.horario && (
                  <span className="inline-flex shrink-0 items-center gap-1 font-semibold">
                    <Clock className="h-3 w-3" />
                    {a.horario}
                  </span>
                )}
                <span className="truncate opacity-80">{a.servico}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ backgroundColor: "var(--theme-surface)", color: "var(--theme-text)" }}
        className={`w-full py-3 px-4 border border-[rgba(128,128,128,0.3)] text-sm font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all ${btnRadiusClass}`}
      >
        <CalendarSearch className="h-4 w-4" style={{ color: primaryColor }} />
        Consultar meus agendamentos
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Consultar meus agendamentos">
          <button type="button" aria-label="Fechar" onClick={close} className="absolute inset-0 bg-black/50" />
          <div
            style={{ borderRadius: `${cardRadius}px`, backgroundColor: "var(--theme-surface)" }}
            className="relative w-full max-w-md max-h-[85vh] overflow-y-auto p-5 shadow-2xl"
          >
            <button type="button" aria-label="Fechar" onClick={close} className="absolute right-3 top-3 p-1.5 text-[var(--theme-muted-text)]">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold text-[var(--theme-text)] pr-8" style={{ fontFamily: "var(--theme-heading-font)" }}>
              Meus agendamentos
            </h2>
            <p className="text-xs text-[var(--theme-muted-text)] mt-1">Digite o WhatsApp usado no agendamento.</p>

            <form onSubmit={search} className="mt-4 space-y-3">
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                maxLength={20}
                value={phone}
                onChange={(e) => { setPhone(maskPhone(e.target.value)); setResult(null); setError(""); }}
                placeholder="(11) 99999-9999"
                aria-label="WhatsApp"
                className="block w-full h-11 px-3 rounded-xl bg-transparent border border-[rgba(128,128,128,0.45)] text-base text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-primary)]"
              />
              <button
                type="submit"
                disabled={loading || phone.replace(/\D/g, "").length < 10}
                style={{ backgroundColor: primaryColor, color: primaryTextColor, fontFamily: "var(--theme-body-font)" }}
                className={`w-full py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${btnRadiusClass}`}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Consultando..." : "Consultar"}
              </button>
            </form>

            {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}

            {result && (
              <div className="mt-5 space-y-5">
                {section("Próximos", result.upcoming, "Nenhum agendamento futuro encontrado.")}
                {section("Já realizados", result.past, "Nenhum agendamento anterior encontrado.")}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
