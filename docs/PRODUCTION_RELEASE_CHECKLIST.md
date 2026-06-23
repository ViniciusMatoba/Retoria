# Checklist de Lançamento em Produção - Retoria

Este checklist engloba as validações necessárias para a implantação final do projeto em larga escala.

## Requisitos de Produção

### 1. Infraestrutura e Segurança
- [ ] Conexão e credenciais do banco de dados de produção Firebase isoladas do ambiente de teste.
- [ ] Regras de segurança de banco de dados (`firestore.rules` e `storage.rules`) aplicadas e testadas em produção.
- [ ] Nenhuma chave secreta ou credencial exposta no código-fonte ou no repositório.
- [ ] HTTPS ativado em todos os domínios associados.

### 2. Qualidade de Código e CI/CD
- [ ] Build de produção otimizado compilado com sucesso.
- [ ] Pipeline de CI configurado para rodar a suíte completa de testes (`test:themes`, `test:rules`) em cada Pull Request para a branch `main`.
- [ ] Cobertura de testes validada e sem regressões críticas.

### 3. Integração com WhatsApp
- [ ] Redirecionamento da página pública para o WhatsApp (`wa.me`) testado com números reais em diferentes viewports e sistemas (iOS / Android).
- [ ] Limpeza correta de caracteres especiais e espaços em branco na formatação do link do WhatsApp.
