# Auditoria de Segurança — Retoria

**Data:** 26/06/2026  
**Escopo:** Codebase Retoria (Next.js 16 + Firebase), ambiente local/emulador  
**Classificação:** Uso interno — não publicar publicamente  
**UID de administrador:** não documentado aqui — referenciado como `[ADMIN_UID_REDACTED]`

---

## Mapeamento canônico de IDs

Os IDs abaixo são fixos e nunca devem ser reutilizados para outro achado.

| ID | Achado |
|----|--------|
| SEC-001 | Endpoint `/api/test` acessível publicamente em produção |
| SEC-002 | Endpoint `/api/admin-check` expõe info de configuração em produção |
| SEC-003 | `[ADMIN_UID_REDACTED]` hardcoded em múltiplos arquivos fonte |
| SEC-004 | Documento `professionals/{uid}` com leitura pública irrestrita expõe campos privados |
| SEC-005 | `availableSlots` públicos expõem `bookingId` e `ocupacaoTipo` para visitantes |
| SEC-006 | Reagendamento sem transação atômica — slots não eram gerenciados |
| SEC-007 | Matriz de acesso para `team_member` não definida nas Rules |
| SEC-008 | OAuth `state` era UID simples sem nonce verificável — CSRF possível |
| SEC-009 | Merge de identidade de customers (`/api/customer/ensure`) sem controle |
| SEC-010 | Rate limiter em memória — ineficaz em serverless multi-instância |
| SEC-011 | Logs de erro podiam conter objetos completos com stack/dados sensíveis |
| SEC-012 | Leitura de todos os leads no navegador sem paginação ou filtro |
| SEC-013 | `console.log` na página pública expunha UID interno do profissional |
| SEC-014 | Handle do Instagram aceita qualquer string — sem validação de formato/comprimento |
| SEC-015 | Campo `plano` em `accessRequests` sem validação de enum nas Firestore Rules |
| SEC-016 | Headers HTTP de segurança ausentes (X-Frame-Options, COTO, etc.) |
| SEC-017 | `accountTypes` editável pelo cliente via client SDK |
| SEC-018 | Dependências — auditoria de vulnerabilidades não executada |
| SEC-019 | Race condition em token de ativação de licença — sem TTL ou idempotência garantida |

---

## Status consolidado

| ID | Descrição resumida | Prioridade | Status |
|----|--------------------|-----------|--------|
| SEC-001 | `/api/test` público | P0 | ✅ Corrigido |
| SEC-002 | `/api/admin-check` público | P0 | ✅ Corrigido |
| SEC-003 | ADMIN_UID hardcoded no código | P1 | ⚠️ Aberto |
| SEC-004 | `professionals` expõe campos privados anonimamente | P1 — BLOQUEADOR PILOT | ⚠️ Confirmado em emulador |
| SEC-005 | `availableSlots` expõe `bookingId` anonimamente | P1 — BLOQUEADOR PILOT | ⚠️ Confirmado em emulador |
| SEC-006 | Reagendamento sem transação | P0 | ✅ Corrigido |
| SEC-007 | Permissões de membros de equipe | P1 | ⚠️ Aberto |
| SEC-008 | OAuth CSRF | P0 | ✅ Corrigido |
| SEC-009 | Merge de identidade de customers | P2 | ⚠️ Aberto |
| SEC-010 | Rate limit em memória | P1 | ⚠️ Aceite temporário (ver BACKLOG) |
| SEC-011 | Logs sensíveis | P1 | ✅ Corrigido |
| SEC-012 | Leads sem paginação no navegador | P2 | ⚠️ Aberto |
| SEC-013 | UID exposto na página pública | P0 | ✅ Corrigido |
| SEC-014 | Instagram sem validação | P2 | ⚠️ Aberto (normalização existe, validação não) |
| SEC-015 | `plano` sem enum nas Rules | P1 | ✅ Corrigido |
| SEC-016 | Headers HTTP ausentes | P1 | ✅ Corrigido |
| SEC-017 | `accountTypes` editável | P2 | ⚠️ Documentado |
| SEC-018 | Dependências sem auditoria | P2 | ⚠️ Aberto |
| SEC-019 | Race condition em ativação | P1 | ⚠️ Aberto |

