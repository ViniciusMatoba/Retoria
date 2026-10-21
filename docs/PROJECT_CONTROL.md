# Controle do Projeto - Retoria

Este documento é a fonte única de verdade para governança, acompanhamento e atualização do roadmap do projeto Retoria.

## Status Resumido do Projeto
* **Fase Atual**: Fase 0B encerrada com restrições (aplicação publicada, mas não homologada funcionalmente; teste real com conta autorizada não executado; comportamento deslogado não validado; logs de produção não revisados).
* **Marco Ativo**: **M0 — Estabilização da base** (Estado: Testado. Observação: Deploy concluído, teste pós-deploy ainda pendente).
* **Próxima Tarefa**: Executar homologação pós-deploy controlada do MVP Individual e registrar evidências no PROJECT_CONTROL.md.

---

## Escopo do Produto

### MVP Individual (Escopo Atual)
Focado no profissional autônomo individual que atende clientes de forma direta.
* Autenticação Dual-Auth (Portal Central, Área do Cliente e Painel do Profissional).
* Onboarding do profissional.
* Cadastro de Serviços do Profissional.
* Gerenciador de Horários (Disponibilização e Slots de Agenda).
* Página Pública de Agendamento (`/p/[slug]`) com fluxo de coleta de dados de contato e reserva de slots.
* Redirecionamento formatado para o WhatsApp com resumo do agendamento.
* Personalização de Temas (Presets, Cores, Fontes e Fundos seguros) e Preview Dinâmico.
* Sistema de Modais Acessíveis (`useAppModal`).

### Versão Equipe (Planejamento Futuro)
Suporte a clínicas, consultórios e salões com múltiplos profissionais integrados.
* Organizações (`organizations`) e Associação de profissionais (`memberships`).
* Gerenciamento de múltiplos provedores de serviço (`providers`).
* Convites para novos membros da equipe.
* Agenda multi-provider unificada e página pública multi-provider.
* Migração automatizada de contas individuais para organizações.

---

## Matriz Central de Funcionalidades

