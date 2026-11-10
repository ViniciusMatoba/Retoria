"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight,
  DollarSign, Receipt, Table2, UserPlus, Users, XCircle, BarChart3, Wallet,
} from "lucide-react";
import Link from "next/link";
import { profitOf, summarizeCosts, type CostSummary, type Expense } from "@/lib/costs";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { getSaoPauloToday } from "@/lib/timezone";
import { formatPhoneFriendly } from "@/lib/whatsapp";
import { getPeriod, summarizeRevenue, type Breakdown, type PeriodKind, type RevenueLead, type RevenueSummary } from "@/lib/revenue";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl(v).replace(",00", "");
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

// Teto "redondo" do eixo (1, 2 ou 5 × 10^n), para as linhas de grade caírem em valores legíveis
const niceCeil = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

const PERIODS: { kind: PeriodKind; label: string }[] = [
  { kind: "dia", label: "Dia" },
  { kind: "semana", label: "Semana" },
  { kind: "mes", label: "Mês" },
  { kind: "ano", label: "Ano" },
];

// Faturamento: painel com o realizado, o previsto e de onde vem o dinheiro (serviços, dias, turnos, origem, clientes).
export default function FaturamentoPage() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState<RevenueLead[] | null>(null);
  const [hasTeam, setHasTeam] = useState(false);
  const [kind, setKind] = useState<PeriodKind>("mes");
  const [offset, setOffset] = useState(0);
  const today = getSaoPauloToday();

  // Agendamentos do estabelecimento e da equipe (mesma origem dos números da tela de Leads)
  useEffect(() => {
    if (!user) return;
    let unsubs: (() => void)[] = [];
    let cancelled = false;
    (async () => {
      let ids = [user.uid];
      try {
        const snap = await getDocs(query(
          collection(db, "professionals"),
          where("parentProfessionalId", "==", user.uid),
          where("role", "==", "team_member"),
          where("professionalStatus", "==", "active"),
        ));
        ids = [user.uid, ...snap.docs.map((d) => d.id)];
      } catch {
        // sem equipe
      }
      if (cancelled) return;
      setHasTeam(ids.length > 1);
      const byProf = new Map<string, RevenueLead[]>();
      unsubs = ids.map((pid) =>
        onSnapshot(
          collection(db, "professionals", pid, "leads"),
          (snap) => {
            byProf.set(pid, snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RevenueLead));
            setLeads([...byProf.values()].flat());
          },
          (err) => {
            console.error("Erro ao carregar agendamentos:", err);
            setLeads((prev) => prev ?? []);
          }
        )
      );
    })();
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [user]);

  const period = useMemo(() => getPeriod(kind, offset, today), [kind, offset, today]);
  const summary = useMemo(() => (leads ? summarizeRevenue(leads, period, today) : null), [leads, period, today]);
  const todaySummary = useMemo(() => (leads ? summarizeRevenue(leads, getPeriod("dia", 0, today), today) : null), [leads, today]);

  // Custos do período (tela Custos e Materiais) para o lucro. undefined = carregando; null = não foi possível carregar.
  const [expenses, setExpenses] = useState<Expense[] | null | undefined>(undefined);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/professionals/${user.uid}/expenses?from=${period.prevStart}&to=${period.end}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setExpenses(res.ok ? data.expenses : null);
      } catch {
        if (!cancelled) setExpenses(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user, period.prevStart, period.end]);
  const costSummary = useMemo(
    () => (expenses === undefined ? undefined : expenses === null ? null : summarizeCosts(expenses, period)),
    [expenses, period]
  );

  const isLight = profile?.themeConfig?.mode === "light";
  // Cores dos gráficos validadas (daltonismo e contraste) para fundo claro e escuro
  const vizVars = {
    "--viz-1": isLight ? "#2a78d6" : "#3987e5", // realizado
    "--viz-2": isLight ? "#eb6834" : "#d95926", // previsto
  } as React.CSSProperties;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" style={vizVars}>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-indigo-400" />
          Faturamento
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Quanto entrou, quanto está para entrar e de onde vem o seu faturamento{hasTeam ? " (estabelecimento e equipe)" : ""}.
        </p>
      </div>

      {/* Hoje — sempre visível */}
      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        <MiniStat label="Faturado hoje" value={todaySummary ? brl(todaySummary.realized) : "…"} />
        <MiniStat label="A receber hoje" value={todaySummary ? brl(todaySummary.predicted) : "…"} />
        <MiniStat
          label="Atendimentos hoje"
          value={todaySummary ? `${todaySummary.realizedCount}/${todaySummary.realizedCount + todaySummary.predictedCount + todaySummary.overdueCount}` : "…"}
        />
      </section>

      {/* Filtro do período (vale para tudo abaixo) */}
      <div className="sticky top-0 z-20 -mx-4 md:mx-0 px-4 md:px-3 py-2 bg-slate-900 border-y md:border md:rounded-2xl border-slate-800 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-slate-800 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.kind}
              type="button"
              onClick={() => { setKind(p.kind); setOffset(0); }}
              className={`px-3 py-1 rounded-full text-xs font-bold ${kind === p.kind ? "bg-indigo-600 text-white" : "text-slate-400"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button type="button" aria-label="Período anterior" onClick={() => setOffset((o) => o - 1)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-extrabold text-slate-100 whitespace-nowrap">{period.label}</span>
          <button type="button" aria-label="Próximo período" onClick={() => setOffset((o) => o + 1)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800">
            <ChevronRight className="h-5 w-5" />
          </button>
          {offset !== 0 && (
            <button type="button" onClick={() => setOffset(0)} className="px-2.5 py-1 rounded-full border border-slate-800 text-[11px] font-bold text-slate-300">
              Atual
            </button>
          )}
        </div>
      </div>

      {!summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-slate-900/50 border border-slate-800 rounded-2xl" />)}
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity`}>
          <KpiGrid s={summary} prevLabel={period.prevLabel} />

          <ProfitCard realized={summary.realized} costs={costSummary} prevLabel={period.prevLabel} />

          <Card title="Evolução do faturamento" icon={BarChart3}>
            <EvolutionChart s={summary} kind={kind} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Faturamento por serviço" icon={Receipt}>
              <BarList rows={summary.byService} empty="Nenhum atendimento concluído no período." showShare />
            </Card>
            <Card title="Origem dos clientes" icon={Users}>
              <BarList rows={summary.byOrigin} empty="Nenhum atendimento concluído no período." showShare />
            </Card>
            <Card title="Por dia da semana" icon={CalendarClock}>
              <BarList rows={summary.byWeekday} empty="Nenhum atendimento concluído no período." compact />
            </Card>
            <Card title="Por turno" icon={CalendarClock}>
              <BarList rows={summary.byShift} empty="Nenhum atendimento concluído no período." showShare />
              <p className="mt-3 text-[11px] text-slate-500">Manhã: até 12h · Tarde: 12h–18h · Noite: a partir das 18h</p>
            </Card>
            <Card title="Custos por categoria" icon={Wallet}>
              {costSummary === undefined ? (
                <p className="text-sm text-slate-400">Carregando custos...</p>
              ) : (
                <BarList rows={costSummary?.byCategory ?? []} empty="Nenhum custo lançado no período." showShare countLabel="lançamento" />
              )}
              <Link href="/dashboard/custos" className="mt-3 inline-block text-xs font-semibold text-indigo-400 underline">Lançar ou ver custos</Link>
            </Card>
          </div>

          <Card title="Clientes que mais faturaram no período" icon={UserPlus}>
            {summary.topClients.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum atendimento concluído no período.</p>
            ) : (
              <ol className="divide-y divide-slate-800/60">
                {summary.topClients.map((c, i) => (
                  <li key={`${c.telefone}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 text-center text-xs font-extrabold text-slate-500">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate">{c.nome || "Sem nome"}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.count} atendimento{c.count !== 1 ? "s" : ""}{c.telefone ? ` · ${formatPhoneFriendly(c.telefone)}` : ""}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-slate-100">{brl(c.value)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <p className="text-[11px] text-slate-500">
            Faturamento realizado considera os agendamentos com status <strong>Atendido</strong>, pelo valor do agendamento.
            Previsto são os agendamentos ativos (Novo, Em contato, Agendado) de hoje em diante.
          </p>
        </div>
      )}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-4 md:p-6">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-3 sm:p-4 min-w-0">
      <p className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-tight">{label}</p>
      <p className="text-base sm:text-xl font-extrabold text-slate-100 mt-1 truncate">{value}</p>
    </div>
  );
}

function KpiGrid({ s, prevLabel }: { s: RevenueSummary; prevLabel: string }) {
  const up = s.deltaPct !== null && s.deltaPct >= 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {/* Destaque: faturamento realizado */}
      <div className="col-span-2 bg-slate-900/40 border border-slate-800 rounded-3xl p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faturamento realizado</p>
        <p className="text-3xl md:text-4xl font-black text-slate-100 mt-1">{brl(s.realized)}</p>
        <p className="mt-2 text-xs text-slate-400 flex items-center gap-1 flex-wrap">
          {s.deltaPct === null ? (
            <span>Sem faturamento no {prevLabel} para comparar.</span>
          ) : (
            <>
              <span className={`inline-flex items-center gap-0.5 font-bold ${up ? "text-emerald-500" : "text-red-500"}`}>
                {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {up ? "+" : ""}{pct(s.deltaPct)}
              </span>
              <span>em relação ao {prevLabel} ({brl(s.prevRealized)})</span>
            </>
          )}
        </p>
      </div>
      <Kpi label="Atendimentos" value={String(s.realizedCount)} sub="concluídos no período" />
      <Kpi label="Ticket médio" value={brl(s.avgTicket)} sub="por atendimento" />
      <Kpi label="A receber" value={brl(s.predicted)} sub={`${s.predictedCount} agendamento${s.predictedCount !== 1 ? "s" : ""} ativo${s.predictedCount !== 1 ? "s" : ""}`} icon={CalendarClock} />
      <Kpi label="Clientes atendidos" value={String(s.uniqueClients)} sub={`${s.newClients} novo${s.newClients !== 1 ? "s" : ""} · ${s.uniqueClients - s.newClients} recorrente${s.uniqueClients - s.newClients !== 1 ? "s" : ""}`} icon={Users} />
      <Kpi label="Cancelamentos" value={brl(s.lost)} sub={`${s.lostCount} · ${pct(s.cancelRate)} dos agendamentos`} icon={XCircle} />
      <Kpi
        label="A confirmar"
        value={brl(s.overdue)}
        sub={s.overdueCount > 0 ? `${s.overdueCount} já passaram e não foram marcados como Atendido` : "Tudo em dia"}
        icon={AlertTriangle}
      />
    </div>
  );
}

// Resultado do período: faturamento realizado − custos lançados em "Custos e Materiais" = lucro.
function ProfitCard({ realized, costs, prevLabel }: { realized: number; costs: CostSummary | null | undefined; prevLabel: string }) {
  if (costs === undefined) {
    return <div className="h-28 bg-slate-900/40 border border-slate-800 rounded-3xl animate-pulse" />;
  }
  if (costs === null) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 text-sm text-slate-400">
        Não foi possível carregar os custos agora. O lucro aparece aqui quando os custos carregarem.
      </div>
    );
  }
  const { lucro, margem } = profitOf(realized, costs.total);
  return (
    <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4" />
        Lucro do período
      </h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faturamento</p>
          <p className="text-sm md:text-lg font-extrabold text-slate-100 mt-1 truncate">{brl(realized)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">− Custos</p>
          <p className="text-sm md:text-lg font-extrabold text-slate-100 mt-1 truncate">{brl(costs.total)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">= Lucro</p>
          <p className={`text-sm md:text-lg font-black mt-1 truncate ${lucro < 0 ? "text-red-500" : "text-emerald-500"}`}>{brl(lucro)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {margem === null
          ? "Sem faturamento realizado no período."
          : lucro < 0
            ? `Prejuízo: os custos passaram o faturamento em ${brl(-lucro)}.`
            : `Margem de ${pct(margem)}: de cada R$ 100 faturados, sobram ${brl(margem * 100)}.`}
        {costs.count === 0 && " Nenhum custo lançado neste período."}
        {costs.deltaPct !== null && ` Custos ${costs.deltaPct >= 0 ? "+" : ""}${pct(costs.deltaPct)} em relação ao ${prevLabel}.`}
      </p>
      <Link href="/dashboard/custos" className="mt-2 inline-block text-xs font-semibold text-indigo-400 underline">Lançar ou ver custos</Link>
    </section>
  );
}

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: string; sub: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 min-w-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className="text-lg md:text-xl font-extrabold text-slate-100 mt-1 truncate">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{sub}</p>
    </div>
  );
}

// Barras empilhadas realizado (baixo) + previsto (cima) por hora / dia / mês, com leitura do ponto tocado e tabela.
function EvolutionChart({ s, kind }: { s: RevenueSummary; kind: PeriodKind }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const buckets = s.buckets;
  const max = niceCeil(Math.max(0, ...buckets.map((b) => b.realized + b.predicted)));
  const PLOT = 168;
  const sel = selected !== null ? buckets[selected] : null;
  const showLabel = (i: number) => {
    if (kind === "mes") return i === 0 || (i + 1) % 5 === 0 || i === buckets.length - 1;
    if (kind === "dia") return i % 2 === 0;
    return true;
  };
  const hasData = buckets.some((b) => b.realized > 0 || b.predicted > 0);

  return (
    <div>
      {/* Legenda + leitura do ponto selecionado (substitui o tooltip no toque) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--viz-1)" }} />Realizado</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--viz-2)" }} />Previsto</span>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-300"
        >
          <Table2 className="h-3.5 w-3.5" />
          {showTable ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-1.5 font-semibold">Período</th>
                <th className="py-1.5 font-semibold text-right">Realizado</th>
                <th className="py-1.5 font-semibold text-right">Previsto</th>
                <th className="py-1.5 font-semibold text-right">Atend.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {buckets.filter((b) => b.realized > 0 || b.predicted > 0).map((b) => (
                <tr key={b.key}>
                  <td className="py-1.5 text-slate-300">{b.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-100">{brl(b.realized)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-300">{brl(b.predicted)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-300">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!hasData && <p className="text-sm text-slate-400 py-4">Sem faturamento no período.</p>}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-300 mb-2 min-h-[1.25rem]">
            {sel ? (
              <>
                <strong className="text-slate-100">{sel.label}</strong> · Realizado {brl(sel.realized)} · Previsto {brl(sel.predicted)} · {sel.count} atend.
              </>
            ) : (
              <span className="text-slate-500">Toque numa barra para ver os valores.</span>
            )}
          </p>
          <div className="flex">
            {/* Eixo: só topo, meio e zero (grade discreta) */}
            <div className="relative w-14 shrink-0 text-[10px] text-slate-500 tabular-nums" style={{ height: PLOT }}>
              <span className="absolute right-1.5 top-0 -translate-y-1/2">{brlCompact(max)}</span>
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{brlCompact(max / 2)}</span>
              <span className="absolute right-1.5 bottom-0 translate-y-1/2">0</span>
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="absolute inset-x-0 top-0 border-t border-slate-800" />
              <div className="absolute inset-x-0 top-1/2 border-t border-slate-800" />
              <div className="relative flex items-end gap-[2px]" style={{ height: PLOT }} onMouseLeave={() => setSelected(null)}>
                {buckets.map((b, i) => {
                  const rH = (b.realized / max) * PLOT;
                  const pH = (b.predicted / max) * PLOT;
                  const active = selected === i;
                  return (
                    <button
                      key={b.key}
                      type="button"
                      aria-label={`${b.label}: realizado ${brl(b.realized)}, previsto ${brl(b.predicted)}`}
                      onMouseEnter={() => setSelected(i)}
                      onFocus={() => setSelected(i)}
                      onClick={() => setSelected(active ? null : i)}
                      className={`relative flex-1 min-w-0 h-full flex flex-col justify-end rounded-t ${active ? "bg-slate-800/50" : ""}`}
                    >
                      {pH > 0 && (
                        <span
                          className={`block w-full ${rH > 0 ? "mb-[2px]" : ""} rounded-t-[4px]`}
                          style={{ height: Math.max(pH, 2), background: "var(--viz-2)" }}
                        />
                      )}
                      {rH > 0 && (
                        <span
                          className={`block w-full ${pH > 0 ? "" : "rounded-t-[4px]"}`}
                          style={{ height: Math.max(rH, 2), background: "var(--viz-1)" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-slate-700" />
              <div className="flex gap-[2px] mt-1">
                {buckets.map((b, i) => (
                  <span key={b.key} className="flex-1 min-w-0 text-center text-[9px] text-slate-500 whitespace-nowrap overflow-visible">
                    {showLabel(i) ? b.label : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {!hasData && <p className="text-sm text-slate-400 mt-3">Sem faturamento no período.</p>}
        </>
      )}
    </div>
  );
}

// Barras horizontais de uma série (sempre a mesma cor): valor à direita, quantidade e participação abaixo.
function BarList({ rows, empty, showShare, compact, countLabel = "atendimento" }: { rows: Breakdown[]; empty: string; showShare?: boolean; compact?: boolean; countLabel?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (max === 0) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <ul className={compact ? "space-y-2" : "space-y-3"}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-200 truncate">{r.label}</span>
            <span className="shrink-0 font-bold text-slate-100 tabular-nums">{brl(r.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800/60 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: "var(--viz-1)" }} />
          </div>
          {!compact && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {r.count} {countLabel}{r.count !== 1 ? "s" : ""}{showShare ? ` · ${pct(r.share)} do total` : ""}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