---

## Correções P0 aplicadas

### SEC-001 — `/api/test`

**Antes:** Qualquer visitante podia acionar o endpoint de integração em produção, criando e deletando documentos em `professionals/test_integration_professional`.

**Comportamento final:**

| Ambiente | Resultado |
|----------|-----------|
| Produção (Vercel) | 404 |
| Preview Vercel | 404 |
| Dev sem flag explícita | 404 |
| Dev com `INTEGRATION_TESTS_ENABLED=true` | Endpoint ativo |

**Correção em** [`src/app/api/test/route.ts`](../src/app/api/test/route.ts):
```typescript
if (process.env.INTEGRATION_TESTS_ENABLED !== "true") {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
```

### SEC-002 — `/api/admin-check`

**Antes:** Qualquer visitante recebia informações sobre quais variáveis de ambiente Firebase estão configuradas.

**Comportamento final:**

| Ambiente | Resultado |
|----------|-----------|
| Produção | 404 |
| Preview Vercel | 404 |
| Desenvolvimento local | Endpoint ativo (mínimo e seguro) |

**Correção em** [`src/app/api/admin-check/route.ts`](../src/app/api/admin-check/route.ts):
```typescript
if (process.env.NODE_ENV !== "development") {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
```

O endpoint de desenvolvimento retorna apenas status do SDK — sem nomes de variáveis, sem parsing de JSON, sem stack, sem detalhes de credenciais.

### SEC-006 — Reagendamento com transação atômica

**Antes:** O handler `PATCH /reschedule` chamava `leadRef.update(...)` diretamente sem tocar nos slots — os slots antigos permaneciam bloqueados com `bookingId` do lead; os novos slots não eram reservados.

**Transação real implementada — checklist funcional:**

| # | Etapa | Implementado |
|---|-------|-------------|
| 1 | Autenticação via Bearer token | ✅ |
| 2 | Validação de ownership (`callerUid !== professionalId`) | ✅ (antes da transação) |
| 3 | Lê lead atual dentro da transação | ✅ `tx.get(leadRef)` |
| 4 | Valida ownership do lead dentro da transação | ✅ `leadData.professionalId !== professionalId` |
| 5 | Lê `slotDuration` do profissional | ✅ `tx.get(profRef)` |
| 6 | Lê todos os slots antigos pelo `bookingId` | ✅ `tx.get(slotsRef.where("bookingId","==",leadId))` |
| 7 | Lê todos os slots do novo dia | ✅ `tx.get(slotsRef.where("data","==",dataEscolhida))` |
| 8 | Calcula slots que cobrem o intervalo solicitado | ✅ filtro por sobreposição + ordenação |
| 9 | Valida cobertura contínua sem lacunas | ✅ verifica `curEnd >= nextStart` entre consecutivos |
| 10 | Valida disponibilidade — exclui slots já deste lead | ✅ `oldSlotIds.has(s.id)` exclui da verificação |
| 11 | Impede uso de slot de outro booking | ✅ `!s.disponivel && !oldSlotIds.has(s.id)` → 409 |
| 12 | Libera slots antigos (`disponivel=true, bookingId=null`) | ✅ |
| 13 | Reserva slots novos (`disponivel=false, bookingId=leadId`) | ✅ |
| 14 | Atualiza o lead | ✅ |
| 15 | Atualiza índice do cliente (`customerAccounts/{uid}/bookings/{leadId}`) | ✅ se `customerUid` existir e índice existir |
| 16 | Preserva dados em falha (rollback integral da transação) | ✅ Firestore garante atomicidade |
| 17 | Impede dupla reserva | ✅ via verificação de disponibilidade dentro da transação |

**Limitação documentada:** Se o lead não tiver `customerUid` (agendamento anônimo sem conta), o índice do cliente não é atualizado — correto por design.

