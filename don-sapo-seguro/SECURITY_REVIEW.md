# Revisão de segurança — Don Sapo v2

## Implementado no código
- Argon2id para senhas administrativas.
- TOTP obrigatório para liberar leitura/alteração da agenda.
- Segredo TOTP cifrado com AES-256-GCM; chave externa via ambiente.
- Sessão aleatória com hash no banco, cookie HttpOnly, SameSite=Strict e Secure em produção.
- Expiração por inatividade de 8 horas e troca do identificador de sessão após login.
- CSRF por cookie/header e validação estrita de Origin em operações mutáveis.
- Rate limit básico em login e criação de reserva.
- SQL parametrizado e validação server-side.
- Dados do cliente e status não são aceitos como fonte de verdade do browser; preço/nomes/tipo vêm do banco.
- Constraint PostgreSQL de exclusão GiST para bloquear sobreposição em qualquer tentativa de gravação.
- Erros internos não são enviados ao cliente; recebem requestId e log no servidor.

## Não implementado / depende de operação
- CAPTCHA/Turnstile após falhas; WAF.
- Notificações remotas de novo dispositivo e alertas ativos.
- Web Push e lembretes agendados. A permissão local do navegador não equivale a push.
- Backups e restauração: configurar no Neon e testar.
- HSTS: configurar no proxy/host HTTPS.
- Política de senha vazada: não há consulta a base de senhas comprometidas neste código.
- MFA por passkey/WebAuthn e códigos de recuperação.
- Bloqueio progressivo customizado por conta/dispositivo além do rate limit por IP.
- Isolamento de credenciais/roles no Neon: configurar credencial de aplicação de privilégio mínimo no provedor.

Não declarar o sistema "invulnerável" ou pronto para produção sem configurar e executar o plano de testes do README.
