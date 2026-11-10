# Decisões de Arquitetura (ADRs) - Retoria

Este documento registra as principais decisões de design de software e escolhas tecnológicas tomadas durante o desenvolvimento do Retoria.

## ADR 1: Renderização Dinâmica na Página Pública (`/p/[slug]`)
* **Contexto**: A página pública do profissional precisa refletir instantaneamente quaisquer mudanças feitas na sua identidade visual, tema ou disponibilidade de horários.
* **Decisão**: Utilizar `export const dynamic = "force-dynamic"` e gerenciar a leitura dos dados e renderização do tema diretamente no cliente (Client Component) utilizando o SDK de leitura direta do Cloud Firestore.
* **Consequências**:
  * Elimina a complexidade de invalidação e revalidação de cache estático no Next.js (como ISR ou SSR com CDN).
  * Menor tempo de latência de atualização para o profissional.
  * O custo de tráfego e leitura de dados no Firestore é gerenciado diretamente no cliente, mantendo o servidor web Next.js leve e apátrida.

## ADR 2: Centralização de Validação e Normalização de Temas
* **Contexto**: Formatos de temas inválidos ou parciais gravados no Firestore podiam corromper a renderização e quebrar a visualização pública.
* **Decisão**: Criar funções utilitárias unificadas (`normalizeThemeConfig`, `validateThemeConfig`) em `themeUtils.ts` que são compartilhadas tanto pela página de personalização do dashboard (preview) quanto pela página pública `/p/[slug]`.
* **Consequências**:
  * Qualquer tema incompleto ou legado que contenha dados faltantes ou inválidos é automaticamente sanetizado em memória durante o carregamento.
  * Segurança aprimorada contra injeção manual de URLs externas proibidas ou formatos de cores errados no banco de dados.

## ADR 3: Custos e Materiais gravados só pelo servidor
* **Contexto**: A tela Custos e Materiais precisa de coleções novas (`materials`, `expenses`). Publicar regras do Firestore exige `firebase deploy`, separado do deploy do app no Vercel.
* **Decisão**: Ler e gravar essas coleções apenas por rotas `/api/professionals/[id]/...` com Admin SDK e verificação do token do dono (`src/lib/apiOwner.ts`), como já ocorre com `customers`. As regras atuais negam o acesso direto do navegador por padrão.
* **Consequências**:
  * A funcionalidade sobe só com o deploy do app, sem passo manual de regras.
  * Cada leitura passa pelo servidor (sem tempo real nem cache local do Firestore); a validação fica em `src/lib/costs.ts`.
