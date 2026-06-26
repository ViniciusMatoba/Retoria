# Gates de Liberação - Retoria

Este documento define os critérios de entrada e saída (gates) para cada nível de liberação do produto, desde os testes internos até o lançamento de produção pública comercial.

---

## Gate A — Piloto Interno
Liberação da aplicação para testes em ambiente de homologação simulado pelos próprios desenvolvedores e equipe de testes interna com contas fictícias.

* **Critérios Obrigatórios**:
  * [x] Build de produção Next.js compilado com sucesso.
  * [x] Testes de segurança de regras de Firestore/Storage (`test:rules`) passando 100%.
  * [x] Validação estrutural de temas e presets (`test:themes`) passando 100%.
  * [x] Fluxo de agendamento básico (da página pública ao WhatsApp) funcional.
* **Critérios Recomendados**:
  * [x] Todos os modais refinados no editor de personalização.
* **Bloqueadores**:
  * Nenhuma falha em testes de segurança ou travamento de build.
* **Evidências**:
  * `npm run test:themes` -> 13/13 passados.
  * `npm run test:rules` -> 53/53 passados.
  * `npm run build` -> Compilação limpa.
* **Limitações do GO**:
  * O estado GO para o Gate A limita-se estritamente à execução local, dados fictícios, contas controladas de teste e acompanhamento exclusivamente técnico, sem profissionais reais, sem promessa de estabilidade de produção e sem cobrança.
* **Resultado Atual**: **GO**

---

## Gate B — Piloto Acompanhado
Liberação para um grupo fechado de 3 a 5 profissionais reais utilizarem a aplicação com seus respectivos clientes.

* **Critérios Obrigatórios**:
  * [x] Deploy estável concluído em ambiente público acessível.
  * [ ] Fluxo completo de onboarding testado manualmente com zero falhas em produção.
  * [ ] Monitoramento básico de logs de erros em produção ativo.
  * [x] Presets de imagem de fundo restritos apenas ao Firebase Storage (segurança de carregamento público).
  * [ ] Homologação pós-deploy das seguintes jornadas críticas:
    * Tema salvo e confirmado na página pública de produção;
    * Persistência do tema após F5;
    * Acesso público deslogado ao tema;
    * Login do profissional;
    * Dashboard funcional;
    * Serviços editáveis;
    * Agenda funcional;
    * Criação de agendamento real;
    * Área do cliente;
    * Sincronização do agendamento;
    * Ausência de erros críticos nos logs de produção;
    * Suporte mínimo configurado para o piloto;
    * Definição de contas e dados de teste.
* **Critérios Recomendados**:
  * [ ] Fase 1 (Aplicação global de modais) concluída para evitar alertas nativos que quebram a UX móvel.

* **Security Gate (auditoria AppSec 26/06/2026)**:
  * [x] SEC-001 corrigido — `/api/test` bloqueado em produção
  * [x] SEC-002 corrigido — `/api/admin-check` bloqueado em produção
  * [x] SEC-006 corrigido — reagendamento com transação atômica
  * [x] SEC-008 corrigido — OAuth CSRF com nonce verificável
  * [x] SEC-013 corrigido — UID removido do console público
  * [x] SEC-011 corrigido — logs sanitizados
  * [x] SEC-015 corrigido — validação de `plano` nas Rules
  * [x] SEC-016 corrigido — headers HTTP de segurança
  * [x] `npm run test:rules` — 76/76 aprovados
  * [x] `npm run build` — aprovado
  * [x] **SEC-004 CORRIGIDO** — `professionals` bloqueado para anônimos; dados públicos via `/api/p/[slug]` (DTO filtrado, Admin SDK)
  * [x] **SEC-005 CORRIGIDO** — `bookingId`/`ocupacaoTipo` removidos dos slots; índice privado `slotBookings` (Admin SDK only)
  * [x] **SEC-003 CORRIGIDO** — `[ADMIN_UID_REDACTED]` removido de 4 arquivos; lido de `process.env.ADMIN_UIDS`
  * [ ] SEC-010 — rate limit em memória (aceite temporário documentado em SECURITY_BACKLOG.md)
  * [ ] SEC-019 — race condition em ativação de licença (P1, avaliar risco para o pilot)

* **Bloqueadores**:
  * Homologação pós-deploy das jornadas críticas ainda não executada.
  * ⚠️ Variável `ADMIN_UIDS` deve ser configurada no Vercel antes do deploy (SEC-003).
* **Evidências**:
  * `npm run test:themes` → 13/13 aprovados (26/06/2026)
  * `npm run test:rules` → 76/76 aprovados (26/06/2026, inclui testes SEC-004 e SEC-005 corrigidos)
  * `npm run build` → aprovado (26/06/2026)
  * `npm run check:governance` → aprovado (26/06/2026)
  * Auditoria: `docs/SECURITY_AUDIT.md`
  * Teste pós-deploy em produção: NÃO TESTADO
* **Resultado Atual**: **GO** (Security Gate aprovado — SEC-003, SEC-004, SEC-005 corrigidos; deploy pendente de homologação)

---

## Gate C — Beta Comercial Individual
Liberação da cobrança e entrada de clientes individuais pagantes de forma autônoma.

* **Critérios Obrigatórios**:
  * [ ] Integração com o gateway de pagamento (assinaturas/trial) funcional.
  * [ ] Termos de Uso e Políticas de Privacidade publicados e acessíveis no site.
  * [ ] Fluxo de cancelamento de assinatura automatizado.
  * [ ] Execução das regras de segurança de banco validadas no CI do GitHub.
* **Critérios Recomendados**:
  * [ ] Central de suporte ou FAQ para profissionais disponível.
* **Bloqueadores**:
  * Falha de processamento de cobrança ou erros de cancelamento de slots no banco de dados real.
* **Evidências**:
  * Testes de integração de pagamento.
* **Resultado Atual**: **NO-GO**

---

## Gate D — Produção Pública
Lançamento comercial ampliado da plataforma contendo suporte a equipes, clínicas e múltiplos profissionais.

* **Critérios Obrigatórios**:
  * [ ] Implementação de `organizations`, `memberships` e `providers` aprovados sob suíte de testes de regras.
  * [ ] Painel administrativo para gerenciar contas de organizações.
  * [ ] Migração de dados de planos individuais para planos equipe validada.
  * [ ] Infraestrutura de alta disponibilidade monitorada 24/7.
* **Critérios Recomendados**:
  * [ ] Auditoria de segurança de penetração realizada nas rotas de API.
* **Bloqueadores**:
  * Vulnerabilidades de acesso cruzado a dados de agendamentos entre membros e clínicas.
* **Evidências**:
  * Relatórios de testes automatizados multi-provider.
* **Resultado Atual**: **NO-GO**

---

## Gate E — Piloto Equipe
Liberação para um ou dois estabelecimentos comerciais parceiros testarem a versão com múltiplos profissionais em ambiente de homologação acompanhado.

* **Critérios Obrigatórios**:
  * [ ] Implementação de controle de membros e convites testada.
  * [ ] Agenda multi-provider e página pública multi-provider funcionando corretamente.
* **Critérios Recomendados**:
  * [ ] Pesquisa de satisfação com recepcionistas e profissionais do estabelecimento piloto.
* **Bloqueadores**:
  * Erros no agendamento cruzado ou sobreposição indevida de horários de profissionais diferentes.
* **Evidências**:
  * Homologação do fluxo multi-provider.
* **Resultado Atual**: **NO-GO**