| ID | Área | Funcionalidade | Estado | Código | Testes | Homologação | Produção | Evidência | Bloqueador | Próxima ação |
| -- | ---- | -------------- | ------ | ------ | ------ | ----------- | -------- | --------- | ---------- | ------------ |
| F01 | Autenticação | Login profissional e cliente | Testado | Sim | Sim | Sim | Sim | `src/app/login/page.tsx`, `src/app/providers.tsx` | Nenhum | Manter e monitorar |
| F02 | Dual-Auth | Portais separados prof/cliente | Testado | Sim | Sim | Sim | Sim | `src/app/portal/page.tsx`, `scripts/test-rules.mjs` | Nenhum | Manter |
| F03 | Perfil | Dados do profissional e slug | Testado | Sim | Sim | Sim | Sim | `src/app/dashboard/profile/page.tsx` | Nenhum | Manter |
| F04 | Onboarding | Fluxo inicial profissional | Implementado | Sim | Não | Sim | Sim | `src/app/professional/onboarding/page.tsx` | Nenhum | Criar testes de fluxo |
| F05 | Serviços | CRUD de serviços ativos | Testado | Sim | Sim | Sim | Sim | `src/app/dashboard/services/page.tsx` | Nenhum | Manter |
| F06 | Slots | Geração e visualização de slots | Testado | Sim | Sim | Sim | Sim | `src/app/dashboard/slots/page.tsx` | Nenhum | Manter |
| F07 | Página Pública | Agendamento `/p/[slug]` | Testado | Sim | Sim | Sim | Sim | `src/app/p/[slug]/page.tsx`, `PublicBookingExperience.tsx` | Nenhum | Manter |
| F08 | WhatsApp | Links formatados de contato | Testado | Sim | Sim | Sim | Sim | `src/lib/whatsapp.ts`, `PublicBookingExperience.tsx` | Nenhum | Manter |
| F09 | Temas | Presets visuais e customização | Testado | Implementado | 13/13 aprovados | Não testada | Sim | `src/lib/themePresetCatalog.ts`, `scripts/test-themes.ts`, `npm run test:themes — 13/13` | Nenhum | Homologação pós-deploy |
| F10 | Modais | Sistema de modais `useAppModal` | Testado | Implementado | Revisão manual local | Não testada | Sim | `src/components/ModalProvider.tsx`, `revisão de acessibilidade local` | Nenhum | Homologação pós-deploy |
| F11 | Firestore Rules | Segurança do Firestore | Testado | Sim | 53/53 aprovados | Sim | Sim | `firestore.rules`, `npm run test:rules — 53/53 com Microsoft OpenJDK 21.0.11` | Nenhum | Manter |
| F12 | Storage Rules | Segurança do Storage | Testado | Sim | Sim | Sim | Sim | `storage.rules`, `scripts/test-rules.mjs` | Nenhum | Manter |
| F13 | Deploy | Deploy automático | Implementado | Sim | `npm run build` | Não testada | Publicado | Vercel Git integration, commit `b2aea7e` | Nenhum | Homologação pós-deploy |
| F15 | Agenda | Edição e criação manual de agendamento via Admin SDK (slotBookings, valorTotal) | Implementado | Sim | Build; sem teste automatizado das rotas | Não testada | Não | `leads/route.ts`, `leads/[leadId]/edit/route.ts`, commit `99bcaeb` | Deploy + teste manual | Homologar editar/criar no painel |
| F16 | Agenda | Lixeira cancela e libera horário; reativação direta de Cancelado/Perdido bloqueada | Implementado | Sim | Build | Não testada | Não | `dashboard/page.tsx`, `status/route.ts`, commit `2369dd8` | Deploy + teste manual | Homologar |
| F17 | Agenda | Bloquear/reativar horário livre (campo `bloqueadoManual`) | Implementado | Sim | Build | Não testada | Não | `dashboard/slots/page.tsx`, commit `f597dca` | Deploy + teste manual | Homologar |
| F18 | Clientes | Notas privadas do cliente (`customerNotes`) | Testado (regras) / Implementado (UI) | Sim | `test:rules` 81/81 | Não testada | Não | `firestore.rules`, `clientes/page.tsx`, commit `a78228a` | Deploy das regras do Firestore | Publicar regras e homologar |
| F19 | Agenda | Ações no cartão (status, Conversar, Reagendar, Cancelar) e Mover por toque/arrastar na visão diária | Implementado | Sim | Build | Não testada | Não | `LeadCardActions.tsx`, `dashboard/slots/page.tsx`, commit `75826cb` | Teste manual (arrastar só funciona com mouse; no celular usar Mover) | Homologar |
| F20 | Agenda | Aba Agenda Atual primeiro/padrão; métricas e card Google no fim; aviso de reconexão no topo | Implementado | Sim | Build | Não testada | Não | `dashboard/slots/page.tsx`, commit `75826cb` | Teste manual | Homologar |
| F21 | Página Pública | Data desejada na mensagem de "Pedir outras opções de horário" | Implementado | Sim | Build | Não testada | Não | `PublicBookingExperience.tsx`, commit `d13e7cc` | Teste manual | Homologar |
| F22 | Financeiro | Preenchimento de valorTotal em agendamentos antigos (rota backfill-values) | Implementado | Sim | Build | Não testada | Não | `backfill-values/route.ts`, commit `aad1c9c` | Teste manual; usa preço atual do serviço | Homologar |
| F14 | Organizações | Controle multi-provider/equipes | Planejado | Não | Não | Não | Não | Roadmap apenas | Suspenso | Não implementar nesta etapa |

---

## Marcos do Produto

| Marco | Estado | Critérios de Entrada | Critérios de Saída | Bloqueadores | Evidências |
| ----- | ------ | -------------------- | ------------------ | ------------ | ---------- |
| **M0 — Estabilização** | Testado | Temas e modais base integrados | Build Next.js com sucesso, testes de temas e regras passando, modais refinados | Deploy concluído, teste pós-deploy ainda pendente | Commit `b2aea7e`, build limpo, `test:rules` passing |
| **M1 — MVP Individual**| Em desenvolvimento | Estabilização (M0) concluída | Todas as áreas individuais homologadas e sem pendências visuais ou de segurança | Homologação pós-deploy pendente | Rota `/dashboard/personalization` e `/p/[slug]` ativas |
| **M2 — Piloto Interno** | Não iniciado | MVP Individual (M1) concluído | Gate A (Piloto Interno) aprovado com zero erros críticos em teste de simulação | M1 não concluído | Checklist Gate A |
| **M3 — Piloto Acompanhado**| Não iniciado | Piloto Interno (M2) concluído | 3 a 5 profissionais reais rodando por 15 dias sem bugs de agendamento | M2 não concluído | Relatório do piloto |
| **M4 — Beta Individual** | Não iniciado | Piloto Acompanhado (M3) concluído | Liberação da cobrança individual integrada e primeiros assinantes pagantes | M3 não concluído | Integração gateway |
| **M5 — Organizações** | Planejado | Sucesso do MVP Individual | Arquitetura multi-provider documentada e schemas de dados aprovados | M4 não concluído | Documentos de design |
| **M6 — Piloto Equipe** | Planejado | M5 concluído | Um ou dois estabelecimentos parceiros rodando em homologação | M5 não concluído | Relatório do piloto equipe |
| **M7 — Prod. Ampliada** | Planejado | Piloto Equipe (M6) concluído | Cobrança equipe ativa, suporte estruturado, monitoramento 24/7 | M6 não concluído | Integração de cobrança de equipe |

