

# Gestão do Meu Negócio — Fase 1

## Visão Geral
App web responsivo (desktop-first, mobile friendly) com tema **escuro** para gestão de negócio próprio. Backend com **Supabase** (auth + banco + edge functions). Moeda BRL, datas pt-BR, fuso America/Sao_Paulo.

---

## O que entra na Fase 1

### 1. Autenticação
- Login e cadastro com email/senha
- Tela de redefinição de senha
- Todas as rotas protegidas

### 2. Banco de Dados (Supabase)
Tabelas criadas nesta fase:
- **customers** — dados do cliente (nome, WhatsApp, email, foto, status)
- **products** — estoque (custo, preço, margem, alerta mínimo)
- **sales** + **sale_items** — vendas com itens
- **installments** — parcelas com vencimento e status
- **expenses** — contas a pagar (com suporte a recorrência)
- **cash_movements** — movimentações financeiras (entrada/saída)

Todas com RLS por usuário autenticado.

### 3. Navegação (Sidebar)
Sidebar colapsável com dark mode, contendo:
- Dashboard
- Calendário
- Clientes
- Vendas / Parcelas
- Financeiro
- Estoque
- Contas a Pagar
- *(Relatórios e Configurações ficam para Fase 2)*

### 4. Dashboard
- **6 cards KPI** do mês: Entradas, Saídas, Lucro, A Receber, A Pagar, Vence Hoje
- **Ações rápidas**: + Novo Cliente, + Nova Venda, + Nova Conta, Registrar Pagamento
- **Mini calendário** com lista de vencimentos do dia (parcelas e contas)
- Clique em vencimento → detalhe com botão "Marcar como pago"

### 5. Clientes
- **Lista** com busca e filtros (ativo/inativo, com atraso)
- Colunas: Nome, Próximo Vencimento, Em Aberto, Status (cores)
- **Criação rápida** (< 30 segundos)
- **Detalhe do cliente** com:
  - Header (foto, nome, WhatsApp, botões de ação)
  - Resumo financeiro calculado (última compra, total comprado, total em aberto, parcelas restantes, próximo vencimento, ticket médio)
  - Aba Compras (histórico de vendas)
  - Aba Parcelas (com status colorido e ações)

### 6. Vendas / Parcelas
- **Wizard de venda** em passos:
  1. Escolher ou criar cliente
  2. Adicionar produtos (preço editável)
  3. Desconto
  4. Forma de pagamento: à vista ou parcelado (nº parcelas, data 1º vencimento, intervalo mensal)
  5. Confirmar → gera parcelas automaticamente
- **Tela de Parcelas**: filtros por status, período (hoje/7 dias/atrasadas), cliente
- Ações: Marcar pago, Reagendar
- Status com cores: 🟢 Em dia, 🟡 Vence hoje, 🔴 Atrasado, ⚪ Pago

### 7. Calendário (tela completa)
- Visão mensal com eventos:
  - Parcelas: "Cliente X — Parcela 2/6 — R$..."
  - Contas: "Aluguel — R$..."
- Filtros: Parcelas / Contas / Ambos, por status
- Clique no evento → detalhe com ação rápida (marcar pago)

### 8. Estoque
- Lista de produtos: custo, preço, margem calculada, estoque atual, alerta baixo
- Detalhe do produto: lucro por unidade, margem %, preço mínimo de promoção (custo × 1.10 ou configurável)
- CRUD completo

### 9. Contas a Pagar
- CRUD com campos: descrição, categoria, valor, vencimento, status
- Suporte a recorrência (mensal/semanal/anual) — gera próximas automaticamente
- Contas aparecem no calendário

### 10. Financeiro
- Fluxo de caixa por mês (tabela de movimentações)
- Gráfico simples: Entradas × Saídas mensal (Recharts)
- Baseado em cash_movements gerados ao registrar pagamentos e despesas

### 11. Notificações — Modo 1 (sem API WhatsApp)
- Botão "Enviar lembrete" no cliente e na parcela
- Gera mensagem pré-formatada e abre `https://wa.me/<numero>?text=...`
- Template: "Olá, {nome}. Hoje ({data}) vence a parcela {x}/{y} no valor de {valor}..."

### 12. Lógica de Status e Alertas
- Status automático baseado em data:
  - Pendente + vencimento == hoje → "Vence hoje" (amarelo)
  - Pendente + vencimento < hoje → "Atrasado" (vermelho)
  - Pago → verde
- Visual com badges coloridos em todas as telas

---

## O que fica para Fase 2
- Relatórios com exportação CSV
- Configurações (nome do negócio, margem mínima, categorias)
- Score de risco do cliente
- Renegociação de parcelas com log
- Comprovante (anexar imagem/PDF no pagamento)
- Metas do mês
- WhatsApp Modo 2 (API oficial com agendamento automático)
- Auditoria (log de alterações)
- Notificação interna no app (ícone de sino)

