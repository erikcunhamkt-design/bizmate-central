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
import { Plus, CheckCircle, FileText, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

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
        descricao: form.descricao, categoria: form.categoria, valor: Number(form.valor),
        vencimento_data: form.vencimento_data, recorrente: form.recorrente,
        recorrencia_tipo: form.recorrente ? form.recorrencia_tipo : null, user_id: user!.id,
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
          user_id: user!.id, tipo: "saida", valor: exp.valor, origem: "conta",
          ref_id: id, descricao: exp.descricao, data: today,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Conta marcada como paga!" });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Conta excluída!" });
    },
  });

  const pendingTotal = expenses.filter(e => e.status === "pendente").reduce((s, e) => s + e.valor, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">
            {expenses.length} contas • <span className="text-warning font-semibold">{formatBRL(pendingTotal)} pendente</span>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 gradient-primary shadow-glow"><Plus className="h-4 w-4" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary-foreground" />
                </div>
                Nova Conta
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="h-10" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} className="h-10" /></div>
              </div>
              <div className="space-y-1.5"><Label>Vencimento *</Label><Input type="date" value={form.vencimento_data} onChange={e => setForm(f => ({ ...f, vencimento_data: e.target.value }))} className="h-10" /></div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                <Switch checked={form.recorrente} onCheckedChange={v => setForm(f => ({ ...f, recorrente: v }))} />
                <Label className="text-sm font-medium">Recorrente</Label>
                {form.recorrente && (
                  <Select value={form.recorrencia_tipo} onValueChange={v => setForm(f => ({ ...f, recorrencia_tipo: v }))}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button className="w-full h-10 gradient-primary" disabled={!form.descricao || !form.valor || !form.vencimento_data || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Salvando..." : "Salvar Conta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Vencimento</TableHead>
                <TableHead className="font-semibold">Descrição</TableHead>
                <TableHead className="font-semibold">Categoria</TableHead>
                <TableHead className="font-semibold">Valor</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : expenses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma conta cadastrada</TableCell></TableRow>
              ) : expenses.map(e => (
                <TableRow key={e.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="text-sm">{format(new Date(e.vencimento_data), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-semibold text-sm">{e.descricao}</TableCell>
                  <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-md">{e.categoria}</span></TableCell>
                  <TableCell className="font-semibold text-sm">{formatBRL(e.valor)}</TableCell>
                  <TableCell><StatusBadge status={e.status} vencimento={e.vencimento_data} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {e.status === "pendente" && (
                        <Button size="sm" variant="ghost" className="gap-1 h-8 text-success hover:bg-success/10" onClick={() => markPaid.mutate(e.id)} disabled={markPaid.isPending}>
                          <CheckCircle className="h-3.5 w-3.5" />Pagar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => deleteExpense.mutate(e.id)}>
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
    </motion.div>
  );
}
