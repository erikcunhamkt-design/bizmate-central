import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Plus, Trash2, Pencil, ShoppingCart, CreditCard, Search, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

interface CartItem {
  product_id: string;
  nome: string;
  preco: number;
  custo: number;
  quantidade: number;
  estoque_atual: number;
}

export default function Vendas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "parcelas" ? "parcelas" : "vendas";
  const [openNova, setOpenNova] = useState(searchParams.get("nova") === "1");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters
  const [salesStatusFilter, setSalesStatusFilter] = useState("todos");
  const [salesPaymentFilter, setSalesPaymentFilter] = useState("todos");
  const [salesDateFrom, setSalesDateFrom] = useState("");
  const [salesDateTo, setSalesDateTo] = useState("");
  const [installmentStatusFilter, setInstallmentStatusFilter] = useState("todos");

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [parcelado, setParcelado] = useState(false);
  const [valorPorParcela, setValorPorParcela] = useState("");
  const [diaPagamento, setDiaPagamento] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  const [editingInstallment, setEditingInstallment] = useState<{ id: string; valor: string; vencimento: string } | null>(null);

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["sales", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, customers(nome)").order("data_compra", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: installments = [], isLoading: instLoading } = useQuery({
    queryKey: ["installments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("installments").select("*, customers(nome)").order("vencimento_data");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, nome").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const inst = installments.find(i => i.id === id);
      const { error } = await supabase.from("installments").update({ status: "pago", pago_em: today, pago_valor: inst?.valor_parcela }).eq("id", id);
      if (error) throw error;
      if (inst) {
        await supabase.from("cash_movements").insert({
          user_id: user!.id, tipo: "entrada", valor: inst.valor_parcela, origem: "parcela",
          ref_id: id, descricao: `Parcela ${inst.numero_parcela}/${inst.total_parcelas}`, data: today,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Parcela marcada como paga!" });
    },
  });

  const deleteInstallment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("installments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      toast({ title: "Parcela excluída!" });
    },
  });

  const updateInstallmentValue = useMutation({
    mutationFn: async ({ id, valor, vencimento }: { id: string; valor: number; vencimento: string }) => {
      const { error } = await supabase.from("installments").update({ valor_parcela: valor, vencimento_data: vencimento }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      setEditingInstallment(null);
      toast({ title: "Parcela atualizada!" });
    },
  });

  const createSale = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer) throw new Error("Selecione um cliente");
      const total = cart.length > 0 ? cart.reduce((s, c) => s + c.preco * c.quantidade, 0) : parseFloat(manualTotal) || 0;
      if (total <= 0) throw new Error("Informe o valor da venda");
      const today = format(new Date(), "yyyy-MM-dd");

      const { data: sale, error: saleErr } = await supabase.from("sales").insert({
        user_id: user!.id, customer_id: selectedCustomer, total_venda: total,
        forma_pagamento: formaPagamento, data_compra: today, status: !parcelado ? "pago" : "ativa",
      }).select().single();
      if (saleErr) throw saleErr;

      if (cart.length > 0) {
        const items = cart.map(c => ({
          sale_id: sale.id, product_id: c.product_id, quantidade: c.quantidade,
          preco_unitario_vendido: c.preco, custo_unitario_no_momento: c.custo, subtotal: c.preco * c.quantidade,
        }));
        const { error: itemsErr } = await supabase.from("sale_items").insert(items);
        if (itemsErr) throw itemsErr;

        for (const c of cart) {
          await supabase.from("products").update({ estoque_atual: c.estoque_atual - c.quantidade }).eq("id", c.product_id);
        }
      }

      if (parcelado && valorPorParcela) {
        const vparcela = parseFloat(valorPorParcela);
        if (vparcela <= 0) throw new Error("Valor por parcela inválido");
        const numParcelas = Math.ceil(total / vparcela);
        const dia = parseInt(diaPagamento) || new Date().getDate();
        const parcelas = Array.from({ length: numParcelas }, (_, i) => {
          const venc = new Date();
          venc.setMonth(venc.getMonth() + i + 1);
          venc.setDate(Math.min(dia, new Date(venc.getFullYear(), venc.getMonth() + 1, 0).getDate()));
          const isLast = i === numParcelas - 1;
          const valor = isLast ? Math.round((total - vparcela * (numParcelas - 1)) * 100) / 100 : vparcela;
          return {
            user_id: user!.id, customer_id: selectedCustomer, sale_id: sale.id,
            numero_parcela: i + 1, total_parcelas: numParcelas, valor_parcela: valor,
            vencimento_data: format(venc, "yyyy-MM-dd"), status: "pendente",
          };
        });
        await supabase.from("installments").insert(parcelas);
      } else {
        await supabase.from("cash_movements").insert({
          user_id: user!.id, tipo: "entrada", valor: total, origem: "venda",
          ref_id: sale.id, descricao: `Venda à vista`, data: today,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Venda registrada com sucesso!" });
      resetForm();
    },
    onError: (e) => toast({ title: "Erro ao criar venda", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setOpenNova(false); setSelectedCustomer(""); setFormaPagamento("pix");
    setParcelado(false); setValorPorParcela(""); setDiaPagamento("");
    setCart([]); setAddProductId(""); setManualTotal("");
  };

  const addToCart = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    if (cart.find(c => c.product_id === productId)) { toast({ title: "Produto já adicionado", variant: "destructive" }); return; }
    if (prod.estoque_atual <= 0) { toast({ title: "Produto sem estoque", variant: "destructive" }); return; }
    setCart(prev => [...prev, { product_id: prod.id, nome: prod.nome, preco: prod.preco_padrao, custo: prod.custo_unitario, quantidade: 1, estoque_atual: prod.estoque_atual }]);
    setAddProductId("");
  };

  const updateQty = (productId: string, qty: number) => {
    setCart(prev => prev.map(c => c.product_id === productId ? { ...c, quantidade: Math.min(Math.max(1, qty), c.estoque_atual) } : c));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(c => c.product_id !== productId));

  const totalCart = cart.length > 0 ? cart.reduce((s, c) => s + c.preco * c.quantidade, 0) : parseFloat(manualTotal) || 0;

  // Filtered data
  const filteredSales = sales.filter(s => {
    const matchSearch = !searchTerm || (s as any).customers?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = salesStatusFilter === "todos" || s.status === salesStatusFilter;
    const matchPayment = salesPaymentFilter === "todos" || s.forma_pagamento === salesPaymentFilter;
    const matchDateFrom = !salesDateFrom || s.data_compra >= salesDateFrom;
    const matchDateTo = !salesDateTo || s.data_compra <= salesDateTo;
    return matchSearch && matchStatus && matchPayment && matchDateFrom && matchDateTo;
  });

  const filteredInstallments = installments.filter(i => {
    const matchSearch = !searchTerm || (i as any).customers?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = installmentStatusFilter === "todos" ? true :
      installmentStatusFilter === "atrasado" ? (i.status === "pendente" && new Date(i.vencimento_data) < new Date()) :
      i.status === installmentStatusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendas</h1>
          <p className="text-sm text-muted-foreground">{sales.length} vendas registradas</p>
        </div>
        <Button onClick={() => setOpenNova(true)} className="gap-2 gradient-primary shadow-glow">
          <Plus className="h-4 w-4" />Nova Venda
        </Button>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-card border border-border/50">
          <TabsTrigger value="vendas" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <ShoppingCart className="h-3.5 w-3.5" />Vendas
          </TabsTrigger>
          <TabsTrigger value="parcelas" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <CreditCard className="h-3.5 w-3.5" />Parcelas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10 bg-card border-border/50" />
            </div>
            <Select value={salesStatusFilter} onValueChange={setSalesStatusFilter}>
              <SelectTrigger className="w-32 h-10 bg-card border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
            <Select value={salesPaymentFilter} onValueChange={setSalesPaymentFilter}>
              <SelectTrigger className="w-36 h-10 bg-card border-border/50"><SelectValue placeholder="Pagamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="parcelado">Parcelado</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={salesDateFrom} onChange={e => setSalesDateFrom(e.target.value)} className="w-36 h-10 bg-card border-border/50" placeholder="De" />
            <Input type="date" value={salesDateTo} onChange={e => setSalesDateTo(e.target.value)} className="w-36 h-10 bg-card border-border/50" placeholder="Até" />
          </div>

          <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Total</TableHead>
                    <TableHead className="font-semibold">Pagamento</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filteredSales.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</TableCell></TableRow>
                  ) : filteredSales.map(s => (
                    <TableRow key={s.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="text-sm">{format(new Date(s.data_compra), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-semibold text-sm">{(s as any).customers?.nome ?? "—"}</TableCell>
                      <TableCell className="font-semibold text-sm">{formatBRL(s.total_venda)}</TableCell>
                      <TableCell><span className="capitalize text-xs bg-muted px-2 py-1 rounded-md">{s.forma_pagamento}</span></TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parcelas" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10 bg-card border-border/50" />
            </div>
            <Select value={installmentStatusFilter} onValueChange={setInstallmentStatusFilter}>
              <SelectTrigger className="w-36 h-10 bg-card border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Vencimento</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Parcela</TableHead>
                    <TableHead className="font-semibold">Valor</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filteredInstallments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma parcela encontrada</TableCell></TableRow>
                  ) : filteredInstallments.map(i => (
                    <TableRow key={i.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell>
                        {editingInstallment?.id === i.id ? (
                          <Input type="date" value={editingInstallment.vencimento}
                            onChange={e => setEditingInstallment({ ...editingInstallment, vencimento: e.target.value })}
                            className="h-8 w-36" />
                        ) : <span className="text-sm">{format(new Date(i.vencimento_data), "dd/MM/yyyy")}</span>}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{(i as any).customers?.nome ?? "—"}</TableCell>
                      <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-md">{i.numero_parcela}/{i.total_parcelas}</span></TableCell>
                      <TableCell>
                        {editingInstallment?.id === i.id ? (
                          <div className="flex gap-1 items-center">
                            <Input type="number" min={0.01} step="0.01" value={editingInstallment.valor}
                              onChange={e => setEditingInstallment({ ...editingInstallment, valor: e.target.value })}
                              className="h-8 w-24" />
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-success" onClick={() => {
                              const v = parseFloat(editingInstallment.valor);
                              if (v > 0) updateInstallmentValue.mutate({ id: i.id, valor: v, vencimento: editingInstallment.vencimento });
                            }}><CheckCircle className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : <span className="text-sm font-semibold">{formatBRL(i.valor_parcela)}</span>}
                      </TableCell>
                      <TableCell><StatusBadge status={i.status} vencimento={i.vencimento_data} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {i.status === "pendente" && (
                            <>
                              <Button size="sm" variant="ghost" className="gap-1 h-8 text-success hover:bg-success/10" onClick={() => markPaid.mutate(i.id)} disabled={markPaid.isPending}>
                                <CheckCircle className="h-3.5 w-3.5" />Pagar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10" onClick={() => setEditingInstallment({ id: i.id, valor: String(i.valor_parcela), vencimento: i.vencimento_data })}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => deleteInstallment.mutate(i.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Nova Venda Dialog */}
      <Dialog open={openNova} onOpenChange={(v) => { if (!v) resetForm(); else setOpenNova(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-primary-foreground" />
              </div>
              Nova Venda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionar Produto</Label>
              <div className="flex gap-2">
                <Select value={addProductId} onValueChange={setAddProductId}>
                  <SelectTrigger className="flex-1 h-10"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent>{products.filter(p => p.estoque_atual > 0).map(p => <SelectItem key={p.id} value={p.id}>{p.nome} (est: {p.estoque_atual})</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => addProductId && addToCart(addProductId)} disabled={!addProductId}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {cart.length > 0 && (
              <div className="border border-border/50 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="w-20 text-xs">Qtd</TableHead>
                    <TableHead className="text-right text-xs">Subtotal</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {cart.map(c => (
                      <TableRow key={c.product_id}>
                        <TableCell className="text-sm font-medium">{c.nome}</TableCell>
                        <TableCell><Input type="number" min={1} max={c.estoque_atual} value={c.quantidade} onChange={e => updateQty(c.product_id, parseInt(e.target.value) || 1)} className="h-8 w-16" /></TableCell>
                        <TableCell className="text-right text-sm font-semibold">{formatBRL(c.preco * c.quantidade)}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(c.product_id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-3 border-t border-border/50 flex justify-between font-bold text-sm bg-muted/30">
                  <span>Total</span>
                  <span className="text-primary">{formatBRL(totalCart)}</span>
                </div>
              </div>
            )}

            {cart.length === 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor da Venda (R$)</Label>
                <Input type="number" min={0} step="0.01" placeholder="0,00" value={manualTotal} onChange={e => setManualTotal(e.target.value)} className="h-10" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <input type="checkbox" id="parcelado" checked={parcelado} onChange={e => setParcelado(e.target.checked)} className="rounded accent-primary" />
              <Label htmlFor="parcelado" className="text-sm font-medium cursor-pointer">Parcelado?</Label>
            </div>

            {parcelado && (
              <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor por Parcela (R$)</Label>
                  <Input type="number" min={1} step="0.01" placeholder="Ex: 150.00" value={valorPorParcela} onChange={e => setValorPorParcela(e.target.value)} className="h-10" />
                  {parseFloat(valorPorParcela) > 0 && totalCart > 0 && (
                    <p className="text-xs text-primary font-semibold">
                      {Math.ceil(totalCart / parseFloat(valorPorParcela))}x de {formatBRL(parseFloat(valorPorParcela))}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dia de Pagamento (do mês)</Label>
                  <Input type="number" min={1} max={31} placeholder="Ex: 10" value={diaPagamento} onChange={e => setDiaPagamento(e.target.value)} className="h-10" />
                </div>
              </div>
            )}

            <Button className="w-full h-11 gradient-primary shadow-glow font-semibold" onClick={() => createSale.mutate()} disabled={createSale.isPending || !selectedCustomer}>
              {createSale.isPending ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : "Registrar Venda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
