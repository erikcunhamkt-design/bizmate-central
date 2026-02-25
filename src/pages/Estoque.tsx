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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/currency";
import { Plus, Search, AlertTriangle } from "lucide-react";

export default function Estoque() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nome: "", custo_unitario: "", preco_padrao: "", estoque_atual: "", alerta_estoque_minimo: "5", categoria: "", sku: "" });

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
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto criado!" });
      setOpen(false);
      setForm({ nome: "", custo_unitario: "", preco_padrao: "", estoque_atual: "", alerta_estoque_minimo: "5", categoria: "", sku: "" });
    },
    onError: () => toast({ title: "Erro ao criar produto", variant: "destructive" }),
  });

  const filtered = products.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()));

  const calcMargem = (custo: number, preco: number) => {
    if (preco === 0) return 0;
    return ((preco - custo) / preco * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estoque</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Produto</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Custo Unit. *</Label><Input type="number" step="0.01" value={form.custo_unitario} onChange={e => setForm(f => ({ ...f, custo_unitario: e.target.value }))} /></div>
                <div><Label>Preço Venda *</Label><Input type="number" step="0.01" value={form.preco_padrao} onChange={e => setForm(f => ({ ...f, preco_padrao: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Estoque Atual</Label><Input type="number" value={form.estoque_atual} onChange={e => setForm(f => ({ ...f, estoque_atual: e.target.value }))} /></div>
                <div><Label>Alerta Mínimo</Label><Input type="number" value={form.alerta_estoque_minimo} onChange={e => setForm(f => ({ ...f, alerta_estoque_minimo: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} /></div>
                <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
              </div>
              <Button className="w-full" disabled={!form.nome || !form.custo_unitario || !form.preco_padrao || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produtos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Margem</TableHead>
                <TableHead>Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
              ) : filtered.map(p => {
                const margem = calcMargem(p.custo_unitario, p.preco_padrao);
                const lowStock = p.estoque_atual <= p.alerta_estoque_minimo;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.nome}</p>
                        {p.categoria && <p className="text-xs text-muted-foreground">{p.categoria}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{formatBRL(p.custo_unitario)}</TableCell>
                    <TableCell>{formatBRL(p.preco_padrao)}</TableCell>
                    <TableCell>
                      <span className={margem >= 30 ? "text-success" : margem >= 15 ? "text-warning" : "text-destructive"}>
                        {margem.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{p.estoque_atual}</span>
                        {lowStock && <AlertTriangle className="h-4 w-4 text-warning" />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
