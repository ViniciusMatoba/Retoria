// Validação da alteração de cadastro de cliente (tela Clientes → Editar), usada pela rota do servidor.

export type CustomerEditResult =
  | { ok: true; telefoneAtual: string; nome: string; telefone: string }
  | { ok: false; error: string };

const onlyDigits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

export const validateCustomerEdit = (body: unknown): CustomerEditResult => {
  const b = (body ?? {}) as Record<string, unknown>;
  const telefoneAtual = onlyDigits(b.telefoneAtual);
  const telefone = onlyDigits(b.telefone);
  const nome = typeof b.nome === "string" ? b.nome.trim().replace(/\s+/g, " ") : "";

  if (telefoneAtual.length < 10 || telefoneAtual.length > 20) return { ok: false, error: "Cliente não identificado." };
  if (nome.length < 2 || nome.length > 80) return { ok: false, error: "O nome do cliente deve conter entre 2 e 80 caracteres." };
  if (telefone.length < 10 || telefone.length > 20) return { ok: false, error: "O telefone deve ter entre 10 e 20 dígitos (incluindo o DDD)." };
  return { ok: true, telefoneAtual, nome, telefone };
};
