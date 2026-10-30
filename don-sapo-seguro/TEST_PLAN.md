# Plano de testes — Don Sapo v2

## Agenda
- [ ] 09:00 aceita corte simples.
- [ ] 09:30 aceita procedimento.
- [ ] 10:00 aceita corte simples.
- [ ] 10:30 aceita procedimento.
- [ ] Serviço simples em :30 é rejeitado pela API.
- [ ] Serviço procedimento em :00 é rejeitado pela API.
- [ ] Reserva pendente bloqueia vaga.
- [ ] Reserva cancelada libera vaga.
- [ ] Duas requisições simultâneas para a mesma vaga: somente uma vence.
- [ ] Inserção SQL que se sobrepõe é rejeitada pela constraint.
- [ ] Negar notificações não altera o estado da reserva.

## Administração
- [ ] Senha incorreta retorna mensagem genérica.
- [ ] Rate limit de login é aplicado.
- [ ] Primeiro login exige cadastro TOTP.
- [ ] Próximos logins exigem código TOTP.
- [ ] Sem MFA, endpoints administrativos não retornam dados.
- [ ] CSRF/Origin inválido é rejeitado.
- [ ] Logout revoga sessão.
- [ ] Sessão expira após 8h sem atividade.

## Infraestrutura
- [ ] HTTPS e HSTS ativos.
- [ ] Segredos somente no ambiente da hospedagem.
- [ ] Backup Neon configurado e restauração testada.
- [ ] Monitoramento e alertas configurados.
