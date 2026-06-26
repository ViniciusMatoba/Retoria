# Backlog de Segurança — Retoria

**Data:** 26/06/2026  
**Referência:** [SECURITY_AUDIT.md](SECURITY_AUDIT.md)

> IDs são fixos. Nunca reutilizar um ID para outro achado.

---

## P0 — Bloqueadores de pilot (todos corrigidos)

| ID | Achado | Status |
|----|--------|--------|
| SEC-001 | `/api/test` público em produção | ✅ Corrigido |
| SEC-006 | Reagendamento sem transação atômica | ✅ Corrigido |
| SEC-008 | OAuth CSRF / vinculação indevida de Google | ✅ Corrigido |
| SEC-013 | UID exposto no console da página pública | ✅ Corrigido |
| SEC-002 | `/api/admin-check` público em produção | ✅ Corrigido |

---

## P1 — Bloqueadores de pilot (pendentes — decisão necessária antes do go)

### SEC-004: Campos privados em professionals expostos anonimamente

**Confirmado em emulador em 26/06/2026.**

Campos privados expostos anonimamente: `email`, `telefoneWhatsapp`, `plan`, `professionalStatus`, `trialEndsAt`, `licenseStatus`, `agendaConfig`, `role`, `parentProfessionalId`, `userId`, `id`, `createdAt`.

**Alternativas (ver SECURITY_AUDIT.md):**
1. Coleção `publicProfiles/{uid}` separada — maior esforço, mais clean
2. DTO server-side na página pública — menor esforço, recomendado para o pilot
3. Subcampo `publicProfile: {}` — não funciona com Firestore Rules por campo

**Solução recomendada para o pilot:** Opção 2 — o Server Component `p/[slug]/page.tsx` já roda no servidor; mover o fetch para um DTO explícito que projeta apenas os campos necessários.

**Esforço estimado:** 1 dia.

### SEC-005: `bookingId` exposto nos slots públicos

**Confirmado em emulador em 26/06/2026.**

**Solução mínima (recomendada para o pilot):** Remover `bookingId` e `ocupacaoTipo` do documento `availableSlots`. Substituir a query `where("bookingId","==",leadId)` por índice privado `professionals/{uid}/bookingSlotIndex/{leadId}` com campo `slotIds: string[]`.

**Impacto:** Requer atualizar `reschedule/route.ts` (leitura de índice) e `bookings/create/route.ts` (escrita de índice). O endpoint público de agendamento usa apenas `disponivel` — não quebra nada publicamente.

**Esforço estimado:** 1 dia.

### SEC-003: `[ADMIN_UID_REDACTED]` hardcoded em 4 arquivos

Presente literalmente em: `access-requests/route.ts`, `admin/me/route.ts`, `admin/professionals/route.ts`, `admin/license-tokens/route.ts`.

**Mitigação:** Variável de ambiente `ADMIN_UIDS` (comma-separated). Configurar na Vercel + `.env.local`.

**Esforço estimado:** 2 horas.

### SEC-010: Rate limiter em memória

`src/lib/rateLimit.ts` usa `Map` local. Em serverless (Vercel), cada instância tem estado separado — o rate limit pode ser contornado simplesmente roteando para outra instância.

**Aceite temporário para o pilot**, desde que:
- [ ] Rate limit atual esteja ativo (implementado em `bookings/create` e `access-requests`)
- [ ] Pilot seja restrito a 5 profissionais controlados
- [ ] Páginas não sejam divulgadas publicamente
- [ ] Logs do Vercel sejam monitorados
- [ ] Exista procedimento de bloqueio manual (remoção do deploy)
- [ ] O risco seja explicitamente aceito pelo responsável

**Solução definitiva:** Redis/Upstash ou Vercel KV como store compartilhado.

**Esforço estimado:** 4 horas + configuração de infraestrutura.

### SEC-011: Logs sensíveis

✅ Corrigido.

### SEC-015: `plano` sem enum nas Rules

✅ Corrigido.

### SEC-016: Headers HTTP

✅ Corrigido.

### SEC-019: Race condition em ativação de licença

O endpoint `/api/activate/[token]` usa o token de ativação como chave única, mas não há transação que garanta idempotência — duas requisições simultâneas com o mesmo token poderiam ambas passar pela verificação de `status !== "used"` antes que qualquer uma atualize o status.

**Mitigação:** Usar Firestore transaction no `/api/activate/[token]`: ler `status`, verificar, escrever atomicamente.

**Esforço estimado:** 2 horas.

---

## P1 — Antes de usuários reais (após pilot)

### SEC-007: Permissões de team_member

A regra atual permite `isProfessional(profId)` para todos os leads, independente de `permissions.canViewAllLeads`. A matriz de acesso para membros precisa ser definida e implementada antes do uso real de equipe.

**Esforço estimado:** 2-3 dias (definição de matriz + Rules + testes).

---

## P2 — Hardening futuro

### SEC-009: Merge de identidade de customers

`/api/customer/ensure` cria o documento `customerAccounts/{uid}` na primeira vez que um cliente autentica. Não há verificação de que um cliente existente com mesmo e-mail em outra plataforma está tentando mesclar identidades. Risco baixo enquanto só Firebase Auth é usado.

### SEC-012: Leads sem paginação no navegador

O dashboard carrega todos os leads do profissional no cliente. Para profissionais com muitos leads, isso representa performance e potencial de exposição de dados desnecessários no bundle. Solução: paginação + query filtrada por status/data.

### SEC-014: Instagram sem validação

A função `cleanInstagramUsername()` normaliza mas não valida. Após a normalização, adicionar:
```typescript
const INSTAGRAM_REGEX = /^[A-Za-z0-9._]{1,30}$/;
if (cleanInsta && !INSTAGRAM_REGEX.test(cleanInsta)) {
  // rejeitar com mensagem de erro
}
```
Em `dashboard/profile/page.tsx` antes de salvar, e nas Firestore Rules no update de `professionals`.

**Esforço estimado:** 2 horas.

### SEC-017: `accountTypes` editável pelo cliente

A regra atual permite que o usuário altere `accountTypes` — que é usado para navegação de UI, não para autorização. Risco baixo (não controla acesso real). Mover gestão de `accountTypes` para Admin SDK apenas.

### SEC-018: Dependências

`npm audit` não foi executado. Executar antes do lançamento público e resolver CVEs críticos e altos.

---

## Itens encerrados

- ~~SEC-001: `/api/test` público~~ ✅ 26/06/2026
- ~~SEC-002: `/api/admin-check` público~~ ✅ 26/06/2026
- ~~SEC-006: Reagendamento sem transação~~ ✅ 26/06/2026
- ~~SEC-008: OAuth CSRF~~ ✅ 26/06/2026
- ~~SEC-011: Logs sensíveis~~ ✅ 26/06/2026
- ~~SEC-013: UID na página pública~~ ✅ 26/06/2026
- ~~SEC-015: `plano` sem enum nas Rules~~ ✅ 26/06/2026
- ~~SEC-016: Headers HTTP ausentes~~ ✅ 26/06/2026
