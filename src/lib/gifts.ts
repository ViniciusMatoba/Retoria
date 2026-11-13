// Brindes (/dashboard/brindes): campanhas com período e controle de entrega, um brinde por cliente.
// Funções puras, testadas em scripts/test-gifts.ts.
//
// Campanha: professionals/{id}/giftCampaigns/{campaignId} = { nome, inicio, fim }
// Entrega:  .../giftCampaigns/{campaignId}/deliveries/{chave da cliente} = { nome, telefone, leadId, data, entregueEm }
// O id da entrega é a chave da cliente, então o banco não aceita dois brindes para a mesma pessoa.
// Leitura e gravação só pelas rotas do servidor (Admin SDK), como Custos e Materiais.

export interface GiftCampaign {
  id: string;
  nome: string;
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
}

export interface GiftDelivery {
  key: string;
  nome: string;
  leadId: string | null;
  data: string | null; // dia do atendimento em que foi entregue
  entregueEm: number; // epoch ms
}

export interface GiftLead {
  id: string;
  pid: string; // profissional (dono ou membro da equipe)
  nome?: string;
  telefone?: string;
  status?: string;
  dataEscolhida?: string;
  horarioInicio?: string;
  horarioEscolhido?: string;
  servicoEscolhido?: string;
}

export interface GiftAppointment {
  leadId: string;
  pid: string;
  data: string;
  horario: string;
  servico: string;
  status: string;
}

export interface GiftClient {
  key: string;
  nome: string;
  telefone: string;
  appointments: GiftAppointment[]; // do período, em ordem
  delivery: GiftDelivery | null;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const YMD = /^\d{4}-\d{2}-\d{2}$/;
// Quem cancelou, faltou ou foi perdido não entra na lista do brinde.
const EXCLUDED = ["Cancelado", "Perdido", "Não compareceu"];
const MAX_DAYS = 366;

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export const validateCampaign = (body: unknown): Result<Omit<GiftCampaign, "id">> => {
  const b = (body ?? {}) as Record<string, unknown>;
  const nome = typeof b.nome === "string" ? b.nome.trim().replace(/\s+/g, " ") : "";
  if (nome.length < 2 || nome.length > 60) return { ok: false, error: "O nome do brinde deve ter entre 2 e 60 caracteres." };
  const inicio = typeof b.inicio === "string" ? b.inicio : "";
  const fim = typeof b.fim === "string" ? b.fim : "";
  if (!YMD.test(inicio) || !YMD.test(fim)) return { ok: false, error: "Informe o primeiro e o último dia do período." };
  if (fim < inicio) return { ok: false, error: "O último dia não pode ser antes do primeiro." };
  if (dayNumber(fim) - dayNumber(inicio) + 1 > MAX_DAYS) return { ok: false, error: "O período pode ter no máximo 1 ano." };
  return { ok: true, data: { nome, inicio, fim } };
};

// Chave da cliente: o WhatsApp (sem DDI 55 e sem formatação). Sem telefone, o nome sem acentos.
// É também o id do documento da entrega, por isso só letras, números e "_" (nunca "/").
export const clientKey = (telefone: string | undefined, nome: string | undefined): string | null => {
  let d = (telefone ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length >= 10 && d.length <= 13) return `t_${d}`;
  const n = (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return n.length >= 2 ? `n_${n}` : null;
};

const timeOf = (l: GiftLead) => l.horarioInicio || l.horarioEscolhido || "";
const sortKey = (a: GiftAppointment) => `${a.data} ${a.horario}`;

export const inCampaign = (c: Pick<GiftCampaign, "inicio" | "fim">, date: string | undefined) =>
  !!date && YMD.test(date) && date >= c.inicio && date <= c.fim;

export const isGiftEligible = (l: Pick<GiftLead, "status">) => !EXCLUDED.includes(l.status ?? "");

// Junta os agendamentos do período por cliente e marca quem já recebeu.
// Quem já recebeu continua na lista mesmo se depois cancelar os agendamentos (a entrega fica registrada).
export const buildGiftClients = (campaign: GiftCampaign, leads: GiftLead[], deliveries: GiftDelivery[]): GiftClient[] => {
  const byKey = new Map<string, GiftClient>();
  const delivered = new Map(deliveries.map((d) => [d.key, d]));

  leads
    .filter((l) => inCampaign(campaign, l.dataEscolhida) && isGiftEligible(l))
    .forEach((l) => {
      const key = clientKey(l.telefone, l.nome);
      if (!key) return;
      const client = byKey.get(key) ?? { key, nome: (l.nome ?? "").trim(), telefone: (l.telefone ?? "").replace(/\D/g, ""), appointments: [], delivery: delivered.get(key) ?? null };
      if (!client.nome && l.nome) client.nome = l.nome.trim();
      client.appointments.push({
        leadId: l.id,
        pid: l.pid,
        data: l.dataEscolhida as string,
        horario: timeOf(l),
        servico: (l.servicoEscolhido ?? "").trim() || "Serviço",
        status: l.status ?? "",
      });
      byKey.set(key, client);
    });

  deliveries.forEach((d) => {
    if (!byKey.has(d.key)) byKey.set(d.key, { key: d.key, nome: d.nome, telefone: d.key.startsWith("t_") ? d.key.slice(2) : "", appointments: [], delivery: d });
  });

  const clients = [...byKey.values()];
  clients.forEach((c) => c.appointments.sort((a, b) => sortKey(a).localeCompare(sortKey(b))));
  return clients.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

export const summarizeGifts = (clients: GiftClient[]) => {
  const total = clients.length;
  const delivered = clients.filter((c) => c.delivery).length;
  return { total, delivered, pending: total - delivered };
};

export interface GiftDayRow {
  client: GiftClient;
  appointment: GiftAppointment;
  visit: number; // 1 = primeira vinda da cliente no período
  visits: number;
}

// Atendimentos de um dia, por horário: "hoje atendo estas clientes".
export const giftDayRows = (clients: GiftClient[], date: string): GiftDayRow[] =>
  clients
    .flatMap((client) =>
      client.appointments
        .map((appointment, i) => ({ client, appointment, visit: i + 1, visits: client.appointments.length }))
        .filter((r) => r.appointment.data === date)
    )
    .sort((a, b) => sortKey(a.appointment).localeCompare(sortKey(b.appointment)));

// Dias do período que têm atendimento, com quantos brindes ainda faltam em cada um.
export const giftDays = (clients: GiftClient[]) => {
  const days = new Map<string, { date: string; count: number; pending: number }>();
  clients.forEach((c) =>
    c.appointments.forEach((a) => {
      const d = days.get(a.data) ?? { date: a.data, count: 0, pending: 0 };
      d.count += 1;
      if (!c.delivery) d.pending += 1;
      days.set(a.data, d);
    })
  );
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
};

// Dia a abrir primeiro: hoje, se tiver atendimento; senão o próximo dia com atendimento; senão o último.
export const defaultGiftDay = (days: { date: string }[], today: string) =>
  days.find((d) => d.date === today)?.date ?? days.find((d) => d.date > today)?.date ?? days[days.length - 1]?.date ?? null;

// Campanha que vale para a data de um agendamento (para o selo em Leads e Lembretes). A mais recente primeiro.
export const campaignForDate = <T extends Pick<GiftCampaign, "inicio" | "fim">>(campaigns: T[], date: string | undefined) =>
  campaigns.find((c) => inCampaign(c, date)) ?? null;
