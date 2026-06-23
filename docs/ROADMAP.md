# Roadmap de Desenvolvimento - Retoria

Este documento descreve o cronograma oficial de desenvolvimento do projeto Retoria. As fases de multi-provider e organizações estão listadas apenas para planejamento futuro e não devem ser implementadas neste momento.

## Linha do Tempo de Desenvolvimento

```text
[CONCLUÍDO] Fase 0A — Infraestrutura mínima de modais
      ↓
[ENCERRADA] Fase 0B — Correção completa dos temas (com restrições)
      ↓
[PENDENTE]  Homologação pós-deploy controlada do MVP Individual
      ↓
[A SEGUIR]  Fase 1  — Aplicação global dos modais
      ↓
            Fase 2  — Tipos e abstrações de organizações
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

## Trilha Comercial

```text
Estabilização do MVP Individual
            ↓
      Piloto interno
            ↓
    Piloto acompanhado
            ↓
Beta comercial Individual
            ↓
      Piloto Equipe
            ↓
      Venda ampliada
```

A trilha de organizações não deve impedir o piloto do MVP Individual quando os gates individuais (Gate A e Gate B) forem devidamente aprovados.

---

## Descrição das Fases

### Fase 0A — Infraestrutura mínima de modais (Concluída)
Criação do `ModalProvider` acessível, gerando um sistema robusto e unificado de caixas de diálogo para toda a aplicação.

### Fase 0B — Correção completa dos temas (Encerrada com Restrições)
Correção no fluxo de seleção, preview, salvamento e renderização pública de temas personalizados sem hosts externos proibidos. O deploy automático foi realizado, mas a homologação em produção está pendente.

### Homologação pós-deploy controlada
Validação manual de todas as jornadas de agendamento e personalização de temas no ambiente publicado real do Vercel e Firestore de produção antes de prosseguir com novas funcionalidades.

### Fase 1 — Aplicação global dos modais
Varredura do projeto para substituição de alertas nativos (`window.alert`, `window.confirm`) pelo `useAppModal` e tratamento de erros de formulários com o sistema padronizado.

### Fases de Organizações (Planejamento Futuro)
As fases de 4 a 12 introduzirão suporte a múltiplos profissionais sob a mesma organização (clínicas, salões), controle de membros e convites, e migração gradual dos dados legados. Esta implementação está suspensa até a validação do piloto com o escopo atual (profissional individual).
