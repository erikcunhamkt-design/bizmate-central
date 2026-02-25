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
import { CheckCircle, Plus, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  // Nova venda state
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [parcelado, setParcelado] = useState(false);
  const [valorPorParcela, setValorPorParcela] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  const [editingInstallment, setEditingInstallment] = useState<{ id: string; valor: string } | null>(null);

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["sales", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(nome)")
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: installments = [], isLoading: instLoading } = useQuery({
    queryKey: ["installments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, customers(nome)")
        .order("vencimento_data");
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
          user_id: user!.id,
          tipo: "entrada",
          valor: inst.valor_parcela,
          origem: "parcela",
          ref_id: id,
          descricao: `Parcela ${inst.numero_parcela}/${inst.total_parcelas}`,
          data: today,
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
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await supabase.from("installments").update({ valor_parcela: valor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      setEditingInstallment(null);
      toast({ title: "Valor da parcela atualizado!" });
    },
  });

  const createSale = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer) throw new Error("Selecione um cliente");
      const total = cart.length > 0 ? cart.reduce((s, c) => s + c.preco * c.quantidade, 0) : parseFloat(manualTotal) || 0;
      if (total <= 0) throw new Error("Informe o valor da venda");
      const today = format(new Date(), "yyyy-MM-dd");

      // 1. Create sale
      const { data: sale, error: saleErr } = await supabase.from("sales").insert({
        user_id: user!.id,
        customer_id: selectedCustomer,
        total_venda: total,
        forma_pagamento: formaPagamento,
        data_compra: today,
        status: !parcelado ? "pago" : "ativa",
      }).select().single();
      if (saleErr) throw saleErr;

      // 2. Create sale_items (if any)
      if (cart.length > 0) {
        const items = cart.map(c => ({
          sale_id: sale.id,
          product_id: c.product_id,
          quantidade: c.quantidade,
          preco_unitario_vendido: c.preco,
          custo_unitario_no_momento: c.custo,
          subtotal: c.preco * c.quantidade,
        }));
        const { error: itemsErr } = await supabase.from("sale_items").insert(items);
        if (itemsErr) throw itemsErr;

        // 3. Decrement stock for each product
        for (const c of cart) {
          const { error: stockErr } = await supabase.from("products").update({
            estoque_atual: c.estoque_atual - c.quantidade,
          }).eq("id", c.product_id);
          if (stockErr) throw stockErr;
        }
      }

      // 4. Create installments if parcelado, or cash movement if à vista
      if (parcelado && valorPorParcela) {
        const vparcela = parseFloat(valorPorParcela);
        if (vparcela <= 0) throw new Error("Valor por parcela inválido");
        const numParcelas = Math.ceil(total / vparcela);
        const parcelas = Array.from({ length: numParcelas }, (_, i) => {
          const venc = new Date();
          venc.setMonth(venc.getMonth() + i + 1);
          const isLast = i === numParcelas - 1;
          const valor = isLast ? Math.round((total - vparcela * (numParcelas - 1)) * 100) / 100 : vparcela;
          return {
            user_id: user!.id,
            customer_id: selectedCustomer,
            sale_id: sale.id,
            numero_parcela: i + 1,
            total_parcelas: numParcelas,
            valor_parcela: valor,
            vencimento_data: format(venc, "yyyy-MM-dd"),
            status: "pendente",
          };
        });
        const { error: instErr } = await supabase.from("installments").insert(parcelas);
        if (instErr) throw instErr;
      } else {
        // à vista — register cash entry
        await supabase.from("cash_movements").insert({
          user_id: user!.id,
          tipo: "entrada",
          valor: total,
          origem: "venda",
          ref_id: sale.id,
          descricao: `Venda à vista`,
          data: today,
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
    setOpenNova(false);
    setSelectedCustomer("");
    setFormaPagamento("pix");
    setParcelado(false);
    setValorPorParcela("");
    setCart([]);
    setAddProductId("");
    setManualTotal("");
  };

  const addToCart = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    if (cart.find(c => c.product_id === productId)) {
      toast({ title: "Produto já adicionado", variant: "destructive" });
      return;
    }
    if (prod.estoque_atual <= 0) {
      toast({ title: "Produto sem estoque", variant: "destructive" });
      return;
    }
    setCart(prev => [...prev, {
      product_id: prod.id,
      nome: prod.nome,
      preco: prod.preco_padrao,
      custo: prod.custo_unitario,
      quantidade: 1,
      estoque_atual: prod.estoque_atual,
    }]);
    setAddProductId("");
  };

  const updateQty = (productId: string, qty: number) => {
    setCart(prev => prev.map(c => c.product_id === productId ? { ...c, quantidade: Math.min(Math.max(1, qty), c.estoque_atual) } : c));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(c => c.product_id !== productId));
  };

  const totalCart = cart.length > 0 ? cart.reduce((s, c) => s + c.preco * c.quantidade, 0) : parseFloat(manualTotal) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendas / Parcelas</h1>
        <Button onClick={() => setOpenNova(true)} className="gap-2"><Plus className="h-4 w-4" />Nova Venda</Button>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma venda registrada</TableCell></TableRow>
                  ) : sales.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{format(new Date(s.data_compra), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{(s as any).customers?.nome ?? "—"}</TableCell>
                      <TableCell>{formatBRL(s.total_venda)}</TableCell>
                      <TableCell className="capitalize">{s.forma_pagamento}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parcelas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : installments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma parcela registrada</TableCell></TableRow>
                  ) : installments.map(i => (
                    <TableRow key={i.id}>
                      <TableCell>{format(new Date(i.vencimento_data), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{(i as any).customers?.nome ?? "—"}</TableCell>
                      <TableCell>{i.numero_parcela}/{i.total_parcelas}</TableCell>
                      <TableCell>
                        {editingInstallment?.id === i.id ? (
                          <div className="flex gap-1 items-center">
                            <Input
                              type="number"
                              min={0.01}
                              step="0.01"
                              value={editingInstallment.valor}
                              onChange={e => setEditingInstallment({ ...editingInstallment, valor: e.target.value })}
                              className="h-7 w-24"
                            />
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-success" onClick={() => {
                              const v = parseFloat(editingInstallment.valor);
                              if (v > 0) updateInstallmentValue.mutate({ id: i.id, valor: v });
                            }}>
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : formatBRL(i.valor_parcela)}
                      </TableCell>
                      <TableCell><StatusBadge status={i.status} vencimento={i.vencimento_data} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {i.status === "pendente" && (
                            <>
                              <Button size="sm" variant="ghost" className="gap-1 text-success" onClick={() => markPaid.mutate(i.id)} disabled={markPaid.isPending}>
                                <CheckCircle className="h-4 w-4" />Pagar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingInstallment({ id: i.id, valor: String(i.valor_parcela) })}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteInstallment.mutate(i.id)} disabled={deleteInstallment.isPending}>
                            <Trash2 className="h-3 w-3" />
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
            <DialogTitle>Nova Venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Adicionar Produto */}
            <div className="space-y-1">
              <Label>Adicionar Produto</Label>
              <div className="flex gap-2">
                <Select value={addProductId} onValueChange={setAddProductId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent>
                    {products.filter(p => p.estoque_atual > 0).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} (est: {p.estoque_atual})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => addProductId && addToCart(addProductId)} disabled={!addProductId}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Carrinho */}
            {cart.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="w-20">Qtd</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map(c => (
                      <TableRow key={c.product_id}>
                        <TableCell className="text-sm">{c.nome}</TableCell>
                        <TableCell>
                          <Input type="number" min={1} max={c.estoque_atual} value={c.quantidade}
                            onChange={e => updateQty(c.product_id, parseInt(e.target.value) || 1)}
                            className="h-8 w-16" />
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatBRL(c.preco * c.quantidade)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(c.product_id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-3 border-t flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatBRL(totalCart)}</span>
                </div>
              </div>
            )}

            {/* Valor manual quando sem produtos */}
            {cart.length === 0 && (
              <div className="space-y-1">
                <Label>Valor da Venda (R$)</Label>
                <Input type="number" min={0} step="0.01" placeholder="0,00" value={manualTotal} onChange={e => setManualTotal(e.target.value)} />
              </div>
            )}

            {/* Forma de Pagamento */}
            <div className="space-y-1">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Parcelado */}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="parcelado" checked={parcelado} onChange={e => setParcelado(e.target.checked)} className="rounded" />
              <Label htmlFor="parcelado">Parcelado?</Label>
            </div>

            {parcelado && (
              <div className="space-y-1">
                <Label>Valor por Parcela (R$)</Label>
                <Input type="number" min={1} step="0.01" placeholder="Ex: 150.00" value={valorPorParcela} onChange={e => setValorPorParcela(e.target.value)} />
                {parseFloat(valorPorParcela) > 0 && totalCart > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Math.ceil(totalCart / parseFloat(valorPorParcela))}x de {formatBRL(parseFloat(valorPorParcela))}
                  </p>
                )}
              </div>
            )}

            <Button className="w-full" onClick={() => createSale.mutate()} disabled={createSale.isPending || !selectedCustomer}>
              {createSale.isPending ? "Registrando..." : "Registrar Venda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
