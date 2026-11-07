// Atualiza o valor de agendamentos para o preço atual dos serviços (Faturamento → "Atualizar valores").
// Função pura usada pela rota /api/professionals/[id]/reprice-leads; testada em scripts/test-repricing.ts.

export interface ServicePrice {
  nome?: string;
  preco?: number | null;
}

export interface LeadServiceItem {
  id?: string;
  nome?: string;
  preco?: number | null;
  [key: string]: unknown;
}

export interface RepriceLead {
  serviceId?: string;
  servicoEscolhido?: string;
  servicos?: LeadServiceItem[];
  valorTotal?: number;
}

export interface RepriceResult {
  servicos: LeadServiceItem[];
  valorTotal: number;
  changed: boolean;
}

const validPrice = (p: unknown): p is number => typeof p === "number" && Number.isFinite(p) && p >= 0;
const round2 = (v: number) => Math.round(v * 100) / 100;

// Recalcula os serviços e o total do agendamento com os preços atuais. Serviço apagado ou sem preço
// mantém o preço que estava no agendamento. Retorna null quando não há como calcular (sem serviço conhecido).
export const repriceLead = (lead: RepriceLead, services: Map<string, ServicePrice>): RepriceResult | null => {
  let items: LeadServiceItem[];
  if (Array.isArray(lead.servicos) && lead.servicos.length > 0) {
    items = lead.servicos.map((s) => {
      const current = s.id ? services.get(s.id) : undefined;
      return current && validPrice(current.preco) ? { ...s, preco: current.preco } : { ...s };
    });
  } else if (lead.serviceId && services.has(lead.serviceId) && validPrice(services.get(lead.serviceId)!.preco)) {
    const svc = services.get(lead.serviceId)!;
    items = [{ id: lead.serviceId, nome: svc.nome ?? lead.servicoEscolhido ?? "", preco: svc.preco }];
  } else {
    return null;
  }

  if (!items.some((s) => validPrice(s.preco))) return null;
  const valorTotal = round2(items.reduce((sum, s) => sum + (validPrice(s.preco) ? s.preco : 0), 0));
  const old = typeof lead.valorTotal === "number" ? round2(lead.valorTotal) : null;
  return { servicos: items, valorTotal, changed: old !== valorTotal };
};
