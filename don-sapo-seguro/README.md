# Don Sapo — versão local por dispositivo

O Don Sapo agora é um site estático hospedado na Vercel e versionado no GitHub. Não utiliza Neon, Supabase, Firebase, Redis, API própria ou qualquer plataforma de banco de dados.

## Como os dados funcionam

- Os agendamentos são salvos no `localStorage` do navegador.
- A agenda administrativa lê os mesmos dados somente no mesmo navegador e dispositivo.
- Outro celular, computador ou navegador terá uma agenda separada e vazia.
- Os dados não são enviados para a barbearia, não são sincronizados e não há backup automático.
- Limpar os dados do navegador, trocar de aparelho ou usar navegação privada pode apagar os agendamentos.
- Não há bloqueio confiável de horários entre dispositivos; duas pessoas em aparelhos diferentes podem reservar o mesmo horário.

## Painel administrativo

- Na primeira entrada em Área do barbeiro, crie uma senha local com pelo menos 12 caracteres.
- A senha é derivada com PBKDF2 e guardada no armazenamento local do navegador.
- A senha é independente em cada navegador e não equivale à autenticação anterior no servidor.
- Quem tiver acesso ao navegador e às ferramentas de desenvolvedor poderá manipular os dados locais. Não use este modo para dados sensíveis ou operação comercial real.
- Redefinir a senha local não apaga os agendamentos.

## Regras preservadas

- Catálogo, valores, imagens e identidade visual mantidos.
- Cada reserva ocupa 30 minutos.
- Serviços simples usam horários `:00`; procedimentos usam `:30`.
- Horário de atendimento: 09h às 18h.
- Datas permitidas: hoje até 30 dias.
- Pedidos pendentes e confirmados ocupam o horário; cancelados liberam.
- Transições: pendente → confirmado/cancelado; confirmado → cancelado.

## Desenvolvimento e publicação

1. Clone o repositório.
2. Abra a pasta `don-sapo-seguro`.
3. Edite os arquivos em `public/`.
4. Envie as alterações para o GitHub.
5. A Vercel publica o conteúdo da pasta `public` como site estático.

Não é necessário configurar banco de dados, credenciais, `.env` ou instalar dependências de backend.
