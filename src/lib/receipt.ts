import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/currency";

export type ReceiptAllocation = {
  numero_parcela: number;
  total_parcelas: number;
  valor_aplicado: number;
  tipo: "parcela" | "abatimento" | string;
};

export type ReceiptData = {
  empresa?: string;
  cliente: string;
  clienteCpf?: string | null;
  valorTotal: number;
  data: string; // yyyy-MM-dd
  metodo: string;
  operador?: string | null;
  observacoes?: string | null;
  vendaData?: string | null; // yyyy-MM-dd
  vendaTotal?: number | null;
  alocacoes: ReceiptAllocation[];
  numeroRecibo?: string;
};

const formatDateBR = (iso: string) => {
  try {
    return format(new Date(iso + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
};

export function generateReceiptPDF(data: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 20;

  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(data.empresa || "BizMate", margin, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Recibo de pagamento", pageWidth - margin, 9, { align: "right" });

  doc.setTextColor(20, 20, 20);
  y = 26;

  // Title + receipt number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RECIBO", margin, y);
  if (data.numeroRecibo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(`Nº ${data.numeroRecibo}`, pageWidth - margin, y, { align: "right" });
    doc.setTextColor(20, 20, 20);
  }
  y += 8;

  // Highlighted amount
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 3, 3, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text("Valor recebido", margin + 5, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(formatBRL(data.valorTotal), margin + 5, y + 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(formatDateBR(data.data), pageWidth - margin - 5, y + 17, { align: "right" });
  doc.setTextColor(20, 20, 20);
  y += 30;

  // Two column info
  const drawField = (label: string, value: string, x: number, yy: number, w: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(value || "—", w);
    doc.text(lines, x, yy + 5);
  };

  const colW = (pageWidth - margin * 2 - 6) / 2;
  drawField("Recebido de", data.cliente, margin, y, colW);
  drawField("Forma de recebimento", data.metodo.toUpperCase(), margin + colW + 6, y, colW);
  y += 14;

  if (data.clienteCpf) {
    drawField("CPF", data.clienteCpf, margin, y, colW);
  }
  if (data.operador) {
    drawField("Operador", data.operador, margin + colW + 6, y, colW);
  }
  if (data.clienteCpf || data.operador) y += 14;

  if (data.vendaData) {
    drawField(
      "Referente à venda",
      `${formatDateBR(data.vendaData)}${data.vendaTotal ? ` — ${formatBRL(data.vendaTotal)}` : ""}`,
      margin,
      y,
      pageWidth - margin * 2,
    );
    y += 14;
  }

  // Allocations table
  if (data.alocacoes.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text("Distribuição do pagamento", margin, y);
    y += 5;

    doc.setFillColor(245, 245, 247);
    doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("PARCELA", margin + 3, y + 5);
    doc.text("TIPO", margin + 70, y + 5);
    doc.text("VALOR APLICADO", pageWidth - margin - 3, y + 5, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    for (const a of data.alocacoes) {
      doc.setDrawColor(230, 230, 232);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);
      doc.text(`${a.numero_parcela}/${a.total_parcelas}`, margin + 3, y + 5);
      doc.text(a.tipo === "abatimento" ? "Abatimento futuro" : "Parcela", margin + 70, y + 5);
      doc.text(formatBRL(a.valor_aplicado), pageWidth - margin - 3, y + 5, { align: "right" });
      y += 8;
    }
    y += 4;
  }

  // Observations
  if (data.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text("OBSERVAÇÕES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(data.observacoes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  // Declaration
  y = Math.max(y + 6, 200);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const declar = `Declaro para os devidos fins que recebi de ${data.cliente} a importância de ${formatBRL(
    data.valorTotal,
  )} (${data.metodo}) referente ao pagamento descrito acima, dando plena e total quitação do valor recebido.`;
  const declarLines = doc.splitTextToSize(declar, pageWidth - margin * 2);
  doc.text(declarLines, margin, y);
  y += declarLines.length * 5 + 18;

  // Signature line
  doc.setDrawColor(80, 80, 80);
  doc.line(margin + 30, y, pageWidth - margin - 30, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(data.empresa || "BizMate", pageWidth / 2, y + 5, { align: "center" });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • BizMate`,
    pageWidth / 2,
    287,
    { align: "center" },
  );

  const filename = `recibo-${data.cliente.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${data.data}.pdf`;
  doc.save(filename);
}
