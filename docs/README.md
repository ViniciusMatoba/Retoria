# Documentação do Projeto Retoria

Bem-vindo à pasta de documentação do Retoria! Aqui você encontrará a governança, roadmap, arquitetura, riscos e checklists de lançamento.

---

## 1. Fonte Principal de Acompanhamento (Fonte Única de Verdade)
* **Documento Central**: [docs/PROJECT_CONTROL.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md)
* **Objetivo**: Este arquivo reúne a matriz central de funcionalidades, o controle dos marcos de liberação (M0-M7), riscos ativos e o histórico acumulado de verificações. Qualquer agente ou desenvolvedor deve atualizá-lo ao término de uma tarefa.

---

## 2. Índice de Documentos e Frequência de Atualização

1. [Controle do Projeto (PROJECT_CONTROL.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md)  
   * **Atualização**: A cada tarefa. Registra nova entrada no histórico de verificações e atualiza a matriz de status.
2. [Status do Produto (PRODUCT_STATUS.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/PRODUCT_STATUS.md)  
   * **Atualização**: Quando houver avanço de fase ou modificação no status dos testes (ex: regras, temas, build).
3. [Roadmap de Desenvolvimento (ROADMAP.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/ROADMAP.md)  
   * **Atualização**: Apenas em transições de fase de desenvolvimento ou repactuação do cronograma.
4. [Checklist de Lançamento Piloto (PILOT_RELEASE_CHECKLIST.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/PILOT_RELEASE_CHECKLIST.md)  
   * **Atualização**: Conforme os critérios obrigatórios de piloto forem sendo testados e homologados.
5. [Checklist de Lançamento em Produção (PRODUCTION_RELEASE_CHECKLIST.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/PRODUCTION_RELEASE_CHECKLIST.md)  
   * **Atualização**: Na preparação para deploy público final.
6. [Decisões de Arquitetura (ARCHITECTURE_DECISIONS.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/ARCHITECTURE_DECISIONS.md)  
   * **Atualização**: Sempre que houver nova definição técnica estrutural de impacto global (ADR).
7. [Riscos e Limitações (RISKS_AND_LIMITATIONS.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/RISKS_AND_LIMITATIONS.md)  
   * **Atualização**: Quando novos riscos técnicos ou limites operacionais do MVP forem identificados.
8. [Gates de Liberação (RELEASE_GATES.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/RELEASE_GATES.md)  
   * **Atualização**: Na mudança de estado de avaliação dos gates de transição comercial/teste (Gate A a Gate D).
9. [Template de Encerramento (TASK_CLOSEOUT_TEMPLATE.md)](file:///C:/Users/Usuario/Desktop/Retoria/docs/TASK_CLOSEOUT_TEMPLATE.md)  
   * **Uso**: Modelo obrigatório para formatação do relatório final entregue pelos agentes ao término das atividades.

---

## 3. Protocolo Obrigatório para Agentes de Código

### Protocolo ANTES de Iniciar Qualquer Tarefa
1. Ler a regra de governança em [AGENTS.md](file:///C:/Users/Usuario/Desktop/Retoria/AGENTS.md).
2. Ler a fonte única de verdade em [docs/PROJECT_CONTROL.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md).
3. Confirmar o estado do repositório executando:
   ```bash
   git status -sb
   git branch --show-current
   git log --oneline -n 5
   ```
4. Se houver código modificado, rodar a suíte de testes existente:
   ```bash
   npm run build
   npm run test:themes
   npm run test:rules
   ```
5. Registrar qualquer **DIVERGÊNCIA IDENTIFICADA** entre o estado real do código e o relatado nos documentos de status.

### Protocolo APÓS Concluir Qualquer Tarefa
1. Rerun dos testes e build para assegurar que não há regressões.
2. Analisar o `git diff` para evitar a subida de arquivos temporários, logs ou segredos.
3. Atualizar a matriz de funcionalidades e marcos em [docs/PROJECT_CONTROL.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md).
4. Adicionar novo registro no "Histórico de verificações" de [docs/PROJECT_CONTROL.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md).
5. Se houver modificação de status resumido ou fase, atualizar [PROJECT_STATUS.md](file:///C:/Users/Usuario/Desktop/Retoria/PROJECT_STATUS.md) e [docs/ROADMAP.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/ROADMAP.md).
6. Entregar o relatório de conclusão formatado rigorosamente de acordo com [docs/TASK_CLOSEOUT_TEMPLATE.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/TASK_CLOSEOUT_TEMPLATE.md).

---

## 4. Definições de Estados e Gates

Consulte o arquivo [AGENTS.md](file:///C:/Users/Usuario/Desktop/Retoria/AGENTS.md) para a lista de estados válidos (`Planejado`, `Em desenvolvimento`, `Implementado`, `Testado`, `Homologado`, etc.) e regras anti-otimismo. Consulte [docs/RELEASE_GATES.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/RELEASE_GATES.md) para as regras de aprovação de liberação dos Gates.
