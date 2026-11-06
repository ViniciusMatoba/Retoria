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
| F23 | Página Pública | Antecedência mínima de 2h para o cliente agendar (lista, seleção e API) | Implementado | Sim | Build; verificação da regra por script (08:00 → só 10:00+) | Não testada | Não | `timezone.ts` (`PUBLIC_MIN_LEAD_MINUTES`), `bookings/create`, `next-slots`, `PublicBookingExperience.tsx` | Teste manual | Homologar |
| F24 | Página Pública | Faixas alternadas em "Horários livres por dia": linha da data com tom da cor principal, linha dos horários neutra | Testado | Sim | `test:slot-stripes` 9/9; build aprovado | Não testada | Sim | `src/lib/slotDayStripes.ts`, `PublicBookingExperience.tsx` | Nenhum | Homologação pós-deploy |
| F25 | Agenda | Visões Dia/Semana em grade estilo Google Agenda: blocos pela duração, linha da hora atual, pinça (e Ctrl+roda / botões −/+) para ajustar as horas, painel inferior de detalhes | Testado (lógica) | Sim | `test:time-grid` 26/26; build aprovado | Não testada | Não | `src/lib/timeGrid.ts`, `TimeGridCalendar.tsx`, `dashboard/slots/page.tsx` | Gesto de pinça só verificável em aparelho real | Homologar no celular |
| F26 | Agenda | Deslizar para o lado troca de dia/semana/mês | Testado (lógica) | Sim | `test:time-grid` (detectSwipe) | Não testada | Não | `timeGrid.ts` (`detectSwipe`), `dashboard/slots/page.tsx` | Teste em aparelho real | Homologar no celular |
| F27 | Agenda | Duplicar agendamento (abre novo agendamento manual com cliente, serviço, duração e observação copiados) | Implementado | Sim | Build | Não testada | Não | `dashboard/slots/page.tsx` (`handleDuplicateLead`) | Teste manual | Homologar |
| F28 | Clientes | Agendamento manual grava o cliente em `customers`; preenchimento automático inclui clientes de agendamentos anteriores | Testado (lógica) / Implementado (rota) | Sim | `test:time-grid` (mergeCustomerSuggestions); build | Não testada | Não | `api/professionals/[professionalId]/leads/route.ts`, `src/lib/customerSuggestions.ts` | Teste manual (rota usa Admin SDK; regras inalteradas) | Homologar |
| F29 | Agenda | Tela Horários só com as abas e o calendário; resumo de horários e Google Agenda na nova tela "Resumo da Agenda" (`/dashboard/resumo`); navegação para meses/semanas/dias anteriores; grade sem cabeçalho fixo nem botões −/+ | Implementado | Sim | Build | Não testada | Não | `dashboard/slots/page.tsx`, `dashboard/resumo/page.tsx`, `TimeGridCalendar.tsx`, callback do Google → `/dashboard/resumo` | Teste manual | Homologar |
| F30 | Painel | Zoom da página desativado no painel (viewport + bloqueio de gestos do Safari); pinça só na grade da agenda | Implementado | Sim | Build; viewport conferido no HTML local | Não testada | Não | `dashboard/layout.tsx` (servidor), `DashboardShell.tsx` | Teste em aparelho; afeta acessibilidade (zoom) | Usuário avalia |
| F31 | Clientes | Editar cadastro (nome/telefone); atualiza agendamentos do cliente e move as notas ao trocar telefone | Testado (validação) / Implementado (rota) | Sim | `test:customer-edit` 10/10; build | Não testada | Não | `api/professionals/[professionalId]/customers/route.ts`, `src/lib/customerEdit.ts`, `clientes/page.tsx` | Teste manual; eventos do Google Agenda não são renomeados | Homologar |
| F32 | Painel | App instalável do administrador (manifesto, ícone Retoria, aviso de instalação) | Implementado | Sim | Build; manifesto e ícone conferidos localmente | Não testada | Não | `dashboard/layout.tsx`, `dashboard/manifest.webmanifest`, `dashboard/app-icon`, `InstallAppBanner.tsx` | Teste em aparelho | Homologar |
| F33 | Agenda | Horários: calendário no topo (largura da tela no celular) com barra compacta (período, setas, Hoje, Mês/Sem./Dia); abas e "+" flutuante (Novo agendamento) abaixo/fixo; Mês estilo Google Agenda mostrando só os agendamentos (nome do cliente na cor do status, "+N"); painel do horário centralizado na tela | Implementado | Sim | Build | Não testada | Não | `dashboard/slots/page.tsx`, `TimeGridCalendar.tsx` | Teste manual | Homologar |
| F34 | Financeiro | Tela Faturamento (`/dashboard/faturamento`): hoje (faturado, a receber, atendimentos), período Dia/Semana/Mês/Ano com navegação, realizado com variação vs. período anterior, atendimentos, ticket médio, a receber, clientes novos/recorrentes, cancelamentos, a confirmar; gráfico de evolução (realizado × previsto) com tabela; por serviço, origem, dia da semana, turno; top 5 clientes. Inclui equipe | Testado (cálculos) / Implementado (tela) | Sim | `test:revenue` 41/41; build | Não testada | Não | `src/lib/revenue.ts`, `dashboard/faturamento/page.tsx` | Teste manual com dados reais | Homologar |
| F35 | Leads | Resumo de faturamento (real, previsto, histórico 4 meses) removido da tela de Leads; menu reordenado (Horários, Faturamento, Leads, Lembretes, Clientes, Serviços, demais) | Implementado | Sim | Build | Não testada | Não | `leads/page.tsx`, `DashboardShell.tsx` | Teste manual | Homologar |
| F36 | Página Pública | Avisos do passo de dados (pré-agendamento, cadastro encontrado) com texto do tema sobre tom leve da cor principal, no lugar de amarelo/verde | Implementado | Sim | Build | Não testada | Não | `PublicBookingExperience.tsx` | Teste manual | Homologar |
| F37 | Agenda | Barra do calendário com título curto no celular (ex.: "Qua, 04/11") para a data caber na mesma faixa | Implementado | Sim | Build | Não testada | Não | `dashboard/slots/page.tsx` | Teste manual | Homologar |
| F38 | Agenda | Bloquear o dia todo / Liberar o dia na visão Dia (transação: só horários ainda livres e futuros; agendamentos intactos) | Implementado | Sim | Build | Não testada | Não | `dashboard/slots/page.tsx` (`handleToggleWholeDay`) | Teste manual | Homologar |
| F39 | Clientes | Total de clientes cadastrados; resumo clicável (Cadastrados, Novos no mês, Ativos, Sem retorno 60+ dias, Com horário) que filtra a lista; ordenação; selos Novo / Próximo / Sem retorno; WhatsApp com convite para quem sumiu | Testado (classificação) / Implementado (tela) | Sim | `test:customer-stats` 14/14; build | Não testada | Não | `src/lib/customerStats.ts`, `clientes/page.tsx` | Teste manual | Homologar |
| F40 | Página Pública | Ao escolher um serviço, a tela desce até o resumo e o botão "Escolher Data & Horário" | Implementado | Sim | Build | Não testada | Não | `PublicBookingExperience.tsx` | Teste manual | Homologar |
| F41 | Página Pública | "Não encontrou o dia ou horário": campo de data corrigido (saía da caixa no iPhone) e novo campo de horário desejado, de hora em hora (06:00–21:00), enviado na mensagem do WhatsApp; marcador `{horario}` na mensagem do perfil | Testado (mensagem) / Implementado (tela) | Sim | `test:other-times` 9/9; build | Não testada | Não | `src/lib/otherTimesMessage.ts`, `PublicBookingExperience.tsx`, `profile/page.tsx` | Teste manual no iPhone | Homologar |
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

