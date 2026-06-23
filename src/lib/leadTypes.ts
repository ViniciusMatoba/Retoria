/**
 * Fonte única para status de leads e formato do índice do cliente.
 *
 * Arquitetura:
 *   professionals/{professionalId}/leads/{leadId}  ← FONTE PRINCIPAL (única fonte de verdade)
 *   customerAccounts/{customerUid}/bookings/{leadId} ← ÍNDICE RESUMIDO (somente leitura do cliente)
 *
 * Sincronização:
 *   Toda alteração de status DEVE passar pelo endpoint PATCH
 *   /api/professionals/[professionalId]/leads/[leadId]/status
 *   que atualiza ambos os documentos na mesma transação.
 *
 * Operações ainda não implementadas (futuro):
 *   - Reagendamento completo (data/hora/serviço)
 *   - Cancelamento com liberação de slots
 *   - Vinculação retroativa de leads anônimos a contas
 */

// ─── Status canônico ──────────────────────────────────────────────────────────

export const LEAD_STATUSES = [
  "Novo",
  "Em contato",
  "Agendado",
  "Atendido",
  "Cancelado",
  "Perdido",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function isValidLeadStatus(value: unknown): value is LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus);
}

// ─── Estilo de badge por status (usado no dashboard e na área do cliente) ────

export const LEAD_STATUS_STYLES: Record<
  LeadStatus,
  { label: string; classes: string; dashboardClasses: string }
> = {
  Novo: {
    label: "Novo",
    classes: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
    dashboardClasses: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  "Em contato": {
    label: "Em contato",
    classes: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
    dashboardClasses: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  Agendado: {
    label: "Confirmado",
    classes: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    dashboardClasses: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  Atendido: {
    label: "Concluído",
    classes: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    dashboardClasses: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  Cancelado: {
    label: "Cancelado",
    classes: "bg-red-500/15 text-red-400 border-red-500/20",
    dashboardClasses: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  Perdido: {
    label: "Não realizado",
    classes: "bg-orange-500/15 text-orange-300 border-orange-500/20",
    dashboardClasses: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
};

// ─── Schema do índice resumido do cliente ─────────────────────────────────────

export interface CustomerBookingIndexData {
  bookingId: string;
  professionalId: string;
  professionalName: string;
  professionalSlug: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: LeadStatus;
  sourcePath: string;
  createdAt: unknown;
  updatedAt: unknown;
}

/**
 * Monta os dados do índice do cliente a partir dos dados do lead.
 * Garante que nenhum campo privado (observação, telefone, tags) seja incluído.
 * Usada tanto na criação quanto na sincronização de status.
 */
export function buildCustomerBookingIndex(params: {
  bookingId: string;
  professionalId: string;
  professionalName: string;
  professionalSlug: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: LeadStatus;
  createdAt?: unknown;
  updatedAt: unknown;
}): CustomerBookingIndexData {
  return {
    bookingId: params.bookingId,
    professionalId: params.professionalId,
    professionalName: params.professionalName,
    professionalSlug: params.professionalSlug,
    serviceName: params.serviceName,
    date: params.date,
    startTime: params.startTime,
    endTime: params.endTime,
    status: params.status,
    sourcePath: `professionals/${params.professionalId}/leads/${params.bookingId}`,
    createdAt: params.createdAt ?? params.updatedAt,
    updatedAt: params.updatedAt,
  };
}
