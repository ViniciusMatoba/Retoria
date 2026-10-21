# Status do Projeto - Retoria

Este arquivo serve como referência rápida para o status atual e progresso do desenvolvimento do projeto Retoria. A fonte única de verdade detalhada de todo o projeto é o arquivo [docs/PROJECT_CONTROL.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md).

## Visão Geral das Fases

* **Fase 0A: Sistema Mínimo de Modais** ── **[CONCLUÍDO]**
* **Fase 0B: Temas Persistidos e Aplicados Publicamente** ── **[ENCERRADA COM RESTRIÇÕES]**
* **Fase 1: Aplicação Global dos Modais** ── **[PLANEJADO]**
* **Fase 2 a 12 (Organizações / Multi-Provider)** ── **[APENAS PLANEJAMENTO]**

---

## Resultados das Validações

* **Next.js Build**: **Aprovado** (`npm run build` executado com sucesso em 26/06/2026).
* **Testes de Temas**: **Aprovado** (`npm run test:themes` — 13/13).
* **Testes de Regras (Firebase)**: **Aprovado** (`npm run test:rules` — 81/81 em 21/10/2026; inclui testes de slotBookings e customerNotes). Mudanças de 21/10 estão commitadas localmente, sem push nem deploy; ver `docs/PROJECT_CONTROL.md` (F15–F18).
* **Deploy**: Aguardando revisão (nenhum deploy executado desde a auditoria de segurança).
* **Homologação pós-deploy**: **Não testada** (pendente de execução de jornadas críticas).
* **Gate Atual**: Gate A: GO | Gate B: **NO-GO** (Security Gate pendente)
* **Bloqueadores**:
  1. Homologação pós-deploy das jornadas críticas ainda não executada.
  2. **SEC-004**: `professionals` expõe campos privados (email, telefone, plan, status) para visitantes anônimos — confirmado em emulador. Requer correção ou aceite formal.
  3. **SEC-005**: `availableSlots` expõe `bookingId` para visitantes — confirmado em emulador. Requer correção ou aceite formal.

---

## Auditoria de Segurança AppSec (26/06/2026)

19 achados identificados (SEC-001 a SEC-019). 8 corrigidos (todos os P0 + P1 aplicáveis). 2 bloqueadores de pilot abertos (SEC-004, SEC-005). Ver `docs/SECURITY_AUDIT.md` e `docs/SECURITY_BACKLOG.md`.

---

## Próximos Passos Obrigatórios
1. Decidir sobre SEC-004 e SEC-005: corrigir (ver alternativas no SECURITY_AUDIT.md) ou aceitar formalmente com justificativa documentada no RELEASE_GATES.md.
2. Executar homologação pós-deploy controlada do MVP Individual e registrar evidências no [docs/PROJECT_CONTROL.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md).
3. Somente após os itens acima: atualizar Security Gate para GO e fazer deploy.

Para documentações completas e detalhadas, acesse a pasta [/docs](file:///C:/Users/Usuario/Desktop/Retoria/docs/README.md).
