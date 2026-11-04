// Cálculos da tela Faturamento (/dashboard/faturamento). Funções puras sobre os agendamentos (leads),
// testadas em scripts/test-revenue.ts. Datas são "YYYY-MM-DD" no fuso de São Paulo (como em dataEscolhida).
//
// Regras:
// - Realizado: status "Atendido", pelo valorTotal do agendamento.
// - Previsto (a receber): Novo / Em contato / Agendado com data de hoje em diante.
// - A confirmar: Novo / Em contato / Agendado com data que já passou (falta marcar como Atendido ou Cancelado).
// - Perdido: Cancelado / Perdido.

export type PeriodKind = "dia" | "semana" | "mes" | "ano";

export interface RevenueLead {
  id: string;
  nome?: string;
  telefone?: string;
  status?: string;
  dataEscolhida?: string;
  horarioEscolhido?: string;
  horarioInicio?: string;
  valorTotal?: number;
  servicoEscolhido?: string;
  servicos?: { nome?: string; preco?: number | null }[];
  origem?: string;
}

export interface PeriodBucket {
  key: string;
  label: string;
  start: string;
  end: string;
}

export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  label: string;
  prevLabel: string;
  bucketBy: "hour" | "day" | "month";
  buckets: PeriodBucket[];
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ACTIVE = ["Novo", "Em contato", "Agendado"];
const LOST = ["Cancelado", "Perdido"];

const ORIGIN_LABELS: Record<string, string> = {
  "web-slug": "Página pública",
  "web-publica": "Página pública",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  ligacao: "Ligação",
  indicacao: "Indicação",
  presencial: "Presencial",
  outro: "Outro",
};

