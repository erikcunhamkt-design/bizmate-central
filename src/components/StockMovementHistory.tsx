import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PaginationControls } from "@/components/PaginationControls";
import { StockEvolutionChart } from "@/components/StockEvolutionChart";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Plus, Search, Package as PackageIcon } from "lucide-react";

const PAGE_SIZE = 15;

interface Product {
  id: string;
  nome: string;
  estoque_atual: number;
  foto_url?: string | null;
}

interface StockMovementHistoryProps {
  products: Product[];
}

export function StockMovementHistory({ products }: StockMovementHistoryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [openMovement, setOpenMovement] = useState(false);
  const [movForm, setMovForm] = useState({ product_id: "", tipo: "entrada", quantidade: "", motivo: "" });

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["stock_movements", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, products(nome, foto_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const movementMutation = useMutation({
    mutationFn: async () => {
      const product = products.find(p => p.id === movForm.product_id);
      if (!product) throw new Error("Produto não encontrado");

      const qty = Number(movForm.quantidade);
      if (qty <= 0) throw new Error("Quantidade inválida");

      const estoqueAnterior = product.estoque_atual;
      let estoquePosterior: number;

      if (movForm.tipo === "entrada") {
        estoquePosterior = estoqueAnterior + qty;
      } else if (movForm.tipo === "saida") {
        if (qty > estoqueAnterior) throw new Error("Estoque insuficiente");
        estoquePosterior = estoqueAnterior - qty;
      } else {
        estoquePosterior = qty; // ajuste direto
      }

      const { error: movError } = await supabase.from("stock_movements").insert({
        user_id: user!.id,
        product_id: movForm.product_id,
        tipo: movForm.tipo,
        quantidade: qty,
        estoque_anterior: estoqueAnterior,
        estoque_posterior: estoquePosterior,
        motivo: movForm.motivo || null,
      });
      if (movError) throw movError;

      const { error: updateError } = await supabase
        .from("products")
        .update({ estoque_atual: estoquePosterior })
        .eq("id", movForm.product_id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Movimentação registrada!" });
      setOpenMovement(false);
      setMovForm({ product_id: "", tipo: "entrada", quantidade: "", motivo: "" });
    },
    onError: (err: any) => toast({ title: err.message || "Erro ao registrar movimentação", variant: "destructive" }),
  });

  const filtered = movements.filter((m: any) => {
    const productName = m.products?.nome || "";
    const matchSearch = productName.toLowerCase().includes(search.toLowerCase()) || m.motivo?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "todos" || m.tipo === typeFilter;
    return matchSearch && matchType;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tipoIcon = (tipo: string) => {
    if (tipo === "entrada") return <ArrowUpCircle className="h-4 w-4 text-success" />;
    if (tipo === "saida") return <ArrowDownCircle className="h-4 w-4 text-destructive" />;
    return <RefreshCw className="h-4 w-4 text-primary" />;
  };

  const tipoLabel = (tipo: string) => {
    if (tipo === "entrada") return "Entrada";
    if (tipo === "saida") return "Saída";
    return "Ajuste";
  };

  const tipoColor = (tipo: string) => {
    if (tipo === "entrada") return "bg-success/10 text-success";
    if (tipo === "saida") return "bg-destructive/10 text-destructive";
    return "bg-primary/10 text-primary";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por produto ou motivo..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-10 bg-card border-border/50" />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-10 bg-card border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
            <SelectItem value="ajuste">Ajustes</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-2 gradient-primary shadow-glow" onClick={() => setOpenMovement(true)}>
          <Plus className="h-4 w-4" />Nova Movimentação
        </Button>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Data</TableHead>
                <TableHead className="font-semibold">Produto</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Qtd</TableHead>
                <TableHead className="font-semibold">Estoque</TableHead>
                <TableHead className="font-semibold">Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Nenhuma movimentação encontrada</TableCell></TableRow>
              ) : paginated.map((m: any) => (
                <TableRow key={m.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(m.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {m.products?.foto_url ? (
                        <img src={m.products.foto_url} alt="" className="w-7 h-7 rounded object-cover border border-border/50" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center">
                          <PackageIcon className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <span className="text-sm font-medium">{m.products?.nome || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {tipoIcon(m.tipo)}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${tipoColor(m.tipo)}`}>
                        {tipoLabel(m.tipo)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-semibold">
                    {m.tipo === "entrada" ? "+" : m.tipo === "saida" ? "−" : ""}{m.quantidade}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.estoque_anterior} → <span className="font-semibold text-foreground">{m.estoque_posterior}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.motivo || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* New Movement Dialog */}
      <Dialog open={openMovement} onOpenChange={setOpenMovement}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-primary-foreground" />
              </div>
              Nova Movimentação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Produto *</Label>
              <Select value={movForm.product_id} onValueChange={v => setMovForm(f => ({ ...f, product_id: v }))}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} (estoque: {p.estoque_atual})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tipo *</Label>
              <Select value={movForm.tipo} onValueChange={v => setMovForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste (definir estoque)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {movForm.tipo === "ajuste" ? "Novo estoque *" : "Quantidade *"}
              </Label>
              <Input type="number" min="0" value={movForm.quantidade} onChange={e => setMovForm(f => ({ ...f, quantidade: e.target.value }))} className="h-10" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Motivo</Label>
              <Input value={movForm.motivo} onChange={e => setMovForm(f => ({ ...f, motivo: e.target.value }))} className="h-10" placeholder="Ex: Compra fornecedor, Venda balcão..." />
            </div>
            <Button
              className="w-full h-11 gradient-primary font-semibold"
              disabled={!movForm.product_id || !movForm.quantidade || movementMutation.isPending}
              onClick={() => movementMutation.mutate()}
            >
              {movementMutation.isPending ? "Registrando..." : "Registrar Movimentação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