---

## Riscos e Mitigações Ativas
1. **Quebra de imagens de fundo**: Presets de temas dependentes de URLs externas de terceiros.
   * *Mitigação*: Validação restrita em `validateThemeConfig` aceitando apenas caminhos locais (`/`) ou imagens do Storage do projeto Retoria.
2. **Segurança de Dados**: Acesso ou modificação cruzada de dados (leads, slots) entre profissionais.
   * *Mitigação*: Firestore Rules estrito validando que o `request.auth.uid` é idêntico ao ID do documento de destino, validado por 53 casos de teste automatizados em `test-rules.mjs`.

---

## Histórico de Verificações

## Verificação 2026-06-23

* **Branch**: main
* **Commit local**: b2aea7e
* **Commit remoto**: b2aea7e
* **Commit publicado**: b2aea7e
* **Git status**: Workspace sem alterações pendentes no código funcional do produto, mas com alterações documentais e de governança ainda não versionadas.
* **Java**: Microsoft OpenJDK 21.0.11
* **Build**: Aprovado
* **Testes de temas**: Aprovado (13/13)
* **Testes de regras**: Aprovado (53/53)
* **Teste manual**: Aprovado (homologado fluxo de temas e modais localmente)
* **Ambiente**: Desenvolvimento local e Vercel Produção
* **Plataforma de deploy**: Vercel (Git Integration)
* **Deploy**: Aprovado
* **URL**: [https://retoria.vercel.app/](https://retoria.vercel.app/)
* **Resultado**: Estabilização da base (M0) testada (deploy concluído, teste pós-deploy ainda pendente).
* **Gate**: Gate A: GO, Gate B: NO-GO
* **Bloqueadores**: Homologação pós-deploy das jornadas críticas ainda não executada.
* **Próxima ação**: Executar homologação pós-deploy controlada do MVP Individual e registrar evidências no PROJECT_CONTROL.md.

## Verificação 2026-10-21

* **Branch**: main (4 commits locais à frente de origin/main, sem push)
* **Commits**: `99bcaeb`, `2369dd8`, `f597dca`, `a78228a`
* **Build**: Aprovado (`npm run build`)
* **Testes de temas**: Aprovado (13/13)
* **Testes de regras**: Aprovado (81/81, inclui 5 testes novos: escrita em slotBookings negada e 4 de customerNotes)
* **Teste manual**: Não executado (rotas e telas novas sem teste no painel)
* **Deploy**: Não realizado. As regras do Firestore (customerNotes) precisam ser publicadas junto com o app.
* **Divergência**: docs citavam 53/53 e 73/73 em test:rules e não listavam Google Agenda, Clientes e Lembretes.
* **Pendências investigadas, não implementadas**: Google Agenda (sincronização é app→Google e bloqueio de horários públicos; eventos criados direto no Google não aparecem na agenda do painel; token em modo Teste do OAuth pode expirar), data/horário desejado na página pública.
* **Próxima ação**: deploy controlado (app + regras), homologação manual e decisão sobre Google e data desejada.

## Verificação 2026-10-21 (2)

* **Commits locais (sem push)**: `75826cb`, `d13e7cc`, `aad1c9c`
* **Build**: Aprovado. Regras do Firestore inalteradas nesta rodada.
* **Teste manual**: Não executado.
* **Riscos**: arrastar e soltar não funciona em toque (mitigado com o botão Mover); backfill usa o preço atual do serviço, não o da data do atendimento, e marca `valorOrigem`.
