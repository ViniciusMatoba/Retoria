# Roadmap de Desenvolvimento - Retoria

Este documento descreve o cronograma oficial de desenvolvimento do projeto Retoria. As fases de multi-provider e organizações estão listadas apenas para planejamento futuro e não devem ser implementadas neste momento.

## Linha do Tempo de Desenvolvimento

```text
[CONCLUÍDO] Fase 0A — Infraestrutura mínima de modais
      ↓
[CONCLUÍDO] Fase 0B — Correção completa dos temas
      ↓
[A SEGUIR]  Fase 1  — Aplicação global dos modais
      ↓
            Fase 2  — Tipos e abstrações
      ↓
            Fase 3  — Schema e compatibilidade
      ↓
            Fase 4  — Portal e memberships
      ↓
            Fase 5  — Providers e serviços
      ↓
            Fase 6  — Agenda por provider
      ↓
            Fase 7  — Equipe e convites
      ↓
            Fase 8  — Página pública multi-provider
      ↓
            Fase 9  — Agendamentos e índices
      ↓
            Fase 10 — Métricas
      ↓
            Fase 11 — Migração
      ↓
            Fase 12 — Homologação e desativação gradual
```

---

## Descrição das Fases

### Fase 0A — Infraestrutura mínima de modais (Concluída)
Criação do `ModalProvider` acessível, gerando um sistema robusto e unificado de caixas de diálogo para toda a aplicação.

### Fase 0B — Correção completa dos temas (Concluída)
Correção no fluxo de seleção, preview, salvamento e renderização pública de temas personalizados sem hosts externos proibidos.

### Fase 1 — Aplicação global dos modais
Varredura do projeto para substituição de alertas nativos (`window.alert`, `window.confirm`) pelo `useAppModal` e tratamento de erros de formulários com o sistema padronizado.

### Fases de Organizações (Planejamento Futuro)
As fases de 4 a 12 introduzirão suporte a múltiplos profissionais sob a mesma organização (clinicas, salões), controle de membros e convites, e migração gradual dos dados legados. Esta implementação está suspensa até a validação do piloto com o escopo atual (profissional individual).
