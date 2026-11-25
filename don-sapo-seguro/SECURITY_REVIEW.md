# Revisão de segurança — modo local

## Escopo
O projeto foi convertido de backend + Neon PostgreSQL para site estático com armazenamento local no navegador.

## Limitações importantes
- `localStorage` não é banco de dados, não é compartilhado entre dispositivos e não oferece integridade transacional.
- A validação de horário acontece no navegador e pode ser contornada por quem controla o dispositivo.
- A senha administrativa local é apenas uma barreira básica de interface. Não protege os dados contra alguém com acesso ao navegador ou DevTools.
- Não há autenticação no servidor, CSRF, sessão remota, rate limiting, backups ou prevenção global de reservas duplicadas.
- Dados podem ser apagados pelo navegador, pelo usuário ou por limpeza automática do dispositivo.

## Recomendação
Este modo atende apenas a uso pessoal/teste local por dispositivo. Não é adequado para receber agendamentos reais de clientes que precisem chegar ao barbeiro ou sincronizar entre aparelhos. Para isso será necessário um backend e armazenamento central, o que foi explicitamente descartado para evitar custos.
