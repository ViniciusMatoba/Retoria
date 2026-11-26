// Novidades ligadas por conta (decisão do usuário em 25/11/2026, ver docs/ARCHITECTURE_DECISIONS.md ADR 5).
//
// Michele e Natália usam o mesmo sistema. Toda novidade de aparência ou de funcionamento feita para uma
// conta NÃO pode aparecer na outra sem autorização do usuário. Por isso cada novidade nova entra aqui com
// a lista de contas onde está ligada. Correções de erro e de segurança valem para todas (não entram aqui).
//
// Chave: uid da conta dona (professionals/{uid}); membros de equipe usam o uid do dono.

export type AccountFeature =
  | "servicosAdicionais" // serviços adicionais com janela na página pública (feito para a Natália, 25/11/2026)
  | "visualApp"; // página pública com cara de app: etapas numeradas, títulos grandes, tela de confirmação (Michele, 26/11/2026)

export const ACCOUNTS = {
  natalia: "BwnqYAIn5PPqmWAG7DIVcLTQGC63", // Natália Coelho Unhas (/p/natalia-coelho-unhas)
  michele: "MICHELE_UID_PENDENTE", // Michele (conta principal) — preencher com o uid real antes de publicar
} as const;

const ENABLED: Record<AccountFeature, string[]> = {
  servicosAdicionais: [ACCOUNTS.natalia],
  visualApp: [ACCOUNTS.michele],
};

export const hasFeature = (ownerId: string | null | undefined, feature: AccountFeature): boolean =>
  !!ownerId && ENABLED[feature].includes(ownerId);
