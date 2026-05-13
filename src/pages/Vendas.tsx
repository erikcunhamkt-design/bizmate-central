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
import { endOfMonth, format, startOfMonth } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, CheckCircle, DollarSign, Plus, Trash2, Pencil, ShoppingCart, CreditCard, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { PaginationControls } from "@/components/PaginationControls";
import { buildAllocationPreview, getPaidValue, getRemainingValue } from "@/lib/receivables";
import { useOperator } from "@/hooks/useOperator";

const PAGE_SIZE = 15;

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
  const { operator } = useOperator();
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
  const [salesPage, setSalesPage] = useState(1);
  const [installmentsPage, setInstallmentsPage] = useState(1);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [parcelado, setParcelado] = useState(false);
  const [valorTotalParcelado, setValorTotalParcelado] = useState("");
  const [valorPorParcela, setValorPorParcela] = useState("");
  const [diaPagamento, setDiaPagamento] = useState("");
  const [quantidadeParcelas, setQuantidadeParcelas] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  const [editingInstallment, setEditingInstallment] = useState<{ id: string; valor: string; vencimento: string } | null>(null);
  const [editingSale, setEditingSale] = useState<{ id: string; customer_id: string; total: string; forma_pagamento: string; data_compra: string } | null>(null);
  const [pendingDeleteSale, setPendingDeleteSale] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [receivingInstallment, setReceivingInstallment] = useState<any | null>(null);
  const [receiveForm, setReceiveForm] = useState({ valor: "", data: format(new Date(), "yyyy-MM-dd"), metodo: "pix", observacoes: "" });

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

  const receivePayment = useMutation({
    mutationFn: async () => {
      if (!receivingInstallment) throw new Error("Selecione uma parcela");
      const valorRecebido = parseFloat(receiveForm.valor);
      if (!valorRecebido || valorRecebido <= 0) throw new Error("Informe o valor recebido");
      const preview = buildAllocationPreview(installments as any, receivingInstallment.id, valorRecebido);
      const totalEmAberto = preview.reduce((sum, item) => sum + item.amount, 0);
      if (Math.abs(totalEmAberto - valorRecebido) > 0.009) throw new Error("O valor recebido é maior que o saldo em aberto desta venda");

      const { data: payment, error: paymentError } = await (supabase as any).from("customer_payments").insert({
        user_id: user!.id,
        customer_id: receivingInstallment.customer_id,
        sale_id: receivingInstallment.sale_id,
        valor_total: valorRecebido,
        data_pagamento: receiveForm.data,
        metodo_recebimento: receiveForm.metodo,
        observacoes: receiveForm.observacoes || null,
        operador: operator,
      }).select().single();
      if (paymentError) throw paymentError;

      const { error: allocationsError } = await (supabase as any).from("payment_allocations").insert(preview.map(item => ({
        user_id: user!.id,
        payment_id: payment.id,
        installment_id: item.installment.id,
        valor_aplicado: item.amount,
        tipo: item.installment.id === receivingInstallment.id ? "parcela" : "abatimento",
      })));
      if (allocationsError) throw allocationsError;

      for (const item of preview) {
        const novoPago = Math.round((getPaidValue(item.installment) + item.amount) * 100) / 100;
        const { error } = await supabase.from("installments").update({
          pago_valor: novoPago,
          pago_em: item.statusAfter === "pago" ? receiveForm.data : null,
          metodo_recebimento: receiveForm.metodo,
          status: item.statusAfter,
        }).eq("id", item.installment.id);
        if (error) throw error;
      }

      const { error: cashError } = await supabase.from("cash_movements").insert({
        user_id: user!.id, tipo: "entrada", valor: valorRecebido, origem: "recebimento",
        ref_id: payment.id, descricao: `Recebimento parcelado — ${(receivingInstallment as any).customers?.nome ?? "Cliente"}`, data: receiveForm.data,
      });
      if (cashError) throw cashError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-sales"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-goals-cash-history"] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
      setReceivingInstallment(null);
      setReceiveForm({ valor: "", data: format(new Date(), "yyyy-MM-dd"), metodo: "pix", observacoes: "" });
      toast({ title: "Recebimento registrado!" });
    },
    onError: (e) => toast({ title: "Erro ao receber pagamento", description: e.message, variant: "destructive" }),
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

  const undoInstallmentPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("undo_installment_payment", { p_installment_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["customer-installments"] });
      queryClient.invalidateQueries({ queryKey: ["customer-payment-history"] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Recebimento desfeito!" });
    },
    onError: (e: any) => toast({ title: "Erro ao desfazer", description: e.message, variant: "destructive" }),
  });

    mutationFn: async ({ id, customer_id, total, forma_pagamento, data_compra }: { id: string; customer_id: string; total: number; forma_pagamento: string; data_compra: string }) => {
      if (total <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase.from("sales").update({ customer_id, total_venda: total, forma_pagamento, data_compra }).eq("id", id);
      if (error) throw error;
      const { error: cashError } = await supabase
        .from("cash_movements")
        .update({ valor: total, data: data_compra, descricao: `Venda à vista` })
        .eq("ref_id", id)
        .eq("origem", "venda");
      if (cashError) throw cashError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-sales"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-goals-cash-history"] });
      setEditingSale(null);
      toast({ title: "Venda atualizada!" });
    },
    onError: (e) => toast({ title: "Erro ao editar venda", description: e.message, variant: "destructive" }),
  });

  const createSale = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer) throw new Error("Selecione um cliente");
      const totalProdutos = cart.length > 0 ? cart.reduce((s, c) => s + c.preco * c.quantidade, 0) : parseFloat(manualTotal) || 0;
      const total = parcelado ? (parseFloat(valorTotalParcelado) || totalProdutos) : totalProdutos;
      if (total <= 0) throw new Error("Informe o valor da venda");
      const today = format(new Date(), "yyyy-MM-dd");

      const { data: sale, error: saleErr } = await supabase.from("sales").insert({
        user_id: user!.id, customer_id: selectedCustomer, total_venda: total,
        forma_pagamento: parcelado ? "parcelado" : formaPagamento, data_compra: today, status: !parcelado ? "pago" : "ativa",
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

      if (parcelado) {
        const vparcela = parseFloat(valorPorParcela);
        const numParcelas = parseInt(quantidadeParcelas);
        const intervaloDias = parseInt(diaPagamento);
        if (vparcela <= 0) throw new Error("Valor por parcela inválido");
        if (!numParcelas || numParcelas <= 0) throw new Error("Informe em quantas vezes o cliente fez");
        if (!intervaloDias || intervaloDias <= 0) throw new Error("Informe o intervalo de dias entre os vencimentos");
        const parcelas = Array.from({ length: numParcelas }, (_, i) => {
          const venc = new Date();
          venc.setDate(venc.getDate() + intervaloDias * (i + 1));
          const isLast = i === numParcelas - 1;
          const valor = isLast ? Math.round((total - vparcela * (numParcelas - 1)) * 100) / 100 : vparcela;
          if (valor <= 0) throw new Error("Confira o total, valor da parcela e quantidade de vezes");
          return {
            user_id: user!.id, customer_id: selectedCustomer, sale_id: sale.id,
            numero_parcela: i + 1, total_parcelas: numParcelas, valor_parcela: valor,
            vencimento_data: format(venc, "yyyy-MM-dd"), status: "pendente",
          };
        });
        const { error: installmentsErr } = await supabase.from("installments").insert(parcelas);
        if (installmentsErr) throw installmentsErr;
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
      queryClient.invalidateQueries({ queryKey: ["monthly-sales"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-goals-cash-history"] });
      toast({ title: "Venda registrada com sucesso!" });
      resetForm();
    },
    onError: (e) => toast({ title: "Erro ao criar venda", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setOpenNova(false); setSelectedCustomer(""); setFormaPagamento("pix");
    setParcelado(false); setValorTotalParcelado(""); setValorPorParcela(""); setDiaPagamento(""); setQuantidadeParcelas("");
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
  const totalVendaAtual = parcelado ? parseFloat(valorTotalParcelado) || 0 : totalCart;
  const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const currentMonthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const totalVendido = sales.reduce((sum, sale) => sum + sale.total_venda, 0);
  const totalAReceberParcelado = installments.filter(i => i.status !== "pago").reduce((sum, i) => sum + getRemainingValue(i), 0);
  const aReceberParceladoMes = installments
    .filter(i => i.status !== "pago" && i.vencimento_data >= currentMonthStart && i.vencimento_data <= currentMonthEnd)
    .reduce((sum, i) => sum + getRemainingValue(i), 0);
  const receivingPreview = receivingInstallment ? buildAllocationPreview(installments as any, receivingInstallment.id, parseFloat(receiveForm.valor) || 0) : [];

  const deleteSale = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason?: string }) => {
      const sale = sales.find(s => s.id === saleId);
      if (!sale) throw new Error("Venda não encontrada");
      const saleInstallments = installments.filter(i => i.sale_id === saleId);
      const hasPaidInstallments = saleInstallments.some(i => i.status === "pago" || i.status === "parcial");
      const isCashSaleWithLinkedEntries = sale.forma_pagamento !== "parcelado" && sale.status === "pago";
      if (isCashSaleWithLinkedEntries && !reason?.trim()) throw new Error("Informe o motivo da exclusão");

      const installmentIds = saleInstallments.map(i => i.id);
      const { data: linkedCashMovements, error: linkedCashErr } = await supabase.from("cash_movements").select("id, tipo, origem, valor, data, descricao").eq("ref_id", saleId);
      if (linkedCashErr) throw linkedCashErr;

      if (isCashSaleWithLinkedEntries) {
        const { error: auditErr } = await (supabase as any).from("audit_logs").insert({
          user_id: user!.id,
          action: "delete_cash_sale_with_linked_entries",
          entity_type: "sale",
          entity_id: saleId,
          reason: reason!.trim(),
          details: {
            sale: {
              customer_id: sale.customer_id,
              customer_name: (sale as any).customers?.nome ?? null,
              total_venda: sale.total_venda,
              forma_pagamento: sale.forma_pagamento,
              data_compra: sale.data_compra,
              status: sale.status,
            },
            linked_cash_movements: linkedCashMovements ?? [],
          },
        });
        if (auditErr) throw auditErr;
      }

      if (installmentIds.length > 0) {
        const { error: cashInstallmentsErr } = await supabase.from("cash_movements").delete().in("ref_id", installmentIds);
        if (cashInstallmentsErr) throw cashInstallmentsErr;
      }
      const { error: cashSaleErr } = await supabase.from("cash_movements").delete().eq("ref_id", saleId);
      if (cashSaleErr) throw cashSaleErr;
      const { data: saleItems, error: saleItemsFetchErr } = await supabase.from("sale_items").select("product_id, quantidade").eq("sale_id", saleId);
      if (saleItemsFetchErr) throw saleItemsFetchErr;
      for (const item of saleItems ?? []) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const { error: stockErr } = await supabase.from("products").update({ estoque_atual: product.estoque_atual + item.quantidade }).eq("id", item.product_id);
          if (stockErr) throw stockErr;
        }
      }
      const { error: installmentsErr } = await supabase.from("installments").delete().eq("sale_id", saleId);
      if (installmentsErr) throw installmentsErr;
      const { error: itemsErr } = await supabase.from("sale_items").delete().eq("sale_id", saleId);
      if (itemsErr) throw itemsErr;
      const { error: saleErr } = await supabase.from("sales").delete().eq("id", saleId);
      if (saleErr) throw saleErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-sales"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-goals-cash-history"] });
      setPendingDeleteSale(null);
      setDeleteReason("");
      toast({ title: "Venda excluída!" });
    },
    onError: (e) => toast({ title: "Erro ao excluir venda", description: e.message, variant: "destructive" }),
  });

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
      installmentStatusFilter === "atrasado" ? (i.status !== "pago" && getRemainingValue(i) > 0 && new Date(i.vencimento_data) < new Date()) :
      i.status === installmentStatusFilter;
    return matchSearch && matchStatus;
  });

  const paginatedSales = filteredSales.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
  const paginatedInstallments = filteredInstallments.slice((installmentsPage - 1) * PAGE_SIZE, installmentsPage * PAGE_SIZE);

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total vendido</p>
              <p className="text-lg font-bold text-success">{formatBRL(totalVendido)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">A receber parcelado</p>
              <p className="text-lg font-bold text-primary">{formatBRL(totalAReceberParcelado)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">A receber no mês</p>
              <p className="text-lg font-bold text-warning">{formatBRL(aReceberParceladoMes)}</p>
            </div>
          </CardContent>
        </Card>
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filteredSales.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</TableCell></TableRow>
                  ) : paginatedSales.map(s => (
                    <TableRow key={s.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="text-sm">
                        {editingSale?.id === s.id ? <Input type="date" value={editingSale.data_compra} onChange={e => setEditingSale({ ...editingSale, data_compra: e.target.value })} className="h-8 w-36" /> : format(new Date(s.data_compra), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">
                        {editingSale?.id === s.id ? (
                          <Select value={editingSale.customer_id} onValueChange={v => setEditingSale({ ...editingSale, customer_id: v })}>
                            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (s as any).customers?.nome ?? "—"}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">
                        {editingSale?.id === s.id ? <Input type="number" min={0.01} step="0.01" value={editingSale.total} onChange={e => setEditingSale({ ...editingSale, total: e.target.value })} className="h-8 w-28" /> : formatBRL(s.total_venda)}
                      </TableCell>
                      <TableCell>
                        {editingSale?.id === s.id ? (
                          <Select value={editingSale.forma_pagamento} onValueChange={v => setEditingSale({ ...editingSale, forma_pagamento: v })}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <span className="capitalize text-xs bg-muted px-2 py-1 rounded-md">{s.forma_pagamento}</span>}
                      </TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editingSale?.id === s.id ? (
                            <>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-success hover:bg-success/10" onClick={() => updateSale.mutate({ id: s.id, customer_id: editingSale.customer_id, total: parseFloat(editingSale.total), forma_pagamento: editingSale.forma_pagamento, data_compra: editingSale.data_compra })} disabled={updateSale.isPending}>
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingSale(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10" onClick={() => setEditingSale({ id: s.id, customer_id: s.customer_id, total: String(s.total_venda), forma_pagamento: s.forma_pagamento === "parcelado" ? "pix" : s.forma_pagamento, data_compra: s.data_compra })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => {
                            if (s.forma_pagamento !== "parcelado" && s.status === "pago") {
                              setPendingDeleteSale(s);
                              setDeleteReason("");
                              return;
                            }
                            deleteSale.mutate({ saleId: s.id });
                          }} disabled={deleteSale.isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls currentPage={salesPage} totalItems={filteredSales.length} pageSize={PAGE_SIZE} onPageChange={setSalesPage} />
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
                <SelectItem value="parcial">Parcial</SelectItem>
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
                    <TableHead className="font-semibold">Recebido</TableHead>
                    <TableHead className="font-semibold">Falta</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filteredInstallments.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma parcela encontrada</TableCell></TableRow>
                  ) : paginatedInstallments.map(i => (
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
                      <TableCell className="text-sm font-semibold text-success">{formatBRL(getPaidValue(i))}</TableCell>
                      <TableCell className={`text-sm font-semibold ${getRemainingValue(i) > 0 ? "text-warning" : "text-muted-foreground"}`}>{formatBRL(getRemainingValue(i))}</TableCell>
                      <TableCell><StatusBadge status={i.status} vencimento={i.vencimento_data} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {i.status !== "pago" && getRemainingValue(i) > 0 && (
                            <>
                              <Button size="sm" variant="ghost" className="gap-1 h-8 text-success hover:bg-success/10" onClick={() => {
                                setReceivingInstallment(i);
                                setReceiveForm({ valor: String(getRemainingValue(i)), data: format(new Date(), "yyyy-MM-dd"), metodo: "pix", observacoes: "" });
                              }} disabled={receivePayment.isPending}>
                                <CheckCircle className="h-3.5 w-3.5" />Receber
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
              <PaginationControls currentPage={installmentsPage} totalItems={filteredInstallments.length} pageSize={PAGE_SIZE} onPageChange={setInstallmentsPage} />
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

            <div className="space-y-1.5 opacity-100 data-[disabled=true]:opacity-50" data-disabled={parcelado}>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento} disabled={parcelado}>
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
                  <Label className="text-xs">Valor Total Parcelado (R$)</Label>
                  <Input type="number" min={0.01} step="0.01" placeholder="Ex: 900.00" value={valorTotalParcelado} onChange={e => setValorTotalParcelado(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor da Parcela (R$)</Label>
                  <Input type="number" min={1} step="0.01" placeholder="Ex: 150.00" value={valorPorParcela} onChange={e => setValorPorParcela(e.target.value)} className="h-10" />
                  {parseFloat(valorPorParcela) > 0 && parseInt(quantidadeParcelas) > 0 && totalVendaAtual > 0 && (
                    <p className="text-xs text-primary font-semibold">
                      {quantidadeParcelas}x de {formatBRL(parseFloat(valorPorParcela))} • total {formatBRL(totalVendaAtual)}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dias de Pagamento</Label>
                    <Input type="number" min={1} placeholder="Ex: 30" value={diaPagamento} onChange={e => setDiaPagamento(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quantas Vezes</Label>
                    <Input type="number" min={1} placeholder="Ex: 6" value={quantidadeParcelas} onChange={e => setQuantidadeParcelas(e.target.value)} className="h-10" />
                  </div>
                </div>
              </div>
            )}

            <Button className="w-full h-11 gradient-primary shadow-glow font-semibold" onClick={() => createSale.mutate()} disabled={createSale.isPending || !selectedCustomer || (parcelado && (!valorTotalParcelado || !valorPorParcela || !diaPagamento || !quantidadeParcelas))}>
              {createSale.isPending ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : "Registrar Venda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receivingInstallment} onOpenChange={(open) => { if (!open) setReceivingInstallment(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-success" />
              </div>
              Receber pagamento
            </DialogTitle>
          </DialogHeader>
          {receivingInstallment && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Parcela</p><p className="font-semibold">{receivingInstallment.numero_parcela}/{receivingInstallment.total_parcelas}</p></div>
                <div><p className="text-xs text-muted-foreground">Recebido</p><p className="font-semibold text-success">{formatBRL(getPaidValue(receivingInstallment))}</p></div>
                <div><p className="text-xs text-muted-foreground">Falta</p><p className="font-semibold text-warning">{formatBRL(getRemainingValue(receivingInstallment))}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor recebido</Label>
                  <Input type="number" min={0.01} step="0.01" value={receiveForm.valor} onChange={e => setReceiveForm(f => ({ ...f, valor: e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</Label>
                  <Input type="date" value={receiveForm.data} onChange={e => setReceiveForm(f => ({ ...f, data: e.target.value }))} className="h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de recebimento</Label>
                <Select value={receiveForm.metodo} onValueChange={metodo => setReceiveForm(f => ({ ...f, metodo }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Operador</p>
                <p className="text-sm font-semibold">{operator}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observação</Label>
                <Textarea value={receiveForm.observacoes} onChange={e => setReceiveForm(f => ({ ...f, observacoes: e.target.value }))} className="resize-none" rows={2} />
              </div>
              {receivingPreview.length > 0 && (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aplicação automática</div>
                  {receivingPreview.map(item => (
                    <div key={item.installment.id} className="flex items-center justify-between px-3 py-2 border-t border-border/50 text-sm">
                      <span>Parcela {item.installment.numero_parcela}/{item.installment.total_parcelas}</span>
                      <span className="font-semibold text-success">{formatBRL(item.amount)} — {item.statusAfter === "pago" ? "paga" : "parcial"}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button className="w-full h-11 gradient-primary shadow-glow font-semibold" onClick={() => receivePayment.mutate()} disabled={receivePayment.isPending || receivingPreview.length === 0}>
                {receivePayment.isPending ? "Registrando..." : "Registrar recebimento"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDeleteSale} onOpenChange={(open) => { if (!open) { setPendingDeleteSale(null); setDeleteReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-destructive" />
              </div>
              Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/40 p-3 text-sm">
              <p className="font-semibold">Venda à vista com lançamento vinculado</p>
              <p className="text-muted-foreground">{pendingDeleteSale ? `${(pendingDeleteSale as any).customers?.nome ?? "Cliente"} • ${formatBRL(pendingDeleteSale.total_venda)}` : ""}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motivo/observação obrigatório</Label>
              <Textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Ex: venda lançada em duplicidade, cancelamento confirmado..." className="min-h-24 resize-none" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPendingDeleteSale(null); setDeleteReason(""); }}>Cancelar</Button>
              <Button variant="destructive" disabled={!deleteReason.trim() || deleteSale.isPending} onClick={() => pendingDeleteSale && deleteSale.mutate({ saleId: pendingDeleteSale.id, reason: deleteReason })}>
                {deleteSale.isPending ? "Excluindo..." : "Excluir e auditar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
