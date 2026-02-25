import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/currency";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ShoppingCart, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";

interface CustomerDetailProps {
  customerId: string | null;
  customerName: string;
  onClose: () => void;
}

export function CustomerDetail({ customerId, customerName, onClose }: CustomerDetailProps) {
  const { data: sales = [] } = useQuery({
    queryKey: ["customer-sales", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*, products(nome))")
        .eq("customer_id", customerId!)
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["customer-installments", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*")
        .eq("customer_id", customerId!)
        .order("vencimento_data");
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const totalComprado = sales.reduce((s, sale) => s + sale.total_venda, 0);
  const totalPago = installments
    .filter(i => i.status === "pago")
    .reduce((s, i) => s + (i.pago_valor ?? i.valor_parcela), 0);
  // Add cash sales (non-installment sales that are "pago")
  const vendasAVista = sales.filter(s => s.status === "pago" && !installments.some(i => i.sale_id === s.id))
    .reduce((s, sale) => s + sale.total_venda, 0);
  const totalPagoGeral = totalPago + vendasAVista;
  const totalDevendo = installments
    .filter(i => i.status === "pendente")
    .reduce((s, i) => s + i.valor_parcela, 0);

  // Collect all products bought
  const productMap = new Map<string, { nome: string; qtd: number; total: number }>();
  for (const sale of sales) {
    for (const item of (sale as any).sale_items ?? []) {
      const key = item.product_id;
      const existing = productMap.get(key);
      if (existing) {
        existing.qtd += item.quantidade;
        existing.total += item.subtotal;
      } else {
        productMap.set(key, {
          nome: (item as any).products?.nome ?? "Produto removido",
          qtd: item.quantidade,
          total: item.subtotal,
        });
      }
    }
  }
  const productsList = Array.from(productMap.values());

  const kpis = [
    { label: "Total Comprado", value: totalComprado, icon: ShoppingCart, color: "text-primary" },
    { label: "Total Pago", value: totalPagoGeral, icon: CheckCircle, color: "text-success" },
    { label: "Devendo", value: totalDevendo, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <Dialog open={!!customerId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customerName}</DialogTitle>
        </DialogHeader>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {kpis.map(k => (
            <Card key={k.label}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                </div>
                <p className={`text-lg font-bold ${k.color}`}>{formatBRL(k.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Produtos comprados */}
        {productsList.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Produtos Comprados</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsList.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{p.nome}</TableCell>
                      <TableCell className="text-right text-sm">{p.qtd}</TableCell>
                      <TableCell className="text-right text-sm">{formatBRL(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Histórico de vendas */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Histórico de Vendas</h3>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{format(new Date(s.data_compra), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm">{formatBRL(s.total_venda)}</TableCell>
                      <TableCell className="text-sm capitalize">{s.forma_pagamento}</TableCell>
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
            <h3 className="text-sm font-semibold mb-2">Parcelas</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="text-sm">{format(new Date(i.vencimento_data), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm">{i.numero_parcela}/{i.total_parcelas}</TableCell>
                      <TableCell className="text-sm">{formatBRL(i.valor_parcela)}</TableCell>
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
