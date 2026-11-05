"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { BookUser, ChevronDown, ChevronUp, MessageCircle, Pencil, Search, Trophy, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { formatPhoneFriendly, getWhatsAppLink } from "@/lib/whatsapp";
import { addDaysSaoPaulo, getSaoPauloToday } from "@/lib/timezone";
import { ACTIVE_WITHIN_DAYS, INACTIVE_AFTER_DAYS, getCustomerInsight, type CustomerInsight } from "@/lib/customerStats";

interface LeadRow {
  id: string;
  telefone: string;
  nome: string;
  servicoEscolhido: string;
  dataEscolhida: string;
  horarioEscolhido: string;
  status: string;
  valorTotal: number;
}

interface CustomerRow {
  id: string;
  nome: string;
  telefone: string;
  lastBookingDate?: string;
}

const formatDate = (d?: string) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
};

type Segment = "todos" | "novos" | "ativos" | "sem-retorno" | "marcados";
type SortBy = "recentes" | "nome" | "gasto" | "sem-visita";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_STYLE: Record<string, string> = {
  Atendido: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelado: "bg-red-500/10 text-red-400 border-red-500/20",
  Perdido: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  Agendado: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Novo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "Em contato": "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default function ClientesPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "ranking">("lista");
  const [rankBy, setRankBy] = useState<"valor" | "atendimentos">("valor");
  const [periodDays, setPeriodDays] = useState<0 | 30 | 90 | 365>(0);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [segment, setSegment] = useState<Segment>("todos");
  const [sortBy, setSortBy] = useState<SortBy>("recentes");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [custSnap, leadSnap, notesSnap] = await Promise.all([
          getDocs(collection(db, "professionals", user.uid, "customers")),
          getDocs(collection(db, "professionals", user.uid, "leads")),
          getDocs(collection(db, "professionals", user.uid, "customerNotes")).catch(() => null),
        ]);
        if (cancelled) return;

        const notesMap: Record<string, string> = {};
        notesSnap?.docs.forEach((d) => { notesMap[d.id] = String(d.data().notas ?? ""); });
        setNotes(notesMap);

        const leadRows: LeadRow[] = leadSnap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            telefone: String(x.telefone ?? "").replace(/\D/g, ""),
            nome: x.nome ?? "",
            servicoEscolhido: x.servicoEscolhido ?? "",
            dataEscolhida: x.dataEscolhida ?? "",
            horarioEscolhido: x.horarioEscolhido ?? "",
            status: x.status ?? "Novo",
            valorTotal: typeof x.valorTotal === "number" ? x.valorTotal : 0,
          };
        });

        // Clientes: cadastro automático + qualquer telefone que só exista nos leads (histórico antigo)
        const byPhone = new Map<string, CustomerRow>();
        custSnap.docs.forEach((d) => {
          const x = d.data();
          const phone = String(x.telefone ?? "").replace(/\D/g, "");
          if (!phone) return;
          const prev = byPhone.get(phone);
          if (!prev || (x.lastBookingDate ?? "") > (prev.lastBookingDate ?? "")) {
            byPhone.set(phone, { id: phone, nome: x.nome ?? "", telefone: phone, lastBookingDate: x.lastBookingDate });
          }
        });
        leadRows.forEach((l) => {
          if (!l.telefone) return;
          const prev = byPhone.get(l.telefone);
          if (!prev) {
            byPhone.set(l.telefone, { id: l.telefone, nome: l.nome, telefone: l.telefone, lastBookingDate: l.dataEscolhida });
          } else if (l.dataEscolhida > (prev.lastBookingDate ?? "")) {
            prev.lastBookingDate = l.dataEscolhida;
          }
        });

        const rows = [...byPhone.values()].sort((a, b) => (b.lastBookingDate ?? "").localeCompare(a.lastBookingDate ?? ""));
        setLeads(leadRows);
        setCustomers(rows);
      } catch (e) {
        console.error("Erro ao carregar clientes:", e);
        if (!cancelled) setError("Não foi possível carregar os clientes. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const leadsByPhone = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    leads.forEach((l) => {
      if (!l.telefone) return;
      const list = map.get(l.telefone) ?? [];
      list.push(l);
      map.set(l.telefone, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => `${b.dataEscolhida} ${b.horarioEscolhido}`.localeCompare(`${a.dataEscolhida} ${a.horarioEscolhido}`))
    );
    return map;
  }, [leads]);

  // Ranking: só atendimentos concluídos (status Atendido) dentro do período escolhido
  const ranking = useMemo(() => {
    const cutoff = periodDays > 0 ? addDaysSaoPaulo(getSaoPauloToday(), -periodDays) : "";
    const stats = new Map<string, { telefone: string; nome: string; valor: number; atendimentos: number; ultimo: string }>();
    leads.forEach((l) => {
      if (l.status !== "Atendido" || !l.telefone) return;
      if (cutoff && l.dataEscolhida < cutoff) return;
      const cur = stats.get(l.telefone) ?? { telefone: l.telefone, nome: l.nome, valor: 0, atendimentos: 0, ultimo: "" };
      cur.valor += l.valorTotal;
      cur.atendimentos += 1;
      if (l.dataEscolhida > cur.ultimo) { cur.ultimo = l.dataEscolhida; cur.nome = l.nome || cur.nome; }
      stats.set(l.telefone, cur);
    });
    const nameByPhone = new Map(customers.map((c) => [c.telefone, c.nome]));
    const rows = [...stats.values()].map((r) => ({ ...r, nome: nameByPhone.get(r.telefone) || r.nome }));
    rows.sort((a, b) =>
      rankBy === "valor"
        ? b.valor - a.valor || b.atendimentos - a.atendimentos
        : b.atendimentos - a.atendimentos || b.valor - a.valor
    );
    return rows.slice(0, 10);
  }, [leads, customers, rankBy, periodDays]);

  // Situação de cada cliente (novo no mês, ativo, sem retorno, com horário marcado)
  const insights = useMemo(() => {
    const today = getSaoPauloToday();
    const map = new Map<string, CustomerInsight>();
    customers.forEach((c) => map.set(c.telefone, getCustomerInsight(leadsByPhone.get(c.telefone) ?? [], today)));
    return map;
  }, [customers, leadsByPhone]);

  const counts = useMemo(() => {
    const all = [...insights.values()];
    return {
      todos: customers.length,
      novos: all.filter((i) => i.isNewThisMonth).length,
      ativos: all.filter((i) => i.isActive).length,
      "sem-retorno": all.filter((i) => i.isInactive).length,
      marcados: all.filter((i) => !!i.nextBooking).length,
    };
  }, [customers, insights]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const rows = customers.filter((c) => {
      const ins = insights.get(c.telefone);
      if (segment === "novos" && !ins?.isNewThisMonth) return false;
      if (segment === "ativos" && !ins?.isActive) return false;
      if (segment === "sem-retorno" && !ins?.isInactive) return false;
      if (segment === "marcados" && !ins?.nextBooking) return false;
      if (!term) return true;
      return c.nome.toLowerCase().includes(term) || (!!digits && c.telefone.includes(digits));
    });
    if (sortBy === "nome") return [...rows].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (sortBy === "gasto") return [...rows].sort((a, b) => (insights.get(b.telefone)?.spent ?? 0) - (insights.get(a.telefone)?.spent ?? 0));
    if (sortBy === "sem-visita") {
      return [...rows].sort((a, b) => (insights.get(b.telefone)?.daysSinceLastVisit ?? -1) - (insights.get(a.telefone)?.daysSinceLastVisit ?? -1));
    }
    return rows; // já vem do mais recente para o mais antigo
  }, [customers, search, segment, sortBy, insights]);

  const SEGMENTS: { key: Segment; label: string; hint: string }[] = [
    { key: "todos", label: "Cadastrados", hint: "todos os clientes" },
    { key: "novos", label: "Novos no mês", hint: "1º agendamento neste mês" },
    { key: "ativos", label: "Ativos", hint: `atendidos em ${ACTIVE_WITHIN_DAYS} dias ou com horário` },
    { key: "sem-retorno", label: "Sem retorno", hint: `+${INACTIVE_AFTER_DAYS} dias sem vir` },
    { key: "marcados", label: "Com horário", hint: "agendamento futuro" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <BookUser className="h-6 w-6 text-indigo-400" />
          Clientes
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {loading ? "Carregando..." : <><strong className="text-slate-200">{customers.length}</strong> cliente{customers.length !== 1 ? "s" : ""} cadastrado{customers.length !== 1 ? "s" : ""}.</>}{" "}
          Toque em um cliente para ver o histórico de agendamentos e o valor gasto.
        </p>
      </div>

      {/* Resumo da carteira: cada número também filtra a lista */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => { setSegment(s.key); setView("lista"); }}
              aria-pressed={segment === s.key}
              className={`text-left rounded-2xl border p-3 transition-all ${
                segment === s.key ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
              } ${s.key === "todos" ? "col-span-2 sm:col-span-1" : ""}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</div>
              <div className="text-2xl font-extrabold text-slate-100 mt-0.5">{counts[s.key]}</div>
              <div className="text-[10px] text-slate-500 leading-tight">{s.hint}</div>
            </button>
          ))}
        </div>
      )}

      <div className="inline-flex rounded-xl border border-slate-800 p-1 bg-slate-900/50">
        {(["lista", "ranking"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${view === v ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            {v === "lista" ? "Lista" : "Ranking"}
          </button>
        ))}
      </div>

      {view === "ranking" && !loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select value={rankBy} onChange={(e) => setRankBy(e.target.value as "valor" | "atendimentos")} className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-200">
              <option value="valor">Quem mais gastou</option>
              <option value="atendimentos">Quem mais contratou</option>
            </select>
            <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value) as 0 | 30 | 90 | 365)} className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-200">
              <option value={0}>Todo o período</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={365}>Últimos 12 meses</option>
            </select>
          </div>

          {ranking.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-400">
              Ainda não há atendimentos concluídos neste período. O ranking considera agendamentos com status Atendido.
            </div>
          ) : (
            <ol className="overflow-hidden rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
              {ranking.map((r, i) => {
                const top = ranking[0];
                const ratio = rankBy === "valor" ? (top.valor ? r.valor / top.valor : 0) : (top.atendimentos ? r.atendimentos / top.atendimentos : 0);
                const medal = ["text-amber-400", "text-slate-300", "text-orange-400"][i];
                return (
                  <li key={r.telefone} className="p-4 bg-slate-900/30">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 text-center font-extrabold ${medal ?? "text-slate-500"}`}>
                          {i < 3 ? <Trophy className="h-5 w-5 mx-auto" /> : i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{i + 1}. {r.nome || "Sem nome"}</div>
                          <div className="text-xs text-slate-500">
                            {r.atendimentos} atendimento(s) · último em {formatDate(r.ultimo)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-100">{brl(r.valor)}</div>
                        <a href={getWhatsAppLink(r.telefone, `Olá ${(r.nome || "").split(" ")[0]}!`)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">WhatsApp</a>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(4, Math.round(ratio * 100))}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {view === "lista" && (<>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          aria-label="Ordenar clientes"
          className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2.5 text-sm text-slate-200"
        >
          <option value="recentes">Agendamento mais recente</option>
          <option value="nome">Nome (A–Z)</option>
          <option value="gasto">Quem mais gastou</option>
          <option value="sem-visita">Há mais tempo sem vir</option>
        </select>
      </div>
      {segment !== "todos" && (
        <p className="text-xs text-slate-400">
          Mostrando {filtered.length} de {customers.length}: <strong className="text-slate-200">{SEGMENTS.find((s) => s.key === segment)?.label}</strong>.{" "}
          <button type="button" onClick={() => setSegment("todos")} className="text-indigo-400 underline">Ver todos</button>
        </p>
      )}

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando clientes...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-400">
          {customers.length === 0 ? "Nenhum cliente ainda. Eles aparecem aqui após o primeiro agendamento." : "Nenhum cliente encontrado com esse filtro ou busca."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
          {filtered.map((c) => {
            const history = leadsByPhone.get(c.telefone) ?? [];
            const done = history.filter((l) => l.status === "Atendido");
            const canceled = history.filter((l) => l.status === "Cancelado" || l.status === "Perdido");
            const spent = done.reduce((sum, l) => sum + l.valorTotal, 0);
            const isOpen = openId === c.id;
            const ins = insights.get(c.telefone);
            const firstName = c.nome.split(" ")[0];
            // Para quem sumiu, a mensagem já convida a voltar
            const waMessage = ins?.isInactive
              ? `Olá ${firstName}! Sentimos sua falta por aqui. Que tal agendar um horário?`
              : `Olá ${firstName}!`;

            const servicesDone = new Map<string, number>();
            done.forEach((l) => {
              if (!l.servicoEscolhido) return;
              servicesDone.set(l.servicoEscolhido, (servicesDone.get(l.servicoEscolhido) ?? 0) + 1);
            });

            return (
              <div key={c.id} className="bg-slate-900/30">
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : c.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="font-semibold text-slate-200 truncate">{c.nome || "Sem nome"}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{formatPhoneFriendly(c.telefone)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {history.length} agendamento(s) · {done.length} concluído(s) · {canceled.length} cancelado(s) · Gasto: {brl(spent)}
                    </div>
                    {ins && (ins.isNewThisMonth || ins.nextBooking || ins.isInactive) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {ins.isNewThisMonth && (
                          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">Novo</span>
                        )}
                        {ins.nextBooking && (
                          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-500">Próximo: {formatDate(ins.nextBooking)}</span>
                        )}
                        {ins.isInactive && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">Sem retorno há {ins.daysSinceLastVisit} dias</span>
                        )}
                      </div>
                    )}
                  </button>
                  <a
                    href={getWhatsAppLink(c.telefone, waMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                  <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)} className="shrink-0 text-slate-400" aria-label="Ver histórico">
                    {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-4">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
                    >
                      <Pencil className="h-4 w-4" /> Editar cadastro
                    </button>
                    <NotasEditor
                      profId={user!.uid}
                      phone={c.telefone}
                      initial={notes[c.telefone] ?? ""}
                      onSaved={(v) => setNotes((prev) => ({ ...prev, [c.telefone]: v }))}
                    />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
                        <div className="text-lg font-bold text-emerald-400">{done.length}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Concluídos</div>
                      </div>
                      <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
                        <div className="text-lg font-bold text-red-400">{canceled.length}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Cancelados</div>
                      </div>
                      <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
                        <div className="text-lg font-bold text-slate-100">{brl(spent)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Valor gasto</div>
                      </div>
                    </div>

                    {servicesDone.size > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Serviços já realizados</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[...servicesDone.entries()].map(([name, count]) => (
                            <span key={name} className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                              {name}{count > 1 ? ` ×${count}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Histórico de agendamentos</div>
                      {history.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhum agendamento encontrado.</p>
                      ) : (
                        <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800">
                          {history.map((l) => (
                            <div key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                              <div className="min-w-0">
                                <div className="text-slate-200 truncate">{l.servicoEscolhido || "Serviço"}</div>
                                <div className="text-xs text-slate-500">{formatDate(l.dataEscolhida)} às {l.horarioEscolhido}{l.valorTotal > 0 ? ` · ${brl(l.valorTotal)}` : ""}</div>
                              </div>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[l.status] ?? STATUS_STYLE.Novo}`}>
                                {l.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {editing && (
        <CustomerEditModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={(nome, telefone) => {
            const old = editing.telefone;
            setCustomers((prev) => prev.map((c) => (c.telefone === old ? { ...c, id: telefone, nome, telefone } : c)));
            setLeads((prev) => prev.map((l) => (l.telefone === old ? { ...l, nome, telefone } : l)));
            if (telefone !== old) {
              setNotes((prev) => {
                if (!(old in prev) || telefone in prev) return prev;
                const next = { ...prev, [telefone]: prev[old] };
                delete next[old];
                return next;
              });
              setOpenId(telefone);
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// Alteração do nome e do telefone do cliente. Vale também para os agendamentos dele.
function CustomerEditModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerRow;
  onClose: () => void;
  onSaved: (nome: string, telefone: string) => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState(customer.nome);
  const [telefone, setTelefone] = useState(formatPhoneFriendly(customer.telefone));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/professionals/${user.uid}/customers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ telefoneAtual: customer.telefone, nome, telefone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar o cadastro.");
      onSaved(data.nome, data.telefone);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form onSubmit={save} className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-slate-800 bg-slate-900 p-5 pb-8 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-100">Editar cadastro</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={80}
            className="w-full rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">Telefone (WhatsApp)</label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="tel"
            className="w-full rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>
        <p className="text-[11px] text-slate-500">O nome e o telefone também são atualizados nos agendamentos deste cliente.</p>
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-200 text-xs font-bold">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

const NOTAS_MAX = 2000;

// Notas privadas do profissional sobre o cliente (alergias, preferências etc.), com botão Salvar próprio.
function NotasEditor({ profId, phone, initial, onSaved }: { profId: string; phone: string; initial: string; onSaved: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = value !== initial;

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await setDoc(doc(db, "professionals", profId, "customerNotes", phone), { notas: value.trim(), updatedAt: new Date() });
      onSaved(value.trim());
      setValue(value.trim());
      setMsg({ ok: true, text: "Notas salvas." });
    } catch (e) {
      console.error("Erro ao salvar notas:", e);
      setMsg({ ok: false, text: "Não foi possível salvar as notas." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">Notas do cliente</label>
      <textarea
        value={value}
        onChange={(e) => { setValue(e.target.value); setMsg(null); }}
        maxLength={NOTAS_MAX}
        rows={3}
        placeholder="Particularidades: alergias, preferências, observações..."
        className="w-full rounded-xl bg-slate-950/50 border border-slate-800 p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className={`text-xs ${msg ? (msg.ok ? "text-emerald-400" : "text-red-400") : "text-slate-500"}`}>
          {msg ? msg.text : `${value.length}/${NOTAS_MAX}`}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white"
        >
          {saving ? "Salvando..." : "Salvar notas"}
        </button>
      </div>
    </div>
  );
}
