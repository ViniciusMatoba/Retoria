"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Gift, Loader2, Pencil, Plus, Search, Trash2, Undo2, X } from "lucide-react";
import { useAuth } from "../../providers";
import { useAppModal } from "@/components/ModalProvider";
import { getSaoPauloToday } from "@/lib/timezone";
import { formatPhoneFriendly } from "@/lib/whatsapp";
import { invalidateGiftBadges } from "@/hooks/useGiftBadges";
import {
  defaultGiftDay, giftDayRows, giftDays, summarizeGifts,
  type GiftAppointment, type GiftCampaign, type GiftClient,
} from "@/lib/gifts";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const weekday = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};
const deliveredOn = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

// Sugestão do primeiro brinde: o mês seguinte inteiro (em novembro, "Brinde de dezembro").
const suggestion = (today: string) => {
  const [y, m] = today.split("-").map(Number);
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { nome: `Brinde de ${MONTHS[month - 1]}`, inicio: `${year}-${mm}-01`, fim: `${year}-${mm}-${String(last).padStart(2, "0")}` };
};

type CampaignForm = { id?: string; nome: string; inicio: string; fim: string };
type Detail = { campaign: GiftCampaign; clients: GiftClient[] };

// Brindes: um brinde por cliente dentro de um período. Mostra quem é atendida em cada dia
// e quem já recebeu, para não entregar duas vezes a quem vem mais de uma vez.
export default function BrindesPage() {
  const { user } = useAuth();
  const { showConfirmationModal } = useAppModal();
  const today = getSaoPauloToday();
  const [campaigns, setCampaigns] = useState<GiftCampaign[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"dia" | "todas">("dia");
  const [day, setDay] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [form, setForm] = useState<CampaignForm | null>(null);
  const [formError, setFormError] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    if (!user) throw new Error("Sessão expirada.");
    const token = await user.getIdToken();
    const res = await fetch(`/api/professionals/${user.uid}/gifts${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    // Qualquer alteração aqui muda os selos de brinde de Horários, Leads e Lembretes
    if (init?.method && init.method !== "GET") invalidateGiftBadges();
    if (!res.ok) throw Object.assign(new Error(data.error || "Não foi possível concluir. Tente novamente."), { status: res.status, data });
    return data;
  }, [user]);

  // Recarregar = mudar a chave; os efeitos abaixo buscam de novo
  const [campaignsKey, setCampaignsKey] = useState(0);
  const [detailKey, setDetailKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api("");
        if (cancelled) return;
        const list: GiftCampaign[] = data.campaigns;
        setCampaigns(list);
        // Abre a campanha em andamento; senão a próxima; senão a mais recente
        setSelectedId((cur) =>
          cur && list.some((c) => c.id === cur)
            ? cur
            : (list.find((c) => c.inicio <= today && c.fim >= today) ?? [...list].reverse().find((c) => c.inicio > today) ?? list[0])?.id ?? null
        );
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [user, api, campaignsKey, today]);

  useEffect(() => {
    if (!user || !selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/${selectedId}`);
        if (cancelled) return;
        setDetail({ campaign: data.campaign, clients: data.clients });
        setDay((cur) => {
          const days = giftDays(data.clients);
          return cur && days.some((d) => d.date === cur) ? cur : defaultGiftDay(days, today);
        });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [user, api, selectedId, detailKey, today]);

  const current = detail && detail.campaign.id === selectedId ? detail : null;
  const clients = useMemo(() => current?.clients ?? [], [current]);
  const summary = useMemo(() => summarizeGifts(clients), [clients]);
  const days = useMemo(() => giftDays(clients), [clients]);
  const dayRows = useMemo(() => (day ? giftDayRows(clients, day) : []), [clients, day]);
  const dayIndex = days.findIndex((d) => d.date === day);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return clients.filter((c) =>
      (!onlyPending || !c.delivery) &&
      (!q || c.nome.toLowerCase().includes(q) || (digits.length >= 3 && c.telefone.includes(digits)))
    );
  }, [clients, search, onlyPending]);

  const setDelivery = (key: string, delivery: GiftClient["delivery"]) =>
    setDetail((d) => (d ? { ...d, clients: d.clients.map((c) => (c.key === key ? { ...c, delivery } : c)) } : d));

  const deliver = async (client: GiftClient, appt: GiftAppointment) => {
    if (!selectedId) return;
    setBusyKey(client.key);
    setError("");
    try {
      const data = await api(`/${selectedId}/deliveries`, { method: "POST", body: JSON.stringify({ leadId: appt.leadId, pid: appt.pid }) });
      setDelivery(client.key, { key: client.key, nome: client.nome, leadId: appt.leadId, data: data.delivery.data, entregueEm: data.delivery.entregueEm });
    } catch (e) {
      const err = e as Error & { status?: number; data?: { delivery?: { entregueEm: number; data: string | null } | null } };
      // Já recebeu (marcado em outro aparelho ou por outro agendamento): mostra a entrega existente
      if (err.status === 409 && err.data?.delivery) {
        setDelivery(client.key, { key: client.key, nome: client.nome, leadId: null, data: err.data.delivery.data, entregueEm: err.data.delivery.entregueEm });
      }
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  };

  const undo = (client: GiftClient) => {
    if (!selectedId) return;
    showConfirmationModal({
      title: "Desfazer entrega",
      description: `Marcar que ${client.nome || "a cliente"} ainda não recebeu o brinde?`,
      confirmLabel: "Desfazer",
      cancelLabel: "Voltar",
      variant: "danger",
      onConfirm: async () => {
        setBusyKey(client.key);
        setError("");
        try {
          await api(`/${selectedId}/deliveries`, { method: "DELETE", body: JSON.stringify({ key: client.key }) });
          setDelivery(client.key, null);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusyKey(null);
        }
      },
    });
  };

  const saveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError("");
    try {
      const body = JSON.stringify({ nome: form.nome, inicio: form.inicio, fim: form.fim });
      if (form.id) {
        await api(`/${form.id}`, { method: "PATCH", body });
        setDetailKey((k) => k + 1);
      } else {
        const data = await api("", { method: "POST", body });
        setSelectedId(data.id);
      }
      setForm(null);
      setCampaignsKey((k) => k + 1);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeCampaign = (c: GiftCampaign) =>
    showConfirmationModal({
      title: "Excluir brinde",
      description: `Excluir "${c.nome}" e o registro de quem já recebeu? Os agendamentos não são alterados.`,
      confirmLabel: "Excluir",
      cancelLabel: "Voltar",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api(`/${c.id}`, { method: "DELETE" });
          setForm(null);
          setDetail(null);
          setSelectedId(null);
          setCampaignsKey((k) => k + 1);
        } catch (e) {
          setError((e as Error).message);
        }
      },
    });

  // Situação do brinde de uma cliente + ação. `appt` é o agendamento usado para registrar a entrega.
  const giftAction = (client: GiftClient, appt: GiftAppointment | null) => {
    const busy = busyKey === client.key;
    if (client.delivery) {
      return (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
            <Check className="h-3.5 w-3.5" /> Recebeu em {deliveredOn(client.delivery.entregueEm)}
          </span>
          <button type="button" onClick={() => undo(client)} disabled={busy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-300 disabled:opacity-50">
            <Undo2 className="h-3 w-3" /> Desfazer
          </button>
        </div>
      );
    }
    if (!appt) return <span className="shrink-0 text-xs text-slate-500">Sem agendamento ativo</span>;
    if (appt.data > today) return <span className="shrink-0 rounded-full border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-400">Vem dia {ddmm(appt.data)}</span>;
    return (
      <button
        type="button"
        onClick={() => deliver(client, appt)}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        Entregar brinde
      </button>
    );
  };

  const selected = campaigns?.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Gift className="h-6 w-6 text-indigo-400" />
            Brindes
          </h1>
          <p className="text-sm text-slate-400 mt-1">Um brinde por cliente no período. Quem vem mais de uma vez aparece como já entregue.</p>
        </div>
        {campaigns && campaigns.length > 0 && (
          <button type="button" onClick={() => { setFormError(""); setForm({ ...suggestion(today), nome: "" }); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            <Plus className="h-4 w-4" /> Novo brinde
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <span>{error}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {campaigns === null ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-3">
          <Gift className="mx-auto h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-300">Crie o primeiro brinde: escolha o nome e o período. As clientes com agendamento nesse período entram na lista sozinhas.</p>
          <button type="button" onClick={() => { setFormError(""); setForm(suggestion(today)); }} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500">
            <Plus className="h-4 w-4" /> Criar {suggestion(today).nome}
          </button>
        </div>
      ) : (
        <>
          {/* Campanhas */}
          <div className="flex flex-wrap items-center gap-2">
            {campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSelectedId(c.id); setDay(null); setSearch(""); }}
                aria-pressed={c.id === selectedId}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${c.id === selectedId ? "border-indigo-500 bg-indigo-600/20 text-white" : "border-slate-800 text-slate-400 hover:border-slate-700"}`}
              >
                {c.nome}
                <span className="block text-[11px] font-normal text-slate-400">{ddmm(c.inicio)} a {ddmm(c.fim)}</span>
              </button>
            ))}
            {selected && (
              <button type="button" onClick={() => { setFormError(""); setForm({ id: selected.id, nome: selected.nome, inicio: selected.inicio, fim: selected.fim }); }} aria-label="Editar brinde" className="rounded-xl border border-slate-800 p-2.5 text-slate-400 hover:bg-slate-800">
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          {!current ? (
            <p className="text-sm text-slate-400">Carregando clientes...</p>
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Clientes no período", value: summary.total, tone: "text-slate-100" },
                  { label: "Já receberam", value: summary.delivered, tone: "text-emerald-400" },
                  { label: "Faltam", value: summary.pending, tone: "text-amber-400" },
                ].map((t) => (
                  <div key={t.label} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
                    <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 leading-tight">{t.label}</div>
                    <div className={`mt-1 text-2xl font-black ${t.tone}`}>{t.value}</div>
                  </div>
                ))}
              </div>

              {/* Abas */}
              <div className="flex gap-1 rounded-xl border border-slate-800 p-1 text-sm font-semibold">
                {([["dia", "Por dia"], ["todas", "Todas as clientes"]] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className={`flex-1 rounded-lg py-2 ${tab === k ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === "dia" ? (
                days.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
                    Nenhum agendamento entre {ddmm(current.campaign.inicio)} e {ddmm(current.campaign.fim)} ainda. Eles aparecem aqui conforme forem marcados.
                  </div>
                ) : (
                  <section className="space-y-3">
                    {/* Dia: setas e dias com atendimento */}
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label="Dia anterior" disabled={dayIndex <= 0} onClick={() => setDay(days[dayIndex - 1].date)} className="rounded-xl border border-slate-800 p-2 text-slate-300 disabled:opacity-30">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="flex-1 text-center">
                        <div className="text-base font-black text-slate-100">
                          {day === today ? "Hoje" : day ? weekday(day) : ""}{day ? ` · ${ddmm(day)}` : ""}
                        </div>
                        <div className="text-xs text-slate-400">
                          {dayRows.length} atendimento(s) · {dayRows.filter((r) => !r.client.delivery).length} brinde(s) a entregar
                        </div>
                      </div>
                      <button type="button" aria-label="Próximo dia" disabled={dayIndex < 0 || dayIndex >= days.length - 1} onClick={() => setDay(days[dayIndex + 1].date)} className="rounded-xl border border-slate-800 p-2 text-slate-300 disabled:opacity-30">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {days.map((d) => (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => setDay(d.date)}
                          aria-pressed={d.date === day}
                          className={`shrink-0 rounded-xl border px-3 py-1.5 text-center text-xs font-semibold ${d.date === day ? "border-indigo-500 bg-indigo-600/20 text-white" : "border-slate-800 text-slate-400"}`}
                        >
                          <span className="block">{d.date === today ? "hoje" : weekday(d.date)} {ddmm(d.date)}</span>
                          <span className={`block text-[10px] font-normal ${d.pending > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                            {d.pending > 0 ? `${d.pending} a entregar` : "todos entregues"}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
                      {dayRows.map((r) => (
                        <div key={r.appointment.leadId} className="flex items-center justify-between gap-3 bg-slate-900/30 p-4">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-200">{r.appointment.horario} · {r.client.nome || "Sem nome"}</div>
                            <div className="truncate text-xs text-slate-500">{r.appointment.servico}</div>
                            {r.visits > 1 && (
                              <div className="mt-0.5 text-[11px] font-semibold text-sky-400">
                                {r.visit}ª de {r.visits} vindas no período ({r.client.appointments.map((a) => ddmm(a.data)).join(", ")})
                              </div>
                            )}
                          </div>
                          {giftAction(r.client, r.appointment)}
                        </div>
                      ))}
                    </div>
                  </section>
                )
              ) : (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nome ou telefone"
                        aria-label="Buscar cliente"
                        className="h-10 w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                      />
                    </label>
                    <button type="button" onClick={() => setOnlyPending((v) => !v)} aria-pressed={onlyPending} className={`h-10 rounded-xl border px-3 text-xs font-semibold ${onlyPending ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-slate-800 text-slate-400"}`}>
                      Só quem falta
                    </button>
                  </div>
                  {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">Nenhuma cliente encontrada.</div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
                      {filtered.map((c) => {
                        // Para registrar: a vinda mais recente que já aconteceu; se ainda não veio, a próxima
                        const came = [...c.appointments].reverse().find((a) => a.data <= today);
                        const appt = came ?? c.appointments[0] ?? null;
                        return (
                          <div key={c.key} className="flex items-center justify-between gap-3 bg-slate-900/30 p-4">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-200">{c.nome || "Sem nome"}</div>
                              <div className="truncate text-xs text-slate-500">
                                {c.telefone ? formatPhoneFriendly(c.telefone) : "Sem telefone"}
                                {c.appointments.length > 0 && ` · ${c.appointments.map((a) => ddmm(a.data)).join(", ")}`}
                              </div>
                            </div>
                            {giftAction(c, appt)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={form.id ? "Editar brinde" : "Novo brinde"}>
          <button type="button" aria-label="Fechar" onClick={() => setForm(null)} className="absolute inset-0 bg-black/50" />
          <form onSubmit={saveCampaign} className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-100 flex items-center gap-2"><Gift className="h-4 w-4 text-indigo-400" />{form.id ? "Editar brinde" : "Novo brinde"}</h2>
              <button type="button" aria-label="Fechar" onClick={() => setForm(null)} className="p-1.5 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-400">Nome</span>
              <input required maxLength={60} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Brinde de dezembro" className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus:border-indigo-500 focus:outline-none" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0 space-y-1">
                <span className="text-xs font-semibold text-slate-400">Primeiro dia</span>
                <input type="date" required value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} className="h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none" />
              </label>
              <label className="block min-w-0 space-y-1">
                <span className="text-xs font-semibold text-slate-400">Último dia</span>
                <input type="date" required value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} className="h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none" />
              </label>
            </div>
            <p className="text-xs text-slate-500">Entram as clientes com agendamento nesse período, marcado por você ou pela página pública. Cancelados e faltas não contam.</p>
            {formError && <p className="text-xs font-semibold text-red-400">{formError}</p>}
            <div className="flex items-center justify-between gap-2">
              {form.id && selected ? (
                <button type="button" onClick={() => removeCampaign(selected)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" /> Excluir
                </button>
              ) : <span />}
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
