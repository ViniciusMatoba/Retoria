// Nome completo = pelo menos duas palavras (nome + sobrenome), cada uma com 2+ letras.
const NAME_PART = /^[\p{L}][\p{L}'’.-]+$/u;

export const FULL_NAME_ERROR = "Informe seu nome completo (nome e sobrenome).";

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function isFullName(name: string): boolean {
  const parts = normalizeName(name).split(" ");
  return parts.length >= 2 && parts.every(p => NAME_PART.test(p));
}