**Arquivo:** [`src/app/api/professionals/[professionalId]/leads/[leadId]/reschedule/route.ts`](../src/app/api/professionals/%5BprofessionalId%5D/leads/%5BleadId%5D/reschedule/route.ts)

### SEC-008 — OAuth CSRF

**Antes:** `state: professionalUid` — um UID estático que qualquer pessoa podia falsificar.

**Implementação do state verificável:**

| Aspecto | Detalhe |
|---------|---------|
| Geração do state | `randomBytes(24).toString("hex")` = 48 chars hex |
| Formato do state | `"{uid}:{nonce}"` |
| Armazenamento | Firestore: `professionals/{uid}/integrations/oauthPending` |
| Cookie | Não usado — nonce fica no servidor |
| TTL | 10 minutos |
| Vínculo com UID | UID está no `state` e o doc é armazenado sob `professionals/{uid}` |
| Vínculo com sessão | Não há sessão HTTP — o UID no `state` identifica o profissional |
| Validação no callback | Extrai `uid:nonce` do state → lê doc Firestore → verifica TTL → compara nonce |
| Consumo único | `pendingRef.delete()` imediatamente antes da troca do code |
| Proteção contra replay | Doc deletado após uso → segunda chamada encontra `!snap.exists` → redirect com `state_not_found` |
| Limpeza após sucesso | `pendingRef.delete()` sempre chamado antes de `getToken()` |
| Limpeza após falha de TTL | `pendingRef.delete()` no bloco de expiração |

**Limitação conhecida:** O callback não recebe um Bearer token do usuário (é um redirect do Google). O vínculo da identidade é feito pelo UID no `state`, que foi gerado no servidor durante `getAuthUrl()`. Isso é seguro porque o atacante não tem como saber o nonce armazenado no Firestore — não pode forjar um `state` válido sem acesso ao documento do profissional.

**Arquivos:** [`src/lib/googleCalendar.ts`](../src/lib/googleCalendar.ts), [`src/app/api/auth/google/callback/route.ts`](../src/app/api/auth/google/callback/route.ts)

### SEC-011 — Logs sanitizados

`customer/ensure/route.ts` e `invite/[token]/route.ts`: `console.error(e)` → `console.error(e?.code ?? e?.message ?? "unknown")`. Resposta 500 não retorna mais `e.message` ao cliente.

### SEC-013 — UID removido da página pública

`src/app/p/[slug]/page.tsx`: removido `console.log("PUBLIC PAGE LOADED PROFILE DATA:", { id, ... })`. O UID interno do profissional não aparece mais no DevTools de visitantes.

### SEC-015 — Validação de plano em accessRequests

Firestore Rules: adicionado `&& request.resource.data.plano in ['individual', 'professional', 'enterprise']`.

### SEC-016 — Headers HTTP

