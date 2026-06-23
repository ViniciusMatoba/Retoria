<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Protocolo de Verificação e Atualização do Projeto

Este protocolo é obrigatório para todos os agentes de Inteligência Artificial (incluindo Antigravity, Claude Code, e outros) que executem tarefas neste repositório.

## 1. Protocolo Antes de Iniciar Qualquer Tarefa
Antes de alterar qualquer arquivo ou tomar decisões, o agente deve ler obrigatoriamente os seguintes documentos de controle:
* [AGENTS.md](file:///C:/Users/Usuario/Desktop/Retoria/AGENTS.md)
* [PROJECT_STATUS.md](file:///C:/Users/Usuario/Desktop/Retoria/PROJECT_STATUS.md)
* [docs/PROJECT_CONTROL.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md)
* [docs/ROADMAP.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/ROADMAP.md)
* [docs/PILOT_RELEASE_CHECKLIST.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PILOT_RELEASE_CHECKLIST.md)
* [docs/PRODUCTION_RELEASE_CHECKLIST.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PRODUCTION_RELEASE_CHECKLIST.md)
* [docs/ARCHITECTURE_DECISIONS.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/ARCHITECTURE_DECISIONS.md)
* [docs/RISKS_AND_LIMITATIONS.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/RISKS_AND_LIMITATIONS.md)

Depois, executar e analisar a saída dos seguintes comandos para confirmar o estado real do repositório:
```bash
git status -sb
git branch --show-current
git log --oneline -n 5
```
Verificar os scripts em `package.json` e, quando aplicável, executar antes de qualquer alteração de código:
```bash
npm run build
npm run test:themes
npm run test:rules
```

## 2. Comparação e Identificação de Divergências
O agente deve comparar ativamente o estado real dos arquivos e execução com o que está documentado. Havendo discrepâncias, deve registrar explicitamente no início do seu turno:
```text
DIVERGÊNCIA IDENTIFICADA: [Descrever a divergência]
```
A realidade do código e dos comandos executados sempre prevalece sobre relatórios anteriores.

## 3. Estados Padronizados de Desenvolvimento
Utilizar unicamente estes estados para rastrear o progresso no roadmap e nas tabelas:
* **Não iniciado**: Funcionalidade planejada sem qualquer linha de código.
* **Planejado**: Existe apenas no roadmap/documentos de planejamento.
* **Em desenvolvimento**: Alterações locais iniciadas, entrega ainda pendente de validação.
* **Implementado**: Código escrito no repositório, mas sem suíte de testes completa ou verificada.
* **Testado**: Suíte de testes (automatizada e/ou scripts de teste) executada e com 100% de sucesso.
* **Homologado**: Validado manualmente simulando o uso em ambiente de produção ou equivalente.
* **Liberado para piloto**: Atende a 100% dos critérios do checklist de piloto.
* **Liberado para produção**: Atende a todos os critérios técnicos, comerciais e de segurança.
* **Bloqueado**: Trabalho interrompido por impedimento técnico ou falta de pré-requisitos.
* **Descontinuado**: Funcionalidade descartada do escopo.

## 4. Regras Anti-Otimismo (Compromisso com a Verdade)
* Não presumir que testes ou build passaram sem executá-los de fato.
* Não ocultar testes que estejam falhando ou bloqueados.
* Não tratar build limpo como equivalente a "funcionalidade testada".
* Não tratar a pré-visualização (preview) do painel como evidência de funcionamento da rota pública real.
* Não tratar um push bem-sucedido para o GitHub como um deploy concluído.
* Não tratar deploy concluído como validação pós-deploy feita (esta exige testes reais na URL pública).
* Não marcar tarefas parcialmente prontas como concluídas.
* Em caso de bloqueios, classificar como `BLOQUEADO` e detalhar de forma clara a causa, o impacto, a ação necessária e o responsável sugerido.

## 5. Protocolo de Encerramento de Tarefa
Ao finalizar a tarefa, o agente deve obrigatoriamente:
1. Executar testes locais relevantes e build de produção.
2. Analisar o `git diff` antes de sugerir ou fazer o commit.
3. Atualizar [docs/PROJECT_CONTROL.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/PROJECT_CONTROL.md) com a nova verificação e status da matriz de controle.
4. Atualizar [PROJECT_STATUS.md](file:///C:/Users/Usuario/Desktop/Retoria/PROJECT_STATUS.md) se houver mudanças no status resumido.
5. Atualizar [docs/ROADMAP.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/ROADMAP.md) se houver transição de fase.
6. Atualizar os checklists e release gates correspondentes.
7. Atualizar riscos em [docs/RISKS_AND_LIMITATIONS.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/RISKS_AND_LIMITATIONS.md) ou decisões em [docs/ARCHITECTURE_DECISIONS.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/docs/ARCHITECTURE_DECISIONS.md) se necessário.
8. Apresentar o encerramento estruturado seguindo o template em [docs/TASK_CLOSEOUT_TEMPLATE.md](file:///C:/Users/Usuario/Desktop/Retoria/docs/TASK_CLOSEOUT_TEMPLATE.md).