## Verificação 2026-10-30

* **Branch**: `feat/painel-horarios-agendar` (sem push)
* **Alterações (Implementado)**: botão "Agendar" no horário livre (abre o modal manual com data/horário preenchidos); sugestão de clientes cadastrados (nome/telefone) no modal; "Horários" como primeira tela e destino pós-login/onboarding/convite/portal/admin; dias atendidos marcados no calendário mensal.
* **Build**: Aprovado. **Testes de temas**: Aprovado (13/13).
* **Testes de regras**: NÃO concluído (emulador encerrado por timeout); regras inalteradas.
* **Teste manual**: Não executado.
* **Divergência**: nenhuma nova identificada nesta rodada.

## Verificação 2026-10-31

* **Branch**: `feat/faixas-data-horario` (sem push)
* **Alterações (Implementado)**: F24, faixas alternadas data/horário na lista de horários livres da página pública.
* **Build**: NÃO executado. **Testes**: `test:slot-stripes` criado e NÃO executado (a pedido do usuário, que fará o teste).
* **Regras do Firestore**: inalteradas.
* **Teste manual**: Não executado.
* **Próxima ação**: usuário executa `npm run test:slot-stripes` e `npm run build`, confere a tela; depois push e homologação pós-deploy.

## Verificação 2026-11-03

* **Branch**: `feat/faixas-data-horario` → merge em `main` para deploy (Vercel Git integration)
* **Node**: 26.13.0 (antes 14.21.3, incompatível; atualizado pelo usuário)
* **Build**: Aprovado (`npm run build`)
* **Testes de faixas**: Aprovado (`test:slot-stripes` 9/9). **Testes de temas**: Aprovado (13/13)
* **Testes de regras**: Não executados; regras do Firestore inalteradas.
* **Teste manual**: Não executado.
* **Teste pós-deploy em produção**: NÃO TESTADO
* **Próxima ação**: homologar as faixas na página pública real `/p/[slug]` com "Mostrar só os 3 próximos horários livres" ativo.

## Verificação 2026-11-03 (2)

