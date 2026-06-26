# Plano de Resposta a Incidentes — Retoria

**Data:** 26/06/2026  
**Fase:** Pilot (5 usuários controlados)

---

## Classificação de Incidentes

| Nível | Descrição | Tempo de resposta |
|-------|-----------|------------------|
| P0 — Crítico | Vazamento de dados, acesso não autorizado, sistema indisponível | Imediato (< 1h) |
| P1 — Alto | Funcionalidade crítica quebrada, dados incorretos | < 4h |
| P2 — Médio | Funcionalidade degradada, erro não crítico | < 24h |
| P3 — Baixo | Bug cosmético, performance | Próximo sprint |

---

## Contatos

- **Responsável técnico:** Contato interno (não documentar publicamente)
- **Firebase Support:** console.firebase.google.com → Suporte
- **Vercel Support:** vercel.com/support

---

## Playbooks

### Vazamento de dados (P0)

1. **Isolar**: Desabilitar o endpoint afetado (`return NextResponse.json({ error: "Manutenção." }, { status: 503 })`)
2. **Avaliar**: Quais dados foram expostos? Por quanto tempo? Quantos usuários afetados?
3. **Conter**: Se via Firestore Rules — deploy imediato de regra corrigida (`firebase deploy --only firestore:rules`)
4. **Notificar**: Avisar usuários afetados do pilot por WhatsApp/email dentro de 24h
5. **Documentar**: Registrar timeline, causa raiz e correção
6. **LGPD**: Se dados pessoais de clientes vazaram, avaliar obrigação de notificação à ANPD

### Acesso não autorizado detectado

1. **Revogar**: Se via token comprometido, usar Firebase Admin para revogar tokens do usuário afetado:
   ```
   authAdmin.revokeRefreshTokens(uid)
   ```
2. **Auditar**: Verificar Firestore logs de acesso para o período suspeito
3. **Corrigir**: Identificar e corrigir a vulnerabilidade explorada
4. **Redeploy**: Deploy imediato da correção

### Sistema indisponível

1. **Verificar**: Logs do Vercel (vercel.com → projeto → Deployments → Functions)
2. **Rollback**: Se o deploy atual causou o problema:
   ```
   npx vercel rollback --project retoria
   ```
3. **Firebase**: Verificar status em status.firebase.google.com

---

## Após o Incidente

- Registrar no `docs/SECURITY_AUDIT.md` como achado adicional
- Adicionar teste de regressão em `scripts/test-rules.mjs`
- Atualizar `docs/SECURITY_BACKLOG.md` se houver follow-up necessário
- Atualizar `PROJECT_STATUS.md` com a data do incidente e resolução

---

## Observações para o Pilot

Durante o pilot com 5 usuários, qualquer anomalia deve ser reportada diretamente pelo WhatsApp do profissional. Não há SLA formal — o objetivo é detectar problemas antes do lançamento real.
