# Cadastro de produtos completo estilo ERP

## Objetivo
Transformar o módulo de Estoque em um fluxo de cadastro de produtos nível ERP: código de barras com leitor/scanner, SKU, controle de vencimento, vínculo automático por código de barras e cadastro em massa (XML de NF-e e CSV).

## 1. Banco de dados
Novos campos em `products`:
- `codigo_barras` (texto, único por usuário) — EAN/GTIN
- `unidade` (UN, KG, CX, L...)
- `marca`, `ncm`, `fornecedor`
- `descricao`
- `ativo` (verdadeiro/falso)

Nova tabela `product_batches` (lotes) para vencimento por partida:
- produto, número do lote, validade, quantidade, custo do lote
- regras de acesso: cada usuário só vê e edita os próprios lotes

O campo `validade` atual do produto continua funcionando como validade principal; os lotes são opcionais e usados quando o mesmo produto tem várias datas.

## 2. Leitor de código de barras
- Componente de entrada com foco automático que aceita leitores USB/Bluetooth (que digitam e dão Enter).
- Botão "Escanear com a câmera" usando a API nativa do navegador (`BarcodeDetector`), com aviso claro quando o navegador não suportar — nesse caso o leitor físico e a digitação continuam funcionando.
- Bipe/vibração de confirmação e mensagem de erro quando o código não for lido.

## 3. Vínculo automático por código de barras
Tela "Bipar produto" no Estoque:
1. Lê o código.
2. Se existir produto com aquele código: abre o produto, mostra estoque e permite entrada rápida de quantidade.
3. Se não existir: pergunta "Produto não encontrado. Deseja cadastrar?" e abre o formulário já com o código preenchido.

O mesmo comportamento fica disponível na busca do Estoque (digitar/bipar um código filtra direto).

## 4. Formulário de produto completo
Reorganizado em abas:
- **Identificação**: nome, código de barras (com botão de scanner e verificação de duplicado), SKU (com gerador automático), categoria, marca, unidade, NCM, foto
- **Preços**: custo, preço de venda, preço mínimo, margem alvo, prévia de margem/lucro
- **Estoque**: quantidade, alerta mínimo, fornecedor
- **Validade**: validade principal + lista de lotes (adicionar/remover lote com data e quantidade)

## 5. Cadastro em massa
Novo diálogo "Importar produtos" com dois modos:
- **XML de NF-e**: lê o arquivo da nota, extrai cada item (nome, EAN, NCM, unidade, quantidade, custo) e monta uma prévia editável.
- **CSV/planilha**: modelo para download e leitura do arquivo preenchido.

Fluxo comum: prévia em tabela com marcação de "novo" x "já existe" (casado pelo código de barras ou SKU), opção de atualizar existentes ou ignorar, e importação em lote com relatório final de sucesso/erros.

## 6. Lista de estoque
- Coluna de código de barras.
- Busca única que aceita nome, SKU e código de barras.
- Filtros já existentes de vencimento mantidos, somando os lotes vencidos.

## Detalhes técnicos
- Arquivos novos: `src/components/BarcodeScanner.tsx`, `src/components/BarcodeInput.tsx`, `src/components/ProductImportDialog.tsx`, `src/lib/nfeXml.ts`, `src/lib/productImport.ts`, `src/pages/EstoqueBipar.tsx` (ou diálogo dentro do Estoque)
- Arquivos alterados: `src/components/ProductForm.tsx`, `src/pages/Estoque.tsx`, `src/lib/exportEstoque.ts`
- Parsing de XML com `DOMParser` nativo, sem dependências novas
- Índice único parcial em `(user_id, codigo_barras)` para impedir duplicidade
