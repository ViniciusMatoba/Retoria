// Lista do preenchimento automático (nome/telefone) do agendamento manual.
// Junta os clientes cadastrados com os agendamentos já feitos, para incluir clientes de
// agendamentos manuais antigos, que não eram gravados em `customers`.

export interface CustomerSuggestion {
  nome: string;
  telefone: string; // só dígitos
}

export const mergeCustomerSuggestions = (
  customers: CustomerSuggestion[],
  leads: { nome?: unknown; telefone?: unknown }[]
): CustomerSuggestion[] => {
  const byPhone = new Map<string, CustomerSuggestion>();
  for (const c of customers) {
    const telefone = String(c.telefone ?? "").replace(/\D/g, "");
    const nome = String(c.nome ?? "").trim();
    if (nome && telefone) byPhone.set(telefone, { nome, telefone });
  }
  for (const l of leads) {
    const telefone = String(l.telefone ?? "").replace(/\D/g, "");
    const nome = String(l.nome ?? "").trim();
    if (nome && telefone && !byPhone.has(telefone)) byPhone.set(telefone, { nome, telefone });
  }
  return [...byPhone.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};
