export interface ImportRow {
  nome: string;
  codigo_barras: string;
  sku: string;
  categoria: string;
  marca: string;
  unidade: string;
  ncm: string;
  fornecedor: string;
  custo_unitario: number;
  preco_padrao: number;
  estoque_atual: number;
  alerta_estoque_minimo: number;
  validade: string;
  descricao: string;
}

export const CSV_COLUMNS = [
  "nome",
  "codigo_barras",
  "sku",
  "categoria",
  "marca",
  "unidade",
  "ncm",
  "fornecedor",
  "custo_unitario",
  "preco_padrao",
  "estoque_atual",
  "alerta_estoque_minimo",
  "validade",
  "descricao",
] as const;

export const UNIDADES = ["UN", "CX", "KG", "G", "L", "ML", "PC", "PCT", "M", "DZ"];

export function emptyImportRow(): ImportRow {
  return {
    nome: "",
    codigo_barras: "",
    sku: "",
    categoria: "",
    marca: "",
    unidade: "UN",
    ncm: "",
    fornecedor: "",
    custo_unitario: 0,
    preco_padrao: 0,
    estoque_atual: 0,
    alerta_estoque_minimo: 5,
    validade: "",
    descricao: "",
  };
}

function splitCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function toNumber(value: string) {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function toDate(value: string) {
  const v = (value || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}

export function parseProductsCsv(content: string): ImportRow[] {
  const clean = content.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw new Error("Arquivo vazio.");

  const sep = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ";" : ",";
  const header = splitCsvLine(lines[0], sep).map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_"),
  );

  if (!header.includes("nome")) throw new Error('A planilha precisa ter a coluna "nome".');

  const get = (cells: string[], key: string) => {
    const i = header.indexOf(key);
    return i >= 0 ? cells[i] || "" : "";
  };

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, sep);
    return {
      ...emptyImportRow(),
      nome: get(cells, "nome"),
      codigo_barras: get(cells, "codigo_barras").replace(/\D/g, ""),
      sku: get(cells, "sku"),
      categoria: get(cells, "categoria"),
      marca: get(cells, "marca"),
      unidade: (get(cells, "unidade") || "UN").toUpperCase(),
      ncm: get(cells, "ncm"),
      fornecedor: get(cells, "fornecedor"),
      custo_unitario: toNumber(get(cells, "custo_unitario")),
      preco_padrao: toNumber(get(cells, "preco_padrao")),
      estoque_atual: Math.round(toNumber(get(cells, "estoque_atual"))),
      alerta_estoque_minimo: Math.round(toNumber(get(cells, "alerta_estoque_minimo"))) || 5,
      validade: toDate(get(cells, "validade")),
      descricao: get(cells, "descricao"),
    };
  }).filter((r) => r.nome);
}

export function downloadCsvTemplate() {
  const header = CSV_COLUMNS.join(";");
  const example = [
    "Camiseta Premium",
    "7891234567895",
    "CAM-001",
    "Roupas",
    "Marca X",
    "UN",
    "61091000",
    "Fornecedor Y",
    "19,90",
    "49,90",
    "10",
    "5",
    "31/12/2027",
    "Camiseta 100% algodão",
  ].join(";");

  const blob = new Blob(["\uFEFF" + header + "\n" + example + "\n"], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-produtos.csv";
  link.click();
  URL.revokeObjectURL(url);
}