* **Branch**: `feat/agenda-estilo-google` (a partir de `main` `9ed5f82`)
* **Backup prévio**: `Documentos/Retoria-backups/Retoria-2026-11-03` (cópia da pasta) e `Retoria-2026-11-03.bundle` (histórico Git, verificado com `git bundle verify`)
* **Alterações**: F25, F26, F27, F28.
* **TypeScript**: `tsc --noEmit` sem erros.
* **Lint**: arquivos novos sem problemas; `dashboard/slots/page.tsx` sem erros novos em relação à `main` (2 erros antigos de react-hooks a menos); `leads/route.ts` igual à `main` (9 `no-explicit-any` pré-existentes).
* **Testes**: `test:time-grid` 26/26, `test:slot-stripes` 9/9, `test:themes` 13/13. `test:rules` não executado (regras inalteradas).
* **Build**: Aprovado.
* **Teste manual**: Não executado. Gesto de pinça e deslizar não verificados em aparelho.
* **Divergência**: o agendamento manual não gravava o cliente em `customers` (só a rota pública gravava), por isso o preenchimento automático não encontrava clientes manuais.
* **Teste manual na prévia do Vercel** (branch `feat/agenda-estilo-google`, commit `e503a55`): aprovado pelo usuário em 2026-11-03.
* **Deploy**: merge em `main` e publicação pela integração do Vercel. Teste pós-deploy em produção: NÃO TESTADO.

## Verificação 2026-11-03 (3)

* **Branch**: `feat/painel-resumo-app` (a partir de `main` `7af0790`)
* **Backup prévio**: `Documentos/Retoria-backups/Retoria-2026-11-03-b.bundle` (verificado com `git bundle verify`)
* **Alterações**: F29, F30, F31, F32. O layout de `/dashboard` passou a ser de servidor (metadata/viewport); o antigo virou `components/DashboardShell.tsx`.
* **TypeScript**: sem erros. **Lint**: nenhum erro novo em relação à `main`.
* **Testes**: `test:customer-edit` 10/10, `test:time-grid` 26/26, `test:slot-stripes` 9/9, `test:themes` 13/13. `test:rules` não executado (regras inalteradas).
* **Build**: Aprovado. `next start` local: manifesto e ícone respondem; `/dashboard/*` com `user-scalable=no`; páginas fora do painel sem mudança.
* **Teste manual na prévia do Vercel** (branch `feat/painel-resumo-app`, commit `4bb016e`): aprovado pelo usuário em 2026-11-03.

## Verificação 2026-11-03 (4)

* **Branch**: `feat/agenda-mes-google` (a partir de `main` `8e6c693`), sem merge até autorização do usuário.
* **Alterações**: F33.
* **Divergência**: o painel do horário abria preso dentro do cartão do calendário (o `backdrop-blur` do cartão vira referência do `position: fixed`); agora é renderizado fora do cartão.
* **TypeScript**: sem erros. **Lint**: igual à `main`. **Build**: Aprovado.
* **Testes automatizados**: não executados nesta rodada, a pedido do usuário. **Teste manual**: Não executado.

## Verificação 2026-11-04

* **Branch**: `feat/faturamento` (a partir de `main` `8196207`), sem merge até autorização do usuário.
* **Backup prévio**: `Documentos/Retoria-backups/Retoria-2026-11-04.bundle` (verificado com `git bundle verify`).
* **Alterações**: F34, F35, F36, F37.
* **TypeScript**: sem erros. **Lint**: nenhum erro novo em relação à `main`.
* **Testes**: `test:revenue` 41/41, `test:customer-edit` 10/10, `test:time-grid` 26/26, `test:slot-stripes` 9/9, `test:themes` 13/13. `test:rules` não executado (regras inalteradas).
* **Build**: Aprovado. Cores dos gráficos validadas (daltonismo/contraste) em fundo claro e escuro.
* **Teste manual**: Não executado (tela de Faturamento não vista com dados reais).

## Verificação 2026-11-04 (2)

* **Branch**: `feat/bloquear-dia-clientes` (a partir de `main` `fdc48d8`), sem merge até autorização do usuário.
* **Alterações**: F38, F39.
* **TypeScript**: sem erros. **Lint**: nenhum erro novo em relação à `main`.
* **Testes**: `test:customer-stats` 14/14, `test:revenue` 41/41, `test:customer-edit` 10/10, `test:time-grid` 26/26, `test:slot-stripes` 9/9, `test:themes` 13/13. `test:rules` não executado (regras inalteradas).
* **Build**: Aprovado. **Teste manual**: Não executado.

## Verificação 2026-11-06

* **Branch**: `feat/agendamento-cliente-ajustes` (a partir de `main` `b82d340`), sem merge até autorização do usuário.
* **Alterações**: F40, F41.
* **TypeScript**: sem erros. **Lint**: nenhum erro novo em relação à `main`.
* **Testes**: `test:other-times` 9/9, `test:customer-stats` 14/14, `test:revenue` 41/41, `test:customer-edit` 10/10, `test:time-grid` 26/26, `test:slot-stripes` 9/9, `test:themes` 13/13. `test:rules` não executado (regras inalteradas).
* **Build**: Aprovado. **Teste manual**: Não executado (campo de data no iPhone só verificável no aparelho).
* **Deploy**: merge em `main` e publicação pela integração do Vercel. Teste pós-deploy em produção: NÃO TESTADO.