`next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.

---

## SEC-004 — Confirmação em emulador

**Teste executado em:** `npm run test:rules` (73/73 aprovados em 26/06/2026)

**Documento de teste criado com:**
```
nome, slugPublico, email, telefoneWhatsapp, plan, professionalStatus, trialEndsAt
```

**Resultado:** Visitante anônimo lê **todos os campos** — `assertSucceeds` confirmado.

### Campos classificados

**Públicos (necessários para a página de agendamento):**
- `nome`, `nomeNegocio`, `slugPublico`, `bio`, `descricaoCurta`
- `instagram`, `corPrincipal`, `themeConfig`
- `especialidade`, `fotoPerfil`, `enderecoPublico`

**Privados/administrativos (expostos sem necessidade):**
- `email` — e-mail de login
- `telefoneWhatsapp` — número privado
- `plan` — plano de licença
- `professionalStatus` — status administrativo
- `trialStartedAt`, `trialEndsAt` — datas de trial
- `licenseStatus`, `currentPeriodEnd` — dados de billing
- `agendaConfig` — configurações internas de agenda
- `role`, `parentProfessionalId` — estrutura interna de equipe
- `userId`, `id`, `createdAt`, `updatedAt`

**Avaliação:** SEC-004 permanece **ALTO** e **BLOQUEADOR DO PILOT** enquanto não for resolvido. Não é possível usar `select()` como controle de segurança no client SDK do Firestore.

### Alternativas de correção (não implementar nesta tarefa)

1. **Coleção `publicProfiles/{uid}`** — espelho com apenas os campos públicos, atualizado pelo Admin SDK a cada save do profissional. Requer migração e atualização da página pública para ler de `publicProfiles`.
2. **Endpoint server-side com DTO filtrado** — `GET /api/p/[slug]` retorna apenas campos autorizados. A página `p/[slug]/page.tsx` (Server Component) já roda no servidor — requer mover o fetch para um DTO explícito em vez de passar o doc completo via `providers`.
3. **Migração gradual** — adicionar campo `publicProfile: {}` no documento existente contendo apenas os campos públicos, e mudar a regra para `allow read: if true` somente nesse subcampo (não possível em Firestore por documento inteiro).

A opção 2 é a de menor impacto estrutural para o pilot: a página pública já é um Server Component e pode fazer DTO sem mudar o modelo de dados.

---

## SEC-005 — Confirmação em emulador

**Documento de teste criado com:**
```
data, horario, disponivel, bookingId: LEAD_ID, ocupacaoTipo
```

**Resultado:** Visitante anônimo lê o documento completo incluindo `bookingId` — `assertSucceeds` confirmado.

**Campos expostos:**
- `bookingId` — ID interno do lead (**identificador privado exposto**)
- `ocupacaoTipo` — "principal"/"continuacao" (metadado interno)
- `disponivel` — necessário (é o dado público de disponibilidade)
- `data`, `horario` — necessários

**Avaliação:** SEC-005 permanece **ALTO** e **BLOQUEADOR DO PILOT**. O `bookingId` não expõe PII diretamente, mas expõe IDs internos de leads que permitem correlação e enumeração.

### Solução mínima
Remover os campos `bookingId` e `ocupacaoTipo` do documento `availableSlots`. Esses campos existem para que o reschedule encontre os slots antigos. A busca por `where("bookingId","==",leadId)` pode ser substituída por um índice privado em `professionals/{uid}/bookingSlotIndex/{leadId}` com `slotIds: [...]`.

### Solução estrutural
Separar em dois documentos:
- `availableSlots/{slotId}` — apenas `{ data, horario, disponivel }` — público
- `occupancy/{bookingId}` — `{ slotIds: [...], leadId, customerUid }` — privado (`isProfessional()`)

A solução mínima pode ser implementada em 1 dia. A estrutural requer migração de dados.

---

## SEC-003 — ADMIN_UID hardcoded

`[ADMIN_UID_REDACTED]` está presente literalmente em 4 arquivos fonte:

- `src/app/api/access-requests/route.ts`
- `src/app/api/admin/me/route.ts`
- `src/app/api/admin/professionals/route.ts`
- `src/app/api/admin/license-tokens/route.ts`

**Impacto:** O UID do administrador estará visível no código publicado no GitHub (repositório público ou privado com acesso de colaboradores). Não é uma credencial de autenticação, mas expõe a identidade do administrador Firebase, facilitando ataques direcionados.

**Mitigação:** Mover para variável de ambiente `ADMIN_UIDS` e ler via `process.env.ADMIN_UIDS?.split(",") ?? []`. Requer configuração na Vercel e no `.env.local`.

---

## SEC-014 — Instagram sem validação

A função `cleanInstagramUsername()` em `src/lib/contactUtils.ts` faz **normalização** (strip de chars inválidos, extração de URL), mas **não valida**:

- Sem verificação de comprimento máximo (Instagram permite até 30 chars)
- Sem rejeição de handle inválido — qualquer string passa
- Sem mensagem de erro ao usuário para entradas inválidas
- O campo pode ser salvo vazio após strip (ex: input `"!!!!"` → `""` → salvo como `null`)

**Validação esperada:**
```
^[A-Za-z0-9._]{1,30}$
```
aplicada **após** `cleanInstagramUsername()` — rejeitar se o resultado não casar com a regex.

**Status:** Não implementado. Manter SEC-014 como aberto (P2).
