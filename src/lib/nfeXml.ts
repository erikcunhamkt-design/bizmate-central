import type { ImportRow } from "@/lib/productImport";

function text(el: Element | null | undefined, tag: string) {
  const node = el?.getElementsByTagName(tag)?.[0];
  return node?.textContent?.trim() || "";
}

function num(value: string) {
  const n = Number((value || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export interface NFeInfo {
  emitente: string;
  numero: string;
  emissao: string;
  itens: ImportRow[];
}

/** Lê um XML de NF-e (modelo 55) e devolve os itens prontos para importação */
export function parseNFeXml(xml: string): NFeInfo {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Arquivo XML inválido.");
  }

  const dets = Array.from(doc.getElementsByTagName("det"));
  if (!dets.length) throw new Error("Nenhum item encontrado no XML. Verifique se é um XML de NF-e.");

  const emit = doc.getElementsByTagName("emit")[0];
  const ide = doc.getElementsByTagName("ide")[0];
  const emitente = text(emit, "xNome") || text(emit, "xFant");

  const itens: ImportRow[] = dets.map((det) => {
    const prod = det.getElementsByTagName("prod")[0];
    const ean = text(prod, "cEAN") || text(prod, "cEANTrib");
    const codigoBarras = /^\d{8,14}$/.test(ean) ? ean : "";
    const custo = num(text(prod, "vUnCom"));

    return {
      nome: text(prod, "xProd"),
      codigo_barras: codigoBarras,
      sku: text(prod, "cProd"),
      categoria: "",
      marca: "",
      unidade: (text(prod, "uCom") || "UN").toUpperCase().slice(0, 6),
      ncm: text(prod, "NCM"),
      fornecedor: emitente,
      custo_unitario: custo,
      preco_padrao: 0,
      estoque_atual: Math.round(num(text(prod, "qCom"))),
      alerta_estoque_minimo: 5,
      validade: "",
      descricao: "",
    };
  });

  return {
    emitente,
    numero: text(ide, "nNF"),
    emissao: (text(ide, "dhEmi") || text(ide, "dEmi")).slice(0, 10),
    itens,
  };
}
