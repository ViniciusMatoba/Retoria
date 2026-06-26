# Plano de Testes de Segurança — Retoria

**Data:** 26/06/2026  
**Referência:** [SECURITY_AUDIT.md](SECURITY_AUDIT.md)

---

## Suite automatizada: `npm run test:rules`

**Resultado em 26/06/2026: 73/73 aprovados.**

### Testes originais (53 casos)

Cobrem: `accounts`, `customerAccounts`, `bookings` subcollection, `customers` subcollection, `usage`, `leads`, `professionals`, `services`, `availableSlots`, `licenses`, `licenseTokens`, `teamInvites`, `accessRequests`, Storage rules.

### Testes de segurança adicionados (20 novos casos)

| # | Cenário | Resultado esperado | Regra ou código protegido |
|---|---------|-------------------|--------------------------|
| 1 | SEC-004: visitante lê `professionals/{uid}` completo | assertSucceeds (**documenta risco aberto**) | `allow read: if true` — exposição confirmada |
| 2 | SEC-005: visitante lê slot com `bookingId` | assertSucceeds (**documenta risco aberto**) | `availableSlots` público — exposição confirmada |
| 3 | SEC-007: profissional B não lê leads do profissional A | assertFails | `isProfessional(profId)` |
| 4 | SEC-007: cliente não lê leads de profissional | assertFails | `isProfessional(profId)` |
| 5 | SEC-015: accessRequest com plano `"professional"` (válido) | assertSucceeds | `plano in [...]` |
| 6 | SEC-015: accessRequest com plano `"admin"` (inválido) | assertFails | `plano in [...]` |
| 7 | SEC-015: accessRequest com status `"attended"` (inválido) | assertFails | `status == "pending"` |
| 8 | SEC-015: ninguém atualiza `accessRequests` via client SDK | assertFails | `allow update: if false` |
| 9 | Licenças: ninguém lê `licenses/{uid}` via client SDK | assertFails | `allow read,write: if false` |
| 10 | Licenças: ninguém lê `licenseTokens/{id}` via client SDK | assertFails | `allow read,write: if false` |
| 11 | Licenças: ninguém lê `teamInvites/{id}` via client SDK | assertFails | `allow read,write: if false` |
| 12 | Licenças: ninguém escreve em `licenseTokens` via client SDK | assertFails | `allow read,write: if false` |
| 13 | Campos protegidos: profissional não altera `professionalStatus` (active→trial) | assertFails | `diff().affectedKeys().hasAny([...])` |
| 14 | Campos protegidos: profissional não altera `plan` | assertFails | idem |
| 15 | Campos protegidos: profissional não altera `trialEndsAt` | assertFails | idem |
| 16 | Campos protegidos: profissional não altera `id` | assertFails | idem |
| 17 | SEC-017: cliente pode alterar `accountTypes` no próprio account (**risco documentado**) | assertSucceeds | Regra atual permite — risco P2 aceito |
| 18 | SEC-017: cliente não altera `uid` no próprio account | assertFails | `request.resource.data.uid == resource.data.uid` |
| 19 | Isolamento: cliente A não lê `customerAccounts/{uid_B}` | assertFails | `isOwner(uid)` |
| 20 | Isolamento: cliente não acessa `bookings` de outro cliente | assertFails | `isOwner(uid)` |

### Cobertura por ID

| SEC | Cobertura nos testes de Rules |
|-----|------------------------------|
| SEC-001 | Não — é controle de API Route Handler, não de Firestore Rules |
| SEC-002 | Não — idem |
| SEC-003 | Não — é controle de variável de ambiente |
| SEC-004 | Teste #1 confirma exposição (assertSucceeds documenta o risco aberto) |
| SEC-005 | Teste #2 confirma exposição (assertSucceeds documenta o risco aberto) |
| SEC-006 | Não — é lógica de transação no Route Handler, requer teste de integração |
| SEC-007 | Testes #3 e #4 |
| SEC-008 | Não — é lógica OAuth no Route Handler |
| SEC-013 | Não — foi verificação manual de diff (console.log removido) |
| SEC-014 | Não — requer teste de formulário / validação de input |
| SEC-015 | Testes #5–#8 |
| SEC-016 | Não — verificar com `curl -I` no ambiente de staging |
| SEC-017 | Testes #17 e #18 |
| Storage | 10 testes nos 53 originais (upload JPEG/WebP/PNG, SVG bloqueado, >2MB bloqueado, outro user bloqueado) |

---

## Storage Rules — Status

**Testes automatizados existem** nos 53 casos originais e são executados via `npm run test:rules`.

Testes de Storage confirmados:

| Teste | Resultado |
|-------|-----------|
| Proprietário envia JPEG <2MB (`logos/`) | ✅ assertSucceeds |
| Leitura pública de logo | ✅ assertSucceeds |
| Proprietário envia SVG | ✅ assertFails |
| Proprietário envia >2MB | ✅ assertFails |
| Outro usuário envia em diretório alheio | ✅ assertFails |
| Visitante não autenticado envia | ✅ assertFails |
| Cover de serviço WebP <2MB | ✅ assertSucceeds |
| Cover >2MB | ✅ assertFails |
| Background PNG <3MB | ✅ assertSucceeds |
| Background >3MB | ✅ assertFails |

**Lacunas de Storage não testadas automaticamente:**

| Cenário | Status |
|---------|--------|
| Upload de `text/html` | Não testado |
| Upload de executável (`application/octet-stream`) | Não testado |
| Exclusão por outro usuário | Não testado |
| Sobrescrita por outro usuário | Não testado |
| Leitura direta de URL (sem `getDownloadURL`) | Não testado |

Esses cenários devem ser adicionados antes do lançamento público.

---

## Testes manuais (antes do pilot)

### Endpoints de diagnóstico
- [ ] `curl https://retoria.vercel.app/api/test` → deve retornar `{"error":"Not found."}` com status 404
- [ ] `curl https://retoria.vercel.app/api/admin-check` → deve retornar `{"error":"Not found."}` com status 404

### Headers de segurança
- [ ] `curl -I https://retoria.vercel.app/` → verificar `X-Frame-Options: SAMEORIGIN` e `X-Content-Type-Options: nosniff`

### Página pública
- [ ] Abrir `/p/{slug}`, inspecionar console do DevTools: nenhum UID nos logs

### OAuth Google Calendar
- [ ] Iniciar fluxo: verificar que URL do Google contém `state={uid}:{48hex}` (não apenas UID)
- [ ] Aguardar 10 min, tentar completar o fluxo: deve receber `google_error=state_expired`
- [ ] Completar fluxo válido, tentar reutilizar o mesmo link de callback: deve receber `google_error=state_not_found`

### Reagendamento
- [ ] Reagendar lead para novo horário: verificar que slots antigos ficam `disponivel: true` e novos ficam `disponivel: false` no Firestore
- [ ] Reagendar para horário já ocupado: deve retornar 409 com mensagem clara

### Autorização
- [ ] Chamar `PATCH /api/professionals/{id}/leads/{leadId}/reschedule` sem Bearer → 401
- [ ] Chamar com token de outro usuário → 403
