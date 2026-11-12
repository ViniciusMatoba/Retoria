// Consulta de agendamentos na página pública, pelo WhatsApp do cliente. Testada em scripts/test-customer-appointments.ts.
//
// A busca não tem senha: quem digitar um número vê os agendamentos dele. Por isso a resposta leva só data,
// horário, serviço e situação (nunca nome, telefone, valor ou observações), mais os identificadores
// necessários para cancelar, remarcar e agendar de novo.
//
// Cancelar e remarcar pela página pública: só agendamentos ativos e com pelo menos 12 h de antecedência.

const ACTIVE = ["Novo", "Em contato", "Agendado"];
const MAX_ITEMS = 20;
export const CUSTOMER_CHANGE_MIN_HOURS = 12;
const SP_OFFSET_MIN = -180; // São Paulo não tem horário de verão desde 2019

export interface AppointmentSource {
  id?: string; // id do agendamento
  pid?: string; // profissional (dono ou membro da equipe) que atende
  serviceId?: string;
  status?: string;
  dataEscolhida?: string;
  horarioInicio?: string;
  horarioEscolhido?: string;
  servicoEscolhido?: string;
  servicos?: { id?: string; nome?: string }[];
}

export interface PublicAppointment {
  data: string;
  horario: string;
  servico: string;
  situacao: string;
  pid?: string;
  servicoIds: string[]; // para "Agendar de novo" e "Remarcar"
  id?: string; // só nos próximos
  podeAlterar?: boolean; // só nos próximos: ainda dá para cancelar/remarcar pela página
}

const serviceName = (l: AppointmentSource) =>
  (l.servicos ?? []).map((s) => (s?.nome ?? "").trim()).filter(Boolean).join(" + ") || (l.servicoEscolhido ?? "").trim() || "Serviço";

const timeOf = (l: AppointmentSource) => l.horarioInicio || l.horarioEscolhido || "";

const serviceIds = (l: AppointmentSource) => {
  const ids = (l.servicos ?? []).map((s) => s?.id).filter((x): x is string => typeof x === "string" && x.length > 0);
  return ids.length > 0 ? ids : l.serviceId ? [l.serviceId] : [];
};

const toPublic = (l: AppointmentSource, situacao: string): PublicAppointment => ({
  data: l.dataEscolhida as string,
  horario: timeOf(l),
  servico: serviceName(l),
  situacao,
  ...(l.pid ? { pid: l.pid } : {}),
  servicoIds: serviceIds(l),
});

// O cliente pode cancelar ou remarcar sozinho? Só agendamento ativo e faltando 12 h ou mais (nowMs = Date.now()).
export const canCustomerChange = (l: AppointmentSource, nowMs: number): { ok: true } | { ok: false; reason: "status" | "sem-horario" | "prazo" } => {
  if (!ACTIVE.includes(l.status ?? "")) return { ok: false, reason: "status" };
  const time = timeOf(l);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.dataEscolhida ?? "") || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, reason: "sem-horario" };
  const [y, m, d] = (l.dataEscolhida as string).split("-").map(Number);
  const apptLocalMin = Date.UTC(y, m - 1, d) / 60_000 + Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const nowLocalMin = Math.floor(nowMs / 60_000) + SP_OFFSET_MIN;
  return apptLocalMin - nowLocalMin >= CUSTOMER_CHANGE_MIN_HOURS * 60 ? { ok: true } : { ok: false, reason: "prazo" };
};

// Próximos: ativos de hoje em diante, do mais perto ao mais longe.
// Anteriores: atendidos e ativos com data passada (o profissional nem sempre marca como Atendido), do mais recente ao mais antigo.
// Cancelados e perdidos não aparecem.
export const splitAppointments = (leads: AppointmentSource[], today: string, nowMs: number = Date.now()) => {
  const dated = leads.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.dataEscolhida ?? ""));
  const key = (a: PublicAppointment) => `${a.data} ${a.horario}`;

  const upcoming = dated
    .filter((l) => ACTIVE.includes(l.status ?? "") && (l.dataEscolhida as string) >= today)
    .map((l) => ({
      ...toPublic(l, l.status === "Agendado" ? "Confirmado" : "Aguardando confirmação"),
      ...(l.id ? { id: l.id } : {}),
      podeAlterar: !!l.id && !!l.pid && canCustomerChange(l, nowMs).ok,
    }))
    .sort((a, b) => key(a).localeCompare(key(b)))
    .slice(0, MAX_ITEMS);

  const past = dated
    .filter((l) => l.status === "Atendido" || (ACTIVE.includes(l.status ?? "") && (l.dataEscolhida as string) < today))
    .map((l) => toPublic(l, l.status === "Atendido" ? "Realizado" : "Data passada"))
    .sort((a, b) => key(b).localeCompare(key(a)))
    .slice(0, MAX_ITEMS);

  return { upcoming, past };
};
