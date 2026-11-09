# Riscos e Limitações - Retoria

Este documento apresenta a análise de riscos técnicos e limitações funcionais do escopo atual da aplicação.

## Limitações do MVP (Escopo 1.0)
* **Sem Integração Automatizada**: Não há serviços de disparo de mensagens em segundo plano. Todo o agendamento requer que o cliente realize o fluxo de confirmação manual, clicando no botão para abrir o WhatsApp Web/App.
* **Agendamento não vinculativo**: Como não há barreira de pagamento integrado ou confirmação instantânea via API de calendário (ex: Google Calendar), os horários são reservados no Firestore, mas a confirmação oficial depende da conversa no WhatsApp.

## Riscos Técnicos Mapeados
* **Risco de Imagens de Hosts Proibidos**: No passado, presets de temas usavam links diretos de fotos de serviços de bancos de imagens como Unsplash ou Pexels. Se essas imagens fossem removidas ou o host alterasse as permissões, a página pública do profissional ficaria sem fundo ou quebraria visualmente.
  * **Mitigação**: Implementação de regra rígida de validação que remove imagens que não estejam hospedadas no próprio Firebase Storage do Retoria ou pasta `/` local.
* **Bloqueio de Execução de Testes de Regras**: O emulador do Firebase necessita de um ambiente JDK 21+ instalado na máquina de desenvolvimento para validação automatizada de regras locais. A ausência de Java compatível no ambiente local atrasa a homologação de segurança em tempo de desenvolvimento.
  * **Mitigação**: Planejar a migração ou instalação do JDK 21+ ou delegar a execução de `npm run test:rules` a uma esteira de integração contínua (CI).

## Riscos adicionados em 2026-10-21
* **Regras e app precisam subir juntos**: as notas do cliente dependem da regra `customerNotes`; sem publicar as regras, salvar notas falha com permissão negada.
* **Google Agenda**: eventos criados direto no Google bloqueiam a página pública, mas não aparecem no painel; refresh token de app OAuth em modo Teste expira e exige reconexão.
* **Cache local do painel**: o Firestore guarda no aparelho os dados do profissional (IndexedDB) e os mostra por instantes antes da resposta do servidor. Ações continuam validadas no servidor. Em aparelho compartilhado, os dados ficam salvos no navegador mesmo após sair da conta.
* **Região das funções**: rotas de API rodam em `iad1` (EUA). Avaliar `gru1` somente após confirmar o local do Firestore no console do Firebase.
* **Rotas novas sem teste automatizado**: editar, criar manual, cancelar e bloquear horário só têm verificação por build e leitura; exigem homologação manual.
