
# Plano para organizar pagamentos maiores que a parcela

## Ideia principal

Criar um fluxo chamado **Receber pagamento** em vez de apenas “Pagar parcela”.

Quando o cliente pagar um valor maior que a parcela atual, o app não vai “bagunçar” o valor original da venda nem apagar parcelas futuras. Ele vai registrar o dinheiro recebido e distribuir esse valor nas parcelas em aberto, mantendo histórico claro.

Exemplo:

```text
Venda parcelada: R$ 600 em 3x de R$ 200

Parcela 1 vence em abril: R$ 200
Cliente paga R$ 300

Resultado:
- Parcela 1: paga com R$ 200
- Parcela 2: fica parcialmente abatida com R$ 100
- Caixa do mês atual: entra R$ 300
- A receber futuro: diminui R$ 300
```

Assim o app separa duas coisas importantes:

```text
Dinheiro recebido no mês = quando o cliente pagou
Valor a receber = quanto ainda falta das parcelas
```

## Regras de negócio

1. **A venda original não muda**
   - O total vendido continua igual.
   - As parcelas originais continuam existindo.
   - Isso evita confusão em relatórios e histórico.

2. **O pagamento maior vira abatimento**
   - Primeiro quita a parcela selecionada.
   - O excedente vai automaticamente para as próximas parcelas pendentes do mesmo cliente/venda, por ordem de vencimento.

3. **Parcela pode ter 3 estados**
   - `pendente`: nada pago ainda.
   - `parcial`: recebeu parte do valor, mas ainda falta.
   - `pago`: recebeu o valor total da parcela.

4. **Não permitir pagar mais que o saldo em aberto**
   - Se a venda ainda tem R$ 500 em aberto, o app não deve aceitar pagamento de R$ 600 sem aviso.
   - Isso evita “crédito solto” sem controle.
   - Podemos futuramente criar “saldo/crédito do cliente”, mas para agora o mais seguro é bloquear excesso acima da dívida total.

5. **Entrada financeira é registrada uma única vez**
   - Se o cliente pagou R$ 300, entra apenas um lançamento de R$ 300 no caixa.
   - Mesmo que esse valor quite uma parcela e abata outra, não devem ser criadas entradas duplicadas.

## O que será alterado na interface

### Em Vendas > Parcelas

Trocar o botão atual **Pagar** por **Receber**.

Ao clicar, abrir um modal com:

- Cliente
- Parcela selecionada
- Valor da parcela
- Valor já recebido
- Valor restante
- Campo: **Valor recebido**
- Campo: **Data do pagamento**
- Campo: **Forma de recebimento**
- Campo opcional: **Observação**
- Prévia automática da distribuição

Exemplo da prévia:

```text
Você está recebendo R$ 300,00

Aplicação:
- Parcela 1/3: R$ 200,00 — ficará paga
- Parcela 2/3: R$ 100,00 — ficará parcialmente paga

Entrada no caixa: R$ 300,00 em 21/04/2026
```

### Na tabela de parcelas

Adicionar informações mais claras:

```text
Parcela | Valor | Recebido | Falta | Status
1/3     | 200   | 200      | 0     | Pago
2/3     | 200   | 100      | 100   | Parcial
3/3     | 200   | 0        | 200   | Pendente
```

### Dentro do cliente

Na seção **Venda x Pagamento**, mostrar:

- Total da venda
- Total recebido
- Total pendente
- Progresso do pagamento

E nas parcelas do cliente:

- Valor original
- Valor recebido
- Valor faltante
- Histórico dos pagamentos/abatimentos

## Alterações técnicas

### Banco de dados

Criar duas tabelas novas.

#### 1. `customer_payments`

Guarda o pagamento real que entrou no caixa.

Campos principais:

- `id`
- `user_id`
- `customer_id`
- `sale_id`
- `valor_total`
- `data_pagamento`
- `metodo_recebimento`
- `observacoes`
- `created_at`

#### 2. `payment_allocations`

Guarda como o pagamento foi distribuído entre as parcelas.

Campos principais:

- `id`
- `user_id`
- `payment_id`
- `installment_id`
- `valor_aplicado`
- `tipo`
  - `parcela`
  - `abatimento`
- `created_at`

Exemplo:

```text
customer_payments
Pagamento: R$ 300

payment_allocations
- R$ 200 na parcela 1
- R$ 100 na parcela 2
```

### Atualização das parcelas

Ao registrar pagamento:

1. Buscar parcelas pendentes/parciais da mesma venda.
2. Calcular quanto falta em cada parcela.
3. Aplicar o pagamento na ordem de vencimento.
4. Atualizar:
   - `pago_valor`
   - `pago_em`
   - `metodo_recebimento`
   - `status`
5. Criar um único lançamento em `cash_movements` com o valor total recebido.
6. Invalidar os dados de:
   - Vendas
   - Parcelas
   - Cliente
   - Dashboard
   - Financeiro
   - Metas de faturamento

### Dashboard

Atualizar os cálculos para considerar pagamento parcial/abatimento:

- **Entradas**: continuam vindo do caixa, pela data real do pagamento.
- **A receber parcelado**: soma apenas o que ainda falta nas parcelas.
- **A receber no mês**: soma o saldo restante das parcelas que vencem no mês.
- **Clientes atrasados**: considerar apenas parcelas com saldo restante.
- **Vence hoje**: considerar pendentes e parciais que ainda têm saldo.

### Gráficos e financeiro

Garantir que:

- O gráfico de recebido use o valor real recebido no mês.
- O total vendido continue vindo das vendas.
- O contas/financeiro mostre uma única entrada por pagamento recebido.
- Abatimentos futuros reduzam o “a receber” sem criar receita duplicada no mês futuro.

## Arquivos que serão ajustados

- `src/pages/Vendas.tsx`
  - Novo modal de recebimento.
  - Nova lógica de pagamento com abatimento.
  - Tabela de parcelas com recebido/falta.

- `src/components/CustomerDetail.tsx`
  - Atualizar “Venda x Pagamento”.
  - Mostrar parcelas parciais.
  - Mostrar histórico de pagamentos/abatimentos.

- `src/hooks/useDashboardData.ts`
  - Recalcular valores a receber usando saldo restante, não apenas `valor_parcela`.

- `src/hooks/useMonthlySalesData.ts`
  - Ajustar recebido mensal para refletir pagamentos reais.

- `src/pages/Financeiro.tsx`
  - Melhorar descrição das entradas de pagamentos parcelados.

- Nova migration do banco
  - Criar `customer_payments`.
  - Criar `payment_allocations`.
  - Criar políticas de segurança por usuário.

## Resultado esperado

Depois disso, quando o cliente pagar mais que uma parcela:

```text
O caixa mostra exatamente o dinheiro que entrou.
A parcela atual fica paga.
A próxima parcela já aparece abatida.
O dashboard reduz o valor a receber.
O histórico do cliente mostra tudo de forma organizada.
Os relatórios não duplicam receita.
```
