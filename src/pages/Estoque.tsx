import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/currency";
import { Plus, Search, AlertTriangle, Package as PackageIcon, Pencil, Trash2, TrendingUp, TrendingDown, BarChart3, Archive, FileDown, FileSpreadsheet, History, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";
import { PaginationControls } from "@/components/PaginationControls";
import { ProductForm } from "@/components/ProductForm";
import { StockMovementHistory } from "@/components/StockMovementHistory";
import { exportEstoqueCSV, exportEstoquePDF } from "@/lib/exportEstoque";

const PAGE_SIZE = 15;

const emptyForm = { nome: "", custo_unitario: "", preco_padrao: "", estoque_atual: "", alerta_estoque_minimo: "5", categoria: "", sku: "", foto_url: "", validade: "" };

const EXPIRY_ALERT_DAYS = 30;

function getExpiryInfo(validade?: string | null) {
  if (!validade) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = validade.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { days, label: "VENCIDO", status: "vencido" as const, className: "bg-destructive/10 text-destructive" };
  if (days <= EXPIRY_ALERT_DAYS) return { days, label: days === 0 ? "VENCE HOJE" : `${days}d`, status: "vencendo" as const, className: "bg-warning/10 text-warning" };
  return { days, label: `${days}d`, status: "ok" as const, className: "text-muted-foreground" };
}


export default function Estoque() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [stockFilter, setStockFilter] = useState("todos");
  const [form, setForm] = useState(emptyForm);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        nome: form.nome,
        custo_unitario: Number(form.custo_unitario),
        preco_padrao: Number(form.preco_padrao),
        estoque_atual: Number(form.estoque_atual) || 0,
        alerta_estoque_minimo: Number(form.alerta_estoque_minimo) || 5,
        categoria: form.categoria || null,
        sku: form.sku || null,
        foto_url: form.foto_url || null,
        validade: form.validade || null,

        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto criado com sucesso!" });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao criar produto", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("products").update({
        nome: data.nome,
        custo_unitario: Number(data.custo_unitario),
        preco_padrao: Number(data.preco_padrao),
        estoque_atual: Number(data.estoque_atual),
        alerta_estoque_minimo: Number(data.alerta_estoque_minimo),
        categoria: data.categoria || null,
        sku: data.sku || null,
        foto_url: data.foto_url || null,
        validade: data.validade || null,

      }).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto atualizado!" });
      setEditingProduct(null);
    },
    onError: () => toast({ title: "Erro ao atualizar produto", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto excluído!" });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: "Erro ao excluir. Verifique se não há vendas vinculadas.", variant: "destructive" }),
  });

  const categories = [...new Set(products.map(p => p.categoria).filter(Boolean))] as string[];

  const filtered = products.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.categoria?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "todos" || p.categoria === categoryFilter;
    const exp = getExpiryInfo((p as any).validade);
    const matchStock = stockFilter === "todos" ? true :
      stockFilter === "baixo" ? (p.estoque_atual <= p.alerta_estoque_minimo && p.estoque_atual > 0) :
      stockFilter === "zerado" ? p.estoque_atual === 0 :
      stockFilter === "vencido" ? exp?.status === "vencido" :
      stockFilter === "vencendo" ? exp?.status === "vencendo" :
      p.estoque_atual > p.alerta_estoque_minimo;
    return matchSearch && matchCategory && matchStock;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const calcMargem = (custo: number, preco: number) => preco === 0 ? 0 : ((preco - custo) / preco * 100);

  const totalEstoqueValor = products.reduce((acc, p) => acc + (p.estoque_atual * p.custo_unitario), 0);
  const totalEstoqueVenda = products.reduce((acc, p) => acc + (p.estoque_atual * p.preco_padrao), 0);
  const lowStockCount = products.filter(p => p.estoque_atual <= p.alerta_estoque_minimo && p.estoque_atual > 0).length;
  const zeroStockCount = products.filter(p => p.estoque_atual === 0).length;
  const expiredCount = products.filter(p => getExpiryInfo((p as any).validade)?.status === "vencido").length;
  const nearExpiryCount = products.filter(p => getExpiryInfo((p as any).validade)?.status === "vencendo").length;
  const avgMargem = products.length > 0 ? products.reduce((acc, p) => acc + calcMargem(p.custo_unitario, p.preco_padrao), 0) / products.length : 0;


  const openEdit = (p: any) => {
    setEditingProduct({
      id: p.id, nome: p.nome, custo_unitario: String(p.custo_unitario), preco_padrao: String(p.preco_padrao),
      estoque_atual: String(p.estoque_atual), alerta_estoque_minimo: String(p.alerta_estoque_minimo),
      categoria: p.categoria || "", sku: p.sku || "", foto_url: p.foto_url || "", validade: p.validade || "",
    });
  };

  const stats = [
    { label: "Produtos", value: products.length, icon: PackageIcon, color: "text-primary" },
    { label: "Valor em Estoque", value: formatBRL(totalEstoqueValor), icon: Archive, color: "text-primary" },
    { label: "Potencial de Venda", value: formatBRL(totalEstoqueVenda), icon: TrendingUp, color: "text-success" },
    { label: "Margem Média", value: `${avgMargem.toFixed(1)}%`, icon: BarChart3, color: avgMargem >= 30 ? "text-success" : "text-warning" },
    { label: "Validade (vencendo/vencidos)", value: `${nearExpiryCount} / ${expiredCount}`, icon: CalendarClock, color: expiredCount > 0 ? "text-destructive" : nearExpiryCount > 0 ? "text-warning" : "text-muted-foreground" },
  ];


  const [activeTab, setActiveTab] = useState("produtos");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} produtos
            {lowStockCount > 0 && <span className="text-warning font-semibold ml-1">• {lowStockCount} baixo</span>}
            {zeroStockCount > 0 && <span className="text-destructive font-semibold ml-1">• {zeroStockCount} zerado</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportEstoquePDF(filtered)}>
            <FileDown className="h-3.5 w-3.5" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportEstoqueCSV(filtered)}>
            <FileSpreadsheet className="h-3.5 w-3.5" />Excel
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 gradient-primary shadow-glow"><Plus className="h-4 w-4" />Novo Produto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                    <PackageIcon className="h-4 w-4 text-primary-foreground" />
                  </div>
                  Novo Produto
                </DialogTitle>
              </DialogHeader>
              <ProductForm data={form} setData={setForm} onSave={() => createMutation.mutate()} isPending={createMutation.isPending} buttonLabel="Criar Produto" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">{stat.label}</p>
                <p className="text-lg font-bold tracking-tight truncate">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="produtos" className="gap-1.5"><PackageIcon className="h-3.5 w-3.5" />Produtos</TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-1.5"><History className="h-3.5 w-3.5" />Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, categoria ou SKU..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-10 bg-card border-border/50" />
            </div>
            {categories.length > 0 && (
              <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40 h-10 bg-card border-border/50"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas categorias</SelectItem>
                  {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={stockFilter} onValueChange={v => { setStockFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-10 bg-card border-border/50"><SelectValue placeholder="Estoque" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo estoque</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="baixo">Estoque baixo</SelectItem>
                <SelectItem value="zerado">Zerado</SelectItem>
                <SelectItem value="vencendo">Perto do vencimento</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>

              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Produto</TableHead>
                    <TableHead className="font-semibold">Custo</TableHead>
                    <TableHead className="font-semibold">Preço</TableHead>
                    <TableHead className="font-semibold">Margem</TableHead>
                    <TableHead className="font-semibold">Estoque</TableHead>
                    <TableHead className="font-semibold">Validade</TableHead>
                    <TableHead className="w-20 text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
                  ) : paginated.map(p => {
                    const margem = calcMargem(p.custo_unitario, p.preco_padrao);
                    const lowStock = p.estoque_atual <= p.alerta_estoque_minimo;
                    const zeroStock = p.estoque_atual === 0;
                    const exp = getExpiryInfo((p as any).validade);

                    return (
                      <TableRow key={p.id} className="hover:bg-primary/5 transition-colors group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {p.foto_url ? (
                              <img src={p.foto_url} alt={p.nome} className="w-10 h-10 rounded-lg object-cover border border-border/50 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <PackageIcon className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{p.nome}</p>
                              <div className="flex items-center gap-2">
                                {p.categoria && <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.categoria}</span>}
                                {p.sku && <span className="text-[11px] text-muted-foreground">SKU: {p.sku}</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatBRL(p.custo_unitario)}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatBRL(p.preco_padrao)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {margem >= 30 ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-warning" />}
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                              margem >= 30 ? "bg-success/10 text-success" : margem >= 15 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                            }`}>{margem.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${zeroStock ? "text-destructive" : lowStock ? "text-warning" : ""}`}>
                              {p.estoque_atual}
                            </span>
                            {zeroStock && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">ZERADO</span>}
                            {lowStock && !zeroStock && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-4">
          <StockMovementHistory products={products} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(v) => { if (!v) setEditingProduct(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <PackageIcon className="h-4 w-4 text-primary-foreground" />
              </div>
              Editar Produto
            </DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <ProductForm data={editingProduct} setData={setEditingProduct} onSave={() => updateMutation.mutate(editingProduct)} isPending={updateMutation.isPending} buttonLabel="Salvar Alterações" />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir Produto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
