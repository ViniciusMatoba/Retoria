// Consulta de agendamentos na página pública, pelo WhatsApp do cliente. Testada em scripts/test-customer-appointments.ts.
//
// A busca não tem senha: quem digitar um número vê os agendamentos dele. Por isso a resposta leva só data,
// horário, serviço e situação (nunca nome, telefone, valor ou observações).

const ACTIVE = ["Novo", "Em contato", "Agendado"];
const MAX_ITEMS = 20;

export interface AppointmentSource {
  status?: string;
  dataEscolhida?: string;
  horarioInicio?: string;
  horarioEscolhido?: string;
  servicoEscolhido?: string;
  servicos?: { nome?: string }[];
}

export interface PublicAppointment {
  data: string;
  horario: string;
  servico: string;
  situacao: string;
}

const serviceName = (l: AppointmentSource) =>
  (l.servicos ?? []).map((s) => (s?.nome ?? "").trim()).filter(Boolean).join(" + ") || (l.servicoEscolhido ?? "").trim() || "Serviço";

const timeOf = (l: AppointmentSource) => l.horarioInicio || l.horarioEscolhido || "";

const toPublic = (l: AppointmentSource, situacao: string): PublicAppointment => ({
  data: l.dataEscolhida as string,
  horario: timeOf(l),
  servico: serviceName(l),
  situacao,
});

// Próximos: ativos de hoje em diante, do mais perto ao mais longe.
// Anteriores: atendidos e ativos com data passada (o profissional nem sempre marca como Atendido), do mais recente ao mais antigo.
// Cancelados e perdidos não aparecem.
export const splitAppointments = (leads: AppointmentSource[], today: string) => {
  const dated = leads.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.dataEscolhida ?? ""));
  const key = (a: PublicAppointment) => `${a.data} ${a.horario}`;

  const upcoming = dated
    .filter((l) => ACTIVE.includes(l.status ?? "") && (l.dataEscolhida as string) >= today)
    .map((l) => toPublic(l, l.status === "Agendado" ? "Confirmado" : "Aguardando confirmação"))
    .sort((a, b) => key(a).localeCompare(key(b)))
    .slice(0, MAX_ITEMS);

  const past = dated
    .filter((l) => l.status === "Atendido" || (ACTIVE.includes(l.status ?? "") && (l.dataEscolhida as string) < today))
    .map((l) => toPublic(l, l.status === "Atendido" ? "Realizado" : "Data passada"))
    .sort((a, b) => key(b).localeCompare(key(a)))
    .slice(0, MAX_ITEMS);

  return { upcoming, past };
};
