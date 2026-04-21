import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/currency";
import { format, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { CustomerPhotoUpload } from "@/components/CustomerPhotoUpload";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, CheckCircle, AlertTriangle, Package, MapPin, User,
  Clock, CalendarDays, Pencil, X, Save, UserCheck, UserX, CreditCard
} from "lucide-react";

interface CustomerDetailProps {
  customerId: string | null;
  customerName: string;
  onClose: () => void;
}

export function CustomerDetail({ customerId, customerName, onClose }: CustomerDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ nome: "", whatsapp: "", email: "", cpf: "", endereco: "", observacoes: "", foto_url: "" });

  const { data: customer } = useQuery({
    queryKey: ["customer-detail", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", customerId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

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
      }).eq("id", customerId!);
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
      const { error } = await supabase.from("customers").update({ status: newStatus }).eq("id", customerId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-detail", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: `Cliente ${customer?.status === "ativo" ? "desativado" : "ativado"}!` });
    },
    onError: () => toast({ title: "Erro ao alterar status", variant: "destructive" }),
  });

  const markInstallmentPaidMutation = useMutation({
    mutationFn: async (installmentId: string) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const installment = installments.find(i => i.id === installmentId);
      if (!installment) throw new Error("Parcela não encontrada");

      const { error } = await supabase
        .from("installments")
        .update({ status: "pago", pago_em: today, pago_valor: installment.valor_parcela })
        .eq("id", installmentId);
      if (error) throw error;

      const { error: cashError } = await supabase.from("cash_movements").insert({
        user_id: installment.user_id,
        tipo: "entrada",
        valor: installment.valor_parcela,
        origem: "parcela",
        ref_id: installmentId,
        descricao: `Parcela ${installment.numero_parcela}/${installment.total_parcelas}`,
        data: today,
      });
      if (cashError) throw cashError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-installments", customerId] });
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Parcela marcada como paga!" });
    },
    onError: () => toast({ title: "Erro ao pagar parcela", variant: "destructive" }),
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
  const totalPago = installments.filter(i => i.status === "pago").reduce((s, i) => s + (i.pago_valor ?? i.valor_parcela), 0);
  const vendasSemParcela = sales.filter(s => !salesWithInstallments.has(s.id)).reduce((s, sale) => s + sale.total_venda, 0);
  const totalPagoGeral = totalPago + vendasSemParcela;
  const totalDevendo = installments.filter(i => i.status === "pendente").reduce((s, i) => s + i.valor_parcela, 0);

  const today = new Date();
  const overdue = installments.filter(i => i.status === "pendente" && new Date(i.vencimento_data) < today);
  const isOverdue = overdue.length > 0;

  const lastPurchaseDate = sales.length > 0 ? new Date(sales[0].data_compra) : null;
  const daysSinceLastPurchase = lastPurchaseDate ? differenceInDays(today, lastPurchaseDate) : null;
  const isInactive = daysSinceLastPurchase !== null && daysSinceLastPurchase > 30;

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

  const salePaymentRows = sales.map((sale) => {
    const saleInstallments = installments.filter(i => i.sale_id === sale.id);
    const isInstallmentSale = sale.forma_pagamento === "parcelado" || saleInstallments.length > 0;
    const paid = isInstallmentSale
      ? saleInstallments.filter(i => i.status === "pago").reduce((sum, i) => sum + (i.pago_valor ?? i.valor_parcela), 0)
      : sale.total_venda;
    const pending = Math.max(sale.total_venda - paid, 0);
    return { sale, paid, pending };
  });

  const getStatusLabel = () => {
    if (isOverdue) return { label: `${overdue.length} parcela(s) atrasada(s)`, color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle };
    if (totalDevendo > 0) return { label: "Em dia", color: "text-success", bg: "bg-success/10", icon: CheckCircle };
    if (isInactive) return { label: `Inativo há ${daysSinceLastPurchase} dias`, color: "text-warning", bg: "bg-warning/10", icon: Clock };
    return { label: "Ativo", color: "text-success", bg: "bg-success/10", icon: CheckCircle };
  };
  const status = getStatusLabel();

  return (
    <Dialog open={!!customerId} onOpenChange={(v) => { if (!v) { setEditing(false); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="flex items-center gap-3">
              {customer?.foto_url ? (
                <img src={customer.foto_url} alt={customerName} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{customerName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div>
                <span>{customerName}</span>
                <div className={`flex items-center gap-1.5 mt-0.5 ${status.color}`}>
                  <status.icon className="h-3 w-3" />
                  <span className="text-xs font-medium">{status.label}</span>
                </div>
              </div>
            </DialogTitle>
            {!editing && (
              <div className="flex items-center gap-2">
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
        </DialogHeader>

        {editing && (
          <Card className="border-border/50">
            <CardContent className="pt-4 space-y-3">
              <CustomerPhotoUpload
                currentUrl={editForm.foto_url || null}
                onUpload={(url) => setEditForm(f => ({ ...f, foto_url: url }))}
                onRemove={() => setEditForm(f => ({ ...f, foto_url: "" }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={editForm.cpf} onChange={e => setEditForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className="h-9" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">WhatsApp</Label><Input value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="h-9" /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Endereço</Label><Input value={editForm.endereco} onChange={e => setEditForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, nº, bairro, cidade" className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Observações</Label><Textarea value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} className="resize-none" rows={2} /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                <Button size="sm" className="gradient-primary" disabled={!editForm.nome || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                  <Save className="h-3.5 w-3.5 mr-1" />{updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!editing && customer && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(customer as any).cpf && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">CPF:</span>
                <span className="font-medium text-xs">{(customer as any).cpf}</span>
              </div>
            )}
            {(customer as any).endereco && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 col-span-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs">{(customer as any).endereco}</span>
              </div>
            )}
            {lastPurchaseDate && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Última compra:</span>
                <span className={`font-medium text-xs ${isInactive ? "text-warning" : ""}`}>
                  {format(lastPurchaseDate, "dd/MM/yyyy")}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Comprado", value: totalComprado, icon: ShoppingCart, color: "text-primary", bg: "bg-primary/10" },
            { label: "Total Pago", value: totalPagoGeral, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
            { label: "Devendo", value: totalDevendo, icon: AlertTriangle, color: totalDevendo > 0 ? "text-destructive" : "text-muted-foreground", bg: totalDevendo > 0 ? "bg-destructive/10" : "bg-muted" },
          ].map(k => (
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

        {isOverdue && (
          <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">{overdue.length} parcela(s) em atraso</p>
              <p className="text-xs text-destructive/70">Total atrasado: {formatBRL(overdue.reduce((s, i) => s + i.valor_parcela, 0))}</p>
            </div>
          </div>
        )}

        {isInactive && !isOverdue && (
          <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
            <Clock className="h-5 w-5 text-warning shrink-0" />
            <div>
              <p className="text-sm font-semibold text-warning">Cliente inativo</p>
              <p className="text-xs text-warning/70">Última compra há {daysSinceLastPurchase} dias</p>
            </div>
          </div>
        )}

        {productsList.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <Package className="h-3.5 w-3.5" /> Produtos Comprados
            </h3>
            <div className="border border-border/50 rounded-xl overflow-hidden">
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
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <ShoppingCart className="h-3.5 w-3.5" /> Histórico de Vendas
          </h3>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda registrada</p>
          ) : (
            <div className="border border-border/50 rounded-xl overflow-hidden">
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
                      <TableCell><span className="capitalize text-xs bg-muted px-2 py-0.5 rounded-md">{s.forma_pagamento}</span></TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {salePaymentRows.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" /> Venda x Pagamento
            </h3>
            <div className="border border-border/50 rounded-xl overflow-hidden">
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
        )}

        {installments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Parcelas</h3>
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Vencimento</TableHead>
                  <TableHead className="text-xs font-semibold">Parcela</TableHead>
                  <TableHead className="text-xs font-semibold">Valor</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {installments.map(i => (
                    <TableRow key={i.id} className={`hover:bg-primary/5 ${i.status === "pendente" && new Date(i.vencimento_data) < today ? "bg-destructive/5" : ""}`}>
                      <TableCell className="text-sm">{format(new Date(i.vencimento_data), "dd/MM/yyyy")}</TableCell>
                      <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-md">{i.numero_parcela}/{i.total_parcelas}</span></TableCell>
                      <TableCell className="text-sm font-semibold">{formatBRL(i.valor_parcela)}</TableCell>
                      <TableCell><StatusBadge status={i.status} vencimento={i.vencimento_data} /></TableCell>
                      <TableCell>
                        {i.status === "pendente" && (
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-success hover:bg-success/10" onClick={() => markInstallmentPaidMutation.mutate(i.id)} disabled={markInstallmentPaidMutation.isPending}>
                            <CheckCircle className="h-3.5 w-3.5" />Pagar
                          </Button>
                        )}
                      </TableCell>
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
