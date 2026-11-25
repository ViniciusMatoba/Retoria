// Regras de status dos agendamentos usadas na agenda, no faturamento e na taxa de não comparecimento.
// Funções puras, testadas em scripts/test-lead-status.ts.
//
// Inativos (Cancelado, Perdido, Não compareceu):
//  - horário já passou: continuam aparecendo na agenda, apagados, para o histórico do dia;
//  - horário futuro: o profissional escolhe liberar o horário (some da agenda e volta a ficar livre)
//    ou manter (`manterNaAgenda: true`: continua aparecendo e segurando o horário).
// "Troca de serviço": a cliente veio, mas o atendimento não é cobrado (não entra no faturamento).
//
// Taxa de não comparecimento: ao marcar Perdido ou Não compareceu, o agendamento recebe
// `taxaNaoComparecimento = { valor, status: "pendente" }`. Enquanto houver taxa pendente para o telefone,
// a página pública mostra o aviso e não deixa agendar. O profissional dá baixa (paga) ou dispensa.

export const INACTIVE_STATUSES = ["Cancelado", "Perdido", "Não compareceu"];
export const NO_SHOW_STATUSES = ["Perdido", "Não compareceu"];
export const NO_CHARGE_STATUS = "Troca de serviço";

export const isInactiveStatus = (status: string | undefined) => INACTIVE_STATUSES.includes(status ?? "");
export const isNoShowStatus = (status: string | undefined) => NO_SHOW_STATUSES.includes(status ?? "");

const SP_OFFSET_MIN = -180; // São Paulo sem horário de verão desde 2019

export interface StatusLead {
  status?: string;
  dataEscolhida?: string;
  horarioInicio?: string;
  horarioEscolhido?: string;
  manterNaAgenda?: boolean;
}

// O horário de início do agendamento já passou? (nowMs = Date.now())
export const hasStarted = (l: StatusLead, nowMs: number) => {
  const time = l.horarioInicio || l.horarioEscolhido || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.dataEscolhida ?? "") || !/^\d{2}:\d{2}$/.test(time)) return false;
  const [y, m, d] = (l.dataEscolhida as string).split("-").map(Number);
  const apptLocal = Date.UTC(y, m - 1, d) / 60_000 + Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return Math.floor(nowMs / 60_000) + SP_OFFSET_MIN >= apptLocal;
};

// Aparece na agenda (Horários)?
export const showsInAgenda = (l: StatusLead, nowMs: number) =>
  !isInactiveStatus(l.status) || l.manterNaAgenda === true || hasStarted(l, nowMs);

// Segura o horário (não deixa outro agendamento ocupar)?
export const occupiesTime = (l: StatusLead) => !isInactiveStatus(l.status) || l.manterNaAgenda === true;

// Ao inativar, perguntar se libera o horário? Só quando o horário ainda não chegou.
export const shouldAskToRelease = (l: StatusLead, newStatus: string, nowMs: number) =>
  isInactiveStatus(newStatus) && !isInactiveStatus(l.status) && !hasStarted(l, nowMs);

// ── Taxa de não comparecimento ────────────────────────────────────────────────

export interface NoShowFeeSettings { ativo: boolean; valor: number; chavePix: string }
export const DEFAULT_NO_SHOW_FEE: NoShowFeeSettings = { ativo: true, valor: 30, chavePix: "" };

export const readNoShowFeeSettings = (raw: unknown): NoShowFeeSettings => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const valor = typeof r.valor === "number" && Number.isFinite(r.valor) && r.valor > 0 && r.valor <= 10_000
    ? Math.round(r.valor * 100) / 100
    : DEFAULT_NO_SHOW_FEE.valor;
  const chavePix = typeof r.chavePix === "string" ? r.chavePix.trim().slice(0, 140) : "";
  return { ativo: r.ativo !== false, valor, chavePix };
};

export interface NoShowFee {
  valor: number;
  status: "pendente" | "paga" | "dispensada";
  criadaEm: number;
  resolvidaEm?: number;
}

// Taxa do agendamento depois da troca de status: objeto novo, `null` para remover, `undefined` para não mexer.
export const feeAfterStatusChange = (
  oldStatus: string | undefined,
  newStatus: string,
  current: NoShowFee | null | undefined,
  settings: NoShowFeeSettings,
  nowMs: number
): NoShowFee | null | undefined => {
  const entering = isNoShowStatus(newStatus) && !isNoShowStatus(oldStatus);
  const leaving = !isNoShowStatus(newStatus) && isNoShowStatus(oldStatus);
  if (entering && settings.ativo && !current) return { valor: settings.valor, status: "pendente", criadaEm: nowMs };
  if (leaving && current?.status === "pendente") return null; // marcou errado: tira a cobrança
  return undefined;
};

export interface FeeLead { id: string; nome?: string; dataEscolhida?: string; taxaNaoComparecimento?: NoShowFee | null }

// Taxa pendente mais antiga entre os agendamentos da cliente (o mesmo telefone).
export const pendingFeeOf = (leads: FeeLead[]) =>
  leads
    .filter((l) => l.taxaNaoComparecimento?.status === "pendente")
    .sort((a, b) => (a.taxaNaoComparecimento!.criadaEm ?? 0) - (b.taxaNaoComparecimento!.criadaEm ?? 0))
    .map((l) => ({ leadId: l.id, valor: l.taxaNaoComparecimento!.valor, data: l.dataEscolhida ?? null, nome: l.nome ?? "" }))[0] ?? null;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Texto do aviso na página pública (pedido pela profissional).
export const noShowFeeMessage = (nome: string, valor: number) => {
  const primeiro = (nome || "").trim().split(/\s+/)[0];
  return `Olá${primeiro ? ` ${primeiro}` : ""}! No último agendamento, o não comparecimento gerou uma taxa de cancelamento de ${brl(valor)}. ` +
    "Para um novo agendamento, é necessário efetuar o pagamento. Envie o comprovante para a baixa e siga com o novo agendamento. " +
    "Obrigado pela compreensão e preferência.";
};
