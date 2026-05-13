# Plano para corrigir o container cortado

## Objetivo
Eliminar de vez o corte nos popups, especialmente no detalhe do cliente, para que todo modal sempre caiba na viewport e role corretamente por dentro.

## O que vou implementar
1. Reforçar o componente base de diálogo
   - Ajustar o `DialogContent` para usar um wrapper com alinhamento, margem de respiro e altura máxima real da viewport.
   - Garantir que o container externo e o conteúdo interno não disputem scroll.
   - Preservar animação e comportamento de fechamento.

2. Corrigir o modal de detalhe do cliente
   - Transformar o conteúdo em layout mais resiliente para altura e largura.
   - Aplicar `min-w-0`, `overflow-x-auto` e/ou quebras adequadas nas seções que podem empurrar o container.
   - Evitar que tabelas e linhas de ação forcem largura ou altura além do espaço disponível.

3. Revisar diálogos aninhados e formulários da tela de clientes
   - Ajustar o modal “Novo Cliente” e o submodal de recebimento dentro de `CustomerDetail` para seguir a mesma regra.
   - Remover classes locais que possam reintroduzir corte ou scroll incorreto.

4. Validar visualmente
   - Abrir os modais críticos no preview e confirmar que:
     - topo e rodapé ficam acessíveis,
     - há rolagem interna quando necessário,
     - nenhuma lateral fica escondida,
     - o botão fechar continua acessível.

## Resultado esperado
- O popup abre inteiro dentro da tela.
- Se o conteúdo for grande, o scroll acontece dentro do modal.
- Tabelas/seções largas não cortam mais o container.

## Detalhes técnicos
- Arquivos principais: `src/components/ui/dialog.tsx`, `src/components/CustomerDetail.tsx`, `src/pages/Clientes.tsx`
- Ajustes prováveis:
  - `max-h` com `100dvh`
  - wrappers com `overflow-y-auto`
  - conteúdo com `min-w-0`
  - seções de tabela com `overflow-x-auto`
  - revisão de classes locais como `overflow-hidden` e `max-h-[90vh]`