// ── Datas (UTC ao meio-dia para não sofrer com horário de verão) ──────────────
const toDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const toYmd = (dt: Date) =>
  `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
export const addDays = (ymd: string, n: number) => {
  const dt = toDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toYmd(dt);
};
const weekdayOf = (ymd: string) => toDate(ymd).getUTCDay();
const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const monthStart = (y: number, m0: number) => toYmd(new Date(Date.UTC(y, m0, 1, 12)));
const monthEnd = (y: number, m0: number) => toYmd(new Date(Date.UTC(y, m0 + 1, 0, 12)));

// Período escolhido na tela (offset 0 = atual, -1 = anterior...) e o período imediatamente anterior, para comparar.
export const getPeriod = (kind: PeriodKind, offset: number, today: string): Period => {
  if (kind === "dia") {
    const day = addDays(today, offset);
    const prev = addDays(day, -1);
    const label = `${WEEKDAYS[weekdayOf(day)]}, ${ddmm(day)}/${day.slice(0, 4)}`;
    const buckets = Array.from({ length: 24 }, (_, h) => {
      const hh = String(h).padStart(2, "0");
      return { key: hh, label: `${hh}h`, start: day, end: day };
    });
    return { kind, start: day, end: day, prevStart: prev, prevEnd: prev, label, prevLabel: "dia anterior", bucketBy: "hour", buckets };
  }

  if (kind === "semana") {
    const start = addDays(addDays(today, -weekdayOf(today)), offset * 7);
    const end = addDays(start, 6);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { key: d, label: `${WEEKDAYS[i]} ${d.slice(8, 10)}`, start: d, end: d };
    });
    return {
      kind, start, end, prevStart: addDays(start, -7), prevEnd: addDays(start, -1),
      label: `${ddmm(start)} – ${ddmm(end)}/${end.slice(0, 4)}`, prevLabel: "semana anterior", bucketBy: "day", buckets,
    };
  }

  const [ty, tm] = today.split("-").map(Number);
  if (kind === "mes") {
    const ref = new Date(Date.UTC(ty, tm - 1 + offset, 1, 12));
    const y = ref.getUTCFullYear();
    const m0 = ref.getUTCMonth();
    const start = monthStart(y, m0);
    const end = monthEnd(y, m0);
    const days = Number(end.slice(8, 10));
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = addDays(start, i);
      return { key: d, label: String(i + 1), start: d, end: d };
    });
    return {
      kind, start, end, prevStart: monthStart(y, m0 - 1), prevEnd: monthEnd(y, m0 - 1),
      label: `${MONTHS[m0]} de ${y}`, prevLabel: "mês anterior", bucketBy: "day", buckets,
    };
  }

  const y = ty + offset;
  const buckets = Array.from({ length: 12 }, (_, m0) => ({
    key: `${y}-${String(m0 + 1).padStart(2, "0")}`,
    label: MONTHS_SHORT[m0],
    start: monthStart(y, m0),
    end: monthEnd(y, m0),
  }));
  return {
    kind, start: `${y}-01-01`, end: `${y}-12-31`, prevStart: `${y - 1}-01-01`, prevEnd: `${y - 1}-12-31`,
    label: String(y), prevLabel: "ano anterior", bucketBy: "month", buckets,
  };
};

// ── Agendamento ───────────────────────────────────────────────────────────────
const value = (l: RevenueLead) => (typeof l.valorTotal === "number" && Number.isFinite(l.valorTotal) ? l.valorTotal : 0);
const timeOf = (l: RevenueLead) => l.horarioInicio || l.horarioEscolhido || "";
const phoneOf = (l: RevenueLead) => String(l.telefone ?? "").replace(/\D/g, "");
const inRange = (d: string | undefined, start: string, end: string) => !!d && d >= start && d <= end;

// Divide o valor do agendamento entre os serviços dele (proporcional ao preço; sem preço, partes iguais).
export const allocateByService = (l: RevenueLead): { name: string; value: number }[] => {
  const total = value(l);
  const items = (l.servicos ?? []).filter((s) => s && (s.nome ?? "").trim());
  if (items.length === 0) return [{ name: (l.servicoEscolhido || "Sem serviço").trim() || "Sem serviço", value: total }];
  const prices = items.map((s) => (typeof s.preco === "number" && s.preco > 0 ? s.preco : 0));
  const sum = prices.reduce((a, b) => a + b, 0);
  return items.map((s, i) => ({
    name: (s.nome as string).trim(),
    value: sum > 0 ? (total * prices[i]) / sum : total / items.length,
  }));
};

export const shiftOf = (time: string): "Manhã" | "Tarde" | "Noite" | null => {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const h = Number(time.slice(0, 2));
  return h < 12 ? "Manhã" : h < 18 ? "Tarde" : "Noite";
};

export const originLabel = (origem?: string) => (origem ? ORIGIN_LABELS[origem] ?? origem : "Não informado");

export interface Breakdown {
  label: string;
  value: number;
  count: number;
  share: number; // fração do realizado do período (0–1)
}

export interface RevenueSummary {
  realized: number;
  realizedCount: number;
  avgTicket: number;
  predicted: number;
  predictedCount: number;
  overdue: number;
  overdueCount: number;
  lost: number;
  lostCount: number;
  cancelRate: number; // perdidos / (atendidos + perdidos + ativos) do período
  prevRealized: number;
  deltaPct: number | null; // null quando o período anterior não teve faturamento
  uniqueClients: number;
  newClients: number; // primeiro atendimento da vida do cliente caiu neste período
  buckets: { key: string; label: string; realized: number; predicted: number; count: number }[];
  byService: Breakdown[];
  byWeekday: Breakdown[];
  byShift: Breakdown[];
  byOrigin: Breakdown[];
  topClients: { nome: string; telefone: string; value: number; count: number }[];
}

const toBreakdown = (map: Map<string, { value: number; count: number }>, total: number, sort = true): Breakdown[] => {
  const rows = [...map.entries()].map(([label, v]) => ({ label, value: v.value, count: v.count, share: total > 0 ? v.value / total : 0 }));
  return sort ? rows.sort((a, b) => b.value - a.value || b.count - a.count) : rows;
};

const bump = (map: Map<string, { value: number; count: number }>, key: string, v: number, c = 1) => {
  const cur = map.get(key) ?? { value: 0, count: 0 };
  cur.value += v;
  cur.count += c;
  map.set(key, cur);
};

export const summarizeRevenue = (leads: RevenueLead[], period: Period, today: string): RevenueSummary => {
  const { start, end } = period;
  const attended = leads.filter((l) => l.status === "Atendido" && inRange(l.dataEscolhida, start, end));
  const active = leads.filter((l) => ACTIVE.includes(l.status ?? "") && inRange(l.dataEscolhida, start, end));
  const predictedLeads = active.filter((l) => (l.dataEscolhida as string) >= today);
  const overdueLeads = active.filter((l) => (l.dataEscolhida as string) < today);
  const lostLeads = leads.filter((l) => LOST.includes(l.status ?? "") && inRange(l.dataEscolhida, start, end));

  const realized = attended.reduce((s, l) => s + value(l), 0);
  const prevRealized = leads
    .filter((l) => l.status === "Atendido" && inRange(l.dataEscolhida, period.prevStart, period.prevEnd))
    .reduce((s, l) => s + value(l), 0);
  const totalInPeriod = attended.length + active.length + lostLeads.length;

  // Evolução: realizado e previsto por hora / dia / mês
  const bucketOf = (l: RevenueLead): string | null => {
    if (period.bucketBy === "hour") {
      const t = timeOf(l);
      return /^\d{2}:/.test(t) ? t.slice(0, 2) : null;
    }
    if (period.bucketBy === "month") return (l.dataEscolhida as string).slice(0, 7);
    return l.dataEscolhida as string;
  };
  const bucketMap = new Map(period.buckets.map((b) => [b.key, { key: b.key, label: b.label, realized: 0, predicted: 0, count: 0 }]));
  attended.forEach((l) => {
    const b = bucketMap.get(bucketOf(l) ?? "");
    if (b) { b.realized += value(l); b.count += 1; }
  });
  predictedLeads.forEach((l) => {
    const b = bucketMap.get(bucketOf(l) ?? "");
    if (b) b.predicted += value(l);
  });
  let buckets = [...bucketMap.values()];
  if (period.bucketBy === "hour") {
    // No dia, mostra das 07h às 20h e estende só se houver atendimento fora dessa faixa
    const used = buckets.filter((b) => b.realized > 0 || b.predicted > 0).map((b) => Number(b.key));
    const from = Math.min(7, ...used);
    const to = Math.max(20, ...used);
    buckets = buckets.filter((b) => Number(b.key) >= from && Number(b.key) <= to);
  }

  const services = new Map<string, { value: number; count: number }>();
  const weekdays = new Map<string, { value: number; count: number }>(WEEKDAYS.map((w) => [w, { value: 0, count: 0 }]));
  const shifts = new Map<string, { value: number; count: number }>([["Manhã", { value: 0, count: 0 }], ["Tarde", { value: 0, count: 0 }], ["Noite", { value: 0, count: 0 }]]);
  const origins = new Map<string, { value: number; count: number }>();
  const clients = new Map<string, { nome: string; telefone: string; value: number; count: number; last: string }>();

  attended.forEach((l) => {
    const v = value(l);
    allocateByService(l).forEach((s) => bump(services, s.name, s.value));
    bump(weekdays, WEEKDAYS[weekdayOf(l.dataEscolhida as string)], v);
    const shift = shiftOf(timeOf(l));
    if (shift) bump(shifts, shift, v);
    bump(origins, originLabel(l.origem), v);
    const key = phoneOf(l) || `nome:${(l.nome ?? "").trim().toLowerCase()}`;
    const c = clients.get(key) ?? { nome: l.nome ?? "", telefone: phoneOf(l), value: 0, count: 0, last: "" };
    c.value += v;
    c.count += 1;
    if ((l.dataEscolhida as string) >= c.last) { c.last = l.dataEscolhida as string; c.nome = l.nome || c.nome; }
    clients.set(key, c);
  });

  // Cliente novo: o primeiro atendimento dele (em todo o histórico) está dentro do período
  const firstVisit = new Map<string, string>();
  leads.forEach((l) => {
    if (l.status !== "Atendido" || !l.dataEscolhida) return;
    const key = phoneOf(l) || `nome:${(l.nome ?? "").trim().toLowerCase()}`;
    const cur = firstVisit.get(key);
    if (!cur || l.dataEscolhida < cur) firstVisit.set(key, l.dataEscolhida);
  });
  const newClients = [...clients.keys()].filter((k) => inRange(firstVisit.get(k), start, end)).length;

  return {
    realized,
    realizedCount: attended.length,
    avgTicket: attended.length > 0 ? realized / attended.length : 0,
    predicted: predictedLeads.reduce((s, l) => s + value(l), 0),
    predictedCount: predictedLeads.length,
    overdue: overdueLeads.reduce((s, l) => s + value(l), 0),
    overdueCount: overdueLeads.length,
    lost: lostLeads.reduce((s, l) => s + value(l), 0),
    lostCount: lostLeads.length,
    cancelRate: totalInPeriod > 0 ? lostLeads.length / totalInPeriod : 0,
    prevRealized,
    deltaPct: prevRealized > 0 ? (realized - prevRealized) / prevRealized : null,
    uniqueClients: clients.size,
    newClients,
    buckets,
    byService: toBreakdown(services, realized),
    byWeekday: toBreakdown(weekdays, realized, false),
    byShift: toBreakdown(shifts, realized, false),
    byOrigin: toBreakdown(origins, realized),
    topClients: [...clients.values()]
      .sort((a, b) => b.value - a.value || b.count - a.count)
      .slice(0, 5)
      .map(({ nome, telefone, value: v, count }) => ({ nome, telefone, value: v, count })),
  };
};
