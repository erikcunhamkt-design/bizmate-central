import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/currency";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { CustomerPhotoUpload } from "@/components/CustomerPhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { buildAllocationPreview, getCustomerActivityStatus, getPaidValue, getRemainingValue } from "@/lib/receivables";
import { useOperator } from "@/hooks/useOperator";
import {
  ShoppingCart, CheckCircle, AlertTriangle, Package, MapPin, User,
  Clock, CalendarDays, Pencil, X, Save, UserCheck, UserX, CreditCard, FileDown,
} from "lucide-react";
import { generateReceiptPDF } from "@/lib/receipt";

type CustomerPayment = {
  id: string;
  sale_id: string | null;
  valor_total: number;
  data_pagamento: string;
  metodo_recebimento: string;
  observacoes: string | null;
  operador: string | null;
};

type PaymentAllocation = {
  id: string;
  payment_id: string;
  installment_id: string;
  valor_aplicado: number;
  tipo: string;
};

interface CustomerDetailProps {
  customerId: string;
}

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const { toast } = useToast();
  const { operator } = useOperator();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ nome: "", whatsapp: "", email: "", cpf: "", endereco: "", observacoes: "", foto_url: "" });
  const [receivingInstallment, setReceivingInstallment] = useState<any | null>(null);
  const [receiveForm, setReceiveForm] = useState({ valor: "", data: format(new Date(), "yyyy-MM-dd"), metodo: "pix", observacoes: "" });

  const { data: customer } = useQuery({
    queryKey: ["customer-detail", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["customer-sales", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, sale_items(*, products(nome))").eq("customer_id", customerId).order("data_compra", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["customer-installments", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("installments").select("*").eq("customer_id", customerId).order("vencimento_data");
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: paymentHistory = { payments: [] as CustomerPayment[], allocations: [] as PaymentAllocation[] } } = useQuery({
    queryKey: ["customer-payment-history", customerId],
    queryFn: async () => {
      const { data: payments, error: paymentsError } = await (supabase as any)
        .from("customer_payments")
        .select("id, sale_id, valor_total, data_pagamento, metodo_recebimento, observacoes, operador")
        .eq("customer_id", customerId)
        .order("data_pagamento", { ascending: false });
      if (paymentsError) throw paymentsError;

      const paymentIds = (payments ?? []).map((payment: CustomerPayment) => payment.id);
      if (paymentIds.length === 0) return { payments: [], allocations: [] };

      const { data: allocations, error: allocationsError } = await (supabase as any)
        .from("payment_allocations")
        .select("id, payment_id, installment_id, valor_aplicado, tipo")
        .in("payment_id", paymentIds);
      if (allocationsError) throw allocationsError;

      return { payments: payments ?? [], allocations: allocations ?? [] };
    },
    enabled: !!customerId,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").update({
        nome: editForm.nome,
        whatsapp: editForm.whatsapp || null,
        email: editForm.email || null,
        cpf: editForm.cpf || null,
        endereco: editForm.endereco || null,
        observacoes: editForm.observacoes || null,
        foto_url: editForm.foto_url || null,
      }).eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-detail", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente atualizado!" });
      setEditing(false);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!customer) return;
      const newStatus = customer.status === "ativo" ? "inativo" : "ativo";
      const { error } = await supabase.from("customers").update({ status: newStatus }).eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-detail", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: `Cliente ${customer?.status === "ativo" ? "desativado" : "ativado"}!` });
    },
    onError: () => toast({ title: "Erro ao alterar status", variant: "destructive" }),
  });

  const receivePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!receivingInstallment) throw new Error("Parcela não encontrada");
      const valorRecebido = parseFloat(receiveForm.valor);
      if (!valorRecebido || valorRecebido <= 0) throw new Error("Informe o valor recebido");

      const { error } = await (supabase as any).rpc("register_customer_payment", {
        p_customer_id: receivingInstallment.customer_id,
        p_sale_id: receivingInstallment.sale_id,
        p_selected_installment_id: receivingInstallment.id,
        p_valor: valorRecebido,
        p_data: receiveForm.data,
        p_metodo: receiveForm.metodo,
        p_observacoes: receiveForm.observacoes || "",
        p_operador: operator || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-installments", customerId] });
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-sales"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-goals-cash-history"] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
      queryClient.invalidateQueries({ queryKey: ["customer-payment-history", customerId] });
      setReceivingInstallment(null);
      setReceiveForm({ valor: "", data: format(new Date(), "yyyy-MM-dd"), metodo: "pix", observacoes: "" });
      toast({ title: "Recebimento registrado!" });
    },
    onError: (e) => toast({ title: "Erro ao receber pagamento", description: e.message, variant: "destructive" }),
  });

  const startEdit = () => {
    if (customer) {
      setEditForm({
        nome: customer.nome,
        whatsapp: customer.whatsapp || "",
        email: customer.email || "",
        cpf: (customer as any).cpf || "",
        endereco: (customer as any).endereco || "",
        observacoes: customer.observacoes || "",
        foto_url: customer.foto_url || "",
      });
      setEditing(true);
    }
  };

  const salesWithInstallments = new Set(installments.map(i => i.sale_id));
  const totalComprado = sales.reduce((s, sale) => s + sale.total_venda, 0);
  const totalPago = installments.reduce((s, i) => s + getPaidValue(i), 0);
  const vendasSemParcela = sales.filter(s => !salesWithInstallments.has(s.id)).reduce((s, sale) => s + sale.total_venda, 0);
  const totalPagoGeral = totalPago + vendasSemParcela;
  const totalDevendo = installments.filter(i => i.status !== "pago").reduce((s, i) => s + getRemainingValue(i), 0);

  const today = new Date();
  const overdue = installments.filter(i => i.status !== "pago" && getRemainingValue(i) > 0 && new Date(i.vencimento_data) < today);
  const isOverdue = overdue.length > 0;

  const lastPurchaseDate = sales.length > 0 ? new Date(sales[0].data_compra) : null;
  const activity = getCustomerActivityStatus(lastPurchaseDate, installments as any, today);
  const daysSinceLastPurchase = activity.daysSinceLastPurchase;
  const isInactive = activity.isInactive;

  const productMap = new Map<string, { nome: string; qtd: number; total: number }>();
  for (const sale of sales) {
    for (const item of (sale as any).sale_items ?? []) {
      const key = item.product_id;
      const existing = productMap.get(key);
      if (existing) {
        existing.qtd += item.quantidade;
        existing.total += item.subtotal;
      } else {
        productMap.set(key, { nome: (item as any).products?.nome ?? "Produto removido", qtd: item.quantidade, total: item.subtotal });
      }
    }
  }
  const productsList = Array.from(productMap.values());

  const salePaymentRows = sales.map((sale) => {
    const saleInstallments = installments.filter(i => i.sale_id === sale.id);
    const isInstallmentSale = sale.forma_pagamento === "parcelado" || saleInstallments.length > 0;
    const paid = isInstallmentSale
      ? saleInstallments.reduce((sum, i) => sum + getPaidValue(i), 0)
      : sale.total_venda;
    const pending = Math.max(sale.total_venda - paid, 0);
    return { sale, paid, pending };
  });

  const receivingPreview = receivingInstallment ? buildAllocationPreview(installments as any, receivingInstallment.id, parseFloat(receiveForm.valor) || 0) : [];
  const paymentHistoryBySale = sales.map((sale) => {
    const salePayments = paymentHistory.payments.filter((payment) => payment.sale_id === sale.id);
    const salePaymentIds = new Set(salePayments.map((payment) => payment.id));
    const saleAllocations = paymentHistory.allocations.filter((allocation) => salePaymentIds.has(allocation.payment_id));
    const totalReceived = salePayments.reduce((sum, payment) => sum + Number(payment.valor_total ?? 0), 0);
    return { sale, payments: salePayments, allocations: saleAllocations, totalReceived };
  }).filter((row) => row.payments.length > 0);

  const getStatusLabel = () => {
    if (isOverdue) return { label: `${overdue.length} parcela(s) atrasada(s)`, color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle };
    if (totalDevendo > 0) return { label: "Em dia", color: "text-success", bg: "bg-success/10", icon: CheckCircle };
    if (isInactive) return { label: `Inativo há ${daysSinceLastPurchase} dias`, color: "text-warning", bg: "bg-warning/10", icon: Clock };
    return { label: "Ativo", color: "text-success", bg: "bg-success/10", icon: CheckCircle };
  };

  const status = getStatusLabel();
  const customerName = customer?.nome ?? "Cliente";

  return (
    <div className="min-w-0 space-y-6">
      <Card className="border-border/50">
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              {customer?.foto_url ? (
                <img src={customer.foto_url} alt={customerName} className="h-16 w-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <span className="text-2xl font-bold text-primary">{customerName.charAt(0).toUpperCase()}</span>
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-2">
                <div className="min-w-0">
                  <h1 className="break-words text-2xl font-bold tracking-tight">{customerName}</h1>
                  <div className={`mt-1 flex items-center gap-1.5 ${status.color}`}>
                    <status.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm font-medium">{status.label}</span>
                  </div>
                </div>
              </div>
            </div>

            {!editing && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-1.5 ${customer?.status === "ativo" ? "text-success" : "text-muted-foreground"}`}
                  onClick={() => toggleStatusMutation.mutate()}
                  disabled={toggleStatusMutation.isPending}
                >
                  {customer?.status === "ativo" ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                  {customer?.status === "ativo" ? "Ativo" : "Inativo"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            )}
          </div>

          {editing && (
            <Card className="border-border/50">
              <CardContent className="space-y-3 pt-4">
                <CustomerPhotoUpload
                  currentUrl={editForm.foto_url || null}
                  onUpload={(url) => setEditForm(f => ({ ...f, foto_url: url }))}
                  onRemove={() => setEditForm(f => ({ ...f, foto_url: "" }))}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={editForm.cpf} onChange={e => setEditForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className="h-9" /></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1"><Label className="text-xs">WhatsApp</Label><Input value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="h-9" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Endereço</Label><Input value={editForm.endereco} onChange={e => setEditForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, nº, bairro, cidade" className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Observações</Label><Textarea value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} className="resize-none" rows={2} /></div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="mr-1 h-3.5 w-3.5" />Cancelar</Button>
                  <Button size="sm" className="gradient-primary" disabled={!editForm.nome || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                    <Save className="mr-1 h-3.5 w-3.5" />{updateMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!editing && customer && (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {(customer as any).cpf && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 min-w-0">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">CPF:</span>
                  <span className="truncate text-xs font-medium">{(customer as any).cpf}</span>
                </div>
              )}
              {(customer as any).endereco && (
                <div className="col-span-full flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 min-w-0">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs break-words">{(customer as any).endereco}</span>
                </div>
              )}
              {lastPurchaseDate && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 min-w-0">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Última compra:</span>
                  <span className={`text-xs font-medium ${isInactive ? "text-warning" : ""}`}>
                    {format(lastPurchaseDate, "dd/MM/yyyy")}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Total Comprado", value: totalComprado, icon: ShoppingCart, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Pago", value: totalPagoGeral, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
          { label: "Devendo", value: totalDevendo, icon: AlertTriangle, color: totalDevendo > 0 ? "text-destructive" : "text-muted-foreground", bg: totalDevendo > 0 ? "bg-destructive/10" : "bg-muted" },
        ].map(k => (
          <Card key={k.label} className="border-border/50">
            <CardContent className="px-4 pb-3 pt-4">
              <div className="mb-2 flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">{k.label}</span>
              </div>
              <p className={`text-lg font-bold ${k.color}`}>{formatBRL(k.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isOverdue && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">{overdue.length} parcela(s) em atraso</p>
            <p className="text-xs text-destructive/70">Total atrasado: {formatBRL(overdue.reduce((s, i) => s + i.valor_parcela, 0))}</p>
          </div>
        </div>
      )}

      {isInactive && !isOverdue && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3">
          <Clock className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-warning">Cliente inativo</p>
            <p className="text-xs text-warning/70">Última compra há {daysSinceLastPurchase} dias</p>
          </div>
        </div>
      )}

      {productsList.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Produtos Comprados
          </h2>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Produto</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Qtd</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Total</TableHead>
                </TableRow></TableHeader>
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
        </section>
      )}

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ShoppingCart className="h-3.5 w-3.5" /> Histórico de Vendas
        </h2>
        {sales.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma venda registrada</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Data</TableHead>
                  <TableHead className="text-xs font-semibold">Total</TableHead>
                  <TableHead className="text-xs font-semibold">Pagamento</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sales.map(s => (
                    <TableRow key={s.id} className="hover:bg-primary/5">
                      <TableCell className="text-sm">{format(new Date(s.data_compra), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm font-semibold">{formatBRL(s.total_venda)}</TableCell>
                      <TableCell><span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize">{s.forma_pagamento}</span></TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>

      {salePaymentRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" /> Venda x Pagamento
          </h2>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Venda</TableHead>
                  <TableHead className="text-xs font-semibold">Total</TableHead>
                  <TableHead className="text-xs font-semibold">Pago</TableHead>
                  <TableHead className="text-xs font-semibold">Falta</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {salePaymentRows.map(({ sale, paid, pending }) => (
                    <TableRow key={sale.id} className="hover:bg-primary/5">
                      <TableCell className="text-sm">{format(new Date(sale.data_compra), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm font-semibold">{formatBRL(sale.total_venda)}</TableCell>
                      <TableCell className="text-sm font-semibold text-success">{formatBRL(paid)}</TableCell>
                      <TableCell className={`text-sm font-semibold ${pending > 0 ? "text-destructive" : "text-muted-foreground"}`}>{formatBRL(pending)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      )}

      {paymentHistoryBySale.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" /> Histórico de pagamentos/abatimentos
          </h2>
          <div className="space-y-3">
            {paymentHistoryBySale.map(({ sale, payments, allocations, totalReceived }) => (
              <div key={sale.id} className="overflow-hidden rounded-xl border border-border/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Venda de {format(new Date(sale.data_compra), "dd/MM/yyyy")}</p>
                    <p className="truncate text-xs text-muted-foreground">Total da venda: {formatBRL(sale.total_venda)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">Recebido</p>
                    <p className="text-sm font-bold text-success">{formatBRL(totalReceived)}</p>
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  {payments.map((payment) => {
                    const paymentAllocations = allocations.filter((allocation) => allocation.payment_id === payment.id);
                    const handleDownload = () => {
                      generateReceiptPDF({
                        cliente: customerName,
                        clienteCpf: (customer as any)?.cpf ?? null,
                        valorTotal: Number(payment.valor_total),
                        data: payment.data_pagamento,
                        metodo: payment.metodo_recebimento,
                        operador: payment.operador,
                        observacoes: payment.observacoes,
                        vendaData: sale.data_compra,
                        vendaTotal: Number(sale.total_venda),
                        numeroRecibo: payment.id.slice(0, 8).toUpperCase(),
                        alocacoes: paymentAllocations.map((a) => {
                          const inst = installments.find((i) => i.id === a.installment_id);
                          return {
                            numero_parcela: inst?.numero_parcela ?? 0,
                            total_parcelas: inst?.total_parcelas ?? 0,
                            valor_aplicado: Number(a.valor_aplicado),
                            tipo: a.tipo,
                          };
                        }),
                      });
                    };

                    return (
                      <div key={payment.id} className="space-y-2 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-success">{formatBRL(payment.valor_total)}</p>
                            <p className="break-words text-xs capitalize text-muted-foreground">
                              {format(new Date(payment.data_pagamento), "dd/MM/yyyy")} • {payment.metodo_recebimento} • {payment.operador ?? "Sem operador"}
                            </p>
                            {payment.observacoes && <p className="mt-1 break-words text-xs text-muted-foreground">{payment.observacoes}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleDownload}>
                              <FileDown className="h-3 w-3" />Recibo
                            </Button>
                            <span className="rounded-md border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">Recebimento</span>
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                          {paymentAllocations.map((allocation) => {
                            const installment = installments.find((item) => item.id === allocation.installment_id);
                            return (
                              <div key={allocation.id} className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-xs last:border-b-0">
                                <span className="text-muted-foreground">
                                  {allocation.tipo === "abatimento" ? "Abatimento" : "Parcela"} {installment ? `${installment.numero_parcela}/${installment.total_parcelas}` : "removida"}
                                  <span className="block text-[10px] capitalize">{format(new Date(payment.data_pagamento), "dd/MM/yyyy")} • {payment.metodo_recebimento} • {payment.operador ?? "Sem operador"}</span>
                                </span>
                                <span className="font-semibold">{formatBRL(allocation.valor_aplicado)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {installments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parcelas</h2>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Vencimento</TableHead>
                  <TableHead className="text-xs font-semibold">Parcela</TableHead>
                  <TableHead className="text-xs font-semibold">Valor</TableHead>
                  <TableHead className="text-xs font-semibold">Recebido</TableHead>
                  <TableHead className="text-xs font-semibold">Falta</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {installments.map(i => (
                    <TableRow key={i.id} className={`hover:bg-primary/5 ${i.status === "pendente" && new Date(i.vencimento_data) < today ? "bg-destructive/5" : ""}`}>
                      <TableCell className="text-sm">{format(new Date(i.vencimento_data), "dd/MM/yyyy")}</TableCell>
                      <TableCell><span className="rounded-md bg-muted px-2 py-0.5 text-xs">{i.numero_parcela}/{i.total_parcelas}</span></TableCell>
                      <TableCell className="text-sm font-semibold">{formatBRL(i.valor_parcela)}</TableCell>
                      <TableCell className="text-sm font-semibold text-success">{formatBRL(getPaidValue(i))}</TableCell>
                      <TableCell className={`text-sm font-semibold ${getRemainingValue(i) > 0 ? "text-warning" : "text-muted-foreground"}`}>{formatBRL(getRemainingValue(i))}</TableCell>
                      <TableCell><StatusBadge status={i.status} vencimento={i.vencimento_data} /></TableCell>
                      <TableCell>
                        {i.status !== "pago" && getRemainingValue(i) > 0 && (
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-success hover:bg-success/10" onClick={() => {
                            setReceivingInstallment(i);
                            setReceiveForm({ valor: String(getRemainingValue(i)), data: format(new Date(), "yyyy-MM-dd"), metodo: "pix", observacoes: "" });
                          }} disabled={receivePaymentMutation.isPending}>
                            <CheckCircle className="h-3.5 w-3.5" />Receber
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      )}

      <Dialog open={!!receivingInstallment} onOpenChange={(open) => { if (!open) setReceivingInstallment(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                <CreditCard className="h-4 w-4 text-success" />
              </div>
              Receber pagamento
            </DialogTitle>
          </DialogHeader>
          {receivingInstallment && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Parcela</p><p className="font-semibold">{receivingInstallment.numero_parcela}/{receivingInstallment.total_parcelas}</p></div>
                <div><p className="text-xs text-muted-foreground">Recebido</p><p className="font-semibold text-success">{formatBRL(getPaidValue(receivingInstallment))}</p></div>
                <div><p className="text-xs text-muted-foreground">Falta</p><p className="font-semibold text-warning">{formatBRL(getRemainingValue(receivingInstallment))}</p></div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor recebido</Label><Input type="number" min={0.01} step="0.01" value={receiveForm.valor} onChange={e => setReceiveForm(f => ({ ...f, valor: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</Label><Input type="date" value={receiveForm.data} onChange={e => setReceiveForm(f => ({ ...f, data: e.target.value }))} /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de recebimento</Label>
                <Select value={receiveForm.metodo} onValueChange={metodo => setReceiveForm(f => ({ ...f, metodo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao">Cartão</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Operador</p><p className="text-sm font-semibold">{operator}</p></div>
              <div className="space-y-1.5"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observação</Label><Textarea value={receiveForm.observacoes} onChange={e => setReceiveForm(f => ({ ...f, observacoes: e.target.value }))} className="resize-none" rows={2} /></div>
              {receivingPreview.length > 0 && <div className="overflow-hidden rounded-xl border border-border/50"><div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aplicação automática</div>{receivingPreview.map(item => <div key={item.installment.id} className="flex items-center justify-between border-t border-border/50 px-3 py-2 text-sm"><span>Parcela {item.installment.numero_parcela}/{item.installment.total_parcelas}</span><span className="font-semibold text-success">{formatBRL(item.amount)} — {item.statusAfter === "pago" ? "paga" : "parcial"}</span></div>)}</div>}
              <Button className="w-full gradient-primary shadow-glow" onClick={() => receivePaymentMutation.mutate()} disabled={receivePaymentMutation.isPending || receivingPreview.length === 0}>{receivePaymentMutation.isPending ? "Registrando..." : "Registrar recebimento"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
