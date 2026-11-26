// Selo "Mais pedido" na página pública: o serviço com mais agendamentos nos últimos 90 dias.
// Função pura, testada em scripts/test-popular-service.ts.

export const POPULAR_WINDOW_DAYS = 90;
const MIN_BOOKINGS = 3; // com poucos agendamentos o selo não faz sentido
const IGNORED = ["Cancelado", "Perdido", "Não compareceu"];

export interface PopularLead {
  status?: string;
  dataEscolhida?: string;
  serviceId?: string;
  servicos?: { id?: string }[];
}

// Id do serviço mais pedido desde `since` (YYYY-MM-DD), ou null se não houver um claro vencedor.
export const mostRequestedService = (leads: PopularLead[], since: string): string | null => {
  const counts = new Map<string, number>();
  leads.forEach((l) => {
    if (IGNORED.includes(l.status ?? "") || !l.dataEscolhida || l.dataEscolhida < since) return;
    const ids = (l.servicos ?? []).map((s) => s?.id).filter((x): x is string => !!x);
    const unique = new Set(ids.length ? ids : l.serviceId ? [l.serviceId] : []);
    unique.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  });
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || ranked[0][1] < MIN_BOOKINGS) return null;
  if (ranked.length > 1 && ranked[1][1] === ranked[0][1]) return null; // empate: nenhum selo
  return ranked[0][0];
};
