import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/currency";
import { Plus, Search, AlertTriangle, Package as PackageIcon, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

const emptyForm = { nome: "", custo_unitario: "", preco_padrao: "", estoque_atual: "", alerta_estoque_minimo: "5", categoria: "", sku: "" };

export default function Estoque() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
        nome: form.nome, custo_unitario: Number(form.custo_unitario), preco_padrao: Number(form.preco_padrao),
        estoque_atual: Number(form.estoque_atual) || 0, alerta_estoque_minimo: Number(form.alerta_estoque_minimo) || 5,
        categoria: form.categoria || null, sku: form.sku || null, user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto criado!" });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao criar produto", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("products").update({
        nome: data.nome, custo_unitario: Number(data.custo_unitario), preco_padrao: Number(data.preco_padrao),
        estoque_atual: Number(data.estoque_atual), alerta_estoque_minimo: Number(data.alerta_estoque_minimo),
        categoria: data.categoria || null, sku: data.sku || null,
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
    onError: () => toast({ title: "Erro ao excluir produto. Verifique se não há vendas vinculadas.", variant: "destructive" }),
  });

  const filtered = products.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()) || p.categoria?.toLowerCase().includes(search.toLowerCase()));
  const calcMargem = (custo: number, preco: number) => preco === 0 ? 0 : ((preco - custo) / preco * 100);
  const lowStockCount = products.filter(p => p.estoque_atual <= p.alerta_estoque_minimo).length;

  const openEdit = (p: any) => {
    setEditingProduct({
      id: p.id, nome: p.nome, custo_unitario: String(p.custo_unitario), preco_padrao: String(p.preco_padrao),
      estoque_atual: String(p.estoque_atual), alerta_estoque_minimo: String(p.alerta_estoque_minimo),
      categoria: p.categoria || "", sku: p.sku || "",
    });
  };

  const ProductForm = ({ data, setData, onSave, isPending, buttonLabel }: any) => (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label>Nome *</Label><Input value={data.nome} onChange={e => setData((f: any) => ({ ...f, nome: e.target.value }))} className="h-10" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Custo Unit. *</Label><Input type="number" step="0.01" value={data.custo_unitario} onChange={e => setData((f: any) => ({ ...f, custo_unitario: e.target.value }))} className="h-10" /></div>
        <div className="space-y-1.5"><Label>Preço Venda *</Label><Input type="number" step="0.01" value={data.preco_padrao} onChange={e => setData((f: any) => ({ ...f, preco_padrao: e.target.value }))} className="h-10" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Estoque Atual</Label><Input type="number" value={data.estoque_atual} onChange={e => setData((f: any) => ({ ...f, estoque_atual: e.target.value }))} className="h-10" /></div>
        <div className="space-y-1.5"><Label>Alerta Mínimo</Label><Input type="number" value={data.alerta_estoque_minimo} onChange={e => setData((f: any) => ({ ...f, alerta_estoque_minimo: e.target.value }))} className="h-10" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Categoria</Label><Input value={data.categoria} onChange={e => setData((f: any) => ({ ...f, categoria: e.target.value }))} className="h-10" /></div>
        <div className="space-y-1.5"><Label>SKU</Label><Input value={data.sku} onChange={e => setData((f: any) => ({ ...f, sku: e.target.value }))} className="h-10" /></div>
      </div>
      <Button className="w-full h-10 gradient-primary" disabled={!data.nome || !data.custo_unitario || !data.preco_padrao || isPending} onClick={onSave}>
        {isPending ? "Salvando..." : buttonLabel}
      </Button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} produtos • {lowStockCount > 0 && <span className="text-warning font-semibold">{lowStockCount} com estoque baixo</span>}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 gradient-primary shadow-glow"><Plus className="h-4 w-4" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <PackageIcon className="h-4 w-4 text-primary-foreground" />
                </div>
                Novo Produto
              </DialogTitle>
            </DialogHeader>
            <ProductForm data={form} setData={setForm} onSave={() => createMutation.mutate()} isPending={createMutation.isPending} buttonLabel="Salvar Produto" />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produtos ou categorias..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 bg-card border-border/50" />
      </div>

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
                <TableHead className="w-20 text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
              ) : filtered.map(p => {
                const margem = calcMargem(p.custo_unitario, p.preco_padrao);
                const lowStock = p.estoque_atual <= p.alerta_estoque_minimo;
                return (
                  <TableRow key={p.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <PackageIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{p.nome}</p>
                          <div className="flex items-center gap-2">
                            {p.categoria && <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.categoria}</span>}
                            {p.sku && <span className="text-[11px] text-muted-foreground">SKU: {p.sku}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatBRL(p.custo_unitario)}</TableCell>
                    <TableCell className="text-sm font-semibold">{formatBRL(p.preco_padrao)}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        margem >= 30 ? "bg-success/10 text-success" : margem >= 15 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                      }`}>{margem.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${lowStock ? "text-warning" : ""}`}>{p.estoque_atual}</span>
                        {lowStock && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
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
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(v) => { if (!v) setEditingProduct(null); }}>
        <DialogContent>
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

      {/* Delete Confirm Dialog */}
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
