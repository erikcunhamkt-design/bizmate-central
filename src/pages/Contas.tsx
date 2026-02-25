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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Plus, CheckCircle } from "lucide-react";

const categorias = ["Aluguel", "Fornecedor", "Salário", "Internet", "Luz", "Água", "Outros"];

export default function Contas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(searchParams.get("nova") === "1");
  const [form, setForm] = useState({
    descricao: "", categoria: "Outros", valor: "", vencimento_data: "", recorrente: false, recorrencia_tipo: "mensal",
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("vencimento_data");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        descricao: form.descricao,
        categoria: form.categoria,
        valor: Number(form.valor),
        vencimento_data: form.vencimento_data,
        recorrente: form.recorrente,
        recorrencia_tipo: form.recorrente ? form.recorrencia_tipo : null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Conta criada!" });
      setOpen(false);
      setForm({ descricao: "", categoria: "Outros", valor: "", vencimento_data: "", recorrente: false, recorrencia_tipo: "mensal" });
    },
    onError: () => toast({ title: "Erro ao criar conta", variant: "destructive" }),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const exp = expenses.find(e => e.id === id);
      const { error } = await supabase.from("expenses").update({ status: "pago", pago_em: today }).eq("id", id);
      if (error) throw error;
      if (exp) {
        await supabase.from("cash_movements").insert({
          user_id: user!.id,
          tipo: "saida",
          valor: exp.valor,
          origem: "conta",
          ref_id: id,
          descricao: exp.descricao,
          data: today,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Conta marcada como paga!" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contas a Pagar</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
              </div>
              <div><Label>Vencimento *</Label><Input type="date" value={form.vencimento_data} onChange={e => setForm(f => ({ ...f, vencimento_data: e.target.value }))} /></div>
              <div className="flex items-center gap-3">
                <Switch checked={form.recorrente} onCheckedChange={v => setForm(f => ({ ...f, recorrente: v }))} />
                <Label>Recorrente</Label>
                {form.recorrente && (
                  <Select value={form.recorrencia_tipo} onValueChange={v => setForm(f => ({ ...f, recorrencia_tipo: v }))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button className="w-full" disabled={!form.descricao || !form.valor || !form.vencimento_data || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : expenses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma conta cadastrada</TableCell></TableRow>
              ) : expenses.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{format(new Date(e.vencimento_data), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{e.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{e.categoria}</TableCell>
                  <TableCell>{formatBRL(e.valor)}</TableCell>
                  <TableCell><StatusBadge status={e.status} vencimento={e.vencimento_data} /></TableCell>
                  <TableCell>
                    {e.status === "pendente" && (
                      <Button size="sm" variant="ghost" className="gap-1 text-success" onClick={() => markPaid.mutate(e.id)} disabled={markPaid.isPending}>
                        <CheckCircle className="h-4 w-4" />Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
