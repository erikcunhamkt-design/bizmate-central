import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/currency";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ShoppingCart, CheckCircle, AlertTriangle, Package } from "lucide-react";

interface CustomerDetailProps {
  customerId: string | null;
  customerName: string;
  onClose: () => void;
}

export function CustomerDetail({ customerId, customerName, onClose }: CustomerDetailProps) {
  const { data: sales = [] } = useQuery({
    queryKey: ["customer-sales", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, sale_items(*, products(nome))").eq("customer_id", customerId!).order("data_compra", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["customer-installments", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("installments").select("*").eq("customer_id", customerId!).order("vencimento_data");
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const totalComprado = sales.reduce((s, sale) => s + sale.total_venda, 0);
  const totalPago = installments.filter(i => i.status === "pago").reduce((s, i) => s + (i.pago_valor ?? i.valor_parcela), 0);
  const vendasAVista = sales.filter(s => s.status === "pago" && !installments.some(i => i.sale_id === s.id)).reduce((s, sale) => s + sale.total_venda, 0);
  const totalPagoGeral = totalPago + vendasAVista;
  const totalDevendo = installments.filter(i => i.status === "pendente").reduce((s, i) => s + i.valor_parcela, 0);

  const productMap = new Map<string, { nome: string; qtd: number; total: number }>();
  for (const sale of sales) {
    for (const item of (sale as any).sale_items ?? []) {
      const key = item.product_id;
      const existing = productMap.get(key);
      if (existing) { existing.qtd += item.quantidade; existing.total += item.subtotal; }
      else { productMap.set(key, { nome: (item as any).products?.nome ?? "Produto removido", qtd: item.quantidade, total: item.subtotal }); }
    }
  }
  const productsList = Array.from(productMap.values());

  const kpis = [
    { label: "Total Comprado", value: totalComprado, icon: ShoppingCart, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Pago", value: totalPagoGeral, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
    { label: "Devendo", value: totalDevendo, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <Dialog open={!!customerId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{customerName.charAt(0).toUpperCase()}</span>
            </div>
            {customerName}
          </DialogTitle>
        </DialogHeader>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {kpis.map(k => (
            <Card key={k.label} className="border-border/50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center`}>
                    <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">{k.label}</span>
                </div>
                <p className={`text-lg font-bold ${k.color}`}>{formatBRL(k.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Produtos comprados */}
        {productsList.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <Package className="h-3.5 w-3.5" /> Produtos Comprados
            </h3>
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Produto</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Qtd</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsList.map((p, idx) => (
                    <TableRow key={idx} className="hover:bg-primary/5">
                      <TableCell className="text-sm font-medium">{p.nome}</TableCell>
                      <TableCell className="text-right text-sm">{p.qtd}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatBRL(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Histórico de vendas */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <ShoppingCart className="h-3.5 w-3.5" /> Histórico de Vendas
          </h3>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda registrada</p>
          ) : (
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Data</TableHead>
                    <TableHead className="text-xs font-semibold">Total</TableHead>
                    <TableHead className="text-xs font-semibold">Pagamento</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map(s => (
                    <TableRow key={s.id} className="hover:bg-primary/5">
                      <TableCell className="text-sm">{format(new Date(s.data_compra), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm font-semibold">{formatBRL(s.total_venda)}</TableCell>
                      <TableCell><span className="capitalize text-xs bg-muted px-2 py-0.5 rounded-md">{s.forma_pagamento}</span></TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Parcelas */}
        {installments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Parcelas</h3>
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Vencimento</TableHead>
                    <TableHead className="text-xs font-semibold">Parcela</TableHead>
                    <TableHead className="text-xs font-semibold">Valor</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map(i => (
                    <TableRow key={i.id} className="hover:bg-primary/5">
                      <TableCell className="text-sm">{format(new Date(i.vencimento_data), "dd/MM/yyyy")}</TableCell>
                      <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-md">{i.numero_parcela}/{i.total_parcelas}</span></TableCell>
                      <TableCell className="text-sm font-semibold">{formatBRL(i.valor_parcela)}</TableCell>
                      <TableCell><StatusBadge status={i.status} vencimento={i.vencimento_data} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
