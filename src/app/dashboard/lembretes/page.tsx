"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { BellRing, Check, MessageCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { formatPhoneFriendly, getWhatsAppLink } from "@/lib/whatsapp";
import { addDaysSaoPaulo, getSaoPauloToday } from "@/lib/timezone";
import GiftBadge from "../components/GiftBadge";

interface ReminderLead {
  id: string;
  nome: string;
  telefone: string;
  servicoEscolhido: string;
  dataEscolhida: string;
  horarioEscolhido: string;
  lembreteEnviadoAt?: number | null;
}

const DEFAULT_REMINDER =
  "Olá {nome}! Passando para lembrar do seu agendamento de {servico} em {data} às {horario}. Posso confirmar sua presença? 😊";

const formatDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function LembretesPage() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState<ReminderLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = getSaoPauloToday();
  const tomorrow = addDaysSaoPaulo(today, 1);
  const limit = addDaysSaoPaulo(today, 2);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "professionals", user.uid, "leads"),
            where("dataEscolhida", ">=", today),
            where("dataEscolhida", "<=", limit)
          )
        );
        if (cancelled) return;
        const rows: ReminderLead[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((l) => l.status === "Agendado")
          .map((l) => ({
            id: l.id,
            nome: l.nome ?? "",
            telefone: l.telefone ?? "",
            servicoEscolhido: l.servicoEscolhido ?? "",
            dataEscolhida: l.dataEscolhida,
            horarioEscolhido: l.horarioInicio ?? l.horarioEscolhido ?? "",
            lembreteEnviadoAt: l.lembreteEnviadoAt ?? null,
          }));
        rows.sort((a, b) => `${a.dataEscolhida} ${a.horarioEscolhido}`.localeCompare(`${b.dataEscolhida} ${b.horarioEscolhido}`));
        setLeads(rows);
      } catch (e) {
        console.error("Erro ao carregar lembretes:", e);
        if (!cancelled) setError("Não foi possível carregar os agendamentos. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, today, limit]);

  const template = profile?.messageTemplates?.["Lembrete"] || DEFAULT_REMINDER;
  const isPresencial = profile?.serviceLocationType === "physical" || profile?.serviceLocationType === "both";
  const address =
    isPresencial && profile?.publicAddress?.street
      ? [
          profile.publicAddress.street + (profile.publicAddress.number ? ", " + profile.publicAddress.number : ""),
          profile.publicAddress.city,
          profile.publicAddress.state,
        ].filter(Boolean).join(" - ")
      : undefined;

  const buildMessage = (l: ReminderLead) =>
    template
      .replace(/{nome}/g, l.nome.split(" ")[0] || l.nome)
      .replace(/{servico}/g, l.servicoEscolhido)
      .replace(/{data}/g, formatDate(l.dataEscolhida))
      .replace(/{horario}/g, l.horarioEscolhido)
      .replace(/{profissional}/g, profile?.nomeNegocio || profile?.nome || "")
      .replace(address ? /{endereco}/g : /,?\s*{endereco}/g, address ?? "")
      .trim();

  const handleSend = async (l: ReminderLead) => {
    window.open(getWhatsAppLink(l.telefone, buildMessage(l)), "_blank", "noopener,noreferrer");
    if (!user) return;
    const sentAt = Date.now();
    try {
      await updateDoc(doc(db, "professionals", user.uid, "leads", l.id), { lembreteEnviadoAt: sentAt });
      setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, lembreteEnviadoAt: sentAt } : x)));
    } catch (e) {
      console.error("Erro ao marcar lembrete:", e);
    }
  };

  const groups = useMemo(
    () => [
      { label: "Hoje", date: today },
      { label: "Amanhã", date: tomorrow },
      { label: "Depois de amanhã", date: limit },
    ].map((g) => ({ ...g, items: leads.filter((l) => l.dataEscolhida === g.date) })),
    [leads, today, tomorrow, limit]
  );

  const pending = leads.filter((l) => !l.lembreteEnviadoAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <BellRing className="h-6 w-6 text-indigo-400" />
          Lembretes
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Agendamentos confirmados dos próximos dias. Envie o lembrete pelo WhatsApp com um toque.
          {!loading && leads.length > 0 && ` ${pending} pendente(s).`}
        </p>
        <p className="text-xs text-slate-500 mt-1">A mensagem pode ser editada em Editar Perfil → Mensagens → Lembrete.</p>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-400">
          Nenhum agendamento confirmado para hoje, amanhã ou depois de amanhã.
        </div>
      ) : (
        groups.map((g) =>
          g.items.length === 0 ? null : (
            <section key={g.date} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{g.label} · {formatDate(g.date)}</h2>
              <div className="overflow-hidden rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
                {g.items.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 p-4 bg-slate-900/30">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 truncate">{l.horarioEscolhido} · {l.nome}</div>
                      <div className="text-xs text-slate-500 truncate">{l.servicoEscolhido} · {formatPhoneFriendly(l.telefone)}</div>
                      {user && <GiftBadge className="mt-1" lead={{ id: l.id, pid: user.uid, nome: l.nome, telefone: l.telefone, dataEscolhida: l.dataEscolhida, status: "Agendado" }} />}
                      {l.lembreteEnviadoAt && (
                        <div className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                          <Check className="h-3 w-3" /> Lembrete enviado em {new Date(l.lembreteEnviadoAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSend(l)}
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${l.lembreteEnviadoAt ? "border border-slate-700 text-slate-300 hover:bg-slate-800" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {l.lembreteEnviadoAt ? "Enviar de novo" : "Enviar lembrete"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        )
      )}
    </div>
  );
}
