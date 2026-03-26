import { formatBRL } from "@/lib/currency";

interface ProductForExport {
  nome: string;
  categoria: string | null;
  sku: string | null;
  custo_unitario: number;
  preco_padrao: number;
  estoque_atual: number;
  alerta_estoque_minimo: number;
}

function calcMargem(custo: number, preco: number) {
  return preco === 0 ? 0 : ((preco - custo) / preco * 100);
}

export function exportEstoqueCSV(products: ProductForExport[], filename = "estoque.csv") {
  const header = "Nome,Categoria,SKU,Custo Unitário,Preço Venda,Margem %,Estoque Atual,Alerta Mínimo,Valor Estoque (Custo),Valor Estoque (Venda)\n";
  const rows = products.map(p => {
    const margem = calcMargem(p.custo_unitario, p.preco_padrao);
    return [
      `"${p.nome}"`,
      `"${p.categoria || ""}"`,
      `"${p.sku || ""}"`,
      p.custo_unitario.toFixed(2),
      p.preco_padrao.toFixed(2),
      margem.toFixed(1),
      p.estoque_atual,
      p.alerta_estoque_minimo,
      (p.estoque_atual * p.custo_unitario).toFixed(2),
      (p.estoque_atual * p.preco_padrao).toFixed(2),
    ].join(",");
  }).join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportEstoquePDF(products: ProductForExport[]) {
  const totalCusto = products.reduce((acc, p) => acc + p.estoque_atual * p.custo_unitario, 0);
  const totalVenda = products.reduce((acc, p) => acc + p.estoque_atual * p.preco_padrao, 0);

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const rows = products.map(p => {
    const margem = calcMargem(p.custo_unitario, p.preco_padrao);
    const margemColor = margem >= 30 ? "#22c55e" : margem >= 15 ? "#f59e0b" : "#ef4444";
    const stockColor = p.estoque_atual === 0 ? "#ef4444" : p.estoque_atual <= p.alerta_estoque_minimo ? "#f59e0b" : "inherit";
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.nome}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.categoria || "—"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.sku || "—"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;">${formatBRL(p.custo_unitario)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;font-weight:600;">${formatBRL(p.preco_padrao)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;"><span style="color:${margemColor};font-weight:700;">${margem.toFixed(1)}%</span></td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;font-weight:600;color:${stockColor};">${p.estoque_atual}</td>
    </tr>`;
  }).join("");

  printWindow.document.write(`<!DOCTYPE html><html><head><title>Relatório de Estoque</title>
    <style>@media print{body{margin:0}}</style></head><body style="font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#1a1a1a;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:2px solid #3b82f6;padding-bottom:16px;">
      <div><h1 style="margin:0;font-size:22px;">Relatório de Estoque</h1>
      <p style="margin:4px 0 0;color:#666;font-size:13px;">${dateStr} às ${timeStr} • ${products.length} produtos</p></div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;color:#666;">Valor em Estoque (Custo)</p>
        <p style="margin:2px 0 0;font-size:16px;font-weight:700;">${formatBRL(totalCusto)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#666;">Potencial de Venda</p>
        <p style="margin:2px 0 0;font-size:16px;font-weight:700;color:#22c55e;">${formatBRL(totalVenda)}</p>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Produto</th>
        <th style="padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Categoria</th>
        <th style="padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">SKU</th>
        <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Custo</th>
        <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Preço</th>
        <th style="padding:8px;text-align:center;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Margem</th>
        <th style="padding:8px;text-align:center;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Estoque</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=()=>{window.print()}</script>
  </body></html>`);
  printWindow.document.close();
}
