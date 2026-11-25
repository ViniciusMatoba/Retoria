// Serviços adicionais (ex.: Francesinha, Pó cromado): são serviços comuns marcados com
// `adicional: true`. Não aparecem na lista principal da página pública; são oferecidos numa
// janela quando a cliente escolhe um serviço principal que os lista em `adicionaisIds`.

export interface AddonAwareService {
  id: string;
  ativo?: boolean;
  adicional?: boolean;
  adicionaisIds?: string[] | null;
}

export const isAddon = (s: AddonAwareService): boolean => s.adicional === true;

/** Serviços que aparecem na lista principal (tudo que não é adicional). */
export function mainServices<T extends AddonAwareService>(services: T[]): T[] {
  return services.filter((s) => !isAddon(s));
}

/** Adicionais ativos oferecidos com o serviço principal, na ordem da lista de serviços. */
export function addonsFor<T extends AddonAwareService>(main: AddonAwareService, services: T[]): T[] {
  const ids = new Set(main.adicionaisIds ?? []);
  if (ids.size === 0 || isAddon(main)) return [];
  return services.filter((s) => ids.has(s.id) && isAddon(s) && s.ativo !== false);
}

/**
 * Aplica a escolha feita na janela de adicionais de um serviço principal:
 * garante o principal na seleção, inclui os adicionais escolhidos e tira os
 * adicionais desse principal que a cliente desmarcou.
 */
export function applyAddonChoice<T extends AddonAwareService>(
  selected: T[],
  main: T,
  chosenIds: string[],
  services: T[],
): T[] {
  const offered = addonsFor(main, services);
  const chosen = new Set(chosenIds.filter((id) => offered.some((a) => a.id === id)));
  const offeredIds = new Set(offered.map((a) => a.id));
  const next = selected.filter((s) => !offeredIds.has(s.id) || chosen.has(s.id));
  if (!next.some((s) => s.id === main.id)) next.push(main);
  for (const a of offered) {
    if (chosen.has(a.id) && !next.some((s) => s.id === a.id)) next.push(a);
  }
  return next;
}

/**
 * Tira um serviço principal da seleção junto com os adicionais que só ele oferecia
 * (adicionais ainda oferecidos por outro principal escolhido continuam).
 */
export function removeMainService<T extends AddonAwareService>(selected: T[], mainId: string, services: T[]): T[] {
  const rest = selected.filter((s) => s.id !== mainId);
  const stillOffered = new Set(
    rest.filter((s) => !isAddon(s)).flatMap((m) => addonsFor(m, services).map((a) => a.id)),
  );
  return rest.filter((s) => !isAddon(s) || stillOffered.has(s.id));
}

/** Adicionais escolhidos que pertencem a este serviço principal. */
export function selectedAddonsOf<T extends AddonAwareService>(main: AddonAwareService, selected: T[], services: T[]): T[] {
  const offered = new Set(addonsFor(main, services).map((a) => a.id));
  return selected.filter((s) => offered.has(s.id));
}

/** Um agendamento precisa ter ao menos um serviço principal (só adicionais não vale). */
export const hasMainService = (selected: AddonAwareService[]): boolean => selected.some((s) => !isAddon(s));

/** Limpa a lista de adicionais gravada num serviço principal (sem repetidos, só ids válidos). */
export function sanitizeAddonIds(ids: unknown, ownId: string, max = 20): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !id.trim() || id === ownId || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
