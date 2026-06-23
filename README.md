# AgendaZap 🚀

**AgendaZap** é um sistema piloto de pré-atendimento e pré-agendamento web projetado para profissionais autônomos que atendem e recebem clientes através do WhatsApp.

O objetivo principal é evitar que profissionais percam clientes por demora no atendimento inicial, oferecendo uma página simples onde o cliente escolhe o serviço, seleciona a data/hora disponível, informa os dados de contato e é redirecionado para o WhatsApp do profissional com uma mensagem pré-formatada.

---

## ⚠️ Limitações do MVP (Escopo da Versão 1.0)

Este projeto é um MVP (Minimum Viable Product) focado na validação de mercado rápida e baixo custo de infraestrutura. Por design, o sistema possui as seguintes limitações:

1. **Sem Envio Automatizado de Mensagens**: O sistema não envia mensagens em background no WhatsApp; o cliente deve clicar no botão final para abrir o aplicativo e enviar a mensagem pré-preenchida.
2. **Sem Integração com API Oficial do WhatsApp**: Não há dependência da API do WhatsApp Business Cloud ou sistemas de chatbot terceiros. A comunicação é baseada no link público padrão `wa.me`.
3. **Sem Confirmação Automática de Agenda**: O agendamento é registrado como "Novo" no banco de dados e marcado como ocupado, mas a confirmação final do horário é feita no diálogo manual entre o profissional e o cliente via WhatsApp.
4. **Foco em Organização de Pré-atendimento**: O sistema atua como uma barreira de triagem (coleta de dados + intenção) direcionando o lead qualificado para o canal de fechamento.

---

## 📅 Gerador Inteligente e Janela de Exibição Pública

O Retoria separa claramente o conceito de **geração de horários** no banco de dados e a **exibição de horários** para os clientes:

1. **Período de Geração**: Define a quantidade de dias no futuro para os quais o profissional deseja calcular e salvar os horários disponíveis em lote (ex: próximos 90 dias).
2. **Janela de Exibição Pública (`janelaAgendamentoDias`)**: Limita até quantos dias futuros os clientes conseguem visualizar e selecionar na página pública `/p/[slug]` (ex: próximos 15 dias).
   * **Vantagem**: Reduz o volume de opções para o cliente final, facilitando a decisão e evitando escassez percebida ou agenda muito espaçada.
   * **Otimização**: Limita as consultas de leitura no Cloud Firestore apenas ao intervalo da janela configurada, reduzindo custos de tráfego, enquanto mantém o controle total e visualização completa de todos os horários no painel (dashboard) do profissional.

---

## 🛠️ Stack Utilizada

- **Framework**: [Next.js 16](https://nextjs.org/) (React & TypeScript)
- **Estilização**: Tailwind CSS v4 (com visual dark moderno e suporte a cores dinâmicas da marca do profissional)
- **Banco de Dados & Autenticação**: Firebase (Authentication, Cloud Firestore, Firebase Storage)
- **Ícones**: Lucide React

---

## 🚀 Como Rodar Localmente

### 1. Instalar as dependências
Navegue até a pasta do projeto e instale os pacotes necessários:
```bash
npm install
```

### 2. Configurar o Firebase
Crie um projeto no [Firebase Console](https://console.firebase.google.com/), ative os serviços **Authentication (E-mail/Senha)**, **Cloud Firestore** e **Storage**.

### 3. Configurar as Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto e insira as credenciais do seu aplicativo web Firebase (copie o formato de `.env.example`):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
```

### 4. Iniciar o Servidor
```bash
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🔒 Regras de Segurança Oficiais do Firebase

Copie e cole as regras abaixo nos respectivos painéis do console do Firebase para proteger o banco de dados e arquivos de abusos ou invasões de dados de terceiros.

### 1. Cloud Firestore (Regras de Segurança)
Vá em **Firestore Database** > aba **Regras (Rules)**, substitua o conteúdo pelo código abaixo e clique em **Publicar**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function para verificar se o usuário é o profissional dono do documento
    function isProfessional(profId) {
      return request.auth != null && request.auth.uid == profId;
    }

    match /professionals/{profId} {
      allow read: if true; // Necessário para carregar a página pública (/p/slug)
      allow write: if isProfessional(profId); // Apenas o dono edita seu perfil
      
      // Serviços do profissional
      match /services/{serviceId} {
        allow read: if true;
        allow write: if isProfessional(profId);
      }
      
      // Horários da agenda
      match /availableSlots/{slotId} {
        allow read: if true;
        allow write: if isProfessional(profId)
                     // Permite que o cliente marque o horário como indisponível (reserva)
                     || (
                       resource.data.disponivel == true &&
                       request.resource.data.disponivel == false &&
                       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['disponivel', 'updatedAt'])
                     );
      }
      
      // Contatos/Leads recebidos
      match /leads/{leadId} {
        allow read, update, delete: if isProfessional(profId); // Apenas o profissional acessa/muda status
        
        // Validação estrita para criação de lead por cliente público
        allow create: if (
          // Garante que APENAS os 12 campos válidos sejam salvos no documento
          request.resource.data.keys().hasOnly([
            'professionalId', 'nome', 'telefone', 'servicoEscolhido', 'serviceId', 
            'dataEscolhida', 'horarioEscolhido', 'observacao', 'status', 'origem', 
            'createdAt', 'updatedAt'
          ]) &&
          
          // Validação de tipos, dados e limites
          request.resource.data.professionalId == profId &&
          request.resource.data.status == "Novo" &&
          request.resource.data.origem == "web-slug" &&
          request.resource.data.nome is string &&
          request.resource.data.nome.size() >= 2 &&
          request.resource.data.nome.size() <= 80 &&
          request.resource.data.telefone is string &&
          request.resource.data.telefone.size() >= 10 &&
          request.resource.data.telefone.size() <= 20 &&
          request.resource.data.servicoEscolhido is string &&
          request.resource.data.serviceId is string &&
          request.resource.data.dataEscolhida is string &&
          request.resource.data.horarioEscolhido is string &&
          (
            !('observacao' in request.resource.data) ||
            (request.resource.data.observacao is string && request.resource.data.observacao.size() <= 500)
          )
        );
      }
    }
  }
}
```

### 2. Firebase Storage (Regras de Segurança)
Vá em **Storage** > aba **Regras (Rules)**, substitua o conteúdo pelo código abaixo e clique em **Publicar**:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Regra para foto de logo do profissional
    match /logos/{profId}/logo {
      allow read: if true; // Qualquer cliente pode ver a logo
      allow write: if request.auth != null && request.auth.uid == profId // Apenas o próprio profissional faz upload
                   && request.resource.size < 2 * 1024 * 1024 // Limite de 2MB
                   && request.resource.contentType.matches('image/.*'); // Permite apenas imagens
    }
  }
}
```
