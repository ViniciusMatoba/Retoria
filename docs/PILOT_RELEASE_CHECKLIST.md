# Checklist de Lançamento Piloto - Retoria

Este checklist lista os itens necessários para aprovar o lançamento do piloto com profissionais reais.

## Itens Obrigatórios

### 1. Temas e Personalização
- [x] Seleção de preset carrega instantaneamente no rascunho.
- [x] Alterações manuais (cores, fontes, bordas) marcam o estado como modificado.
- [x] O preview exibe as mudanças no layout de simulação móvel.
- [x] Ação de "Salvar Tema" exibe indicador visual de processamento (`Salvando...`) e desabilita cliques duplos.
- [x] A persistência ocorre com sucesso no Firestore (documento do profissional, campo `themeConfig`).
- [x] Modal de Sucesso exibe as opções apropriadas (incluindo botão para ver a página pública se o profissional possuir slug).
- [x] A página pública `/p/[slug]` carrega o tema exatamente como salvo em navegadores Desktop e Mobile.
- [x] O tema é mantido após recarregar com F5, abrir em nova aba e em modo anônimo.
- [x] Temas antigos ou inválidos utilizam fallback seguro sem travar a renderização.

### 2. Validações e Testes
- [x] `npm run build` compila a aplicação com sucesso.
- [x] `npm run test:themes` executa e passa 100%.
- [x] As regras do Firestore e Storage foram validadas localmente ou via ambiente remoto (`test:rules`).

### 3. Modais e UX
- [x] O sistema global de modais (`useAppModal`) impede duplicidade na fila.
- [x] O foco é mantido dentro do modal (focus trap) e retorna ao elemento de origem após o fechamento.
- [x] O fechamento via tecla Escape funciona adequadamente.
- [x] O scroll do fundo é bloqueado ao exibir o modal.
