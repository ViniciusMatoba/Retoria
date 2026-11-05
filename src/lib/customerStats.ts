// Situação de cada cliente na tela Clientes (novo no mês, ativo, sem retorno, com horário marcado).
// Funções puras, testadas em scripts/test-customer-stats.ts. Datas "YYYY-MM-DD".

export const INACTIVE_AFTER_DAYS = 60;
export const ACTIVE_WITHIN_DAYS = 90;

const ACTIVE_STATUSES = ["Novo", "Em contato", "Agendado"];

export interface CustomerHistoryItem {
  status: string;
  dataEscolhida: string;
  valorTotal: number;
}

export interface CustomerInsight {
  firstDate: string | null; // primeiro agendamento (qualquer status)
  lastAttended: string | null; // último atendimento concluído
  nextBooking: string | null; // próximo agendamento ativo de hoje em diante
  spent: number;
  isNewThisMonth: boolean; // primeiro agendamento caiu no mês atual
  isActive: boolean; // atendido nos últimos 90 dias ou com horário marcado
  isInactive: boolean; // já foi atendido, último atendimento há mais de 60 dias e nada marcado
  daysSinceLastVisit: number | null;
}

const daysBetween = (a: string, b: string) => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};

export const getCustomerInsight = (history: CustomerHistoryItem[], today: string): CustomerInsight => {
  const dated = history.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.dataEscolhida));
  const firstDate = dated.reduce<string | null>((min, h) => (!min || h.dataEscolhida < min ? h.dataEscolhida : min), null);
  const attended = dated.filter((h) => h.status === "Atendido");
  const lastAttended = attended.reduce<string | null>((max, h) => (!max || h.dataEscolhida > max ? h.dataEscolhida : max), null);
  const nextBooking = dated
    .filter((h) => ACTIVE_STATUSES.includes(h.status) && h.dataEscolhida >= today)
    .reduce<string | null>((min, h) => (!min || h.dataEscolhida < min ? h.dataEscolhida : min), null);
  const daysSinceLastVisit = lastAttended ? daysBetween(lastAttended, today) : null;

  return {
    firstDate,
    lastAttended,
    nextBooking,
    spent: attended.reduce((s, h) => s + (Number.isFinite(h.valorTotal) ? h.valorTotal : 0), 0),
    isNewThisMonth: !!firstDate && firstDate.slice(0, 7) === today.slice(0, 7),
    isActive: !!nextBooking || (daysSinceLastVisit !== null && daysSinceLastVisit <= ACTIVE_WITHIN_DAYS),
    isInactive: !nextBooking && daysSinceLastVisit !== null && daysSinceLastVisit > INACTIVE_AFTER_DAYS,
    daysSinceLastVisit,
  };
};
