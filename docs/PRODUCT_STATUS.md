# Status do Produto - Retoria

Este documento apresenta o estado real de desenvolvimento e testes do projeto Retoria na data de 23 de Junho de 2026.

## Funcionalidades e Fases Concluídas

### Fase 0A — Infraestrutura Mínima de Modais (CONCLUÍDA)
* **ModalProvider**: Sistema global de modais acessíveis (`useAppModal`) implementado com suporte a modais de sucesso, erro, aviso, informação e confirmação.
* **Acessibilidade**: Implementado focus trap, suporte a tecla Escape, controle de scroll do body e atributos `aria-modal="true"` / `role="dialog"`.
* **Refinamento**: Modais da tela de personalização alinhados exatamente com o comportamento especificado (ações condicionais com base no slug do profissional).

### Fase 0B — Correção Completa dos Temas (CONCLUÍDA)
* **Preview e Persistência**: Sincronização em tempo real entre a seleção de preset, preview de personalização e persistência no Firestore.
* **Página Pública**: A rota `/p/[slug]` carrega e aplica os estilos do tema do profissional usando o `PublicThemeProvider` e `normalizeThemeConfig` com fallbacks robustos.
* **Segurança de Imagens**: Validação rigorosa que impede o salvamento de imagens de hosts externos não autorizados (ex: Unsplash). Apenas imagens relativas locais (`/`) ou do Firebase Storage oficial são aceitas.

---

## Estado Real dos Testes

* **Build**: `npm run build` compilando com sucesso (Next.js 16/Turbopack).
* **Testes de Temas**: `npm run test:themes` passando com **13/13 testes de sucesso**.
* **Testes de Regras (Firestore/Storage)**: `npm run test:rules` **NÃO EXECUTADO** localmente.
  * **Bloqueio**: A execução falhou porque o ambiente local possui apenas a versão antiga do Java (`java version 1.8.0_481`), enquanto as ferramentas do Firebase CLI exigem JDK 21+.

---

## Próxima Fase

* **Próxima Fase**: **Fase 1 — Aplicação global dos modais** (substituição de `window.alert` e modais manuais restantes pelo sistema unificado `useAppModal`).
* **Organizações**: O plano de organizações está aprovado **apenas como planejamento**. Nenhuma alteração no schema ou código de `organizations`, `memberships`, `providers`, `convites` ou `migração` foi realizada.
