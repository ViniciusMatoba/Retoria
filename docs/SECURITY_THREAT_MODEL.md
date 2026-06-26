# Modelo de Ameaças — Retoria

**Data:** 26/06/2026  
**Metodologia:** STRIDE simplificado

---

## Ativos Principais

| Ativo | Classificação |
|-------|--------------|
| Dados pessoais de leads (nome, telefone) | Alto |
| Tokens Firebase (ID tokens, refresh tokens) | Alto |
| Tokens OAuth Google Calendar | Alto |
| Agenda do profissional (slots, bookings) | Médio |
| Dados de faturamento/licença | Alto |
| Configuração de perfil do profissional | Baixo |

---

## Superfície de Ataque

### Endpoints públicos (sem autenticação)
- `GET /p/[slug]` — página de agendamento do profissional
- `POST /api/bookings/create` — criação de agendamento (verifica disponibilidade)
- `POST /api/access-requests` — formulário de solicitação de acesso
- `GET /api/invite/[token]` — leitura de convite de equipe

### Endpoints privados (requerem Bearer token)
- `/api/professionals/[id]/leads/*` — gestão de leads
- `/api/professionals/[id]/slots/*` — gestão de agenda
- `/api/auth/google/*` — OAuth Google Calendar
- `/api/customer/ensure` — criação de conta de cliente
- `/api/admin/*` — administração (requer UID admin)

### Firestore (client SDK)
- `professionals/{uid}` — leitura pública
- `professionals/{uid}/availableSlots` — leitura pública
- `professionals/{uid}/services` — leitura pública
- `customerAccounts/{uid}` — leitura própria
- `accounts/{uid}` — leitura própria

### Storage (client SDK)
- `logos/{uid}/*` — leitura pública, escrita própria
- `services/{uid}/*` — leitura pública, escrita própria
- `backgrounds/{uid}/*` — leitura pública, escrita própria

---

## Ameaças STRIDE

### Spoofing
| Ameaça | Controle |
|--------|---------|
| Forjar identidade em APIs privadas | `authAdmin.verifyIdToken()` — JWT verificado pelo Firebase Admin SDK |
| CSRF em OAuth Google | Nonce criptográfico com TTL 10 min armazenado no Firestore |
| Usar token de outro usuário | Tokens Firebase são por-usuário; UID extraído do token, não do body |

### Tampering
| Ameaça | Controle |
|--------|---------|
| Modificar plano/status via client SDK | Regras Firestore bloqueiam `plan`, `professionalStatus`, `trialEndsAt`, etc. |
| Forjar token de ativação de licença | `licenseTokens` é `allow read,write: if false` |
| Manipular slots de outro profissional | Todas as escritas de slot passam pelo Admin SDK ou regras `isProfessional()` |

### Repudiation
| Ameaça | Controle |
|--------|---------|
| Negar criação de agendamento | `leads/{leadId}` registra `professionalId`, `customerUid`, `createdAt` |
| Negar aceite de convite | `teamInvites/{token}` atualizado com `memberUid` e `acceptedAt` |

### Information Disclosure
| Ameaça | Controle atual | Gap |
|--------|---------------|-----|
| Email/telefone do profissional via client SDK | Nenhum (SEC-004) | P1 aberto |
| `bookingId` nos slots | Nenhum (SEC-005) | P1 aberto |
| Stack trace nos logs do servidor | Sanitizado (SEC-011) | ✅ |
| UID na página pública | Removido (SEC-013) | ✅ |

### Denial of Service
| Ameaça | Controle atual | Gap |
|--------|---------------|-----|
| Flood de requisições em APIs públicas | Rate limiter em memória (SEC-003) | Não efetivo em multi-instância |
| Double-booking por race condition | Firestore transaction em `bookings/create` | Efetivo em single-instance |

### Elevation of Privilege
| Ameaça | Controle |
|--------|---------|
| Escalação de plano via client SDK | Regras Firestore bloqueiam `plan` |
| Acesso a leads de outro profissional | `isProfessional(profId)` valida UID |
| Acesso a dados de outro cliente | `isOwner(uid)` valida UID |
| Criação de licença diretamente | `licenses` é `allow read,write: if false` |

---

## Fluxos de Alto Risco

### Fluxo de Agendamento
```
Visitante → POST /api/bookings/create
  → Verifica disponibilidade (Firestore transaction)
  → Reserva slots
  → Cria lead
  → Envia notificação WhatsApp
```
**Risco:** Double-booking em alta carga (mitigado por transaction)

### Fluxo OAuth Google Calendar
```
Profissional → GET /api/auth/google/connect
  → generateAuthUrl() + nonce no Firestore
  → Google OAuth (redirect)
  → GET /api/auth/google/callback?state={uid}:{nonce}
  → Valida nonce (TTL 10 min)
  → Armazena tokens criptografados
```
**Risco controlado:** CSRF via state forjado (mitigado por nonce)

### Fluxo de Licença
```
Admin → POST /api/admin/license-tokens (cria token)
→ Usuário → GET /api/activate/[token] (ativa licença)
→ Admin SDK atualiza professionals/{uid} com plan/professionalStatus
```
**Risco:** Token de ativação tem TTL? (verificar implementação)
