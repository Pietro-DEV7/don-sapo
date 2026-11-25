# Plano de testes — armazenamento local

1. Abrir o site em um navegador limpo e confirmar que catálogo, imagens e valores aparecem.
2. Criar uma senha local de pelo menos 12 caracteres no painel administrativo.
3. Criar um agendamento de serviço simples em horário :00.
4. Criar um agendamento com procedimento em horário :30.
5. Tentar reservar novamente o mesmo dia e horário no mesmo navegador: a vaga deve aparecer ocupada.
6. Confirmar um pedido no painel e verificar que o status muda para confirmado.
7. Cancelar um pedido e verificar que o horário volta a ficar disponível.
8. Atualizar a página e confirmar que os dados permanecem no mesmo navegador.
9. Abrir o site em outro navegador ou dispositivo e confirmar que a agenda é independente e vazia.
10. Limpar os dados do site no navegador e confirmar que os dados locais são apagados.

## Limitação esperada
Não há sincronização, concorrência segura, backup, envio de pedidos ao barbeiro nem garantia de exclusividade de horários entre dispositivos. Esses comportamentos foram removidos intencionalmente para eliminar banco de dados e custos externos.
