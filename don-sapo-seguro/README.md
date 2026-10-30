# Don Sapo — versão 2 (Neon PostgreSQL, sem Supabase)

Esta versão mantém a interface, catálogo e imagens do ZIP de origem, remove o SDK/configuração Supabase e adiciona um backend próprio Node.js + Neon PostgreSQL.

## Regras da agenda implementadas

- 09:00, 10:00, 11:00...: **corte simples**.
- 09:30, 10:30, 11:30...: **corte + procedimento**.
- Cada reserva ocupa **exatamente 30 minutos na agenda**, independentemente do serviço selecionado.
- Não há intervalo de descanso, duração adicional nem bloqueio artificial.
- A vaga é validada novamente no servidor e no PostgreSQL. Uma restrição `EXCLUDE USING gist` impede sobreposição de intervalos ativos no banco, inclusive em requisições concorrentes.
- Pedidos pendentes e confirmados bloqueiam a vaga; cancelados liberam.
- A escolha de notificação ocorre **depois** de a API confirmar a gravação. Permissão negada ou ignorada não cancela nem impede a reserva.

## Stack

- Frontend: HTML/CSS/JS preservado.
- Backend: Node.js 20+, Express.
- Banco: Neon PostgreSQL (`@neondatabase/serverless`).
- Senhas: Argon2id.
- MFA: TOTP (Google Authenticator, Microsoft Authenticator, 1Password etc.).
- Sessões: token aleatório armazenado somente como SHA-256 no banco; cookie `HttpOnly`, `SameSite=Strict`, `Secure` em produção; expiração de 8h e renovação por atividade.
- CSRF: token em cookie separado + header `X-CSRF-Token`, além de validação estrita de Origin.
- Limitação de tentativas: rate limit para login e criação de reservas.
- Segredos TOTP: AES-256-GCM com chave externa ao banco.
- SQL parametrizado; mensagens de erro genéricas ao cliente; logs de servidor sem dados pessoais.

## Instalação local

1. Instale Node.js 20 ou superior.
2. Crie um banco no Neon e copie a connection string.
3. Copie `.env.example` para `.env` e preencha `DATABASE_URL`, `APP_ORIGIN` e `APP_ENCRYPTION_KEY`.
4. Gere a chave de criptografia com `openssl rand -base64 32`.
5. Execute o SQL de `db/migrations/001_initial.sql` no SQL Editor do Neon.
6. Instale dependências: `npm install`.
7. Crie o administrador inicial com variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD` e rode `npm run admin:create`. A senha precisa ter pelo menos 16 caracteres.
8. Inicie: `npm start`.
9. Abra `http://localhost:3000` (para desenvolvimento, ajuste `APP_ORIGIN=http://localhost:3000` e `NODE_ENV=development`).
10. Entre em Área do barbeiro. No primeiro login, configure TOTP pelo QR code. Nos próximos logins, será exigido o código do autenticador.

Exemplo para criar admin sem gravar a senha no código (Linux/macOS):

```bash
ADMIN_EMAIL='barbeiro@seudominio.com' ADMIN_PASSWORD='uma-frase-senha-longa-com-mais-de-16-caracteres' npm run admin:create
```

No PowerShell:

```powershell
$env:ADMIN_EMAIL='barbeiro@seudominio.com'
$env:ADMIN_PASSWORD='uma-frase-senha-longa-com-mais-de-16-caracteres'
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

## Deploy

O frontend e a API precisam ficar sob a **mesma origem** para que os cookies e a proteção CSRF funcionem como configurados. Publique este projeto em um serviço Node compatível (Render, Railway, Fly.io ou VPS), configure as variáveis de ambiente e use HTTPS. Não publique somente o `index.html` no GitHub Pages: GitHub Pages não executa o backend.

Variáveis obrigatórias em produção:
- `DATABASE_URL`: Neon connection string com SSL.
- `APP_ENCRYPTION_KEY`: Base64 de 32 bytes, guarde no gerenciador de secrets da hospedagem; não versionar.
- `APP_ORIGIN`: URL HTTPS exata do domínio publicado.
- `NODE_ENV=production`.
- `PORT`: normalmente fornecida pela hospedagem.

## Segurança e limites honestos

Este pacote fornece autenticação Argon2id + TOTP, sessão com cookie protegido, validação CSRF/Origin, rate limiting básico, queries parametrizadas, autorização no backend e restrição de conflito no PostgreSQL. Ainda exige configuração operacional para produção:

- Use HTTPS e configure HSTS no proxy/hospedagem.
- Configure WAF/Cloudflare Turnstile no edge se quiser CAPTCHA após tentativas suspeitas; o CAPTCHA não está integrado neste pacote.
- Configure backups automáticos no Neon e teste restauração.
- Use usuário/credencial de banco com privilégios mínimos; a connection string da aplicação deve ser dedicada e nunca ir ao navegador.
- Configure alertas de login suspeito no provedor/monitoramento. O pacote registra alterações de status, mas não implementa e-mail/push para novo dispositivo.
- A notificação do navegador aqui é apenas uma confirmação local após o agendamento. Não é push remoto nem lembrete agendado; isso requer service worker + Web Push/VAPID ou integração de mensageria.
- Não existe garantia absoluta de inviolabilidade. Faça revisão, testes e monitoramento antes de receber clientes reais.

## Testes manuais obrigatórios

1. Fazer duas reservas em sequência: 09:00 simples e 09:30 procedimento; ambas devem funcionar.
2. Tentar reservar 09:00 novamente: deve retornar conflito.
3. Tentar reservar corte simples às 09:30 ou procedimento às 09:00: servidor deve rejeitar.
4. Tentar criar duas reservas simultâneas para a mesma vaga: apenas uma deve ser gravada.
5. Tentar inserir diretamente no banco uma reserva sobreposta: a constraint `bookings_no_overlap` deve rejeitar.
6. Cancelar uma reserva e confirmar que o horário volta a aparecer.
7. Recusar notificações e confirmar que a reserva continua gravada.
8. Fazer login admin, configurar TOTP e verificar que as rotas administrativas exigem MFA.
9. Confirmar que um usuário sem sessão não consegue ler nem alterar a agenda administrativa.

## Arquivos

- `public/index.html`: interface pública/admin e integração com API.
- `public/assets/`: imagens do catálogo.
- `server.js`: backend/API, login, TOTP, sessões e agendamentos.
- `db/migrations/001_initial.sql`: estrutura e constraints do Neon.
- `scripts/create-admin.js`: criação/rotação segura do administrador.
- `.env.example`: nomes das variáveis, sem segredos reais.
